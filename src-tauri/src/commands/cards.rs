use crate::db::{self, Card, DbState};

#[tauri::command]
pub fn list_cards(db: tauri::State<'_, DbState>) -> Result<Vec<Card>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    db::get_all_cards(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_card(
    db: tauri::State<'_, DbState>,
    card_type: String,
    front: String,
    back: String,
) -> Result<i64, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let hash = db::compute_meaning_hash(&front, &back);
    db::insert_card(&conn, None, &card_type, &front, &back, &hash, true).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_card(
    db: tauri::State<'_, DbState>,
    id: i64,
    front: String,
    back: String,
    card_type: String,
) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    db::update_card(&conn, id, &front, &back, &card_type).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_card(db: tauri::State<'_, DbState>, id: i64) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    db::delete_card(&conn, id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_cards_bulk(db: tauri::State<'_, DbState>, ids: Vec<i64>) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    db::delete_cards_bulk(&conn, &ids).map_err(|e| e.to_string())
}
