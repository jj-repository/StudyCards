use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Source {
    pub id: i64,
    pub path: String,
    pub name: String,
    pub content_hash: Option<String>,
    pub last_scanned: Option<String>,
    pub is_folder: bool,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Card {
    pub id: i64,
    pub source_id: Option<i64>,
    pub card_type: String,
    pub front: String,
    pub back: String,
    pub meaning_hash: String,
    pub tags: String,
    pub manual: bool,
    pub created_at: String,
    // Joined fields from card_states
    pub stability: Option<f64>,
    pub difficulty: Option<f64>,
    pub due_date: Option<String>,
    pub status: Option<String>,
    pub review_count: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StudyCard {
    pub id: i64,
    pub card_type: String,
    pub front: String,
    pub back: String,
    pub stability: f64,
    pub difficulty: f64,
    pub review_count: i64,
    pub source_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StudyStats {
    pub total_cards: i64,
    pub due_today: i64,
    pub new_cards: i64,
    pub learning_cards: i64,
    pub review_cards: i64,
    pub reviews_today: i64,
    pub streak_days: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StudyConfig {
    pub daily_review_limit: i64,
    pub new_cards_per_session: i64,
    pub target_retention: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GeneratedCard {
    #[serde(rename = "type")]
    pub card_type: String,
    pub question: Option<String>,
    pub answer: Option<String>,
    pub text: Option<String>,
}
