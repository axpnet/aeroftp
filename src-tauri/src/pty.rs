// PTY (Pseudo-Terminal) module for real shell integration
// Uses portable-pty for cross-platform support (Linux/macOS/Windows)

use portable_pty::{native_pty_system, CommandBuilder, PtyPair, PtySize};
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use tauri::State;

/// Holds the PTY pair (master/slave) for the terminal session
pub struct PtySession {
    pub pair: Option<PtyPair>,
    pub reader: Option<Box<dyn Read + Send>>,
    pub writer: Option<Box<dyn Write + Send>>,
}

impl Default for PtySession {
    fn default() -> Self {
        Self {
            pair: None,
            reader: None,
            writer: None,
        }
    }
}

/// Global PTY state wrapped in Arc<Mutex>
pub type PtyState = Arc<Mutex<PtySession>>;

/// Create a new PTY state
pub fn create_pty_state() -> PtyState {
    Arc::new(Mutex::new(PtySession::default()))
}

/// Spawn a new shell in the PTY
#[tauri::command]
pub fn spawn_shell(pty_state: State<'_, PtyState>) -> Result<String, String> {
    let pty_system = native_pty_system();
    
    let pair = pty_system
        .openpty(PtySize {
            rows: 24,
            cols: 80,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("Failed to open PTY: {}", e))?;

    // Determine the shell to use
    #[cfg(unix)]
    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string());
    
    #[cfg(windows)]
    let shell = "powershell.exe".to_string();

    let mut cmd = CommandBuilder::new(&shell);
    
    // Set environment variables for better terminal experience
    cmd.env("TERM", "xterm-256color");
    cmd.env("COLORTERM", "truecolor");
    
    // Get current working directory
    if let Ok(cwd) = std::env::current_dir() {
        cmd.cwd(cwd);
    }

    // Spawn the shell
    let _child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| format!("Failed to spawn shell: {}", e))?;

    // Get reader and writer from master
    let reader = pair
        .master
        .try_clone_reader()
        .map_err(|e| format!("Failed to clone reader: {}", e))?;

    let writer = pair
        .master
        .take_writer()
        .map_err(|e| format!("Failed to take writer: {}", e))?;

    // Store in state
    let mut session = pty_state.lock().map_err(|_| "Lock error")?;
    session.pair = Some(pair);
    session.reader = Some(reader);
    session.writer = Some(writer);

    Ok(format!("Shell started: {}", shell))
}

/// Write data to the PTY (send keystrokes to shell)
#[tauri::command]
pub fn pty_write(pty_state: State<'_, PtyState>, data: String) -> Result<(), String> {
    let mut session = pty_state.lock().map_err(|_| "Lock error")?;
    
    if let Some(ref mut writer) = session.writer {
        writer
            .write_all(data.as_bytes())
            .map_err(|e| format!("Write error: {}", e))?;
        writer.flush().map_err(|e| format!("Flush error: {}", e))?;
        Ok(())
    } else {
        Err("No active PTY session".to_string())
    }
}

/// Read data from the PTY (get shell output)
#[tauri::command]
pub fn pty_read(pty_state: State<'_, PtyState>) -> Result<String, String> {
    let mut session = pty_state.lock().map_err(|_| "Lock error")?;
    
    if let Some(ref mut reader) = session.reader {
        let mut buffer = [0u8; 4096];
        
        // Non-blocking read attempt
        match reader.read(&mut buffer) {
            Ok(0) => Ok(String::new()), // No data
            Ok(n) => {
                let output = String::from_utf8_lossy(&buffer[..n]).to_string();
                Ok(output)
            }
            Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => Ok(String::new()),
            Err(e) => Err(format!("Read error: {}", e)),
        }
    } else {
        Err("No active PTY session".to_string())
    }
}

/// Resize the PTY
#[tauri::command]
pub fn pty_resize(pty_state: State<'_, PtyState>, rows: u16, cols: u16) -> Result<(), String> {
    let session = pty_state.lock().map_err(|_| "Lock error")?;
    
    if let Some(ref pair) = session.pair {
        pair.master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("Resize error: {}", e))?;
        Ok(())
    } else {
        Err("No active PTY session".to_string())
    }
}

/// Close the PTY session
#[tauri::command]
pub fn pty_close(pty_state: State<'_, PtyState>) -> Result<(), String> {
    let mut session = pty_state.lock().map_err(|_| "Lock error")?;
    
    session.pair = None;
    session.reader = None;
    session.writer = None;
    
    Ok(())
}
