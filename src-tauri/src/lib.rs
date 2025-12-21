// AeroFTP - Modern FTP Client with Tauri
// Real-time transfer progress with event emission

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Instant;
use tauri::{AppHandle, Emitter, State};
use tokio::sync::Mutex;
use tracing::info;

mod ftp;
#[cfg(unix)]
mod pty;

use ftp::{FtpManager, RemoteFile};
#[cfg(unix)]
use pty::{create_pty_state, spawn_shell, pty_write, pty_resize, pty_close, PtyState};

// Shared application state
struct AppState {
    ftp_manager: Mutex<FtpManager>,
    cancel_flag: Mutex<bool>,
}

impl AppState {
    fn new() -> Self {
        Self {
            ftp_manager: Mutex::new(FtpManager::new()),
            cancel_flag: Mutex::new(false),
        }
    }
}

// ============ Request/Response Structs ============

#[derive(Serialize, Deserialize)]
pub struct ConnectionParams {
    server: String,
    username: String,
    password: String,
}

#[derive(Serialize, Deserialize)]
pub struct DownloadParams {
    remote_path: String,
    local_path: String,
}

#[derive(Serialize, Deserialize)]
pub struct UploadParams {
    local_path: String,
    remote_path: String,
}

#[derive(Serialize)]
pub struct FileListResponse {
    files: Vec<RemoteFile>,
    current_path: String,
}

// ============ Transfer Progress Events ============

#[derive(Clone, Serialize)]
pub struct TransferProgress {
    pub transfer_id: String,
    pub filename: String,
    pub transferred: u64,
    pub total: u64,
    pub percentage: u8,
    pub speed_bps: u64,
    pub eta_seconds: u32,
    pub direction: String, // "download" or "upload"
}

#[derive(Clone, Serialize)]
pub struct TransferEvent {
    pub event_type: String, // "start", "progress", "complete", "error", "cancelled"
    pub transfer_id: String,
    pub filename: String,
    pub direction: String,
    pub message: Option<String>,
    pub progress: Option<TransferProgress>,
}

// ============ Local File Info ============

#[derive(Serialize)]
pub struct LocalFileInfo {
    pub name: String,
    pub path: String,
    pub size: Option<u64>,
    pub is_dir: bool,
    pub modified: Option<String>,
}

// ============ FTP Commands ============

#[tauri::command]
async fn connect_ftp(state: State<'_, AppState>, params: ConnectionParams) -> Result<(), String> {
    info!("Connecting to FTP server: {}", params.server);
    let mut ftp_manager = state.ftp_manager.lock().await;
    
    ftp_manager.connect(&params.server)
        .await
        .map_err(|e| format!("Connection failed: {}", e))?;
        
    ftp_manager.login(&params.username, &params.password)
        .await
        .map_err(|e| format!("Login failed: {}", e))?;
        
    Ok(())
}

#[tauri::command]
async fn disconnect_ftp(state: State<'_, AppState>) -> Result<(), String> {
    let mut ftp_manager = state.ftp_manager.lock().await;
    ftp_manager.disconnect()
        .await
        .map_err(|e| format!("Disconnect failed: {}", e))?;
    Ok(())
}

#[tauri::command]
async fn list_files(state: State<'_, AppState>) -> Result<FileListResponse, String> {
    let mut ftp_manager = state.ftp_manager.lock().await;
    
    let files = ftp_manager.list_files()
        .await
        .map_err(|e| format!("Failed to list files: {}", e))?;
        
    let current_path = ftp_manager.current_path();
    
    Ok(FileListResponse {
        files,
        current_path,
    })
}

#[tauri::command]
async fn change_directory(state: State<'_, AppState>, path: String) -> Result<FileListResponse, String> {
    let mut ftp_manager = state.ftp_manager.lock().await;
    
    ftp_manager.change_dir(&path)
        .await
        .map_err(|e| format!("Failed to change directory: {}", e))?;
        
    let files = ftp_manager.list_files()
        .await
        .map_err(|e| format!("Failed to list files: {}", e))?;
        
    let current_path = ftp_manager.current_path();
    
    Ok(FileListResponse {
        files,
        current_path,
    })
}

// ============ Transfer Commands with Progress ============

#[tauri::command]
async fn download_file(
    app: AppHandle,
    state: State<'_, AppState>, 
    params: DownloadParams
) -> Result<String, String> {
    // Reset cancel flag
    {
        let mut cancel = state.cancel_flag.lock().await;
        *cancel = false;
    }

    let filename = PathBuf::from(&params.remote_path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "file".to_string());
    
    let transfer_id = format!("dl-{}", chrono::Utc::now().timestamp_millis());
    
    // Emit start event
    let _ = app.emit("transfer_event", TransferEvent {
        event_type: "start".to_string(),
        transfer_id: transfer_id.clone(),
        filename: filename.clone(),
        direction: "download".to_string(),
        message: Some(format!("Starting download: {}", filename)),
        progress: None,
    });

    let mut ftp_manager = state.ftp_manager.lock().await;
    
    // Get file size first
    let file_size = ftp_manager.get_file_size(&params.remote_path)
        .await
        .unwrap_or(0);
    
    let start_time = Instant::now();

    // Download with progress
    match ftp_manager.download_file_with_progress(
        &params.remote_path, 
        &params.local_path,
        |transferred| {
            let elapsed = start_time.elapsed().as_secs_f64();
            let speed = if elapsed > 0.0 { (transferred as f64 / elapsed) as u64 } else { 0 };
            let percentage = if file_size > 0 { 
                ((transferred as f64 / file_size as f64) * 100.0) as u8 
            } else { 
                0 
            };
            let eta = if speed > 0 && file_size > transferred {
                ((file_size - transferred) / speed) as u32
            } else {
                0
            };

            let progress = TransferProgress {
                transfer_id: transfer_id.clone(),
                filename: filename.clone(),
                transferred,
                total: file_size,
                percentage,
                speed_bps: speed,
                eta_seconds: eta,
                direction: "download".to_string(),
            };

            let _ = app.emit("transfer_event", TransferEvent {
                event_type: "progress".to_string(),
                transfer_id: transfer_id.clone(),
                filename: filename.clone(),
                direction: "download".to_string(),
                message: None,
                progress: Some(progress),
            });
        }
    ).await {
        Ok(_) => {
            // Emit complete event
            let _ = app.emit("transfer_event", TransferEvent {
                event_type: "complete".to_string(),
                transfer_id: transfer_id.clone(),
                filename: filename.clone(),
                direction: "download".to_string(),
                message: Some(format!("Download complete: {}", filename)),
                progress: None,
            });
            Ok(format!("Downloaded: {}", filename))
        }
        Err(e) => {
            // Emit error event
            let _ = app.emit("transfer_event", TransferEvent {
                event_type: "error".to_string(),
                transfer_id: transfer_id.clone(),
                filename: filename.clone(),
                direction: "download".to_string(),
                message: Some(format!("Download failed: {}", e)),
                progress: None,
            });
            Err(format!("Download failed: {}", e))
        }
    }
}

#[tauri::command]
async fn upload_file(
    app: AppHandle,
    state: State<'_, AppState>, 
    params: UploadParams
) -> Result<String, String> {
    // Reset cancel flag
    {
        let mut cancel = state.cancel_flag.lock().await;
        *cancel = false;
    }

    let filename = PathBuf::from(&params.local_path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "file".to_string());
    
    let transfer_id = format!("ul-{}", chrono::Utc::now().timestamp_millis());
    
    // Get local file size
    let file_size = tokio::fs::metadata(&params.local_path)
        .await
        .map(|m| m.len())
        .unwrap_or(0);

    // Emit start event
    let _ = app.emit("transfer_event", TransferEvent {
        event_type: "start".to_string(),
        transfer_id: transfer_id.clone(),
        filename: filename.clone(),
        direction: "upload".to_string(),
        message: Some(format!("Starting upload: {}", filename)),
        progress: None,
    });

    let mut ftp_manager = state.ftp_manager.lock().await;
    let start_time = Instant::now();

    // Upload with progress
    match ftp_manager.upload_file_with_progress(
        &params.local_path, 
        &params.remote_path,
        file_size,
        |transferred| {
            let elapsed = start_time.elapsed().as_secs_f64();
            let speed = if elapsed > 0.0 { (transferred as f64 / elapsed) as u64 } else { 0 };
            let percentage = if file_size > 0 { 
                ((transferred as f64 / file_size as f64) * 100.0) as u8 
            } else { 
                0 
            };
            let eta = if speed > 0 && file_size > transferred {
                ((file_size - transferred) / speed) as u32
            } else {
                0
            };

            let progress = TransferProgress {
                transfer_id: transfer_id.clone(),
                filename: filename.clone(),
                transferred,
                total: file_size,
                percentage,
                speed_bps: speed,
                eta_seconds: eta,
                direction: "upload".to_string(),
            };

            let _ = app.emit("transfer_event", TransferEvent {
                event_type: "progress".to_string(),
                transfer_id: transfer_id.clone(),
                filename: filename.clone(),
                direction: "upload".to_string(),
                message: None,
                progress: Some(progress),
            });
        }
    ).await {
        Ok(_) => {
            // Emit complete event
            let _ = app.emit("transfer_event", TransferEvent {
                event_type: "complete".to_string(),
                transfer_id: transfer_id.clone(),
                filename: filename.clone(),
                direction: "upload".to_string(),
                message: Some(format!("Upload complete: {}", filename)),
                progress: None,
            });
            Ok(format!("Uploaded: {}", filename))
        }
        Err(e) => {
            // Emit error event
            let _ = app.emit("transfer_event", TransferEvent {
                event_type: "error".to_string(),
                transfer_id: transfer_id.clone(),
                filename: filename.clone(),
                direction: "upload".to_string(),
                message: Some(format!("Upload failed: {}", e)),
                progress: None,
            });
            Err(format!("Upload failed: {}", e))
        }
    }
}

#[tauri::command]
async fn cancel_transfer(state: State<'_, AppState>) -> Result<(), String> {
    let mut cancel = state.cancel_flag.lock().await;
    *cancel = true;
    info!("Transfer cancellation requested");
    Ok(())
}

// ============ Local File System Commands ============

#[tauri::command]
async fn get_local_files(path: String) -> Result<Vec<LocalFileInfo>, String> {
    let path = PathBuf::from(&path);
    
    if !path.exists() {
        return Err(format!("Path does not exist: {}", path.display()));
    }

    let mut files = Vec::new();
    
    // Parent directory (..) removed - use "Up" button in toolbar for navigation

    let mut entries = tokio::fs::read_dir(&path)
        .await
        .map_err(|e| format!("Failed to read directory: {}", e))?;

    while let Some(entry) = entries.next_entry().await.map_err(|e| e.to_string())? {
        let metadata = entry.metadata().await.ok();
        let file_name = entry.file_name().to_string_lossy().to_string();
        
        // Skip hidden files
        if file_name.starts_with('.') {
            continue;
        }

        let is_dir = metadata.as_ref().map(|m| m.is_dir()).unwrap_or(false);
        let size = if is_dir { 
            None 
        } else { 
            metadata.as_ref().map(|m| m.len()) 
        };
        
        let modified = metadata.as_ref().and_then(|m| {
            m.modified().ok().map(|t| {
                let datetime: chrono::DateTime<chrono::Local> = t.into();
                datetime.format("%Y-%m-%d %H:%M").to_string()
            })
        });

        files.push(LocalFileInfo {
            name: file_name,
            path: entry.path().to_string_lossy().to_string(),
            size,
            is_dir,
            modified,
        });
    }

    // Sort: directories first, then alphabetically
    files.sort_by(|a, b| {
        match (a.is_dir, b.is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });

    Ok(files)
}

#[tauri::command]
async fn open_in_file_manager(path: String) -> Result<(), String> {
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open file manager: {}", e))?;
    }
    
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open file manager: {}", e))?;
    }
    
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open file manager: {}", e))?;
    }
    
    Ok(())
}

// ============ File Operations Commands ============

#[tauri::command]
async fn delete_remote_file(state: State<'_, AppState>, path: String, is_dir: bool) -> Result<(), String> {
    let mut ftp_manager = state.ftp_manager.lock().await;
    
    if is_dir {
        ftp_manager.remove_dir(&path)
            .await
            .map_err(|e| format!("Failed to delete directory: {}", e))?;
    } else {
        ftp_manager.remove(&path)
            .await
            .map_err(|e| format!("Failed to delete file: {}", e))?;
    }
    
    Ok(())
}

#[tauri::command]
async fn rename_remote_file(state: State<'_, AppState>, from: String, to: String) -> Result<(), String> {
    let mut ftp_manager = state.ftp_manager.lock().await;
    
    ftp_manager.rename(&from, &to)
        .await
        .map_err(|e| format!("Failed to rename: {}", e))?;
    
    Ok(())
}

#[tauri::command]
async fn create_remote_folder(state: State<'_, AppState>, path: String) -> Result<(), String> {
    let mut ftp_manager = state.ftp_manager.lock().await;
    
    ftp_manager.mkdir(&path)
        .await
        .map_err(|e| format!("Failed to create folder: {}", e))?;
    
    Ok(())
}

#[tauri::command]
async fn chmod_remote_file(state: State<'_, AppState>, path: String, mode: String) -> Result<(), String> {
    let mut ftp_manager = state.ftp_manager.lock().await;
    ftp_manager.chmod(&path, &mode)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn delete_local_file(path: String) -> Result<(), String> {
    let path = std::path::PathBuf::from(&path);
    
    if path.is_dir() {
        tokio::fs::remove_dir_all(&path)
            .await
            .map_err(|e| format!("Failed to delete directory: {}", e))?;
    } else {
        tokio::fs::remove_file(&path)
            .await
            .map_err(|e| format!("Failed to delete file: {}", e))?;
    }
    
    Ok(())
}

#[tauri::command]
async fn rename_local_file(from: String, to: String) -> Result<(), String> {
    tokio::fs::rename(&from, &to)
        .await
        .map_err(|e| format!("Failed to rename: {}", e))?;
    
    Ok(())
}

#[tauri::command]
async fn create_local_folder(path: String) -> Result<(), String> {
    tokio::fs::create_dir_all(&path)
        .await
        .map_err(|e| format!("Failed to create folder: {}", e))?;
    
    Ok(())
}

#[tauri::command]
async fn read_file_base64(path: String) -> Result<String, String> {
    use base64::{Engine as _, engine::general_purpose::STANDARD};
    
    let data = tokio::fs::read(&path)
        .await
        .map_err(|e| format!("Failed to read file: {}", e))?;
    
    Ok(STANDARD.encode(data))
}

// ============ DevTools Commands ============

#[tauri::command]
async fn read_local_file(path: String) -> Result<String, String> {
    // Read local file content as UTF-8 string
    let content = tokio::fs::read_to_string(&path)
        .await
        .map_err(|e| format!("Failed to read file: {}", e))?;
    
    Ok(content)
}

#[tauri::command]
async fn preview_remote_file(state: State<'_, AppState>, path: String) -> Result<String, String> {
    let mut ftp_manager = state.ftp_manager.lock().await;
    
    // Download file content to memory (limit to 1MB for preview)
    let max_size: u64 = 1024 * 1024; // 1MB limit
    
    // Get file size first
    let file_size = ftp_manager.get_file_size(&path)
        .await
        .unwrap_or(0);
    
    if file_size > max_size {
        return Err(format!("File too large for preview ({} KB). Max: 1024 KB", file_size / 1024));
    }
    
    // Download to temp and read
    let temp_path = std::env::temp_dir().join(format!("aeroftp_preview_{}", chrono::Utc::now().timestamp_millis()));
    let temp_path_str = temp_path.to_string_lossy().to_string();
    
    ftp_manager.download_file_with_progress(&path, &temp_path_str, |_| {})
        .await
        .map_err(|e| format!("Failed to download for preview: {}", e))?;
    
    // Read content
    let content = tokio::fs::read_to_string(&temp_path)
        .await
        .map_err(|e| format!("Failed to read preview content: {}", e))?;
    
    // Clean up temp file
    let _ = tokio::fs::remove_file(&temp_path).await;
    
    Ok(content)
}

#[tauri::command]
async fn save_local_file(path: String, content: String) -> Result<(), String> {
    // Write content to local file
    tokio::fs::write(&path, content)
        .await
        .map_err(|e| format!("Failed to save file: {}", e))?;
    
    Ok(())
}

#[tauri::command]
async fn save_remote_file(state: State<'_, AppState>, path: String, content: String) -> Result<(), String> {
    let mut ftp_manager = state.ftp_manager.lock().await;
    
    // Write content to temp file first
    let temp_path = std::env::temp_dir().join(format!("aeroftp_upload_{}", chrono::Utc::now().timestamp_millis()));
    let temp_path_str = temp_path.to_string_lossy().to_string();
    
    tokio::fs::write(&temp_path, &content)
        .await
        .map_err(|e| format!("Failed to write temp file: {}", e))?;
    
    // Upload to remote server
    ftp_manager.upload_file_with_progress(&temp_path_str, &path, content.len() as u64, |_| {})
        .await
        .map_err(|e| format!("Failed to upload file: {}", e))?;
    
    // Clean up temp file
    let _ = tokio::fs::remove_file(&temp_path).await;
    
    Ok(())
}

#[tauri::command]
fn toggle_menu_bar(app: AppHandle, window: tauri::Window, visible: bool) {
    if visible {
        if let Some(menu) = app.menu() {
            let _ = window.set_menu(menu);
        }
    } else {
        let _ = window.remove_menu();
    }
}

// ============ App Entry Point ============

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    use tauri::menu::{Menu, MenuItem, Submenu, PredefinedMenuItem};

    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build())
        .setup(|app| {
            // Create menu items
            let quit = MenuItem::with_id(app, "quit", "Quit AeroFTP", true, Some("CmdOrCtrl+Q"))?;
            let about = MenuItem::with_id(app, "about", "About AeroFTP", true, None::<&str>)?;
            let settings = MenuItem::with_id(app, "settings", "Settings...", true, Some("CmdOrCtrl+,"))?;
            let refresh = MenuItem::with_id(app, "refresh", "Refresh", true, Some("CmdOrCtrl+R"))?;
            let shortcuts = MenuItem::with_id(app, "shortcuts", "Keyboard Shortcuts", true, Some("F1"))?;
            
            // File menu
            let file_menu = Submenu::with_items(
                app,
                "File",
                true,
                &[
                    &MenuItem::with_id(app, "new_folder", "New Folder", true, Some("CmdOrCtrl+N"))?,
                    &PredefinedMenuItem::separator(app)?,
                    &settings,
                    &PredefinedMenuItem::separator(app)?,
                    &quit,
                ],
            )?;
            
            // Edit menu
            let edit_menu = Submenu::with_items(
                app,
                "Edit",
                true,
                &[
                    &MenuItem::with_id(app, "rename", "Rename", true, Some("F2"))?,
                    &MenuItem::with_id(app, "delete", "Delete", true, Some("Delete"))?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::select_all(app, None)?,
                ],
            )?;
            
            // View menu
            let view_menu = Submenu::with_items(
                app,
                "View",
                true,
                &[
                    &refresh,
                    &PredefinedMenuItem::separator(app)?,
                    &MenuItem::with_id(app, "toggle_theme", "Toggle Theme", true, Some("CmdOrCtrl+T"))?,
                ],
            )?;
            
            // Help menu
            let help_menu = Submenu::with_items(
                app,
                "Help",
                true,
                &[
                    &shortcuts,
                    &PredefinedMenuItem::separator(app)?,
                    &about,
                ],
            )?;
            
            let menu = Menu::with_items(app, &[&file_menu, &edit_menu, &view_menu, &help_menu])?;
            app.set_menu(menu)?;
            
            Ok(())
        })
        .on_menu_event(|app, event| {
            let id = event.id().as_ref();
            info!("Menu event: {}", id);
            // Emit event to frontend
            let _ = app.emit("menu-event", id);
        })
        .manage(AppState::new());

    // Add PTY state only on Unix systems
    #[cfg(unix)]
    let builder = builder.manage(create_pty_state());

    builder
        .invoke_handler(tauri::generate_handler![
            connect_ftp,
            disconnect_ftp,
            list_files,
            change_directory,
            download_file,
            upload_file,
            cancel_transfer,
            get_local_files,
            open_in_file_manager,
            delete_remote_file,
            rename_remote_file,
            create_remote_folder,
            chmod_remote_file,
            delete_local_file,
            rename_local_file,
            create_local_folder,
            read_file_base64,
            read_local_file,
            preview_remote_file,
            save_local_file,
            save_remote_file,
            toggle_menu_bar,
            #[cfg(unix)]
            spawn_shell,
            #[cfg(unix)]
            pty_write,
            #[cfg(unix)]
            pty_resize,
            #[cfg(unix)]
            pty_close
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}