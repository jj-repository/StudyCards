use crate::db::{self, DbState, GeneratedCard};
use crate::llm::{
    card_generation_messages, extract_json, ChatRequest, ClaudeProvider, LlmState,
    OpenAiCompatProvider,
};
use crate::rule_gen;

#[tauri::command]
pub async fn generate_cards(
    llm_state: tauri::State<'_, LlmState>,
    content: String,
    model: String,
) -> Result<Vec<GeneratedCard>, String> {
    let messages = card_generation_messages(&content);

    let request = ChatRequest {
        model,
        messages,
        temperature: Some(0.7),
        max_tokens: Some(4096),
        json_mode: true,
    };

    let response = {
        let registry = llm_state.0.lock().await;
        let provider = registry.active().map_err(|e| e.to_string())?;
        provider.chat(request).await.map_err(|e| e.to_string())?
    };

    let json = extract_json(&response.content).map_err(|e| e.to_string())?;
    let cards: Vec<GeneratedCard> =
        serde_json::from_value(json).map_err(|e| format!("Failed to parse cards: {e}"))?;

    Ok(cards)
}

#[tauri::command]
pub fn save_generated_cards(
    db: tauri::State<'_, DbState>,
    source_id: Option<i64>,
    cards: Vec<GeneratedCard>,
) -> Result<Vec<i64>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    let batch: Vec<(String, String, String, String)> = cards
        .into_iter()
        .filter_map(|c| {
            let (card_type, front, back) = match c.card_type.as_str() {
                "qa" => ("qa".to_string(), c.question?, c.answer?),
                "cloze" => {
                    let text = c.text?;
                    let answer = c.answer.unwrap_or_default();
                    ("cloze".to_string(), text, answer)
                }
                _ => return None,
            };
            let hash = db::compute_meaning_hash(&front, &back);
            Some((card_type, front, back, hash))
        })
        .collect();

    db::insert_cards_batch(&conn, source_id, &batch).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn configure_provider(
    llm_state: tauri::State<'_, LlmState>,
    provider: String,
    api_key: Option<String>,
    _base_url: Option<String>,
) -> Result<(), String> {
    let mut registry = llm_state.0.blocking_lock();

    match provider.as_str() {
        "ollama" => {
            registry.register("ollama", Box::new(OpenAiCompatProvider::ollama()));
        }
        "openai" => {
            let key = api_key.ok_or("OpenAI API key required")?;
            registry.register("openai", Box::new(OpenAiCompatProvider::openai(key)));
        }
        "gemini" => {
            let key = api_key.ok_or("Gemini API key required")?;
            registry.register("gemini", Box::new(OpenAiCompatProvider::gemini(key)));
        }
        "claude" => {
            let key = api_key.ok_or("Claude API key required")?;
            registry.register("claude", Box::new(ClaudeProvider::new(key)));
        }
        _ => return Err(format!("Unknown provider: {provider}")),
    }

    registry.set_active(&provider).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn test_connection(llm_state: tauri::State<'_, LlmState>) -> Result<bool, String> {
    let registry = llm_state.0.lock().await;
    let provider = registry.active().map_err(|e| e.to_string())?;
    provider.health_check().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_models(llm_state: tauri::State<'_, LlmState>) -> Result<Vec<String>, String> {
    let registry = llm_state.0.lock().await;
    let provider = registry.active().map_err(|e| e.to_string())?;
    provider.list_models().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn detect_ollama() -> Result<bool, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(3))
        .build()
        .map_err(|e| e.to_string())?;
    match client.get("http://localhost:11434/").send().await {
        Ok(resp) => Ok(resp.status().is_success()),
        Err(_) => Ok(false),
    }
}

#[tauri::command]
pub fn generate_cards_rules(content: String) -> Result<Vec<GeneratedCard>, String> {
    let cards = rule_gen::generate_from_markdown(&content);
    if cards.is_empty() {
        return Err("No cards could be extracted from this document".into());
    }
    Ok(cards)
}

#[tauri::command]
pub fn import_anki(path: String) -> Result<Vec<GeneratedCard>, String> {
    crate::anki_import::import_apkg(&path)
}

#[tauri::command]
pub fn export_anki(
    db: tauri::State<'_, DbState>,
    output_path: String,
    deck_name: String,
) -> Result<String, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    crate::anki_export::export_apkg(&conn, &output_path, &deck_name)
}
