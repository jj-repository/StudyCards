use rusqlite::{params, Connection};
use std::io::Write;

/// Export cards to a minimal Anki .apkg file.
/// Returns the path to the generated file.
pub fn export_apkg(
    conn: &Connection,
    output_path: &str,
    deck_name: &str,
) -> Result<String, String> {
    let cards = fetch_cards_for_export(conn)?;
    if cards.is_empty() {
        return Err("No cards to export".into());
    }

    let tmp_db = std::env::temp_dir().join("studycards_export.anki21");
    create_anki_db(&tmp_db, deck_name, &cards)?;

    // Package as .apkg (zip)
    let file =
        std::fs::File::create(output_path).map_err(|e| format!("Cannot create file: {e}"))?;
    let mut zip = zip::ZipWriter::new(file);

    let options =
        zip::write::SimpleFileOptions::default().compression_method(zip::CompressionMethod::Stored);

    zip.start_file("collection.anki21", options)
        .map_err(|e| format!("Zip error: {e}"))?;
    let db_bytes = std::fs::read(&tmp_db).map_err(|e| format!("Read error: {e}"))?;
    zip.write_all(&db_bytes)
        .map_err(|e| format!("Write error: {e}"))?;

    // Empty media file (required by Anki)
    zip.start_file("media", options)
        .map_err(|e| format!("Zip error: {e}"))?;
    zip.write_all(b"{}")
        .map_err(|e| format!("Write error: {e}"))?;

    zip.finish().map_err(|e| format!("Zip finish error: {e}"))?;

    let _ = std::fs::remove_file(&tmp_db);

    Ok(output_path.to_string())
}

struct ExportCard {
    front: String,
    back: String,
}

fn fetch_cards_for_export(conn: &Connection) -> Result<Vec<ExportCard>, String> {
    let mut stmt = conn
        .prepare("SELECT front, back FROM cards")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(ExportCard {
                front: row.get(0)?,
                back: row.get(1)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

fn create_anki_db(
    path: &std::path::Path,
    deck_name: &str,
    cards: &[ExportCard],
) -> Result<(), String> {
    let _ = std::fs::remove_file(path);
    let conn = Connection::open(path).map_err(|e| format!("Cannot create db: {e}"))?;

    conn.execute_batch(
        "CREATE TABLE col (
            id INTEGER PRIMARY KEY,
            crt INTEGER NOT NULL,
            mod INTEGER NOT NULL,
            scm INTEGER NOT NULL,
            ver INTEGER NOT NULL,
            dty INTEGER NOT NULL,
            usn INTEGER NOT NULL,
            ls INTEGER NOT NULL,
            conf TEXT NOT NULL,
            models TEXT NOT NULL,
            decks TEXT NOT NULL,
            dconf TEXT NOT NULL,
            tags TEXT NOT NULL
        );
        CREATE TABLE notes (
            id INTEGER PRIMARY KEY,
            guid TEXT NOT NULL,
            mid INTEGER NOT NULL,
            mod INTEGER NOT NULL,
            usn INTEGER NOT NULL,
            tags TEXT NOT NULL,
            flds TEXT NOT NULL,
            sfld TEXT NOT NULL,
            csum INTEGER NOT NULL,
            flags INTEGER NOT NULL,
            data TEXT NOT NULL
        );
        CREATE TABLE cards (
            id INTEGER PRIMARY KEY,
            nid INTEGER NOT NULL,
            did INTEGER NOT NULL,
            ord INTEGER NOT NULL,
            mod INTEGER NOT NULL,
            usn INTEGER NOT NULL,
            type INTEGER NOT NULL,
            queue INTEGER NOT NULL,
            due INTEGER NOT NULL,
            ivl INTEGER NOT NULL,
            factor INTEGER NOT NULL,
            reps INTEGER NOT NULL,
            lapses INTEGER NOT NULL,
            left INTEGER NOT NULL,
            odue INTEGER NOT NULL,
            odid INTEGER NOT NULL,
            flags INTEGER NOT NULL,
            data TEXT NOT NULL
        );
        CREATE TABLE revlog (
            id INTEGER PRIMARY KEY,
            cid INTEGER NOT NULL,
            usn INTEGER NOT NULL,
            ease INTEGER NOT NULL,
            ivl INTEGER NOT NULL,
            lastIvl INTEGER NOT NULL,
            factor INTEGER NOT NULL,
            time INTEGER NOT NULL,
            type INTEGER NOT NULL
        );
        CREATE TABLE graves (
            usn INTEGER NOT NULL,
            oid INTEGER NOT NULL,
            type INTEGER NOT NULL
        );",
    )
    .map_err(|e| format!("Schema error: {e}"))?;

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;

    let mid: i64 = now * 1000;
    let did: i64 = 1;

    // Minimal model and deck JSON
    let models = format!(
        r#"{{"{mid}":{{"id":{mid},"name":"Basic","type":0,"mod":{now},"usn":-1,"sortf":0,"did":{did},"tmpls":[{{"name":"Card 1","qfmt":"{{{{Front}}}}","afmt":"{{{{FrontSide}}}}<hr id=answer>{{{{Back}}}}","ord":0}}],"flds":[{{"name":"Front","ord":0}},{{"name":"Back","ord":1}}],"css":".card {{font-family: arial; font-size: 20px; text-align: center; color: black; background-color: white;}}","latexPre":"","latexPost":"","latexsvg":false,"req":[[0,"all",[0]]]}}}}"#
    );
    let decks = format!(
        r#"{{"{did}":{{"id":{did},"name":"{deck_name}","mod":{now},"usn":-1,"lrnToday":[0,0],"revToday":[0,0],"newToday":[0,0],"timeToday":[0,0],"collapsed":false,"browserCollapsed":false,"desc":"","dyn":0,"conf":1}}}}"#
    );

    conn.execute(
        "INSERT INTO col VALUES (1, ?1, ?1, ?1, 11, 0, 0, 0, '{}', ?2, ?3, '{}', '{}')",
        params![now, models, decks],
    )
    .map_err(|e| format!("Col insert error: {e}"))?;

    for (i, card) in cards.iter().enumerate() {
        let nid = now * 1000 + i as i64;
        let cid = nid + 1;
        let guid = format!("sc{nid}");
        let flds = format!("{}\x1f{}", card.front, card.back);
        let csum = simple_checksum(&card.front);

        conn.execute(
            "INSERT INTO notes VALUES (?1, ?2, ?3, ?4, -1, '', ?5, ?6, ?7, 0, '')",
            params![nid, guid, mid, now, flds, card.front, csum],
        )
        .map_err(|e| format!("Note insert error: {e}"))?;

        conn.execute(
            "INSERT INTO cards VALUES (?1, ?2, ?3, 0, ?4, -1, 0, 0, ?5, 0, 0, 0, 0, 0, 0, 0, 0, '')",
            params![cid, nid, did, now, i as i64],
        )
        .map_err(|e| format!("Card insert error: {e}"))?;
    }

    Ok(())
}

fn simple_checksum(s: &str) -> i64 {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let mut hasher = DefaultHasher::new();
    s.hash(&mut hasher);
    (hasher.finish() % 2_147_483_647) as i64
}
