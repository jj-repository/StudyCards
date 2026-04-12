use crate::db::{self, DbState, StudyCard, StudyStats};
use crate::fsrs_engine::Scheduler;

#[tauri::command]
pub fn get_due_cards(
    db: tauri::State<'_, DbState>,
    limit: Option<i64>,
) -> Result<Vec<StudyCard>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    db::get_due_cards(&conn, limit.unwrap_or(50)).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn submit_review(
    db: tauri::State<'_, DbState>,
    card_id: i64,
    rating: u32,
    stability: f64,
    difficulty: f64,
    review_count: i64,
    days_elapsed: f64,
) -> Result<(), String> {
    let scheduler = Scheduler::default();
    let (new_stability, new_difficulty, interval_days, new_status) =
        scheduler.review(stability, difficulty, review_count, days_elapsed, rating)?;

    let conn = db.0.lock().map_err(|e| e.to_string())?;

    // Calculate due date
    let due_date = if interval_days < 1.0 {
        // Sub-day interval: add minutes
        let minutes = (interval_days * 1440.0).round() as i64;
        let due = chrono::Utc::now() + chrono::Duration::minutes(minutes);
        due.format("%Y-%m-%d %H:%M:%S").to_string()
    } else {
        let days = interval_days.round() as i64;
        let due = chrono::Utc::now() + chrono::Duration::days(days);
        due.format("%Y-%m-%d %H:%M:%S").to_string()
    };

    db::update_card_state(
        &conn,
        card_id,
        new_stability,
        new_difficulty,
        &due_date,
        &new_status,
    )
    .map_err(|e| e.to_string())?;
    db::insert_review(&conn, card_id, rating as i32, days_elapsed).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn get_study_stats(db: tauri::State<'_, DbState>) -> Result<StudyStats, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    db::get_study_stats(&conn).map_err(|e| e.to_string())
}
