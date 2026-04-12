use super::models::*;
use rusqlite::{params, Connection};

// --- Sources ---

pub fn insert_source(
    conn: &Connection,
    path: &str,
    name: &str,
    is_folder: bool,
) -> Result<i64, rusqlite::Error> {
    conn.execute(
        "INSERT OR IGNORE INTO sources (path, name, is_folder) VALUES (?1, ?2, ?3)",
        params![path, name, is_folder as i32],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn get_sources(conn: &Connection) -> Result<Vec<Source>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT id, path, name, content_hash, last_scanned, is_folder, created_at FROM sources ORDER BY name",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(Source {
            id: row.get(0)?,
            path: row.get(1)?,
            name: row.get(2)?,
            content_hash: row.get(3)?,
            last_scanned: row.get(4)?,
            is_folder: row.get::<_, i32>(5)? != 0,
            created_at: row.get(6)?,
        })
    })?;
    rows.collect()
}

pub fn delete_source(conn: &Connection, id: i64) -> Result<(), rusqlite::Error> {
    conn.execute("DELETE FROM sources WHERE id = ?1", [id])?;
    Ok(())
}

// --- Cards ---

pub fn get_all_cards(conn: &Connection) -> Result<Vec<Card>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT c.id, c.source_id, c.type, c.front, c.back, c.meaning_hash, c.tags, c.manual, c.created_at,
                cs.stability, cs.difficulty, cs.due_date, cs.status, cs.review_count
         FROM cards c
         LEFT JOIN card_states cs ON cs.card_id = c.id
         ORDER BY c.created_at DESC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(Card {
            id: row.get(0)?,
            source_id: row.get(1)?,
            card_type: row.get(2)?,
            front: row.get(3)?,
            back: row.get(4)?,
            meaning_hash: row.get(5)?,
            tags: row.get(6)?,
            manual: row.get::<_, i32>(7)? != 0,
            created_at: row.get(8)?,
            stability: row.get(9)?,
            difficulty: row.get(10)?,
            due_date: row.get(11)?,
            status: row.get(12)?,
            review_count: row.get(13)?,
        })
    })?;
    rows.collect()
}

pub fn insert_card(
    conn: &Connection,
    source_id: Option<i64>,
    card_type: &str,
    front: &str,
    back: &str,
    meaning_hash: &str,
    manual: bool,
) -> Result<i64, rusqlite::Error> {
    conn.execute(
        "INSERT INTO cards (source_id, type, front, back, meaning_hash, manual) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![source_id, card_type, front, back, meaning_hash, manual as i32],
    )?;
    let card_id = conn.last_insert_rowid();
    conn.execute("INSERT INTO card_states (card_id) VALUES (?1)", [card_id])?;
    Ok(card_id)
}

pub fn insert_cards_batch(
    conn: &Connection,
    source_id: Option<i64>,
    cards: &[(String, String, String, String)], // (type, front, back, hash)
) -> Result<Vec<i64>, rusqlite::Error> {
    let tx = conn.unchecked_transaction()?;
    let mut ids = Vec::with_capacity(cards.len());

    {
        let mut card_stmt =
            tx.prepare("INSERT INTO cards (source_id, type, front, back, meaning_hash) VALUES (?1, ?2, ?3, ?4, ?5)")?;
        let mut state_stmt = tx.prepare("INSERT INTO card_states (card_id) VALUES (?1)")?;

        for (card_type, front, back, hash) in cards {
            card_stmt.execute(params![source_id, card_type, front, back, hash])?;
            let card_id = tx.last_insert_rowid();
            state_stmt.execute([card_id])?;
            ids.push(card_id);
        }
    }

    tx.commit()?;
    Ok(ids)
}

pub fn update_card(
    conn: &Connection,
    id: i64,
    front: &str,
    back: &str,
    card_type: &str,
) -> Result<(), rusqlite::Error> {
    let hash = compute_meaning_hash(front, back);
    conn.execute(
        "UPDATE cards SET front = ?1, back = ?2, type = ?3, meaning_hash = ?4 WHERE id = ?5",
        params![front, back, card_type, hash, id],
    )?;
    Ok(())
}

pub fn delete_card(conn: &Connection, id: i64) -> Result<(), rusqlite::Error> {
    conn.execute("DELETE FROM cards WHERE id = ?1", [id])?;
    Ok(())
}

pub fn delete_cards_bulk(conn: &Connection, ids: &[i64]) -> Result<(), rusqlite::Error> {
    let tx = conn.unchecked_transaction()?;
    {
        let mut stmt = tx.prepare("DELETE FROM cards WHERE id = ?1")?;
        for &id in ids {
            stmt.execute([id])?;
        }
    }
    tx.commit()?;
    Ok(())
}

// --- Study ---

pub fn get_due_cards(conn: &Connection, limit: i64) -> Result<Vec<StudyCard>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT c.id, c.type, c.front, c.back, cs.stability, cs.difficulty, cs.review_count, s.name
         FROM cards c
         JOIN card_states cs ON cs.card_id = c.id
         LEFT JOIN sources s ON s.id = c.source_id
         WHERE cs.due_date <= datetime('now')
         ORDER BY cs.due_date ASC
         LIMIT ?1",
    )?;
    let rows = stmt.query_map([limit], |row| {
        Ok(StudyCard {
            id: row.get(0)?,
            card_type: row.get(1)?,
            front: row.get(2)?,
            back: row.get(3)?,
            stability: row.get(4)?,
            difficulty: row.get(5)?,
            review_count: row.get(6)?,
            source_name: row.get(7)?,
        })
    })?;
    rows.collect()
}

pub fn update_card_state(
    conn: &Connection,
    card_id: i64,
    stability: f64,
    difficulty: f64,
    due_date: &str,
    status: &str,
) -> Result<(), rusqlite::Error> {
    conn.execute(
        "UPDATE card_states SET stability = ?1, difficulty = ?2, due_date = ?3, status = ?4,
         last_review = datetime('now'), review_count = review_count + 1
         WHERE card_id = ?5",
        params![stability, difficulty, due_date, status, card_id],
    )?;
    Ok(())
}

pub fn insert_review(
    conn: &Connection,
    card_id: i64,
    rating: i32,
    elapsed_days: f64,
) -> Result<(), rusqlite::Error> {
    conn.execute(
        "INSERT INTO reviews (card_id, rating, elapsed_days) VALUES (?1, ?2, ?3)",
        params![card_id, rating, elapsed_days],
    )?;
    Ok(())
}

pub fn get_study_stats(conn: &Connection) -> Result<StudyStats, rusqlite::Error> {
    let total_cards: i64 = conn.query_row("SELECT COUNT(*) FROM cards", [], |r| r.get(0))?;
    let due_today: i64 = conn.query_row(
        "SELECT COUNT(*) FROM card_states WHERE due_date <= datetime('now')",
        [],
        |r| r.get(0),
    )?;
    let new_cards: i64 = conn.query_row(
        "SELECT COUNT(*) FROM card_states WHERE status = 'new'",
        [],
        |r| r.get(0),
    )?;
    let learning_cards: i64 = conn.query_row(
        "SELECT COUNT(*) FROM card_states WHERE status IN ('learning', 'relearning')",
        [],
        |r| r.get(0),
    )?;
    let review_cards: i64 = conn.query_row(
        "SELECT COUNT(*) FROM card_states WHERE status = 'review'",
        [],
        |r| r.get(0),
    )?;
    let reviews_today: i64 = conn.query_row(
        "SELECT COUNT(*) FROM reviews WHERE date(reviewed_at) = date('now')",
        [],
        |r| r.get(0),
    )?;

    // Streak: count consecutive days with reviews going backwards from today
    let streak_days = compute_streak(conn)?;

    Ok(StudyStats {
        total_cards,
        due_today,
        new_cards,
        learning_cards,
        review_cards,
        reviews_today,
        streak_days,
    })
}

fn compute_streak(conn: &Connection) -> Result<i64, rusqlite::Error> {
    let mut stmt = conn
        .prepare("SELECT DISTINCT date(reviewed_at) as d FROM reviews ORDER BY d DESC LIMIT 365")?;
    let dates: Vec<String> = stmt
        .query_map([], |row| row.get(0))?
        .collect::<Result<Vec<_>, _>>()?;

    if dates.is_empty() {
        return Ok(0);
    }

    let today = chrono::Utc::now().format("%Y-%m-%d").to_string();
    let mut streak = 0i64;
    let mut expected = today;

    for date in &dates {
        if *date == expected {
            streak += 1;
            if let Ok(d) = chrono::NaiveDate::parse_from_str(&expected, "%Y-%m-%d") {
                expected = (d - chrono::Duration::days(1))
                    .format("%Y-%m-%d")
                    .to_string();
            } else {
                break;
            }
        } else {
            break;
        }
    }

    Ok(streak)
}

// --- Settings ---

pub fn get_setting(conn: &Connection, key: &str) -> Result<String, rusqlite::Error> {
    conn.query_row("SELECT value FROM settings WHERE key = ?1", [key], |row| {
        row.get(0)
    })
}

pub fn set_setting(conn: &Connection, key: &str, value: &str) -> Result<(), rusqlite::Error> {
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![key, value],
    )?;
    Ok(())
}

pub fn compute_meaning_hash(front: &str, back: &str) -> String {
    let normalized = format!(
        "{}|{}",
        front.trim().to_lowercase(),
        back.trim().to_lowercase()
    );
    blake3::hash(normalized.as_bytes()).to_hex().to_string()
}
