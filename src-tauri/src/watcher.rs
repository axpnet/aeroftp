// AeroCloud File System Watcher
// Real-time monitoring of local cloud folder changes

use notify::{Config, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use notify_debouncer_mini::{new_debouncer, DebouncedEvent, Debouncer};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::mpsc;

/// Types of file system changes
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WatchEventKind {
    Created,
    Modified,
    Deleted,
    Renamed,
}

/// A file system change event
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WatchEvent {
    pub kind: WatchEventKind,
    pub path: PathBuf,
    pub old_path: Option<PathBuf>, // For renames
}

/// Cloud folder watcher with debouncing
pub struct CloudWatcher {
    debouncer: Debouncer<RecommendedWatcher>,
    watch_path: PathBuf,
}

impl CloudWatcher {
    /// Create a new watcher for the given path
    /// Events will be sent to the provided mpsc sender after debouncing
    pub fn new<F>(
        watch_path: PathBuf,
        debounce_duration: Duration,
        callback: F,
    ) -> Result<Self, String>
    where
        F: Fn(Vec<WatchEvent>) + Send + 'static,
    {
        // Create debouncer with callback
        let mut debouncer = new_debouncer(
            debounce_duration,
            move |res: Result<Vec<DebouncedEvent>, notify::Error>| {
                match res {
                    Ok(events) => {
                        let watch_events: Vec<WatchEvent> = events
                            .into_iter()
                            .map(|e| WatchEvent {
                                kind: WatchEventKind::Modified, // Debouncer simplifies to just path
                                path: e.path,
                                old_path: None,
                            })
                            .collect();
                        
                        if !watch_events.is_empty() {
                            callback(watch_events);
                        }
                    }
                    Err(e) => {
                        tracing::warn!("Watch error: {:?}", e);
                    }
                }
            },
        ).map_err(|e| format!("Failed to create debouncer: {}", e))?;

        // Start watching the path
        debouncer
            .watcher()
            .watch(&watch_path, RecursiveMode::Recursive)
            .map_err(|e| format!("Failed to watch path: {}", e))?;

        tracing::info!("CloudWatcher started for: {:?}", watch_path);

        Ok(Self {
            debouncer,
            watch_path,
        })
    }

    /// Stop watching
    pub fn stop(&mut self) -> Result<(), String> {
        self.debouncer
            .watcher()
            .unwatch(&self.watch_path)
            .map_err(|e| format!("Failed to unwatch: {}", e))?;
        
        tracing::info!("CloudWatcher stopped for: {:?}", self.watch_path);
        Ok(())
    }

    /// Get the currently watched path
    pub fn watch_path(&self) -> &PathBuf {
        &self.watch_path
    }
}

/// Convert notify EventKind to our WatchEventKind
fn convert_event_kind(kind: &EventKind) -> WatchEventKind {
    match kind {
        EventKind::Create(_) => WatchEventKind::Created,
        EventKind::Modify(_) => WatchEventKind::Modified,
        EventKind::Remove(_) => WatchEventKind::Deleted,
        EventKind::Other => WatchEventKind::Modified,
        _ => WatchEventKind::Modified,
    }
}

/// Create a watcher that sends events through a Tauri event channel
pub fn create_cloud_watcher_with_events(
    watch_path: PathBuf,
    app_handle: tauri::AppHandle,
) -> Result<CloudWatcher, String> {
    use tauri::Emitter;
    
    CloudWatcher::new(
        watch_path,
        Duration::from_secs(2), // 2 second debounce
        move |events| {
            // Emit events to frontend
            let _ = app_handle.emit("cloud_file_change", &events);
            tracing::debug!("Cloud file changes: {} events", events.len());
        },
    )
}

/// Async watcher using tokio channels
pub struct AsyncCloudWatcher {
    watcher: RecommendedWatcher,
    watch_path: PathBuf,
    rx: mpsc::Receiver<Result<Event, notify::Error>>,
}

impl AsyncCloudWatcher {
    /// Create an async watcher that sends events through a tokio channel
    pub fn new(watch_path: PathBuf) -> Result<Self, String> {
        let (tx, rx) = mpsc::channel(100);
        
        let watcher = RecommendedWatcher::new(
            move |res| {
                let _ = tx.blocking_send(res);
            },
            Config::default(),
        ).map_err(|e| format!("Failed to create watcher: {}", e))?;

        Ok(Self {
            watcher,
            watch_path,
            rx,
        })
    }

    /// Start watching
    pub fn start(&mut self) -> Result<(), String> {
        self.watcher
            .watch(&self.watch_path, RecursiveMode::Recursive)
            .map_err(|e| format!("Failed to start watching: {}", e))?;
        
        tracing::info!("AsyncCloudWatcher started for: {:?}", self.watch_path);
        Ok(())
    }

    /// Stop watching
    pub fn stop(&mut self) -> Result<(), String> {
        self.watcher
            .unwatch(&self.watch_path)
            .map_err(|e| format!("Failed to stop watching: {}", e))?;
        
        tracing::info!("AsyncCloudWatcher stopped for: {:?}", self.watch_path);
        Ok(())
    }

    /// Get the next event (async)
    pub async fn recv(&mut self) -> Option<Result<Event, notify::Error>> {
        self.rx.recv().await
    }

    /// Get next event with converted WatchEvent type
    pub async fn recv_watch_event(&mut self) -> Option<Vec<WatchEvent>> {
        match self.rx.recv().await {
            Some(Ok(event)) => {
                let kind = convert_event_kind(&event.kind);
                Some(
                    event.paths
                        .into_iter()
                        .map(|path| WatchEvent {
                            kind: kind.clone(),
                            path,
                            old_path: None,
                        })
                        .collect()
                )
            }
            _ => None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn test_watch_event_kind_convert() {
        assert!(matches!(
            convert_event_kind(&EventKind::Create(notify::event::CreateKind::Any)),
            WatchEventKind::Created
        ));
        assert!(matches!(
            convert_event_kind(&EventKind::Remove(notify::event::RemoveKind::Any)),
            WatchEventKind::Deleted
        ));
    }
}
