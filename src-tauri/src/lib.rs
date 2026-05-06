mod anki_export;
mod anki_import;
mod commands;
mod db;
mod fsrs_engine;
mod llm;
mod rule_gen;
mod watcher;

use db::DbState;
use llm::LlmState;
use std::sync::Mutex;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        // tauri_plugin_updater: registered in Cargo.toml, init deferred until signing keys configured
        .setup(|app| {
            let app_dir = app
                .path()
                .app_data_dir()
                .expect("failed to resolve app data dir");
            std::fs::create_dir_all(&app_dir)?;
            let db_path = app_dir.join("studycards.db");

            let conn = db::init_db(&db_path)?;

            // Start file watcher for tracked source folders
            let watch_paths = db::get_source_paths(&conn);
            if !watch_paths.is_empty() {
                watcher::start_watcher(app.handle().clone(), watch_paths);
            }

            app.manage(DbState(Mutex::new(conn)));
            app.manage(LlmState(tokio::sync::Mutex::new(llm::LlmRegistry::new())));

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Sources
            commands::sources::add_source,
            commands::sources::list_sources,
            commands::sources::remove_source,
            commands::sources::read_source_content,
            // Cards
            commands::cards::list_cards,
            commands::cards::create_card,
            commands::cards::update_card,
            commands::cards::delete_card,
            commands::cards::delete_cards_bulk,
            // Study
            commands::study::get_due_cards,
            commands::study::submit_review,
            commands::study::get_study_stats,
            commands::study::get_study_config,
            commands::study::save_study_config,
            commands::study::get_daily_reviews,
            commands::study::get_cards_per_source,
            // LLM
            commands::llm_cmds::generate_cards,
            commands::llm_cmds::save_generated_cards,
            commands::llm_cmds::configure_provider,
            commands::llm_cmds::test_connection,
            commands::llm_cmds::list_models,
            commands::llm_cmds::detect_ollama,
            commands::llm_cmds::generate_cards_rules,
            commands::llm_cmds::import_anki,
            commands::llm_cmds::export_anki,
            // Decks
            commands::decks::list_decks,
            commands::decks::create_deck,
            commands::decks::rename_deck,
            commands::decks::delete_deck,
            commands::decks::move_cards_to_deck,
            commands::decks::update_card_tags,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
