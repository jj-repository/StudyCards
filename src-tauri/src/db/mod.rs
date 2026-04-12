mod models;
mod queries;

pub use models::*;
pub use queries::*;

use rusqlite::Connection;
use rusqlite_migration::{Migrations, M};
use std::path::Path;
use std::sync::Mutex;

pub struct DbState(pub Mutex<Connection>);

pub fn init_db(path: &Path) -> Result<Connection, Box<dyn std::error::Error>> {
    let mut conn = Connection::open(path)?;

    conn.execute_batch(
        "PRAGMA journal_mode=WAL;
         PRAGMA synchronous=NORMAL;
         PRAGMA foreign_keys=ON;
         PRAGMA busy_timeout=5000;",
    )?;

    let migrations = Migrations::new(vec![
        M::up(
            "CREATE TABLE sources (
            id          INTEGER PRIMARY KEY,
            path        TEXT NOT NULL UNIQUE,
            name        TEXT NOT NULL,
            content_hash TEXT,
            last_scanned TEXT,
            is_folder   INTEGER DEFAULT 0,
            created_at  TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE cards (
            id           INTEGER PRIMARY KEY,
            source_id    INTEGER REFERENCES sources(id) ON DELETE SET NULL,
            type         TEXT NOT NULL CHECK(type IN ('qa', 'cloze')),
            front        TEXT NOT NULL,
            back         TEXT NOT NULL,
            meaning_hash TEXT NOT NULL,
            tags         TEXT NOT NULL DEFAULT '',
            manual       INTEGER NOT NULL DEFAULT 0,
            created_at   TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE card_states (
            card_id      INTEGER PRIMARY KEY REFERENCES cards(id) ON DELETE CASCADE,
            stability    REAL NOT NULL DEFAULT 0.0,
            difficulty   REAL NOT NULL DEFAULT 0.0,
            due_date     TEXT NOT NULL DEFAULT (datetime('now')),
            status       TEXT NOT NULL DEFAULT 'new'
                         CHECK(status IN ('new', 'learning', 'review', 'relearning')),
            last_review  TEXT,
            review_count INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE reviews (
            id           INTEGER PRIMARY KEY,
            card_id      INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
            rating       INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 4),
            elapsed_days REAL NOT NULL,
            reviewed_at  TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX idx_cards_source ON cards(source_id);
        CREATE INDEX idx_card_states_due ON card_states(due_date);
        CREATE INDEX idx_reviews_card ON reviews(card_id);",
        ),
        M::up(
            "CREATE TABLE settings (
            key   TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        INSERT INTO settings (key, value) VALUES ('daily_review_limit', '0');
        INSERT INTO settings (key, value) VALUES ('new_cards_per_session', '20');
        INSERT INTO settings (key, value) VALUES ('target_retention', '0.9');",
        ),
        M::up(
            "CREATE TABLE decks (
            id   INTEGER PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        INSERT INTO decks (name) VALUES ('Default');

        ALTER TABLE cards ADD COLUMN deck_id INTEGER REFERENCES decks(id) ON DELETE SET NULL DEFAULT 1;",
        ),
    ]);

    migrations.to_latest(&mut conn)?;

    Ok(conn)
}
