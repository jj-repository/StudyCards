use super::*;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;

// --- OpenAI-compatible provider (covers Ollama, OpenAI, Gemini) ---

pub struct OpenAiCompatProvider {
    client: Client,
    base_url: String,
    api_key: Option<String>,
    provider_name: String,
}

#[derive(Serialize)]
struct OaiRequest {
    model: String,
    messages: Vec<ChatMessage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    temperature: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    max_tokens: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    response_format: Option<ResponseFormat>,
    stream: bool,
}

#[derive(Serialize)]
struct ResponseFormat {
    r#type: String,
}

#[derive(Deserialize)]
struct OaiResponse {
    choices: Vec<OaiChoice>,
    model: String,
    usage: Option<OaiUsage>,
}

#[derive(Deserialize)]
struct OaiChoice {
    message: OaiMessage,
}

#[derive(Deserialize)]
struct OaiMessage {
    content: Option<String>,
}

#[derive(Deserialize)]
struct OaiUsage {
    prompt_tokens: Option<u32>,
    completion_tokens: Option<u32>,
}

#[derive(Deserialize)]
struct OaiModelList {
    data: Vec<OaiModel>,
}

#[derive(Deserialize)]
struct OaiModel {
    id: String,
}

impl OpenAiCompatProvider {
    fn new(base_url: &str, api_key: Option<String>, name: &str) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(120))
            .build()
            .expect("Failed to build HTTP client");
        Self {
            client,
            base_url: base_url.trim_end_matches('/').to_string(),
            api_key,
            provider_name: name.to_string(),
        }
    }

    pub fn ollama() -> Self {
        Self::new("http://localhost:11434/v1", None, "Ollama")
    }

    pub fn openai(api_key: String) -> Self {
        Self::new("https://api.openai.com/v1", Some(api_key), "OpenAI")
    }

    pub fn gemini(api_key: String) -> Self {
        Self::new(
            "https://generativelanguage.googleapis.com/v1beta/openai",
            Some(api_key),
            "Gemini",
        )
    }
}

#[async_trait]
impl LlmProvider for OpenAiCompatProvider {
    async fn chat(&self, request: ChatRequest) -> Result<ChatResponse, LlmError> {
        let url = format!("{}/chat/completions", self.base_url);

        let body = OaiRequest {
            model: request.model,
            messages: request.messages,
            temperature: request.temperature,
            max_tokens: request.max_tokens,
            response_format: if request.json_mode {
                Some(ResponseFormat {
                    r#type: "json_object".to_string(),
                })
            } else {
                None
            },
            stream: false,
        };

        let mut req = self.client.post(&url).json(&body);
        if let Some(ref key) = self.api_key {
            req = req.header("Authorization", format!("Bearer {key}"));
        }

        let resp = req.send().await.map_err(|e| {
            if e.is_timeout() {
                LlmError::Timeout
            } else if e.is_connect() {
                LlmError::Unavailable(self.provider_name.clone())
            } else {
                LlmError::Http(e)
            }
        })?;

        let status = resp.status().as_u16();
        match status {
            200 => {}
            401 | 403 => return Err(LlmError::AuthFailed),
            429 => {
                let retry = resp
                    .headers()
                    .get("retry-after")
                    .and_then(|v| v.to_str().ok())
                    .and_then(|v| v.parse().ok());
                return Err(LlmError::RateLimited {
                    retry_after_secs: retry,
                });
            }
            _ => {
                let msg = resp.text().await.unwrap_or_default();
                return Err(LlmError::Api {
                    status,
                    message: msg,
                });
            }
        }

        let oai: OaiResponse = resp.json().await?;
        let content = oai
            .choices
            .into_iter()
            .next()
            .and_then(|c| c.message.content)
            .unwrap_or_default();

        Ok(ChatResponse {
            content,
            model: oai.model,
            input_tokens: oai.usage.as_ref().and_then(|u| u.prompt_tokens),
            output_tokens: oai.usage.as_ref().and_then(|u| u.completion_tokens),
        })
    }

    async fn list_models(&self) -> Result<Vec<String>, LlmError> {
        let url = format!("{}/models", self.base_url);
        let mut req = self.client.get(&url);
        if let Some(ref key) = self.api_key {
            req = req.header("Authorization", format!("Bearer {key}"));
        }
        let resp = req.send().await?;
        let list: OaiModelList = resp.json().await?;
        Ok(list.data.into_iter().map(|m| m.id).collect())
    }

    async fn health_check(&self) -> Result<bool, LlmError> {
        let url = format!("{}/models", self.base_url);
        let mut req = self.client.get(&url);
        if let Some(ref key) = self.api_key {
            req = req.header("Authorization", format!("Bearer {key}"));
        }
        match req.send().await {
            Ok(resp) => Ok(resp.status().is_success()),
            Err(_) => Ok(false),
        }
    }

    fn name(&self) -> &str {
        &self.provider_name
    }
}

// --- Claude/Anthropic provider ---

pub struct ClaudeProvider {
    client: Client,
    api_key: String,
}

#[derive(Serialize)]
struct ClaudeRequest {
    model: String,
    max_tokens: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    system: Option<String>,
    messages: Vec<ChatMessage>,
}

#[derive(Deserialize)]
struct ClaudeResponse {
    content: Vec<ClaudeContent>,
    model: String,
    usage: ClaudeUsage,
}

#[derive(Deserialize)]
struct ClaudeContent {
    text: String,
}

#[derive(Deserialize)]
struct ClaudeUsage {
    input_tokens: u32,
    output_tokens: u32,
}

impl ClaudeProvider {
    pub fn new(api_key: String) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(120))
            .build()
            .expect("Failed to build HTTP client");
        Self { client, api_key }
    }
}

#[async_trait]
impl LlmProvider for ClaudeProvider {
    async fn chat(&self, request: ChatRequest) -> Result<ChatResponse, LlmError> {
        let mut system_prompt = None;
        let messages: Vec<ChatMessage> = request
            .messages
            .into_iter()
            .filter(|m| {
                if m.role == "system" {
                    system_prompt = Some(m.content.clone());
                    false
                } else {
                    true
                }
            })
            .collect();

        let body = ClaudeRequest {
            model: request.model,
            max_tokens: request.max_tokens.unwrap_or(4096),
            system: system_prompt,
            messages,
        };

        let resp = self
            .client
            .post("https://api.anthropic.com/v1/messages")
            .header("x-api-key", &self.api_key)
            .header("anthropic-version", "2023-06-01")
            .header("content-type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| {
                if e.is_timeout() {
                    LlmError::Timeout
                } else {
                    LlmError::Http(e)
                }
            })?;

        let status = resp.status().as_u16();
        match status {
            200 => {}
            401 => return Err(LlmError::AuthFailed),
            429 => {
                let retry = resp
                    .headers()
                    .get("retry-after")
                    .and_then(|v| v.to_str().ok())
                    .and_then(|v| v.parse().ok());
                return Err(LlmError::RateLimited {
                    retry_after_secs: retry,
                });
            }
            _ => {
                let msg = resp.text().await.unwrap_or_default();
                return Err(LlmError::Api {
                    status,
                    message: msg,
                });
            }
        }

        let claude: ClaudeResponse = resp.json().await?;
        let content = claude
            .content
            .into_iter()
            .map(|c| c.text)
            .collect::<Vec<_>>()
            .join("");

        Ok(ChatResponse {
            content,
            model: claude.model,
            input_tokens: Some(claude.usage.input_tokens),
            output_tokens: Some(claude.usage.output_tokens),
        })
    }

    async fn list_models(&self) -> Result<Vec<String>, LlmError> {
        Ok(vec![
            "claude-sonnet-4-20250514".into(),
            "claude-haiku-4-20250414".into(),
        ])
    }

    async fn health_check(&self) -> Result<bool, LlmError> {
        // Minimal check: try listing models (no API call needed for hardcoded list)
        Ok(true)
    }

    fn name(&self) -> &str {
        "Claude"
    }
}
