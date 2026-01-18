// Remote file from FTP server
export interface RemoteFile {
  name: string;
  path: string;
  size: number | null;
  is_dir: boolean;
  modified: string | null;
  permissions: string | null;
}

export interface FileListResponse {
  files: RemoteFile[];
  current_path: string;
}

export interface ConnectionParams {
  server: string;
  username: string;
  password: string;
}

export interface DownloadParams {
  remote_path: string;
  local_path: string;
}

export interface UploadParams {
  local_path: string;
  remote_path: string;
}

export interface DownloadFolderParams {
  remote_path: string;
  local_path: string;
}

export interface UploadFolderParams {
  local_path: string;
  remote_path: string;
}

// Local file from filesystem (from backend)
export interface LocalFile {
  name: string;
  path: string;
  size: number | null;
  is_dir: boolean;
  modified: string | null;
}

// Transfer progress event from backend
export interface TransferProgress {
  transfer_id: string;
  filename: string;
  transferred: number;
  total: number;
  percentage: number;
  speed_bps: number;
  eta_seconds: number;
  direction: 'download' | 'upload';
}

// Transfer event from backend (includes transfers and deletes)
export interface TransferEvent {
  event_type: 
    // Transfer events
    | 'start' | 'progress' | 'complete' | 'error' | 'cancelled'
    | 'file_start' | 'file_complete' | 'file_error'
    // Delete events
    | 'delete_start' | 'delete_complete' | 'delete_error'
    | 'delete_file_start' | 'delete_file_complete' | 'delete_file_error'
    | 'delete_dir_complete';
  transfer_id: string;
  filename: string;
  direction: 'download' | 'upload' | 'local' | 'remote';
  message?: string;
  progress?: TransferProgress;
}

// Server profile for saved connections
export interface ServerProfile {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  password?: string;
  initialPath?: string;       // Initial remote directory to navigate after connection
  localInitialPath?: string;  // Initial local directory for this project/server
  color?: string;
  lastConnected?: string;
}

// App state
export interface AppState {
  isConnected: boolean;
  isConnecting: boolean;
  currentRemotePath: string;
  currentLocalPath: string;
  remoteFiles: RemoteFile[];
  localFiles: LocalFile[];
  selectedRemoteFiles: string[];
  selectedLocalFiles: string[];
  activeTransfer: TransferProgress | null;
  error: string | null;
}

// Theme type
export type Theme = 'light' | 'dark' | 'system';

// Session status for multi-tab management
export type SessionStatus = 'connected' | 'disconnected' | 'connecting' | 'cached';

// FTP Session for multi-session tabs (Hybrid Cache Architecture)
export interface FtpSession {
  id: string;
  serverId: string;              // Reference to ServerProfile.id
  serverName: string;            // Display name for tab
  status: SessionStatus;
  remotePath: string;
  localPath: string;
  remoteFiles: RemoteFile[];     // Cached file list
  localFiles: LocalFile[];       // Cached local files
  lastActivity: Date;
  connectionParams: ConnectionParams;
  // Per-session navigation sync state
  isSyncNavigation?: boolean;
  syncBasePaths?: { remote: string; local: string } | null;
}

// State for managing multiple tabs
export interface TabsState {
  sessions: FtpSession[];
  activeSessionId: string | null;
}

// ============ Sync Types ============

export type SyncStatus =
  | 'identical'
  | 'local_newer'
  | 'remote_newer'
  | 'local_only'
  | 'remote_only'
  | 'conflict'
  | 'size_mismatch';

export type SyncDirection =
  | 'local_to_remote'
  | 'remote_to_local'
  | 'bidirectional';

export type SyncAction =
  | 'upload'
  | 'download'
  | 'delete_local'
  | 'delete_remote'
  | 'skip'
  | 'ask_user';

export interface FileInfo {
  name: string;
  path: string;
  size: number;
  modified: string | null;
  is_dir: boolean;
  checksum: string | null;
}

export interface FileComparison {
  relative_path: string;
  status: SyncStatus;
  local_info: FileInfo | null;
  remote_info: FileInfo | null;
  is_dir: boolean;
}

export interface CompareOptions {
  compare_timestamp: boolean;
  compare_size: boolean;
  compare_checksum: boolean;
  exclude_patterns: string[];
  direction: SyncDirection;
}

export interface SyncOperation {
  comparison: FileComparison;
  action: SyncAction;
  selected: boolean;
}