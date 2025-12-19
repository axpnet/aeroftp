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

// Transfer event from backend
export interface TransferEvent {
  event_type: 'start' | 'progress' | 'complete' | 'error' | 'cancelled';
  transfer_id: string;
  filename: string;
  direction: 'download' | 'upload';
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
  initialPath?: string;  // Initial directory to navigate after connection
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