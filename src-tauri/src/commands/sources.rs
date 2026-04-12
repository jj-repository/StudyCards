use crate::db::{self, DbState, Source};
use std::path::Path;

#[tauri::command]
pub fn add_source(
    db: tauri::State<'_, DbState>,
    path: String,
    is_folder: bool,
) -> Result<i64, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let name = Path::new(&path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| path.clone());
    db::insert_source(&conn, &path, &name, is_folder).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_sources(db: tauri::State<'_, DbState>) -> Result<Vec<Source>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    db::get_sources(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn remove_source(db: tauri::State<'_, DbState>, id: i64) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    db::delete_source(&conn, id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn read_source_content(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| format!("Failed to read {path}: {e}"))
}
