use crate::db::DbState;
use rusqlite::params;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Deck {
    pub id: i64,
    pub name: String,
    pub card_count: i64,
}

#[tauri::command]
pub fn list_decks(db: tauri::State<'_, DbState>) -> Result<Vec<Deck>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT d.id, d.name, COUNT(c.id) as cnt
             FROM decks d
             LEFT JOIN cards c ON c.deck_id = d.id
             GROUP BY d.id
             ORDER BY d.name ASC",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(Deck {
                id: row.get(0)?,
                name: row.get(1)?,
                card_count: row.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_deck(db: tauri::State<'_, DbState>, name: String) -> Result<i64, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute("INSERT INTO decks (name) VALUES (?1)", params![name])
        .map_err(|e| e.to_string())?;
    Ok(conn.last_insert_rowid())
}

#[tauri::command]
pub fn rename_deck(db: tauri::State<'_, DbState>, id: i64, name: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE decks SET name = ?1 WHERE id = ?2",
        params![name, id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_deck(db: tauri::State<'_, DbState>, id: i64) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    // Move cards to NULL deck, then delete
    conn.execute(
        "UPDATE cards SET deck_id = NULL WHERE deck_id = ?1",
        params![id],
    )
    .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM decks WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn move_cards_to_deck(
    db: tauri::State<'_, DbState>,
    card_ids: Vec<i64>,
    deck_id: Option<i64>,
) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("UPDATE cards SET deck_id = ?1 WHERE id = ?2")
        .map_err(|e| e.to_string())?;
    for id in card_ids {
        stmt.execute(params![deck_id, id])
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn update_card_tags(
    db: tauri::State<'_, DbState>,
    card_id: i64,
    tags: String,
) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE cards SET tags = ?1 WHERE id = ?2",
        params![tags, card_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}
