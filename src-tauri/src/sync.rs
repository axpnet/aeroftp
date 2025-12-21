// AeroFTP Sync Module
// File comparison and synchronization logic

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;

/// Tolerance for timestamp comparison (seconds)
/// Accounts for filesystem and timezone differences
const TIMESTAMP_TOLERANCE_SECS: i64 = 2;

/// Status of a file comparison
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum SyncStatus {
    /// Files are identical (same size and timestamp within tolerance)
    Identical,
    /// Local file is newer -> should upload
    LocalNewer,
    /// Remote file is newer -> should download
    RemoteNewer,
    /// File exists only locally -> upload or ignore
    LocalOnly,
    /// File exists only remotely -> download or ignore
    RemoteOnly,
    /// Both files modified since last sync -> user decision needed
    Conflict,
    /// Same timestamp but different size -> likely checksum needed
    SizeMismatch,
}

/// Information about a file (local or remote)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileInfo {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub modified: Option<DateTime<Utc>>,
    pub is_dir: bool,
    pub checksum: Option<String>,
}

/// Result of comparing a single file/directory
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileComparison {
    pub relative_path: String,
    pub status: SyncStatus,
    pub local_info: Option<FileInfo>,
    pub remote_info: Option<FileInfo>,
    pub is_dir: bool,
}

/// Options for comparison
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompareOptions {
    /// Compare by timestamp
    pub compare_timestamp: bool,
    /// Compare by size
    pub compare_size: bool,
    /// Compare by checksum (slower but accurate)
    pub compare_checksum: bool,
    /// Patterns to exclude (e.g., "node_modules", ".git")
    pub exclude_patterns: Vec<String>,
    /// Direction of comparison
    pub direction: SyncDirection,
}

impl Default for CompareOptions {
    fn default() -> Self {
        Self {
            compare_timestamp: true,
            compare_size: true,
            compare_checksum: false,
            exclude_patterns: vec![
                "node_modules".to_string(),
                ".git".to_string(),
                ".DS_Store".to_string(),
                "Thumbs.db".to_string(),
                "__pycache__".to_string(),
                "*.pyc".to_string(),
                ".env".to_string(),
                "target".to_string(),
            ],
            direction: SyncDirection::Bidirectional,
        }
    }
}

/// Direction of synchronization
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum SyncDirection {
    /// Local -> Remote (upload changes)
    LocalToRemote,
    /// Remote -> Local (download changes)
    RemoteToLocal,
    /// Both directions (full sync)
    Bidirectional,
}

/// Action to perform during sync
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SyncAction {
    Upload,
    Download,
    DeleteLocal,
    DeleteRemote,
    Skip,
    AskUser,
}

/// A sync operation to execute
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncOperation {
    pub comparison: FileComparison,
    pub action: SyncAction,
}

/// Result of sync operations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncResult {
    pub uploaded: u32,
    pub downloaded: u32,
    pub deleted: u32,
    pub skipped: u32,
    pub errors: Vec<String>,
}

impl SyncResult {
    pub fn new() -> Self {
        Self {
            uploaded: 0,
            downloaded: 0,
            deleted: 0,
            skipped: 0,
            errors: Vec::new(),
        }
    }
}

/// Check if a path matches any exclude pattern
pub fn should_exclude(path: &str, patterns: &[String]) -> bool {
    let path_lower = path.to_lowercase();
    
    for pattern in patterns {
        let pattern_lower = pattern.to_lowercase();
        
        // Simple glob matching
        if pattern_lower.starts_with('*') {
            // *.ext pattern
            let ext = &pattern_lower[1..];
            if path_lower.ends_with(ext) {
                return true;
            }
        } else if path_lower.contains(&pattern_lower) {
            // Direct name match
            return true;
        }
    }
    
    false
}

/// Compare two timestamps with tolerance
pub fn timestamps_equal(local: Option<DateTime<Utc>>, remote: Option<DateTime<Utc>>) -> bool {
    match (local, remote) {
        (Some(l), Some(r)) => {
            (l.signed_duration_since(r)).num_seconds().abs() <= TIMESTAMP_TOLERANCE_SECS
        }
        _ => false,
    }
}

/// Determine which timestamp is newer
pub fn compare_timestamps(local: Option<DateTime<Utc>>, remote: Option<DateTime<Utc>>) -> Option<SyncStatus> {
    match (local, remote) {
        (Some(l), Some(r)) => {
            let diff = l.signed_duration_since(r).num_seconds();
            if diff.abs() <= TIMESTAMP_TOLERANCE_SECS {
                None // Equal within tolerance
            } else if diff > 0 {
                Some(SyncStatus::LocalNewer)
            } else {
                Some(SyncStatus::RemoteNewer)
            }
        }
        _ => None, // Can't compare if timestamps missing
    }
}

/// Compare a single file pair and determine status
pub fn compare_file_pair(
    local: Option<&FileInfo>,
    remote: Option<&FileInfo>,
    options: &CompareOptions,
) -> SyncStatus {
    match (local, remote) {
        (None, None) => SyncStatus::Identical, // Shouldn't happen
        (Some(_), None) => SyncStatus::LocalOnly,
        (None, Some(_)) => SyncStatus::RemoteOnly,
        (Some(l), Some(r)) => {
            // Both exist - compare attributes
            
            // First check size if enabled
            if options.compare_size && l.size != r.size {
                // Different sizes - determine which is newer
                if options.compare_timestamp {
                    match compare_timestamps(l.modified, r.modified) {
                        Some(status) => return status,
                        None => return SyncStatus::SizeMismatch,
                    }
                } else {
                    return SyncStatus::SizeMismatch;
                }
            }
            
            // Size is same (or not comparing size), check timestamp
            if options.compare_timestamp {
                if timestamps_equal(l.modified, r.modified) {
                    SyncStatus::Identical
                } else {
                    match compare_timestamps(l.modified, r.modified) {
                        Some(status) => status,
                        None => SyncStatus::Identical,
                    }
                }
            } else {
                // Not comparing anything else, assume identical
                SyncStatus::Identical
            }
        }
    }
}

/// Build comparison results from local and remote file maps
pub fn build_comparison_results(
    local_files: HashMap<String, FileInfo>,
    remote_files: HashMap<String, FileInfo>,
    options: &CompareOptions,
) -> Vec<FileComparison> {
    let mut results = Vec::new();
    let mut all_paths: std::collections::HashSet<String> = local_files.keys().cloned().collect();
    all_paths.extend(remote_files.keys().cloned());
    
    for path in all_paths {
        // Skip excluded paths
        if should_exclude(&path, &options.exclude_patterns) {
            continue;
        }
        
        let local = local_files.get(&path);
        let remote = remote_files.get(&path);
        
        let status = compare_file_pair(local, remote, options);
        
        // Skip identical files unless they're directories we need to show
        let is_dir = local.map(|f| f.is_dir).unwrap_or(false) 
                  || remote.map(|f| f.is_dir).unwrap_or(false);
        
        if status != SyncStatus::Identical || is_dir {
            results.push(FileComparison {
                relative_path: path,
                status,
                local_info: local.cloned(),
                remote_info: remote.cloned(),
                is_dir,
            });
        }
    }
    
    // Sort by path for consistent display
    results.sort_by(|a, b| a.relative_path.cmp(&b.relative_path));
    
    results
}

/// Determine the recommended action based on comparison status and direction
pub fn get_recommended_action(status: &SyncStatus, direction: &SyncDirection) -> SyncAction {
    match (status, direction) {
        // Bidirectional
        (SyncStatus::LocalNewer, SyncDirection::Bidirectional) => SyncAction::Upload,
        (SyncStatus::RemoteNewer, SyncDirection::Bidirectional) => SyncAction::Download,
        (SyncStatus::LocalOnly, SyncDirection::Bidirectional) => SyncAction::Upload,
        (SyncStatus::RemoteOnly, SyncDirection::Bidirectional) => SyncAction::Download,
        (SyncStatus::Conflict, _) => SyncAction::AskUser,
        (SyncStatus::SizeMismatch, _) => SyncAction::AskUser,
        
        // Local to Remote
        (SyncStatus::LocalNewer, SyncDirection::LocalToRemote) => SyncAction::Upload,
        (SyncStatus::LocalOnly, SyncDirection::LocalToRemote) => SyncAction::Upload,
        (SyncStatus::RemoteNewer, SyncDirection::LocalToRemote) => SyncAction::Skip,
        (SyncStatus::RemoteOnly, SyncDirection::LocalToRemote) => SyncAction::DeleteRemote,
        
        // Remote to Local
        (SyncStatus::RemoteNewer, SyncDirection::RemoteToLocal) => SyncAction::Download,
        (SyncStatus::RemoteOnly, SyncDirection::RemoteToLocal) => SyncAction::Download,
        (SyncStatus::LocalNewer, SyncDirection::RemoteToLocal) => SyncAction::Skip,
        (SyncStatus::LocalOnly, SyncDirection::RemoteToLocal) => SyncAction::DeleteLocal,
        
        // Identical - no action needed
        (SyncStatus::Identical, _) => SyncAction::Skip,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_should_exclude() {
        let patterns = vec!["node_modules".to_string(), "*.pyc".to_string()];
        
        assert!(should_exclude("node_modules/package/file.js", &patterns));
        assert!(should_exclude("src/__pycache__/module.pyc", &patterns));
        assert!(!should_exclude("src/main.rs", &patterns));
    }
    
    #[test]
    fn test_compare_file_pair_local_only() {
        let local = FileInfo {
            name: "test.txt".to_string(),
            path: "/local/test.txt".to_string(),
            size: 100,
            modified: Some(Utc::now()),
            is_dir: false,
            checksum: None,
        };
        
        let options = CompareOptions::default();
        let status = compare_file_pair(Some(&local), None, &options);
        
        assert_eq!(status, SyncStatus::LocalOnly);
    }
}
