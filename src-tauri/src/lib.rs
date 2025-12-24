// AeroFTP - Modern FTP Client with Tauri
// Real-time transfer progress with event emission

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::time::Instant;
use tauri::{AppHandle, Emitter, State, Manager};
use tokio::sync::Mutex;
use tracing::{info, warn, error};

mod ftp;
mod sync;
mod ai;
mod cloud_config;
mod watcher;
mod cloud_service;
#[cfg(unix)]
mod pty;

use ftp::{FtpManager, RemoteFile};
#[cfg(unix)]
use pty::{create_pty_state, spawn_shell, pty_write, pty_resize, pty_close};

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

#[derive(Serialize, Deserialize)]
pub struct DownloadFolderParams {
    remote_path: String,
    local_path: String,
}

#[derive(Serialize, Deserialize)]
pub struct UploadFolderParams {
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
async fn check_connection(state: State<'_, AppState>) -> Result<bool, String> {
    let ftp_manager = state.ftp_manager.lock().await;
    Ok(ftp_manager.is_connected())
}

#[tauri::command]
async fn ftp_noop(state: State<'_, AppState>) -> Result<(), String> {
    let mut ftp_manager = state.ftp_manager.lock().await;
    ftp_manager.noop()
        .await
        .map_err(|e| format!("NOOP failed: {}", e))?;
    Ok(())
}

#[tauri::command]
async fn reconnect_ftp(state: State<'_, AppState>) -> Result<(), String> {
    info!("Attempting FTP reconnection");
    let mut ftp_manager = state.ftp_manager.lock().await;
    ftp_manager.reconnect()
        .await
        .map_err(|e| format!("Reconnection failed: {}", e))?;
    info!("FTP reconnection successful");
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
        ftp_manager.delete_folder_recursive(&path)
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

#[tauri::command]
async fn ftp_read_file_base64(state: State<'_, AppState>, path: String) -> Result<String, String> {
    use base64::{Engine as _, engine::general_purpose::STANDARD};
    
    let mut ftp_manager = state.ftp_manager.lock().await;
    
    // Limit size for preview (10MB should be enough for most media files)
    let max_size: u64 = 10 * 1024 * 1024;
    
    // Get file size first
    let file_size = ftp_manager.get_file_size(&path)
        .await
        .unwrap_or(0);
    
    if file_size > max_size {
        return Err(format!("File too large for preview ({:.1} MB). Max: 10 MB", file_size as f64 / 1024.0 / 1024.0));
    }
    
    // Download to memory
    let data = ftp_manager.download_to_bytes(&path)
        .await
        .map_err(|e| format!("Failed to download: {}", e))?;
    
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
async fn read_local_file_base64(path: String, max_size_mb: Option<u32>) -> Result<String, String> {
    use base64::{Engine as _, engine::general_purpose::STANDARD};
    
    // Default max size is 50MB for media files (audio/video)
    let max_size: u64 = (max_size_mb.unwrap_or(50) as u64) * 1024 * 1024;
    
    // Check file size first
    let metadata = tokio::fs::metadata(&path)
        .await
        .map_err(|e| format!("Failed to read file metadata: {}", e))?;
    
    if metadata.len() > max_size {
        return Err(format!(
            "File too large for preview ({:.1} MB). Max: {} MB",
            metadata.len() as f64 / (1024.0 * 1024.0),
            max_size / (1024 * 1024)
        ));
    }
    
    // Read file as binary
    let content = tokio::fs::read(&path)
        .await
        .map_err(|e| format!("Failed to read file: {}", e))?;
    
    // Encode as base64
    Ok(STANDARD.encode(&content))
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

// ============ Sync Commands ============

use sync::{
    CompareOptions, FileComparison, FileInfo,
    build_comparison_results, should_exclude,
};
use cloud_config::{CloudConfig, CloudSyncStatus, ConflictStrategy};
use std::collections::HashMap;

#[tauri::command]
async fn compare_directories(
    state: State<'_, AppState>,
    local_path: String,
    remote_path: String,
    options: Option<CompareOptions>,
) -> Result<Vec<FileComparison>, String> {
    let options = options.unwrap_or_default();
    
    info!("Comparing directories: local={}, remote={}", local_path, remote_path);
    
    // Get local files
    let local_files = get_local_files_recursive(&local_path, &local_path, &options.exclude_patterns)
        .await
        .map_err(|e| format!("Failed to scan local directory: {}", e))?;
    
    // Get remote files
    let mut ftp_manager = state.ftp_manager.lock().await;
    let remote_files = get_remote_files_recursive(&mut ftp_manager, &remote_path, &remote_path, &options.exclude_patterns)
        .await
        .map_err(|e| format!("Failed to scan remote directory: {}", e))?;
    
    // Build comparison results
    let results = build_comparison_results(local_files, remote_files, &options);
    
    info!("Comparison complete: {} differences found", results.len());
    
    Ok(results)
}

/// Scan local directory iteratively and build file info map
async fn get_local_files_recursive(
    base_path: &str,
    _current_path: &str,
    exclude_patterns: &[String],
) -> Result<HashMap<String, FileInfo>, String> {
    let mut files = HashMap::new();
    let base = PathBuf::from(base_path);
    
    if !base.exists() {
        return Ok(files);
    }
    
    // Use a stack for iterative traversal instead of recursion
    let mut dirs_to_process = vec![base.clone()];
    
    while let Some(current_dir) = dirs_to_process.pop() {
        let mut entries = match tokio::fs::read_dir(&current_dir).await {
            Ok(e) => e,
            Err(_) => continue,
        };
        
        while let Ok(Some(entry)) = entries.next_entry().await {
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();
            
            // Calculate relative path
            let relative_path = path
                .strip_prefix(&base)
                .map(|p| p.to_string_lossy().to_string().replace('\\', "/"))
                .unwrap_or_else(|_| name.clone());
            
            // Skip excluded paths
            if should_exclude(&relative_path, exclude_patterns) {
                continue;
            }
            
            let metadata = entry.metadata().await.ok();
            let is_dir = metadata.as_ref().map(|m| m.is_dir()).unwrap_or(false);
            
            let modified = metadata.as_ref().and_then(|m| {
                m.modified().ok().map(|t| {
                    let datetime: chrono::DateTime<chrono::Utc> = t.into();
                    datetime
                })
            });
            
            let size = if is_dir {
                0
            } else {
                metadata.as_ref().map(|m| m.len()).unwrap_or(0)
            };
            
            let file_info = FileInfo {
                name: name.clone(),
                path: path.to_string_lossy().to_string(),
                size,
                modified,
                is_dir,
                checksum: None,
            };
            
            files.insert(relative_path, file_info);
            
            // Add subdirectories to process
            if is_dir {
                dirs_to_process.push(path);
            }
        }
    }
    
    Ok(files)
}

/// Scan remote directory iteratively and build file info map
async fn get_remote_files_recursive(
    ftp_manager: &mut ftp::FtpManager,
    base_path: &str,
    _current_path: &str,
    exclude_patterns: &[String],
) -> Result<HashMap<String, FileInfo>, String> {
    let mut files = HashMap::new();
    
    // Use a stack for iterative traversal
    let mut dirs_to_process = vec![base_path.to_string()];
    
    while let Some(current_dir) = dirs_to_process.pop() {
        // Change to the directory
        if let Err(e) = ftp_manager.change_dir(&current_dir).await {
            info!("Warning: Could not change to directory {}: {}", current_dir, e);
            continue;
        }
        
        // List files
        let entries = match ftp_manager.list_files().await {
            Ok(e) => e,
            Err(e) => {
                info!("Warning: Could not list files in {}: {}", current_dir, e);
                continue;
            }
        };
        
        for entry in entries {
            // Skip . and ..
            if entry.name == "." || entry.name == ".." {
                continue;
            }
            
            // Calculate relative path
            let relative_path = if current_dir == base_path {
                entry.name.clone()
            } else {
                let rel_dir = current_dir.strip_prefix(base_path).unwrap_or(&current_dir);
                let rel_dir = rel_dir.trim_start_matches('/');
                if rel_dir.is_empty() {
                    entry.name.clone()
                } else {
                    format!("{}/{}", rel_dir, entry.name)
                }
            };
            
            // Skip excluded paths
            if should_exclude(&relative_path, exclude_patterns) {
                continue;
            }
            
            let file_info = FileInfo {
                name: entry.name.clone(),
                path: format!("{}/{}", current_dir, entry.name),
                size: entry.size.unwrap_or(0),
                modified: entry.modified.and_then(|s| {
                    chrono::NaiveDateTime::parse_from_str(&s, "%Y-%m-%d %H:%M")
                        .ok()
                        .map(|dt| chrono::DateTime::<chrono::Utc>::from_naive_utc_and_offset(dt, chrono::Utc))
                }),
                is_dir: entry.is_dir,
                checksum: None,
            };
            
            files.insert(relative_path, file_info);
            
            // Add subdirectories to process
            if entry.is_dir {
                let sub_path = format!("{}/{}", current_dir, entry.name);
                dirs_to_process.push(sub_path);
            }
        }
    }
    
    // Return to base path
    let _ = ftp_manager.change_dir(base_path).await;
    
    Ok(files)
}

#[tauri::command]
fn get_compare_options_default() -> CompareOptions {
    CompareOptions::default()
}
// ============ AI Commands ============

#[tauri::command]
async fn ai_chat(request: ai::AIRequest) -> Result<ai::AIResponse, String> {
    ai::call_ai(request)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn ai_test_provider(
    provider_type: ai::ProviderType,
    base_url: String,
    api_key: Option<String>,
) -> Result<bool, String> {
    ai::test_provider(provider_type, base_url, api_key)
        .await
        .map_err(|e| e.to_string())
}

// Tool execution request
#[derive(Debug, Clone, Serialize, Deserialize)]
struct ToolRequest {
    tool_name: String,
    args: serde_json::Value,
}

// Execute AI tool - routes to existing FTP commands
#[tauri::command]
async fn ai_execute_tool(
    state: State<'_, AppState>,
    app: AppHandle,
    request: ToolRequest,
) -> Result<serde_json::Value, String> {
    let args = request.args;
    
    match request.tool_name.as_str() {
        "list_files" => {
            let location = args.get("location").and_then(|v| v.as_str()).unwrap_or("remote");
            let path = args.get("path").and_then(|v| v.as_str()).unwrap_or("/");
            
            if location == "local" {
                let files = get_local_files(path.to_string())
                    .await
                    .map_err(|e| e.to_string())?;
                Ok(serde_json::json!({
                    "success": true,
                    "count": files.len(),
                    "files": files.iter().take(20).map(|f| {
                        serde_json::json!({
                            "name": f.name,
                            "is_dir": f.is_dir,
                            "size": f.size
                        })
                    }).collect::<Vec<_>>()
                }))
            } else {
                let mut manager = state.ftp_manager.lock().await;
                let files = manager.list_files().await.map_err(|e| e.to_string())?;
                Ok(serde_json::json!({
                    "success": true,
                    "count": files.len(),
                    "files": files.iter().take(20).map(|f| {
                        serde_json::json!({
                            "name": f.name,
                            "is_dir": f.is_dir,
                            "size": f.size
                        })
                    }).collect::<Vec<_>>()
                }))
            }
        },
        
        "read_file" => {
            let location = args.get("location").and_then(|v| v.as_str()).unwrap_or("remote");
            let path = args.get("path").and_then(|v| v.as_str()).ok_or("path required")?;
            
            if location == "local" {
                let content = read_local_file(path.to_string())
                    .await
                    .map_err(|e| e.to_string())?;
                Ok(serde_json::json!({
                    "success": true,
                    "content": content.chars().take(5000).collect::<String>(),
                    "truncated": content.len() > 5000
                }))
            } else {
                let content = preview_remote_file(state.clone(), path.to_string())
                    .await
                    .map_err(|e| e.to_string())?;
                Ok(serde_json::json!({
                    "success": true,
                    "content": content.chars().take(5000).collect::<String>(),
                    "truncated": content.len() > 5000
                }))
            }
        },
        
        "create_folder" => {
            let location = args.get("location").and_then(|v| v.as_str()).unwrap_or("remote");
            let path = args.get("path").and_then(|v| v.as_str()).ok_or("path required")?;
            
            if location == "local" {
                create_local_folder(path.to_string())
                    .await
                    .map_err(|e| e.to_string())?;
            } else {
                create_remote_folder(state.clone(), path.to_string())
                    .await
                    .map_err(|e| e.to_string())?;
            }
            Ok(serde_json::json!({ "success": true, "message": format!("Created folder: {}", path) }))
        },
        
        "delete_file" => {
            let location = args.get("location").and_then(|v| v.as_str()).unwrap_or("remote");
            let path = args.get("path").and_then(|v| v.as_str()).ok_or("path required")?;
            
            if location == "local" {
                delete_local_file(path.to_string())
                    .await
                    .map_err(|e| e.to_string())?;
            } else {
                // Assume file, not directory for simple delete
                delete_remote_file(state.clone(), path.to_string(), false)
                    .await
                    .map_err(|e| e.to_string())?;
            }
            Ok(serde_json::json!({ "success": true, "message": format!("Deleted: {}", path) }))
        },
        
        "rename_file" => {
            let location = args.get("location").and_then(|v| v.as_str()).unwrap_or("remote");
            let old_path = args.get("old_path").and_then(|v| v.as_str()).ok_or("old_path required")?;
            let new_path = args.get("new_path").and_then(|v| v.as_str()).ok_or("new_path required")?;
            
            if location == "local" {
                rename_local_file(old_path.to_string(), new_path.to_string())
                    .await
                    .map_err(|e| e.to_string())?;
            } else {
                rename_remote_file(state.clone(), old_path.to_string(), new_path.to_string())
                    .await
                    .map_err(|e| e.to_string())?;
            }
            Ok(serde_json::json!({ "success": true, "message": format!("Renamed {} to {}", old_path, new_path) }))
        },
        
        "download_file" => {
            let remote_path = args.get("remote_path").and_then(|v| v.as_str()).ok_or("remote_path required")?;
            let local_path = args.get("local_path").and_then(|v| v.as_str()).ok_or("local_path required")?;
            
            download_file(app, state.clone(), DownloadParams {
                remote_path: remote_path.to_string(),
                local_path: local_path.to_string(),
            }).await.map_err(|e| e.to_string())?;
            
            Ok(serde_json::json!({ "success": true, "message": format!("Downloaded {} to {}", remote_path, local_path) }))
        },
        
        "upload_file" => {
            let local_path = args.get("local_path").and_then(|v| v.as_str()).ok_or("local_path required")?;
            let remote_path = args.get("remote_path").and_then(|v| v.as_str()).ok_or("remote_path required")?;
            
            upload_file(app, state.clone(), UploadParams {
                local_path: local_path.to_string(),
                remote_path: remote_path.to_string(),
            }).await.map_err(|e| e.to_string())?;
            
            Ok(serde_json::json!({ "success": true, "message": format!("Uploaded {} to {}", local_path, remote_path) }))
        },
        
        "chmod" => {
            let path = args.get("path").and_then(|v| v.as_str()).ok_or("path required")?;
            let mode = args.get("mode").and_then(|v| v.as_str()).ok_or("mode required")?;
            
            chmod_remote_file(state.clone(), path.to_string(), mode.to_string())
                .await
                .map_err(|e| e.to_string())?;
            
            Ok(serde_json::json!({ "success": true, "message": format!("Changed permissions of {} to {}", path, mode) }))
        },
        
        _ => Err(format!("Unknown tool: {}", request.tool_name))
    }
}

// ============ AeroCloud Commands ============

#[tauri::command]
fn get_cloud_config() -> CloudConfig {
    cloud_config::load_cloud_config()
}

#[tauri::command]
fn save_cloud_config_cmd(config: CloudConfig) -> Result<(), String> {
    cloud_config::save_cloud_config(&config)
}

#[tauri::command]
async fn setup_aerocloud(
    local_folder: String,
    remote_folder: String,
    server_profile: String,
    sync_on_change: bool,
    sync_interval_secs: u64,
) -> Result<CloudConfig, String> {
    let mut config = CloudConfig::default();
    config.enabled = true;
    config.local_folder = std::path::PathBuf::from(&local_folder);
    config.remote_folder = remote_folder.clone();
    config.server_profile = server_profile;
    config.sync_on_change = sync_on_change;
    config.sync_interval_secs = sync_interval_secs;
    
    // Validate configuration
    cloud_config::validate_config(&config)?;
    
    // Ensure local cloud folder exists
    cloud_config::ensure_cloud_folder(&config)?;
    
    // Save configuration
    cloud_config::save_cloud_config(&config)?;
    
    info!("AeroCloud setup complete: local={}, remote={}", local_folder, remote_folder);
    
    Ok(config)
}

#[tauri::command]
fn get_cloud_status() -> CloudSyncStatus {
    let config = cloud_config::load_cloud_config();
    
    if !config.enabled {
        return CloudSyncStatus::NotConfigured;
    }
    
    CloudSyncStatus::Idle {
        last_sync: config.last_sync,
        next_sync: None, // Will be calculated by sync service
    }
}

#[tauri::command]
fn enable_aerocloud(enabled: bool) -> Result<CloudConfig, String> {
    let mut config = cloud_config::load_cloud_config();
    
    if enabled {
        // Validate before enabling
        cloud_config::validate_config(&config)?;
        cloud_config::ensure_cloud_folder(&config)?;
    }
    
    config.enabled = enabled;
    cloud_config::save_cloud_config(&config)?;
    
    info!("AeroCloud {}", if enabled { "enabled" } else { "disabled" });
    
    Ok(config)
}

#[tauri::command]
fn get_default_cloud_folder() -> String {
    let default_config = CloudConfig::default();
    default_config.local_folder.to_string_lossy().to_string()
}

#[tauri::command]
fn update_conflict_strategy(strategy: ConflictStrategy) -> Result<(), String> {
    let mut config = cloud_config::load_cloud_config();
    config.conflict_strategy = strategy;
    cloud_config::save_cloud_config(&config)
}

#[tauri::command]
async fn trigger_cloud_sync(state: tauri::State<'_, AppState>) -> Result<String, String> {
    let config = cloud_config::load_cloud_config();
    
    info!("AeroCloud sync triggered");
    info!("Config - enabled: {}, local: {:?}, remote: {}", 
        config.enabled, config.local_folder, config.remote_folder);
    
    if !config.enabled {
        return Err("AeroCloud is not configured. Please set it up first.".to_string());
    }
    
    // Get FTP manager and perform sync
    let mut ftp_manager = state.ftp_manager.lock().await;
    
    if !ftp_manager.is_connected() {
        return Err("Not connected to FTP server. Please connect first.".to_string());
    }
    
    info!("FTP connected, starting sync...");
    
    // First, ensure remote folder exists and navigate to it
    if let Err(_e) = ftp_manager.change_dir(&config.remote_folder).await {
        info!("Remote folder {} doesn't exist, creating it...", config.remote_folder);
        // Try to create the folder
        if let Err(e) = ftp_manager.mkdir(&config.remote_folder).await {
            warn!("Could not create remote folder: {}", e);
        }
    }
    
    // Create cloud service and run sync
    let cloud_service = cloud_service::CloudService::new();
    cloud_service.init(config.clone()).await;
    
    match cloud_service.perform_full_sync(&mut ftp_manager).await {
        Ok(result) => {
            let summary = format!(
                "Sync complete: {} uploaded, {} downloaded, {} conflicts, {} skipped, {} errors",
                result.uploaded, result.downloaded, result.conflicts, result.skipped, result.errors.len()
            );
            info!("{}", summary);
            if !result.errors.is_empty() {
                for err in &result.errors {
                    warn!("Sync error: {}", err);
                }
            }
            Ok(summary)
        }
        Err(e) => {
            error!("Sync failed: {}", e);
            Err(format!("Sync failed: {}", e))
        }
    }
}
// ============ Background Sync & Tray Commands ============

use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

// Global flag to control background sync
static BACKGROUND_SYNC_RUNNING: AtomicBool = AtomicBool::new(false);

/// Background sync worker - runs in a separate tokio task
/// Creates its own FTP connection to avoid conflicts with main UI
async fn background_sync_worker(app: AppHandle) {
    info!("Background sync worker started");
    
    // Run first sync immediately, then loop with intervals
    let mut is_first_run = true;
    
    loop {
        // Check if we should stop
        if !BACKGROUND_SYNC_RUNNING.load(Ordering::SeqCst) {
            info!("Background sync worker stopping (flag set to false)");
            break;
        }
        
        // Load fresh config each cycle
        let config = cloud_config::load_cloud_config();
        if !config.enabled {
            info!("AeroCloud disabled, stopping background sync");
            BACKGROUND_SYNC_RUNNING.store(false, Ordering::SeqCst);
            let _ = app.emit("cloud-sync-status", serde_json::json!({
                "status": "disabled",
                "message": "AeroCloud is disabled"
            }));
            break;
        }
        
        // On first run, sync immediately. On subsequent runs, wait for interval first.
        if !is_first_run {
            let interval_secs = config.sync_interval_secs.max(30); // Minimum 30 seconds for testing
            info!("Background sync: next sync in {}s", interval_secs);
            
            // Wait for interval (check cancel flag every 5 seconds)
            let mut waited = 0u64;
            while waited < interval_secs {
                if !BACKGROUND_SYNC_RUNNING.load(Ordering::SeqCst) {
                    info!("Background sync cancelled during wait");
                    break;
                }
                tokio::time::sleep(Duration::from_secs(5)).await;
                waited += 5;
            }
            
            // Check again after waiting
            if !BACKGROUND_SYNC_RUNNING.load(Ordering::SeqCst) {
                break;
            }
        }
        is_first_run = false;
        
        // Perform sync with dedicated FTP connection
        info!("Background sync: starting sync cycle");
        
        // Emit syncing status
        let _ = app.emit("cloud-sync-status", serde_json::json!({
            "status": "syncing",
            "message": "Syncing..."
        }));
        
        match perform_background_sync(&config).await {
            Ok(result) => {
                info!("Background sync completed: {} uploaded, {} downloaded, {} errors",
                    result.uploaded, result.downloaded, result.errors.len());
                
                // Emit success
                let _ = app.emit("cloud-sync-status", serde_json::json!({
                    "status": "active",
                    "message": format!("Synced: ↑{} ↓{}", result.uploaded, result.downloaded)
                }));
                
                // Emit sync complete event for UI
                let _ = app.emit("cloud_sync_complete", &result);
            }
            Err(e) => {
                warn!("Background sync failed: {}", e);
                let _ = app.emit("cloud-sync-status", serde_json::json!({
                    "status": "error",
                    "message": format!("Sync failed: {}", e)
                }));
                
                // On error, wait a bit before retrying to avoid spamming
                tokio::time::sleep(Duration::from_secs(30)).await;
            }
        }
    }
    
    info!("Background sync worker exited");
}

/// Perform a sync cycle with a dedicated FTP connection
/// This avoids conflicts with the main UI FTP connection
async fn perform_background_sync(config: &cloud_config::CloudConfig) -> Result<cloud_service::SyncOperationResult, String> {
    // Load saved server credentials
    let server_profile = &config.server_profile;
    
    // Try to get server credentials from saved servers (localStorage sync)
    // For now, we'll use a simple approach - the sync requires active main connection
    // In the future, we could store encrypted credentials
    
    // Create dedicated FTP manager for background sync
    let mut ftp_manager = ftp::FtpManager::new();
    
    // We need server credentials - check if we have them saved
    // For MVP, background sync only works if the server is already connected in main UI
    // and we use the same credentials from config file
    
    // Try to connect using saved credentials
    let creds_path = dirs::config_dir()
        .unwrap_or_else(|| dirs::home_dir().unwrap_or_else(|| std::path::PathBuf::from(".")))
        .join("aeroftp")
        .join("server_credentials.json");
    
    #[derive(serde::Deserialize)]
    struct SavedCredentials {
        server: String,
        username: String,
        password: String,
    }
    
    info!("Background sync: looking for credentials at {:?} for profile '{}'", creds_path, server_profile);
    
    // Try to load credentials for the profile
    match tokio::fs::read_to_string(&creds_path).await {
        Ok(content) => {
            info!("Background sync: credentials file found, parsing...");
            match serde_json::from_str::<std::collections::HashMap<String, SavedCredentials>>(&content) {
                Ok(creds_map) => {
                    info!("Background sync: found {} saved profiles", creds_map.len());
                    if let Some(creds) = creds_map.get(server_profile) {
                        // Connect to server
                        ftp_manager.connect(&creds.server)
                            .await
                            .map_err(|e| format!("Failed to connect for background sync: {}", e))?;
                        
                        // Login with credentials
                        ftp_manager.login(&creds.username, &creds.password)
                            .await
                            .map_err(|e| format!("Failed to login for background sync: {}", e))?;
                            
                        info!("Background sync: connected to {} as {}", creds.server, creds.username);
                    } else {
                        let available: Vec<_> = creds_map.keys().collect();
                        return Err(format!("No saved credentials for profile '{}'. Available: {:?}", server_profile, available));
                    }
                }
                Err(e) => {
                    return Err(format!("Failed to parse saved credentials: {}", e));
                }
            }
        }
        Err(e) => {
            return Err(format!("No saved credentials file at {:?}: {}. Please re-setup AeroCloud to save credentials.", creds_path, e));
        }
    }
    
    // Navigate to remote folder
    if ftp_manager.change_dir(&config.remote_folder).await.is_err() {
        // Try to create it
        let _ = ftp_manager.mkdir(&config.remote_folder).await;
        ftp_manager.change_dir(&config.remote_folder).await
            .map_err(|e| format!("Failed to navigate to remote folder: {}", e))?;
    }
    
    // Create cloud service and perform sync
    let cloud_service = cloud_service::CloudService::new();
    cloud_service.init(config.clone()).await;
    
    let result = cloud_service.perform_full_sync(&mut ftp_manager).await?;
    
    // Disconnect
    let _ = ftp_manager.disconnect().await;
    
    Ok(result)
}

#[tauri::command]
async fn start_background_sync(
    app: AppHandle,
    _state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    if BACKGROUND_SYNC_RUNNING.load(Ordering::SeqCst) {
        return Ok("Background sync already running".to_string());
    }

    let config = cloud_config::load_cloud_config();
    if !config.enabled {
        return Err("AeroCloud not configured".to_string());
    }

    // Set flag before spawning
    BACKGROUND_SYNC_RUNNING.store(true, Ordering::SeqCst);
    
    // Clone app handle for the spawned task
    let app_clone = app.clone();
    
    // Spawn background worker
    tokio::spawn(async move {
        background_sync_worker(app_clone).await;
    });
    
    // Emit status
    let _ = app.emit("cloud-sync-status", serde_json::json!({
        "status": "active",
        "message": "Background sync started"
    }));

    info!("Background sync started with interval: {}s", config.sync_interval_secs);
    
    Ok(format!("Background sync started (interval: {}s)", config.sync_interval_secs))
}

#[tauri::command]
async fn stop_background_sync(app: AppHandle) -> Result<String, String> {
    if !BACKGROUND_SYNC_RUNNING.load(Ordering::SeqCst) {
        return Ok("Background sync not running".to_string());
    }

    BACKGROUND_SYNC_RUNNING.store(false, Ordering::SeqCst);
    
    // Emit status
    let _ = app.emit("cloud-sync-status", serde_json::json!({
        "status": "idle",
        "message": "Background sync stopped"
    }));

    info!("Background sync stopped");
    
    Ok("Background sync stopped".to_string())
}

#[tauri::command]
fn is_background_sync_running() -> bool {
    BACKGROUND_SYNC_RUNNING.load(Ordering::SeqCst)
}

#[tauri::command]
async fn set_tray_status(app: AppHandle, status: String, tooltip: Option<String>) -> Result<(), String> {
    let _ = app.emit("tray-status-update", serde_json::json!({
        "status": status,
        "tooltip": tooltip.unwrap_or_else(|| "AeroCloud".to_string())
    }));
    
    info!("Tray status updated: {}", status);
    Ok(())
}

/// Save server credentials for background sync use
#[tauri::command]
async fn save_server_credentials(
    profile_name: String,
    server: String,
    username: String,
    password: String,
) -> Result<(), String> {
    let creds_path = dirs::config_dir()
        .unwrap_or_else(|| dirs::home_dir().unwrap_or_else(|| std::path::PathBuf::from(".")))
        .join("aeroftp")
        .join("server_credentials.json");
    
    // Load existing credentials
    let mut creds_map: std::collections::HashMap<String, serde_json::Value> = 
        if let Ok(content) = tokio::fs::read_to_string(&creds_path).await {
            serde_json::from_str(&content).unwrap_or_default()
        } else {
            std::collections::HashMap::new()
        };
    
    // Add/update credentials
    creds_map.insert(profile_name.clone(), serde_json::json!({
        "server": server,
        "username": username,
        "password": password
    }));
    
    // Ensure directory exists
    if let Some(parent) = creds_path.parent() {
        tokio::fs::create_dir_all(parent).await
            .map_err(|e| format!("Failed to create config dir: {}", e))?;
    }
    
    // Save
    let content = serde_json::to_string_pretty(&creds_map)
        .map_err(|e| format!("Failed to serialize credentials: {}", e))?;
    
    tokio::fs::write(&creds_path, content).await
        .map_err(|e| format!("Failed to save credentials: {}", e))?;
    
    info!("Saved credentials for profile: {}", profile_name);
    Ok(())
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
            use tauri::tray::{TrayIconBuilder, MouseButton, MouseButtonState};
            
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
            let devtools_submenu = Submenu::with_items(
                app,
                "DevTools",
                true,
                &[
                    &MenuItem::with_id(app, "toggle_devtools", "Toggle DevTools", true, Some("CmdOrCtrl+Shift+D"))?,
                    &PredefinedMenuItem::separator(app)?,
                    &MenuItem::with_id(app, "toggle_editor", "Toggle Editor", true, Some("CmdOrCtrl+1"))?,
                    &MenuItem::with_id(app, "toggle_terminal", "Toggle Terminal", true, Some("CmdOrCtrl+2"))?,
                    &MenuItem::with_id(app, "toggle_agent", "Toggle Agent", true, Some("CmdOrCtrl+3"))?,
                ],
            )?;
            
            let view_menu = Submenu::with_items(
                app,
                "View",
                true,
                &[
                    &refresh,
                    &PredefinedMenuItem::separator(app)?,
                    &MenuItem::with_id(app, "toggle_theme", "Toggle Theme", true, Some("CmdOrCtrl+T"))?,
                    &PredefinedMenuItem::separator(app)?,
                    &devtools_submenu,
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
            
            // ============ System Tray Icon ============
            // Create tray menu
            let tray_sync_now = MenuItem::with_id(app, "tray_sync_now", "Sync Now", true, None::<&str>)?;
            let tray_pause = MenuItem::with_id(app, "tray_pause", "Pause Sync", true, None::<&str>)?;
            let tray_open_folder = MenuItem::with_id(app, "tray_open_folder", "Open Cloud Folder", true, None::<&str>)?;
            let tray_separator = PredefinedMenuItem::separator(app)?;
            let tray_show = MenuItem::with_id(app, "tray_show", "Show AeroFTP", true, None::<&str>)?;
            let tray_quit = MenuItem::with_id(app, "tray_quit", "Quit", true, None::<&str>)?;
            
            let tray_menu = Menu::with_items(app, &[
                &tray_sync_now,
                &tray_pause,
                &tray_separator,
                &tray_open_folder,
                &PredefinedMenuItem::separator(app)?,
                &tray_show,
                &tray_quit,
            ])?;
            
            // Build tray icon using the app's default icon
            let icon = app.default_window_icon()
                .cloned()
                .expect("Failed to load tray icon - ensure icon is set in tauri.conf.json");
            
            let _tray = TrayIconBuilder::new()
                .icon(icon)
                .tooltip("AeroCloud - Idle")
                .menu(&tray_menu)
                .on_menu_event(|app, event| {
                    let id = event.id().as_ref();
                    info!("Tray menu event: {}", id);
                    match id {
                        "tray_sync_now" => {
                            let _ = app.emit("menu-event", "cloud_sync_now");
                        }
                        "tray_pause" => {
                            let _ = app.emit("menu-event", "cloud_pause");
                        }
                        "tray_open_folder" => {
                            let _ = app.emit("menu-event", "cloud_open_folder");
                        }
                        "tray_show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        "tray_quit" => {
                            std::process::exit(0);
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    // Click on tray icon shows the window
                    if let tauri::tray::TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                        if let Some(window) = tray.app_handle().get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;
            
            info!("System tray icon initialized");
            
            Ok(())
        })
        .on_menu_event(|app, event| {
            let id = event.id().as_ref();
            info!("Menu event: {}", id);
            // Emit event to frontend
            let _ = app.emit("menu-event", id);
        })
        .on_window_event(|window, event| {
            // Hide window instead of closing when AeroCloud is enabled
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                // Check if AeroCloud is enabled (should stay in tray)
                let cloud_config = cloud_config::load_cloud_config();
                if cloud_config.enabled {
                    info!("Window close requested, hiding to tray (AeroCloud enabled)");
                    let _ = window.hide();
                    api.prevent_close();
                } else {
                    info!("Window close requested, AeroCloud not enabled, exiting");
                }
            }
        })
        .manage(AppState::new());

    // Add PTY state only on Unix systems
    #[cfg(unix)]
    let builder = builder.manage(create_pty_state());

    builder
        .invoke_handler(tauri::generate_handler![
            connect_ftp,
            disconnect_ftp,
            check_connection,
            ftp_noop,
            reconnect_ftp,
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
            ftp_read_file_base64,
            read_local_file,
            read_local_file_base64,
            preview_remote_file,
            save_local_file,
            save_remote_file,
            toggle_menu_bar,
            compare_directories,
            get_compare_options_default,
            // AeroCloud commands
            get_cloud_config,
            save_cloud_config_cmd,
            setup_aerocloud,
            get_cloud_status,
            enable_aerocloud,
            get_default_cloud_folder,
            update_conflict_strategy,
            trigger_cloud_sync,
            // Background sync & tray commands
            start_background_sync,
            stop_background_sync,
            is_background_sync_running,
            set_tray_status,
            save_server_credentials,
            // AI commands
            ai_chat,
            ai_test_provider,
            ai_execute_tool,
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