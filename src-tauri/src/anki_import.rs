use crate::db::GeneratedCard;
use rusqlite::Connection;
use std::io::Read;

/// Import cards from an Anki .apkg file.
/// Returns a list of GeneratedCard for review before saving.
pub fn import_apkg(path: &str) -> Result<Vec<GeneratedCard>, String> {
    let file = std::fs::File::open(path).map_err(|e| format!("Cannot open file: {e}"))?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| format!("Invalid .apkg: {e}"))?;

    // Find the SQLite database inside the zip
    let db_name = find_db_name(&mut archive)?;

    let mut db_bytes = Vec::new();
    archive
        .by_name(&db_name)
        .map_err(|e| format!("Cannot read {db_name}: {e}"))?
        .read_to_end(&mut db_bytes)
        .map_err(|e| format!("Read error: {e}"))?;

    // Write to temp file for rusqlite
    let tmp = std::env::temp_dir().join("studycards_anki_import.db");
    std::fs::write(&tmp, &db_bytes).map_err(|e| format!("Cannot write temp db: {e}"))?;

    let conn = Connection::open(&tmp).map_err(|e| format!("Cannot open Anki db: {e}"))?;
    let cards = extract_cards(&conn)?;

    // Cleanup
    let _ = std::fs::remove_file(&tmp);

    if cards.is_empty() {
        return Err("No cards found in .apkg file".into());
    }

    Ok(cards)
}

fn find_db_name(archive: &mut zip::ZipArchive<std::fs::File>) -> Result<String, String> {
    for i in 0..archive.len() {
        if let Ok(file) = archive.by_index(i) {
            let name = file.name().to_string();
            if name == "collection.anki21"
                || name == "collection.anki2"
                || name == "collection.anki21b"
            {
                return Ok(name);
            }
        }
    }
    Err("No Anki collection database found in .apkg".into())
}

fn extract_cards(conn: &Connection) -> Result<Vec<GeneratedCard>, String> {
    // Anki schema: notes table has `flds` (fields separated by \x1f)
    // The first field is typically the front, second is the back
    let mut stmt = conn
        .prepare("SELECT flds FROM notes")
        .map_err(|e| format!("Query error: {e}"))?;

    let rows = stmt
        .query_map([], |row| {
            let flds: String = row.get(0)?;
            Ok(flds)
        })
        .map_err(|e| format!("Query error: {e}"))?;

    let mut cards = Vec::new();
    for row in rows {
        let flds = row.map_err(|e| format!("Row error: {e}"))?;
        let fields: Vec<&str> = flds.split('\x1f').collect();
        if fields.len() >= 2 {
            let front = strip_html(fields[0]);
            let back = strip_html(fields[1]);
            if !front.is_empty() && !back.is_empty() {
                cards.push(GeneratedCard {
                    card_type: "qa".into(),
                    question: Some(front),
                    answer: Some(back),
                    text: None,
                });
            }
        }
    }

    Ok(cards)
}

fn strip_html(s: &str) -> String {
    let mut result = String::with_capacity(s.len());
    let mut in_tag = false;
    for c in s.chars() {
        match c {
            '<' => in_tag = true,
            '>' => in_tag = false,
            _ if !in_tag => result.push(c),
            _ => {}
        }
    }
    result.trim().to_string()
}
