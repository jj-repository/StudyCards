use crate::db::{self, DbState, StudyCard, StudyConfig, StudyStats};
use crate::fsrs_engine::Scheduler;

#[tauri::command]
pub fn get_due_cards(
    db: tauri::State<'_, DbState>,
    limit: Option<i64>,
) -> Result<Vec<StudyCard>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    let new_cap: i64 = db::get_setting(&conn, "new_cards_per_session")
        .unwrap_or_else(|_| "20".into())
        .parse()
        .unwrap_or(20);

    let daily_limit: i64 = db::get_setting(&conn, "daily_review_limit")
        .unwrap_or_else(|_| "0".into())
        .parse()
        .unwrap_or(0);

    let effective_limit = if daily_limit > 0 {
        daily_limit
    } else {
        limit.unwrap_or(50)
    };

    let mut cards = db::get_due_cards(&conn, effective_limit).map_err(|e| e.to_string())?;

    // Cap new cards per session
    if new_cap > 0 {
        let mut new_count = 0i64;
        cards.retain(|c| {
            if c.review_count == 0 {
                new_count += 1;
                new_count <= new_cap
            } else {
                true
            }
        });
    }

    Ok(cards)
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
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    let retention: f32 = db::get_setting(&conn, "target_retention")
        .unwrap_or_else(|_| "0.9".into())
        .parse()
        .unwrap_or(0.9);

    let scheduler = Scheduler::new(retention);
    let (new_stability, new_difficulty, interval_days, new_status) =
        scheduler.review(stability, difficulty, review_count, days_elapsed, rating)?;

    let due_date = if interval_days < 1.0 {
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

#[tauri::command]
pub fn get_study_config(db: tauri::State<'_, DbState>) -> Result<StudyConfig, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let daily_review_limit = db::get_setting(&conn, "daily_review_limit")
        .unwrap_or_else(|_| "0".into())
        .parse()
        .unwrap_or(0);
    let new_cards_per_session = db::get_setting(&conn, "new_cards_per_session")
        .unwrap_or_else(|_| "20".into())
        .parse()
        .unwrap_or(20);
    let target_retention = db::get_setting(&conn, "target_retention")
        .unwrap_or_else(|_| "0.9".into())
        .parse()
        .unwrap_or(0.9);
    Ok(StudyConfig {
        daily_review_limit,
        new_cards_per_session,
        target_retention,
    })
}

#[tauri::command]
pub fn save_study_config(db: tauri::State<'_, DbState>, config: StudyConfig) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    db::set_setting(
        &conn,
        "daily_review_limit",
        &config.daily_review_limit.to_string(),
    )
    .map_err(|e| e.to_string())?;
    db::set_setting(
        &conn,
        "new_cards_per_session",
        &config.new_cards_per_session.to_string(),
    )
    .map_err(|e| e.to_string())?;
    db::set_setting(
        &conn,
        "target_retention",
        &config.target_retention.to_string(),
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}
