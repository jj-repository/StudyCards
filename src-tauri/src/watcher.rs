use notify::{recommended_watcher, Event, EventKind, RecursiveMode, Watcher};
use std::path::PathBuf;
use std::sync::mpsc;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};

/// Watch a list of paths for Markdown file changes.
/// Emits "source-changed" events to the frontend with the changed path.
pub fn start_watcher(app: AppHandle, paths: Vec<PathBuf>) {
    std::thread::spawn(move || {
        let (tx, rx) = mpsc::channel();

        let mut watcher = match recommended_watcher(move |res: Result<Event, notify::Error>| {
            if let Ok(event) = res {
                let _ = tx.send(event);
            }
        }) {
            Ok(w) => w,
            Err(e) => {
                log::error!("Failed to create file watcher: {e}");
                return;
            }
        };

        for path in &paths {
            let mode = if path.is_dir() {
                RecursiveMode::Recursive
            } else {
                RecursiveMode::NonRecursive
            };
            if let Err(e) = watcher.watch(path, mode) {
                log::error!("Failed to watch {}: {e}", path.display());
            }
        }

        // Debounce: only emit after 2s of quiet
        let mut last_event = Instant::now();
        let mut pending: Option<String> = None;

        loop {
            match rx.recv_timeout(Duration::from_millis(500)) {
                Ok(event) => {
                    if matches!(
                        event.kind,
                        EventKind::Modify(_) | EventKind::Create(_) | EventKind::Remove(_)
                    ) {
                        for path in &event.paths {
                            if is_markdown(path) {
                                pending = Some(path.display().to_string());
                                last_event = Instant::now();
                            }
                        }
                    }
                }
                Err(mpsc::RecvTimeoutError::Timeout) => {
                    if let Some(ref path) = pending {
                        if last_event.elapsed() > Duration::from_secs(2) {
                            let _ = app.emit("source-changed", path.clone());
                            pending = None;
                        }
                    }
                }
                Err(mpsc::RecvTimeoutError::Disconnected) => break,
            }
        }
    });
}

fn is_markdown(path: &std::path::Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .is_some_and(|ext| ext == "md" || ext == "txt")
}
