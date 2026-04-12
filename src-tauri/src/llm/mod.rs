mod providers;

pub use providers::*;

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tokio::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone)]
pub struct ChatRequest {
    pub model: String,
    pub messages: Vec<ChatMessage>,
    pub temperature: Option<f32>,
    pub max_tokens: Option<u32>,
    pub json_mode: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatResponse {
    pub content: String,
    pub model: String,
    pub input_tokens: Option<u32>,
    pub output_tokens: Option<u32>,
}

#[derive(Debug, thiserror::Error)]
pub enum LlmError {
    #[error("HTTP error: {0}")]
    Http(#[from] reqwest::Error),
    #[error("API error ({status}): {message}")]
    Api { status: u16, message: String },
    #[error("Rate limited, retry after {retry_after_secs:?}s")]
    RateLimited { retry_after_secs: Option<u64> },
    #[error("Authentication failed")]
    AuthFailed,
    #[error("Request timeout")]
    Timeout,
    #[error("JSON parse error: {0}")]
    Parse(#[from] serde_json::Error),
    #[error("Provider unavailable: {0}")]
    Unavailable(String),
}

#[async_trait]
pub trait LlmProvider: Send + Sync {
    async fn chat(&self, request: ChatRequest) -> Result<ChatResponse, LlmError>;
    async fn list_models(&self) -> Result<Vec<String>, LlmError>;
    async fn health_check(&self) -> Result<bool, LlmError>;
    fn name(&self) -> &str;
}

pub struct LlmRegistry {
    providers: HashMap<String, Box<dyn LlmProvider>>,
    active: Option<String>,
}

pub struct LlmState(pub Mutex<LlmRegistry>);

impl LlmRegistry {
    pub fn new() -> Self {
        Self {
            providers: HashMap::new(),
            active: None,
        }
    }

    pub fn register(&mut self, key: &str, provider: Box<dyn LlmProvider>) {
        if self.active.is_none() {
            self.active = Some(key.to_string());
        }
        self.providers.insert(key.to_string(), provider);
    }

    pub fn set_active(&mut self, key: &str) -> Result<(), LlmError> {
        if self.providers.contains_key(key) {
            self.active = Some(key.to_string());
            Ok(())
        } else {
            Err(LlmError::Unavailable(format!("Unknown provider: {key}")))
        }
    }

    pub fn active(&self) -> Result<&dyn LlmProvider, LlmError> {
        let key = self
            .active
            .as_ref()
            .ok_or_else(|| LlmError::Unavailable("No active provider configured".into()))?;
        self.providers
            .get(key)
            .map(|p| p.as_ref())
            .ok_or_else(|| LlmError::Unavailable("Active provider not found".into()))
    }
}

pub fn card_generation_messages(markdown_content: &str) -> Vec<ChatMessage> {
    vec![
        ChatMessage {
            role: "system".into(),
            content: "You are a flashcard generator. Extract key concepts from the provided text \
                      and create study cards.\n\n\
                      Rules:\n\
                      - Mix of Q/A and cloze deletion cards\n\
                      - Each card tests ONE concept\n\
                      - Focus: definitions, relationships, processes, key facts\n\
                      - Skip trivial content (section titles, dates alone, metadata)\n\
                      - Cloze: hide the KEY term, not filler words\n\
                      - Return ONLY a valid JSON array, no markdown fences, no explanation\n\n\
                      Format:\n\
                      [{\"type\":\"qa\",\"question\":\"...\",\"answer\":\"...\"},\
                      {\"type\":\"cloze\",\"text\":\"The [hidden] does X\",\"answer\":\"hidden\"}]"
                .into(),
        },
        ChatMessage {
            role: "user".into(),
            content: format!("Generate flashcards from this text:\n\n{markdown_content}"),
        },
    ]
}

/// Extract JSON from LLM response, handling markdown code fences.
pub fn extract_json(raw: &str) -> Result<serde_json::Value, LlmError> {
    let trimmed = raw.trim();

    if let Ok(val) = serde_json::from_str(trimmed) {
        return Ok(val);
    }

    // Strip markdown code fences
    let stripped = if trimmed.starts_with("```") {
        let start = trimmed.find('\n').map(|i| i + 1).unwrap_or(0);
        let end = trimmed.rfind("```").unwrap_or(trimmed.len());
        &trimmed[start..end]
    } else {
        trimmed
    };

    serde_json::from_str(stripped.trim()).map_err(LlmError::Parse)
}
