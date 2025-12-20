import * as React from 'react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-dialog';
import { homeDir, downloadDir } from '@tauri-apps/api/path';
import {
  FileListResponse, ConnectionParams, DownloadParams, UploadParams,
  LocalFile, TransferEvent, TransferProgress, RemoteFile, FtpSession
} from './types';
import { SessionTabs } from './components/SessionTabs';
import { PermissionsDialog } from './components/PermissionsDialog';
import { ToastContainer, useToast } from './components/Toast';
import { Logo } from './components/Logo';
import { ContextMenu, useContextMenu, ContextMenuItem } from './components/ContextMenu';
import { SavedServers } from './components/SavedServers';
import { AboutDialog } from './components/AboutDialog';
import { ShortcutsDialog } from './components/ShortcutsDialog';
import { SettingsPanel } from './components/SettingsPanel';
import { StatusBar } from './components/StatusBar';
import { UploadQueue, useUploadQueue } from './components/UploadQueue';
import { CustomTitlebar } from './components/CustomTitlebar';
import { DevToolsPanel, PreviewFile, isPreviewable } from './components/DevTools';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import {
  Sun, Moon, Monitor, FolderUp, RefreshCw, FolderPlus, FolderOpen,
  Download, Upload, Pencil, Trash2, X, ArrowUp, ArrowDown,
  Folder, FileText, Globe, HardDrive, Settings, Search, Eye, Link2, Unlink, PanelTop
} from 'lucide-react';

// ============ Utility Functions ============
const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const formatSpeed = (bps: number): string => formatBytes(bps) + '/s';

const formatETA = (seconds: number): string => {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
};

// ============ Types ============
type Theme = 'light' | 'dark' | 'auto';
type SortField = 'name' | 'size' | 'modified';
type SortOrder = 'asc' | 'desc';

// ============ Theme Hook ============
const useTheme = () => {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('aeroftp-theme') as Theme;
    return saved || 'auto';
  });
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const updateDarkMode = () => {
      if (theme === 'auto') {
        setIsDark(window.matchMedia('(prefers-color-scheme: dark)').matches);
      } else {
        setIsDark(theme === 'dark');
      }
    };
    updateDarkMode();
    localStorage.setItem('aeroftp-theme', theme);
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', updateDarkMode);
    return () => mediaQuery.removeEventListener('change', updateDarkMode);
  }, [theme]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  return { theme, setTheme, isDark };
};

// ============ Theme Toggle ============
const ThemeToggle = ({ theme, setTheme }: { theme: Theme; setTheme: (t: Theme) => void }) => {
  const nextTheme = (): Theme => {
    const order: Theme[] = ['light', 'dark', 'auto'];
    return order[(order.indexOf(theme) + 1) % 3];
  };

  return (
    <button
      onClick={() => setTheme(nextTheme())}
      className="p-2 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
      title={`Theme: ${theme}`}
    >
      {theme === 'light' ? <Sun size={18} /> : theme === 'dark' ? <Moon size={18} /> : <Monitor size={18} />}
    </button>
  );
};

// ============ Animated Bytes (Matrix-style for uploads) ============
const AnimatedBytes = ({ bytes, isAnimated }: { bytes: number; isAnimated: boolean }) => {
  const [displayText, setDisplayText] = useState(formatBytes(bytes));

  useEffect(() => {
    if (!isAnimated) {
      setDisplayText(formatBytes(bytes));
      return;
    }

    const chars = '0123456789ABCDEF';
    let frame = 0;
    const targetText = formatBytes(bytes);

    const interval = setInterval(() => {
      frame++;
      // Create glitchy effect by replacing some chars with random ones
      const glitched = targetText.split('').map((char, i) => {
        if (char === ' ' || char === '.' || char === '/') return char;
        // More glitch at start, stabilize over time
        if (frame < 3 || (Math.random() > 0.7 && frame < 8)) {
          return chars[Math.floor(Math.random() * chars.length)];
        }
        return char;
      }).join('');
      setDisplayText(glitched);

      if (frame > 10) {
        setDisplayText(targetText);
      }
    }, 80);

    return () => clearInterval(interval);
  }, [bytes, isAnimated]);

  return <span className={isAnimated ? 'font-mono text-green-400' : ''}>{displayText}</span>;
};

// ============ Progress Bar (Apple-style) ============
const TransferProgressBar = ({ transfer, onCancel }: { transfer: TransferProgress; onCancel: () => void }) => {
  const isUpload = transfer.direction === 'upload';
  const isIndeterminate = isUpload && transfer.percentage < 5;

  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-40 bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 p-4 min-w-96">
      <div className="flex items-center gap-4">
        <div className={`text-2xl ${isUpload ? 'animate-pulse' : ''}`}>
          {transfer.direction === 'download' ? <Download size={24} className="text-blue-500" /> : <Upload size={24} className="text-green-500" />}
        </div>
        <div className="flex-1">
          <div className="flex justify-between items-center mb-2">
            <span className="font-medium text-gray-900 dark:text-gray-100 truncate max-w-48">{transfer.filename}</span>
            <span className="text-sm text-gray-500 dark:text-gray-400">{isIndeterminate ? '∞' : `${transfer.percentage}%`}</span>
          </div>
          <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            {isIndeterminate ? (
              <div className="h-full w-1/3 bg-gradient-to-r from-green-500 to-emerald-400 rounded-full"
                style={{ animation: 'indeterminate 1.5s ease-in-out infinite' }} />
            ) : (
              <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full transition-all duration-300"
                style={{ width: `${Math.max(transfer.percentage, 2)}%` }} />
            )}
          </div>
          <div className="flex justify-between mt-1.5 text-xs text-gray-500 dark:text-gray-400">
            <span>
              <AnimatedBytes bytes={transfer.transferred} isAnimated={isIndeterminate} />
              {' / '}
              {formatBytes(transfer.total)}
            </span>
            <span>{isIndeterminate ? '⚡ Streaming...' : (transfer.speed_bps > 0 ? `${formatSpeed(transfer.speed_bps)} • ETA ${formatETA(transfer.eta_seconds)}` : 'Transferring...')}</span>
          </div>
        </div>
        <button onClick={onCancel} className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors">
          <X size={18} />
        </button>
      </div>
    </div>
  );
};

// ============ Sortable Header ============
const SortableHeader = ({ label, field, currentField, order, onClick, className = '' }: {
  label: string; field: SortField; currentField: SortField; order: SortOrder; onClick: (f: SortField) => void; className?: string;
}) => (
  <th
    className={`px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors select-none ${className}`}
    onClick={() => onClick(field)}
  >
    <div className="flex items-center gap-1">
      {label}
      {currentField === field && (
        order === 'asc' ? <ArrowUp size={12} className="text-blue-500" /> : <ArrowDown size={12} className="text-blue-500" />
      )}
    </div>
  </th>
);

// ============ Confirm Dialog ============
const ConfirmDialog = ({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) => (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-2xl max-w-sm">
      <p className="text-gray-900 dark:text-gray-100 mb-4">{message}</p>
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">Cancel</button>
        <button onClick={onConfirm} className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600">Delete</button>
      </div>
    </div>
  </div>
);

// ============ Input Dialog ============
const InputDialog = ({ title, defaultValue, onConfirm, onCancel }: { title: string; defaultValue: string; onConfirm: (value: string) => void; onCancel: () => void }) => {
  const [value, setValue] = useState(defaultValue);
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-2xl w-96">
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">{title}</h3>
        <input
          type="text"
          value={value}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setValue(e.target.value)}
          className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 mb-4 text-gray-900 dark:text-gray-100"
          autoFocus
          onKeyDown={(e: React.KeyboardEvent) => e.key === 'Enter' && onConfirm(value)}
        />
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">Cancel</button>
          <button onClick={() => onConfirm(value)} className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">OK</button>
        </div>
      </div>
    </div>
  );
};

// ============ Main App ============
const App: React.FC = () => {
  const SETTINGS_KEY = 'aeroftp_settings';

  interface ConnectionParams {
    server: string;
    username: string;
    password: string;
  }

  const [isConnected, setIsConnected] = useState(false);
  const [remoteFiles, setRemoteFiles] = useState<RemoteFile[]>([]);
  const [localFiles, setLocalFiles] = useState<LocalFile[]>([]);
  const [currentRemotePath, setCurrentRemotePath] = useState('/');
  const [currentLocalPath, setCurrentLocalPath] = useState('');
  const [connectionParams, setConnectionParams] = useState<ConnectionParams>({ server: '', username: '', password: '' });
  const [quickConnectDirs, setQuickConnectDirs] = useState({ remoteDir: '', localDir: '' });
  const [loading, setLoading] = useState(false);
  const [activeTransfer, setActiveTransfer] = useState<TransferProgress | null>(null);
  const [activePanel, setActivePanel] = useState<'remote' | 'local'>('remote');
  const [remoteSortField, setRemoteSortField] = useState<SortField>('name');
  const [remoteSortOrder, setRemoteSortOrder] = useState<SortOrder>('asc');
  const [localSortField, setLocalSortField] = useState<SortField>('name');
  const [localSortOrder, setLocalSortOrder] = useState<SortOrder>('asc');
  const [selectedLocalFiles, setSelectedLocalFiles] = useState<Set<string>>(new Set());
  const [selectedRemoteFiles, setSelectedRemoteFiles] = useState<Set<string>>(new Set());
  const [permissionsDialog, setPermissionsDialog] = useState<{ file: RemoteFile, visible: boolean } | null>(null);

  // Dialogs
  const [confirmDialog, setConfirmDialog] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [inputDialog, setInputDialog] = useState<{ title: string; defaultValue: string; onConfirm: (v: string) => void } | null>(null);
  const [showAboutDialog, setShowAboutDialog] = useState(false);
  const [showShortcutsDialog, setShowShortcutsDialog] = useState(false);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [showMenuBar, setShowMenuBar] = useState(true);  // Internal header visibility
  const [systemMenuVisible, setSystemMenuVisible] = useState(true);  // Native system menu bar
  const [isSyncNavigation, setIsSyncNavigation] = useState(false); // Navigation Sync feature
  const [syncBasePaths, setSyncBasePaths] = useState<{ remote: string; local: string } | null>(null);

  // Multi-Session Tabs (Hybrid Cache Architecture)
  const [sessions, setSessions] = useState<FtpSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  // Upload Queue
  const uploadQueue = useUploadQueue();

  const [localSearchFilter, setLocalSearchFilter] = useState('');
  const [showLocalPreview, setShowLocalPreview] = useState(false);
  const [previewFile, setPreviewFile] = useState<LocalFile | null>(null);
  const [previewImageBase64, setPreviewImageBase64] = useState<string | null>(null);

  // DevTools Panel
  const [devToolsOpen, setDevToolsOpen] = useState(false);
  const [devToolsPreviewFile, setDevToolsPreviewFile] = useState<PreviewFile | null>(null);

  // Load image preview as base64 when file changes
  useEffect(() => {
    const loadPreview = async () => {
      if (!previewFile) {
        setPreviewImageBase64(null);
        return;
      }
      // Only load images
      if (/\.(jpg|jpeg|png|gif|svg|webp|bmp)$/i.test(previewFile.name)) {
        try {
          const base64: string = await invoke('read_file_base64', { path: previewFile.path });
          // Determine MIME type
          const ext = previewFile.name.split('.').pop()?.toLowerCase() || '';
          const mimeTypes: Record<string, string> = {
            jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
            gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp', bmp: 'image/bmp'
          };
          const mime = mimeTypes[ext] || 'image/png';
          setPreviewImageBase64(`data:${mime};base64,${base64}`);
        } catch (error) {
          console.error('Failed to load preview:', error);
          setPreviewImageBase64(null);
        }
      } else {
        setPreviewImageBase64(null);
      }
    };
    loadPreview();
  }, [previewFile]);

  // Filtered files (search filter applied)
  const filteredLocalFiles = localFiles.filter(f =>
    f.name.toLowerCase().includes(localSearchFilter.toLowerCase())
  );

  // Keyboard Shortcuts
  useKeyboardShortcuts({
    'F1': () => setShowShortcutsDialog(v => !v),
    'F10': () => setShowMenuBar(v => !v),
    'Ctrl+,': () => setShowSettingsPanel(true),
    'Escape': () => {
      // Close any open dialogs priority-wise
      if (showShortcutsDialog) setShowShortcutsDialog(false);
      else if (showAboutDialog) setShowAboutDialog(false);
      else if (showSettingsPanel) setShowSettingsPanel(false);
      else if (inputDialog) setInputDialog(null);
      else if (confirmDialog) setConfirmDialog(null);
    }
  }, [showShortcutsDialog, showAboutDialog, showSettingsPanel, inputDialog, confirmDialog]);

  // Init System Menu and Theme on Mount
  useEffect(() => {
    // Menu Visibility
    try {
      const savedSettings = localStorage.getItem(SETTINGS_KEY);
      let showMenu = true; // Default visible (Safe Mode)
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        if (typeof parsed.showSystemMenu === 'boolean') {
          showMenu = parsed.showSystemMenu;
        }
      }
      invoke('toggle_menu_bar', { visible: showMenu });
      // Update internal state to match (if we linked valid state)
      // Actually showMenuBar state controls the INTERNAL header, showSystemMenu controls the Native one.
      // They are independent.
    } catch (e) {
      console.error("Failed to init menu", e);
    }
  }, []);

  const { theme, setTheme } = useTheme();
  const toast = useToast();
  const contextMenu = useContextMenu();

  // Sorting
  const sortFiles = <T extends { name: string; size: number | null; modified: string | null; is_dir: boolean }>(files: T[], field: SortField, order: SortOrder): T[] => {
    return [...files].sort((a, b) => {
      if (a.is_dir && !b.is_dir) return -1;
      if (!a.is_dir && b.is_dir) return 1;
      if (a.name === '..') return -1;
      if (b.name === '..') return 1;
      let cmp = 0;
      if (field === 'name') cmp = a.name.toLowerCase().localeCompare(b.name.toLowerCase());
      else if (field === 'size') cmp = (a.size || 0) - (b.size || 0);
      else cmp = (a.modified || '').localeCompare(b.modified || '');
      return order === 'asc' ? cmp : -cmp;
    });
  };

  const sortedRemoteFiles = useMemo(() => sortFiles(remoteFiles, remoteSortField, remoteSortOrder), [remoteFiles, remoteSortField, remoteSortOrder]);
  const sortedLocalFiles = useMemo(() => sortFiles(filteredLocalFiles, localSortField, localSortOrder), [filteredLocalFiles, localSortField, localSortOrder]);

  const handleRemoteSort = (field: SortField) => {
    if (remoteSortField === field) setRemoteSortOrder(remoteSortOrder === 'asc' ? 'desc' : 'asc');
    else { setRemoteSortField(field); setRemoteSortOrder('asc'); }
  };

  const handleLocalSort = (field: SortField) => {
    if (localSortField === field) setLocalSortOrder(localSortOrder === 'asc' ? 'desc' : 'asc');
    else { setLocalSortField(field); setLocalSortOrder('asc'); }
  };

  // Transfer events
  useEffect(() => {
    const unlisten = listen<TransferEvent>('transfer_event', (event) => {
      const data = event.payload;
      if (data.event_type === 'start') toast.info('Transfer Started', data.message);
      else if (data.event_type === 'progress' && data.progress) setActiveTransfer(data.progress);
      else if (data.event_type === 'complete') {
        setActiveTransfer(null);
        toast.success('Transfer Complete', data.message);
        if (data.direction === 'upload') loadRemoteFiles();
        else loadLocalFiles(currentLocalPath);
      } else if (data.event_type === 'error') {
        setActiveTransfer(null);
        toast.error('Transfer Failed', data.message);
      } else if (data.event_type === 'cancelled') {
        setActiveTransfer(null);
        toast.warning('Transfer Cancelled', data.message);
      }
    });
    return () => { unlisten.then(fn => fn()); };
  }, [currentLocalPath]);

  // Menu events from native menu
  useEffect(() => {
    const unlisten = listen<string>('menu-event', (event) => {
      const id = event.payload;
      switch (id) {
        case 'about': setShowAboutDialog(true); break;
        case 'shortcuts': setShowShortcutsDialog(true); break;
        case 'settings': setShowSettingsPanel(true); break;
        case 'refresh':
          if (isConnected) loadRemoteFiles();
          loadLocalFiles(currentLocalPath);
          break;
        case 'toggle_theme':
          setTheme(theme === 'light' ? 'dark' : theme === 'dark' ? 'auto' : 'light');
          break;
        case 'new_folder':
          if (isConnected) createFolder(true);
          break;
        case 'quit':
          // Will be handled by Tauri
          break;
      }
    });
    return () => { unlisten.then(fn => fn()); };
  }, [isConnected, currentLocalPath, theme]);

  // File loading
  const loadLocalFiles = useCallback(async (path: string) => {
    try {
      const files: LocalFile[] = await invoke('get_local_files', { path });
      setLocalFiles(files);
      setCurrentLocalPath(path);
    } catch (error) {
      toast.error('Error', `Failed to list local files: ${error}`);
    }
  }, []);

  const loadRemoteFiles = async () => {
    try {
      const response: FileListResponse = await invoke('list_files');
      setRemoteFiles(response.files);
      setCurrentRemotePath(response.current_path);
    } catch (error) {
      toast.error('Error', `Failed to list files: ${error}`);
    }
  };

  useEffect(() => {
    (async () => {
      try { await loadLocalFiles(await homeDir()); }
      catch { try { await loadLocalFiles(await downloadDir()); } catch { } }
    })();
  }, [loadLocalFiles]);

  // FTP operations
  const connectToFtp = async () => {
    if (!connectionParams.server || !connectionParams.username) { toast.error('Missing Fields', 'Please fill in server and username'); return; }
    setLoading(true);
    try {
      await invoke('connect_ftp', { params: connectionParams });
      setIsConnected(true);
      toast.success('Connected', `Connected to ${connectionParams.server}`);
      // Navigate to initial remote directory if specified
      if (quickConnectDirs.remoteDir) {
        await changeRemoteDirectory(quickConnectDirs.remoteDir);
      } else {
        await loadRemoteFiles();
      }
      // Navigate to initial local directory if specified
      if (quickConnectDirs.localDir) {
        await changeLocalDirectory(quickConnectDirs.localDir);
      }
    } catch (error) { toast.error('Connection Failed', String(error)); }
    finally { setLoading(false); }
  };

  const disconnectFromFtp = async () => {
    try {
      await invoke('disconnect_ftp');
      setIsConnected(false);
      setRemoteFiles([]);
      setCurrentRemotePath('/');
      // Close all session tabs on disconnect
      setSessions([]);
      setActiveSessionId(null);
      toast.info('Disconnected', 'Disconnected from server');
    } catch (error) {
      toast.error('Error', `Disconnection failed: ${error}`);
    }
  };

  // Session Management for Multi-Tab
  const createSession = (serverName: string, params: ConnectionParams, remotePath: string, localPath: string) => {
    const newSession: FtpSession = {
      id: `session_${Date.now()}`,
      serverId: serverName,
      serverName,
      status: 'connected',
      remotePath,
      localPath,
      remoteFiles: [...remoteFiles],
      localFiles: [...localFiles],
      lastActivity: new Date(),
      connectionParams: params,
    };
    setSessions(prev => [...prev, newSession]);
    setActiveSessionId(newSession.id);
  };

  const switchSession = async (sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;

    // Save current session state before switching
    if (activeSessionId) {
      setSessions(prev => prev.map(s =>
        s.id === activeSessionId
          ? { ...s, remoteFiles: [...remoteFiles], localFiles: [...localFiles], remotePath: currentRemotePath, localPath: currentLocalPath }
          : s
      ));
    }

    // Load cached data immediately (zero latency UX)
    setRemoteFiles(session.remoteFiles);
    setLocalFiles(session.localFiles);
    setCurrentRemotePath(session.remotePath);
    setCurrentLocalPath(session.localPath);
    setConnectionParams(session.connectionParams);
    setActiveSessionId(sessionId);

    // Background reconnect if needed
    if (session.status === 'cached' || session.status === 'disconnected') {
      setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, status: 'connecting' } : s));
      try {
        await invoke('connect_ftp', { params: session.connectionParams });
        await invoke('change_directory', { path: session.remotePath });
        setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, status: 'connected' } : s));
        // Silent refresh
        const response: FileListResponse = await invoke('list_files');
        setRemoteFiles(response.files);
      } catch {
        setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, status: 'cached' } : s));
      }
    }
  };

  const closeSession = async (sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;

    // If closing active session, switch to another or disconnect
    if (sessionId === activeSessionId) {
      const remaining = sessions.filter(s => s.id !== sessionId);
      if (remaining.length > 0) {
        await switchSession(remaining[0].id);
      } else {
        await disconnectFromFtp();
      }
    }

    setSessions(prev => prev.filter(s => s.id !== sessionId));
  };

  const handleNewTabFromSavedServer = () => {
    // Mark current session as cached and go to connection screen
    if (activeSessionId) {
      setSessions(prev => prev.map(s =>
        s.id === activeSessionId
          ? { ...s, status: 'cached', remoteFiles: [...remoteFiles], localFiles: [...localFiles], remotePath: currentRemotePath, localPath: currentLocalPath }
          : s
      ));
    }
    setIsConnected(false);
  };

  const changeRemoteDirectory = async (path: string) => {
    try {
      const response: FileListResponse = await invoke('change_directory', { path });
      setRemoteFiles(response.files);
      setCurrentRemotePath(response.current_path);

      // Navigation Sync: mirror to local panel if enabled
      if (isSyncNavigation && syncBasePaths) {
        const relativePath = response.current_path.startsWith(syncBasePaths.remote)
          ? response.current_path.slice(syncBasePaths.remote.length)
          : '';
        const newLocalPath = syncBasePaths.local + relativePath;
        // Only sync if the local path exists (don't show errors if it doesn't)
        try {
          const files: LocalFile[] = await invoke('get_local_files', { path: newLocalPath });
          setLocalFiles(files);
          setCurrentLocalPath(newLocalPath);
        } catch {
          // Local directory doesn't exist, silently ignore sync
        }
      }
    } catch (error) { toast.error('Error', `Failed to change directory: ${error}`); }
  };

  const changeLocalDirectory = async (path: string) => {
    await loadLocalFiles(path);

    // Navigation Sync: mirror to remote panel if enabled
    if (isSyncNavigation && syncBasePaths && isConnected) {
      const relativePath = path.startsWith(syncBasePaths.local)
        ? path.slice(syncBasePaths.local.length)
        : '';
      const newRemotePath = syncBasePaths.remote + relativePath;
      // Only sync if the remote path exists
      try {
        const response: FileListResponse = await invoke('change_directory', { path: newRemotePath });
        setRemoteFiles(response.files);
        setCurrentRemotePath(response.current_path);
      } catch {
        // Remote directory doesn't exist, silently ignore sync
      }
    }
  };

  // Toggle navigation sync and set base paths
  const toggleSyncNavigation = () => {
    if (!isSyncNavigation) {
      // Enabling sync: save current paths as base
      setSyncBasePaths({ remote: currentRemotePath, local: currentLocalPath });
      toast.success('Navigation Sync Enabled', `Syncing: ${currentRemotePath} ↔ ${currentLocalPath}`);
    } else {
      setSyncBasePaths(null);
      toast.info('Navigation Sync Disabled');
    }
    setIsSyncNavigation(!isSyncNavigation);
  };

  const downloadFile = async (remoteFilePath: string, fileName: string) => {
    try {
      const downloadPath = await open({ directory: true, multiple: false, defaultPath: await downloadDir() });
      if (downloadPath) {
        const params: DownloadParams = { remote_path: remoteFilePath, local_path: `${downloadPath}/${fileName}` };
        await invoke('download_file', { params });
      }
    } catch (error) { toast.error('Download Failed', String(error)); }
  };

  const uploadFile = async (localFilePath: string, fileName: string) => {
    try {
      const remotePath = `${currentRemotePath}${currentRemotePath.endsWith('/') ? '' : '/'}${fileName}`;
      await invoke('upload_file', { params: { local_path: localFilePath, remote_path: remotePath } as UploadParams });
    } catch (error) { toast.error('Upload Failed', String(error)); }
  };

  const cancelTransfer = async () => { try { await invoke('cancel_transfer'); } catch { } };

  // Open DevTools with file preview
  const openDevToolsPreview = async (file: RemoteFile | LocalFile, isRemote: boolean) => {
    try {
      let content = '';

      if (isRemote) {
        // For remote files, download content to memory
        const remotePath = (file as RemoteFile).path;
        content = await invoke<string>('preview_remote_file', { path: remotePath });
      } else {
        // For local files, read content
        const localPath = (file as LocalFile).path;
        content = await invoke<string>('read_local_file', { path: localPath });
      }

      setDevToolsPreviewFile({
        name: file.name,
        path: isRemote ? (file as RemoteFile).path : (file as LocalFile).path,
        content,
        mimeType: 'text/plain',  // Could be improved
        size: file.size || 0,
        isRemote,
      });
      setDevToolsOpen(true);
    } catch (error) {
      toast.error('Preview Failed', String(error));
    }
  };

  // Upload files (Selected or Dialog)
  const uploadMultipleFiles = async (filesOverride?: string[]) => {
    if (!isConnected) return;

    // Use override or fallback to selected state
    const targetNames = filesOverride || Array.from(selectedLocalFiles);

    // Priority 1: Upload specific target files
    if (targetNames.length > 0) {
      const filesToUpload = targetNames.map(name => {
        const file = localFiles.find(f => f.name === name);
        // Use verified absolute path from backend
        return file ? file.path : null;
      }).filter(Boolean) as string[];

      if (filesToUpload.length > 0) {
        // Add all files to queue first
        const queueItems = filesToUpload.map(filePath => {
          const fileName = filePath.split(/[/\\]/).pop() || filePath;
          const file = localFiles.find(f => f.path === filePath);
          const size = file?.size || 0;
          return { id: uploadQueue.addItem(fileName, filePath, size), filePath, fileName };
        });

        // Upload sequentially with queue tracking
        for (const item of queueItems) {
          uploadQueue.startUpload(item.id);
          try {
            await uploadFile(item.filePath, item.fileName);
            uploadQueue.completeUpload(item.id);
          } catch (error) {
            uploadQueue.failUpload(item.id, String(error));
          }
        }
        setSelectedLocalFiles(new Set());
        loadRemoteFiles();
        return;
      }
    }

    // Priority 2: Open Dialog if no selection
    const selected = await open({
      multiple: true,
      directory: false,
      title: 'Select Files to Upload',
    });

    if (!selected) return;
    const files = Array.isArray(selected) ? selected : [selected];

    if (files.length > 0) {
      toast.info('Upload Started', `Uploading ${files.length} file(s)...`);
      for (const filePath of files) {
        // Extract filename from full path (cross-platform handle)
        const fileName = filePath.replace(/^.*[\\\/]/, '');
        await uploadFile(filePath, fileName);
      }
    }
  };

  // === Bulk Operations ===
  const downloadMultipleFiles = async (filesOverride?: string[]) => {
    if (!isConnected) return;
    const names = filesOverride || Array.from(selectedRemoteFiles);
    if (names.length === 0) return;

    const filesToDownload = names.map(n => remoteFiles.find(f => f.name === n)).filter(Boolean) as RemoteFile[];
    if (filesToDownload.length > 0) {
      toast.info('Download Started', `Downloading ${filesToDownload.length} files...`);
      for (const file of filesToDownload) {
        await downloadFile(file.path, file.name);
      }
      setSelectedRemoteFiles(new Set());
    }
  };

  const deleteMultipleRemoteFiles = (filesOverride?: string[]) => {
    const names = filesOverride || Array.from(selectedRemoteFiles);
    if (names.length === 0) return;

    setConfirmDialog({
      message: `Delete ${names.length} selected items?`,
      onConfirm: async () => {
        setConfirmDialog(null);
        for (const name of names) {
          const file = remoteFiles.find(f => f.name === name);
          if (file) {
            try { await invoke('delete_remote_file', { path: file.path, isDir: file.is_dir }); } catch { }
          }
        }
        await loadRemoteFiles();
        setSelectedRemoteFiles(new Set());
        toast.success('Selected items deleted');
      }
    });
  };

  const deleteMultipleLocalFiles = (filesOverride?: string[]) => {
    const names = filesOverride || Array.from(selectedLocalFiles);
    if (names.length === 0) return;

    setConfirmDialog({
      message: `Delete ${names.length} selected items?`,
      onConfirm: async () => {
        setConfirmDialog(null);
        for (const name of names) {
          const file = localFiles.find(f => f.name === name);
          if (file) {
            try { await invoke('delete_local_file', { path: file.path }); } catch { }
          }
        }
        await loadLocalFiles(currentLocalPath);
        setSelectedLocalFiles(new Set());
        toast.success('Selected items deleted');
      }
    });
  };

  // File operations with proper confirm BEFORE action
  const deleteRemoteFile = (path: string, isDir: boolean) => {
    setConfirmDialog({
      message: `Delete "${path.split('/').pop()}"?`,
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await invoke('delete_remote_file', { path, isDir });
          toast.success('Deleted', path.split('/').pop() || path);
          await loadRemoteFiles();
        }
        catch (error) { toast.error('Delete Failed', String(error)); }
      }
    });
  };

  const deleteLocalFile = (path: string) => {
    setConfirmDialog({
      message: `Delete "${path.split('/').pop()}"?`,
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await invoke('delete_local_file', { path });
          toast.success('Deleted', path.split('/').pop() || path);
          await loadLocalFiles(currentLocalPath);
        }
        catch (error) { toast.error('Delete Failed', String(error)); }
      }
    });
  };

  const renameFile = (path: string, currentName: string, isRemote: boolean) => {
    setInputDialog({
      title: 'Rename',
      defaultValue: currentName,
      onConfirm: async (newName: string) => {
        setInputDialog(null);
        if (!newName || newName === currentName) return;
        try {
          // Get parent directory from the file's path
          const parentDir = path.substring(0, path.lastIndexOf('/'));
          const newPath = parentDir + '/' + newName;

          if (isRemote) {
            await invoke('rename_remote_file', { from: path, to: newPath });
            await loadRemoteFiles();
          } else {
            await invoke('rename_local_file', { from: path, to: newPath });
            await loadLocalFiles(currentLocalPath);
          }
          toast.success('Renamed', newName);
        } catch (error) { toast.error('Rename Failed', String(error)); }
      }
    });
  };

  const createFolder = (isRemote: boolean) => {
    setInputDialog({
      title: 'New Folder',
      defaultValue: '',
      onConfirm: async (name: string) => {
        setInputDialog(null);
        if (!name) return;
        try {
          if (isRemote) {
            const path = currentRemotePath + (currentRemotePath.endsWith('/') ? '' : '/') + name;
            await invoke('create_remote_folder', { path });
            await loadRemoteFiles();
          } else {
            // Create local folder
            const path = currentLocalPath + '/' + name;
            await invoke('create_local_folder', { path });
            await loadLocalFiles(currentLocalPath);
          }
          toast.success('Created', name);
        } catch (error) { toast.error('Create Failed', String(error)); }
      }
    });
  };

  const showRemoteContextMenu = (e: React.MouseEvent, file: RemoteFile) => {
    e.preventDefault();

    // Auto-select logic
    let selection = new Set(selectedRemoteFiles);
    if (!selection.has(file.name)) {
      selection = new Set([file.name]);
      setSelectedRemoteFiles(selection);
    }

    const count = selection.size;
    const downloadLabel = count > 1 ? `Download (${count})` : 'Download';
    const filesToUse = Array.from(selection);

    const items: ContextMenuItem[] = [
      { label: downloadLabel, icon: '⬇️', action: () => downloadMultipleFiles(filesToUse) },
      { label: 'Rename', icon: '✏️', action: () => renameFile(file.path, file.name, true), disabled: count > 1 },
      { label: 'Permissions', icon: '🛡️', action: () => setPermissionsDialog({ file, visible: true }), disabled: count > 1 },
      { label: 'Delete', icon: '🗑️', action: () => deleteMultipleRemoteFiles(filesToUse), danger: true, divider: true },
    ];
    contextMenu.show(e, items);
  };

  const showLocalContextMenu = (e: React.MouseEvent, file: LocalFile) => {
    e.preventDefault();

    // Auto-select if not part of current selection
    let selection = new Set(selectedLocalFiles);
    if (!selection.has(file.name)) {
      selection = new Set([file.name]);
      setSelectedLocalFiles(selection);
    }

    const count = selection.size;
    const uploadLabel = count > 1 ? `Upload (${count})` : 'Upload';
    const filesToUpload = Array.from(selection);

    const items: ContextMenuItem[] = [
      {
        label: uploadLabel,
        icon: '☁️',
        // Use wrapper to upload explicit list
        action: () => uploadMultipleFiles(filesToUpload),
        disabled: !isConnected
      },
      { label: 'Rename', icon: '✏️', action: () => renameFile(file.path, file.name, false), disabled: count > 1 },
      { label: 'Delete', icon: '🗑️', action: () => deleteMultipleLocalFiles(filesToUpload), danger: true, divider: true },
    ];
    contextMenu.show(e, items);
  };

  const handleRemoteFileAction = async (file: RemoteFile) => {
    if (file.is_dir) await changeRemoteDirectory(file.name);
    else await downloadFile(file.path, file.name);
  };

  const openInFileManager = async (path: string) => { try { await invoke('open_in_file_manager', { path }); } catch { } };

  return (
    <div className="h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 text-gray-900 dark:text-gray-100 transition-colors duration-300 flex flex-col overflow-hidden">
      {/* Native System Titlebar - CustomTitlebar removed for Linux compatibility */}

      <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
      <UploadQueue
        items={uploadQueue.items}
        isVisible={uploadQueue.isVisible}
        onToggle={uploadQueue.toggle}
        onClear={uploadQueue.clear}
      />
      {contextMenu.state.visible && <ContextMenu x={contextMenu.state.x} y={contextMenu.state.y} items={contextMenu.state.items} onClose={contextMenu.hide} />}
      {activeTransfer && <TransferProgressBar transfer={activeTransfer} onCancel={cancelTransfer} />}
      {confirmDialog && <ConfirmDialog message={confirmDialog.message} onConfirm={confirmDialog.onConfirm} onCancel={() => setConfirmDialog(null)} />}
      {inputDialog && <InputDialog title={inputDialog.title} defaultValue={inputDialog.defaultValue} onConfirm={inputDialog.onConfirm} onCancel={() => setInputDialog(null)} />}
      <PermissionsDialog
        isOpen={permissionsDialog?.visible || false}
        onClose={() => setPermissionsDialog(null)}
        onSave={async (mode) => {
          if (permissionsDialog?.file) {
            try {
              await invoke('chmod_remote_file', { path: permissionsDialog.file.path, mode });
              toast.success('Permissions Updated', `${permissionsDialog.file.name} -> ${mode}`);
              await loadRemoteFiles();
              setPermissionsDialog(null);
            } catch (e) { toast.error('Failed', String(e)); }
          }
        }}
        fileName={permissionsDialog?.file.name || ''}
        currentPermissions={permissionsDialog?.file.permissions || undefined}
      />
      <AboutDialog isOpen={showAboutDialog} onClose={() => setShowAboutDialog(false)} />
      <ShortcutsDialog isOpen={showShortcutsDialog} onClose={() => setShowShortcutsDialog(false)} />
      <SettingsPanel isOpen={showSettingsPanel} onClose={() => setShowSettingsPanel(false)} />

      {/* Header - can be hidden */}
      {showMenuBar && (
        <header className="sticky top-0 z-30 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between px-6 py-3">
            <Logo size="md" />
            <div className="flex items-center gap-3">
              {/* Quick System Menu Bar Toggle */}
              <button
                onClick={async () => {
                  const newState = !systemMenuVisible;
                  setSystemMenuVisible(newState);
                  await invoke('toggle_menu_bar', { visible: newState });
                }}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                title={systemMenuVisible ? 'Hide system menu bar' : 'Show system menu bar'}
              >
                <PanelTop size={18} className={systemMenuVisible ? 'text-blue-500' : 'text-gray-400'} />
              </button>
              <ThemeToggle theme={theme} setTheme={setTheme} />
              {isConnected && (
                <button onClick={disconnectFromFtp} className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors flex items-center gap-2">
                  <X size={16} /> Disconnect
                </button>
              )}
            </div>
          </div>
        </header>
      )}

      <main className="flex-1 p-6 overflow-auto">
        {!isConnected ? (
          <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-6">
            {/* Quick Connect */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6">
              <h2 className="text-xl font-semibold mb-4">Quick Connect</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Server</label>
                  <input type="text" value={connectionParams.server} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConnectionParams({ ...connectionParams, server: e.target.value })} className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl" placeholder="ftp.example.com:21" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Username</label>
                  <input type="text" value={connectionParams.username} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConnectionParams({ ...connectionParams, username: e.target.value })} className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl" placeholder="Username" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Password</label>
                  <input type="password" value={connectionParams.password} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConnectionParams({ ...connectionParams, password: e.target.value })} className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl" placeholder="Password" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Remote Directory</label>
                  <input type="text" value={quickConnectDirs.remoteDir} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuickConnectDirs({ ...quickConnectDirs, remoteDir: e.target.value })} className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl" placeholder="/www (optional)" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Local Directory</label>
                  <div className="flex gap-2">
                    <input type="text" value={quickConnectDirs.localDir} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuickConnectDirs({ ...quickConnectDirs, localDir: e.target.value })} className="flex-1 px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl" placeholder="/home/user/projects (optional)" />
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const selected = await open({ directory: true, multiple: false, title: 'Select Local Directory' });
                          if (selected && typeof selected === 'string') {
                            setQuickConnectDirs({ ...quickConnectDirs, localDir: selected });
                          }
                        } catch (e) { console.error('Folder picker error:', e); }
                      }}
                      className="px-4 py-3 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-xl transition-colors"
                      title="Browse"
                    >
                      <FolderOpen size={18} />
                    </button>
                  </div>
                </div>
                <button onClick={connectToFtp} disabled={loading} className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-medium py-3 rounded-xl disabled:opacity-50">
                  {loading ? 'Connecting...' : 'Connect'}
                </button>
              </div>
            </div>
            {/* Saved Servers */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6">
              <SavedServers onConnect={async (params, initialPath, localInitialPath) => {
                setConnectionParams(params);
                setLoading(true);
                try {
                  await invoke('connect_ftp', { params });
                  setIsConnected(true);
                  toast.success('Connected', `Connected to ${params.server}`);
                  // Navigate to initial remote path if specified
                  if (initialPath) {
                    await changeRemoteDirectory(initialPath);
                  } else {
                    await loadRemoteFiles();
                  }
                  // Navigate to local initial path if specified (per-project folder)
                  if (localInitialPath) {
                    await changeLocalDirectory(localInitialPath);
                  }
                  // Create session for multi-tab management
                  createSession(
                    params.server.split(':')[0], // Use hostname as server name
                    params,
                    initialPath || currentRemotePath,
                    localInitialPath || currentLocalPath
                  );
                } catch (error) {
                  toast.error('Connection Failed', String(error));
                } finally {
                  setLoading(false);
                }
              }} />
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden">
            {/* Session Tabs - visible when there are sessions */}
            {sessions.length > 0 && (
              <SessionTabs
                sessions={sessions}
                activeSessionId={activeSessionId}
                onTabClick={switchSession}
                onTabClose={closeSession}
                onNewTab={handleNewTabFromSavedServer}
              />
            )}
            {/* Toolbar */}
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
              <div className="flex gap-2">
                <button onClick={() => activePanel === 'remote' ? changeRemoteDirectory('..') : loadLocalFiles(currentLocalPath.split('/').slice(0, -1).join('/') || '/')} className="px-3 py-1.5 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 rounded-lg text-sm flex items-center gap-1.5">
                  <FolderUp size={16} /> Up
                </button>
                <button onClick={() => activePanel === 'remote' ? loadRemoteFiles() : loadLocalFiles(currentLocalPath)} className="px-3 py-1.5 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 rounded-lg text-sm flex items-center gap-1.5">
                  <RefreshCw size={16} /> Refresh
                </button>
                <button onClick={() => createFolder(activePanel === 'remote')} className="px-3 py-1.5 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 rounded-lg text-sm flex items-center gap-1.5">
                  <FolderPlus size={16} /> New
                </button>
                {activePanel === 'local' && (
                  <button onClick={() => openInFileManager(currentLocalPath)} className="px-3 py-1.5 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 rounded-lg text-sm flex items-center gap-1.5">
                    <FolderOpen size={16} /> Open
                  </button>
                )}
                {isConnected && (
                  <>
                    <button onClick={() => uploadMultipleFiles()} className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm flex items-center gap-1.5" title="Upload multiple files">
                      <Upload size={16} /> Upload Files
                    </button>
                    <button
                      onClick={toggleSyncNavigation}
                      className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 transition-colors ${isSyncNavigation
                        ? 'bg-purple-500 hover:bg-purple-600 text-white'
                        : 'bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500'
                        }`}
                      title={isSyncNavigation ? 'Navigation Sync ON - Click to disable' : 'Enable Navigation Sync between panels'}
                    >
                      {isSyncNavigation ? <Link2 size={16} /> : <Unlink size={16} />}
                      {isSyncNavigation ? 'Synced' : 'Sync'}
                    </button>
                  </>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setActivePanel('remote')} className={`px-4 py-1.5 rounded-lg text-sm flex items-center gap-1.5 ${activePanel === 'remote' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-600'}`}>
                  <Globe size={16} /> Remote
                </button>
                <button onClick={() => setActivePanel('local')} className={`px-4 py-1.5 rounded-lg text-sm flex items-center gap-1.5 ${activePanel === 'local' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-600'}`}>
                  <HardDrive size={16} /> Local
                </button>
                <div className="w-px h-6 bg-gray-300 dark:bg-gray-500 mx-1" />
                {/* Search Filter */}
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Filter local files..."
                    value={localSearchFilter}
                    onChange={e => setLocalSearchFilter(e.target.value)}
                    className="w-40 pl-8 pr-2 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                {/* Preview Toggle */}
                <button
                  onClick={() => setShowLocalPreview(p => !p)}
                  className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 ${showLocalPreview ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500'}`}
                  title="Toggle Preview Panel"
                >
                  <Eye size={16} /> Preview
                </button>
                <div className="w-px h-6 bg-gray-300 dark:bg-gray-500 mx-1" />
                <button onClick={() => setShowSettingsPanel(true)} className="px-3 py-1.5 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 rounded-lg text-sm flex items-center gap-1.5" title="Settings (Ctrl+,)">
                  <Settings size={16} />
                </button>
              </div>
            </div>

            {/* Dual Panel */}
            <div className="flex h-[calc(100vh-220px)]">
              {/* Remote */}
              <div className="w-1/2 border-r border-gray-200 dark:border-gray-700 flex flex-col">
                <div className="px-3 py-2 bg-gray-100 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 text-sm font-medium truncate flex items-center gap-2">
                  <Globe size={14} /> {currentRemotePath}
                </div>
                <div className="flex-1 overflow-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                      <tr>
                        <SortableHeader label="Name" field="name" currentField={remoteSortField} order={remoteSortOrder} onClick={handleRemoteSort} />
                        <SortableHeader label="Size" field="size" currentField={remoteSortField} order={remoteSortOrder} onClick={handleRemoteSort} />
                        <SortableHeader label="Modified" field="modified" currentField={remoteSortField} order={remoteSortOrder} onClick={handleRemoteSort} />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {sortedRemoteFiles.map((file, i) => (
                        <tr
                          key={file.name}
                          onClick={(e) => {
                            if (file.name === '..') return;
                            if (e.ctrlKey || e.metaKey) {
                              setSelectedRemoteFiles(prev => {
                                const next = new Set(prev);
                                if (next.has(file.name)) next.delete(file.name);
                                else next.add(file.name);
                                return next;
                              });
                            } else {
                              setSelectedRemoteFiles(new Set([file.name]));
                            }
                          }}
                          onDoubleClick={() => handleRemoteFileAction(file)}
                          onContextMenu={(e: React.MouseEvent) => showRemoteContextMenu(e, file)}
                          className={`cursor-pointer transition-colors ${selectedRemoteFiles.has(file.name)
                            ? 'bg-blue-100 dark:bg-blue-900/40'
                            : 'hover:bg-blue-50 dark:hover:bg-gray-700'
                            }`}
                        >
                          <td className="px-4 py-2 flex items-center gap-2">
                            {file.is_dir ? <Folder size={16} className="text-yellow-500" /> : <FileText size={16} className="text-gray-400" />}
                            {file.name}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-500">{file.size ? formatBytes(file.size) : '-'}</td>
                          <td className="px-4 py-2 text-sm text-gray-500">{file.modified || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Local */}
              <div className={`${showLocalPreview ? 'w-1/3' : 'w-1/2'} flex flex-col transition-all duration-300`}>
                <div className="px-3 py-2 bg-gray-100 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 text-sm font-medium truncate flex items-center gap-2">
                  <HardDrive size={14} />
                  <span className="truncate flex-1">{currentLocalPath}</span>
                </div>
                <div className="flex-1 overflow-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                      <tr>
                        <SortableHeader label="Name" field="name" currentField={localSortField} order={localSortOrder} onClick={handleLocalSort} />
                        <SortableHeader label="Size" field="size" currentField={localSortField} order={localSortOrder} onClick={handleLocalSort} />
                        <SortableHeader label="Modified" field="modified" currentField={localSortField} order={localSortOrder} onClick={handleLocalSort} />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {sortedLocalFiles.map((file, i) => (
                        <tr
                          key={file.name}
                          onClick={(e) => {
                            // Prevent selection of '..' or if holding shift (range todo)
                            if (file.name === '..') return;

                            if (e.ctrlKey || e.metaKey) {
                              setSelectedLocalFiles(prev => {
                                const next = new Set(prev);
                                if (next.has(file.name)) next.delete(file.name);
                                else next.add(file.name);
                                return next;
                              });
                            } else {
                              setSelectedLocalFiles(new Set([file.name]));
                              setPreviewFile(file); // Show in preview
                            }
                          }}
                          onDoubleClick={() => {
                            if (file.is_dir) {
                              // Use absolute path provided by backend - failsafe
                              changeLocalDirectory(file.path);
                            } else {
                              openInFileManager(file.path);
                            }
                          }}
                          onContextMenu={(e: React.MouseEvent) => showLocalContextMenu(e, file)}
                          className={`cursor-pointer transition-colors ${selectedLocalFiles.has(file.name)
                            ? 'bg-blue-100 dark:bg-blue-900/40'
                            : 'hover:bg-blue-50 dark:hover:bg-gray-700'
                            }`}
                        >
                          <td className="px-4 py-2 flex items-center gap-2">
                            {file.is_dir ? <Folder size={16} className="text-yellow-500" /> : <FileText size={16} className="text-gray-400" />}
                            {file.name}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-500">{file.size !== null ? formatBytes(file.size) : '-'}</td>
                          <td className="px-4 py-2 text-sm text-gray-500">{file.modified || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Preview Panel */}
              {showLocalPreview && (
                <div className="w-1/6 flex flex-col bg-gray-50 dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 animate-slide-in-right">
                  <div className="px-3 py-2 bg-gray-100 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 text-sm font-medium flex items-center gap-2">
                    <Eye size={14} /> Preview
                  </div>
                  <div className="flex-1 overflow-auto p-3">
                    {previewFile ? (
                      <div className="space-y-3">
                        {/* File Icon/Preview */}
                        <div className="aspect-square bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center overflow-hidden">
                          {previewImageBase64 ? (
                            <img
                              src={previewImageBase64}
                              alt={previewFile.name}
                              className="w-full h-full object-contain"
                            />
                          ) : /\.(jpg|jpeg|png|gif|svg|webp|bmp)$/i.test(previewFile.name) ? (
                            <div className="text-gray-400 animate-pulse">Loading...</div>
                          ) : (
                            <FileText size={48} className="text-gray-400" />
                          )}
                        </div>
                        {/* Metadata */}
                        <div className="space-y-1 text-xs">
                          <p className="font-medium truncate" title={previewFile.name}>{previewFile.name}</p>
                          <p className="text-gray-500">Size: {formatBytes(previewFile.size || 0)}</p>
                          <p className="text-gray-500">Type: {previewFile.is_dir ? 'Directory' : previewFile.name.split('.').pop()?.toUpperCase() || 'File'}</p>
                          <p className="text-gray-500">Modified: {previewFile.modified || 'Unknown'}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-gray-400 text-sm">
                        <Eye size={24} className="mb-2 opacity-50" />
                        <p>Select a file</p>
                        <p className="text-xs">to preview</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* DevTools Panel */}
      <DevToolsPanel
        isOpen={devToolsOpen}
        previewFile={devToolsPreviewFile}
        onClose={() => setDevToolsOpen(false)}
        onToggle={() => setDevToolsOpen(!devToolsOpen)}
      />

      <StatusBar
        isConnected={isConnected}
        serverInfo={isConnected ? `${connectionParams.username}@${connectionParams.server}` : undefined}
        remotePath={currentRemotePath}
        localPath={currentLocalPath}
        remoteFileCount={remoteFiles.length}
        localFileCount={localFiles.length}
        activePanel={activePanel}
      />
    </div>
  );
};

export default App;