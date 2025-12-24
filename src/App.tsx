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

interface DownloadFolderParams {
  remote_path: string;
  local_path: string;
}

interface UploadFolderParams {
  local_path: string;
  remote_path: string;
}
import { SessionTabs } from './components/SessionTabs';
import { PermissionsDialog } from './components/PermissionsDialog';
import { ToastContainer, useToast } from './components/Toast';
import { Logo } from './components/Logo';
import { ContextMenu, useContextMenu, ContextMenuItem } from './components/ContextMenu';
import { SavedServers } from './components/SavedServers';
import { ConnectionScreen } from './components/ConnectionScreen';
import { AboutDialog } from './components/AboutDialog';
import { ShortcutsDialog } from './components/ShortcutsDialog';
import { SettingsPanel } from './components/SettingsPanel';
import { StatusBar } from './components/StatusBar';
import { UploadQueue, useUploadQueue } from './components/UploadQueue';
import { CustomTitlebar } from './components/CustomTitlebar';
import { DevToolsV2, PreviewFile, isPreviewable } from './components/DevTools';
import { UniversalPreview, PreviewFileData, getPreviewCategory, isPreviewable as isMediaPreviewable } from './components/Preview';
import { SyncPanel } from './components/SyncPanel';
import { CloudPanel } from './components/CloudPanel';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import {
  Sun, Moon, Monitor, FolderUp, RefreshCw, FolderPlus, FolderOpen,
  Download, Upload, Pencil, Trash2, X, ArrowUp, ArrowDown,
  Folder, FileText, Globe, HardDrive, Settings, Search, Eye, Link2, Unlink, PanelTop, Shield, Cloud,
  Archive, Image, Video, FileCode, Music, File, FileSpreadsheet, FileType, Code, Database, Clock,
  Copy, Clipboard, ExternalLink, List, LayoutGrid, ChevronRight, Plus, CheckCircle2
} from 'lucide-react';

// Extracted utilities and components (Phase 1 modularization)
import { formatBytes, formatSpeed, formatETA, formatDate, getFileIcon, getFileIconColor } from './utils';
import { ConfirmDialog, InputDialog, SyncNavDialog } from './components/Dialogs';
import { TransferProgressBar } from './components/Transfer';

// Extracted components (Phase 2 modularization)  
import { useTheme, ThemeToggle, Theme } from './hooks/useTheme';
import { ImageThumbnail } from './components/ImageThumbnail';
import { SortableHeader, SortField, SortOrder } from './components/SortableHeader';

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
  const [isReconnecting, setIsReconnecting] = useState(false);  // FTP reconnection in progress
  const hasActivity = activeTransfer !== null;  // Track if upload/download in progress
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
  const [showSyncPanel, setShowSyncPanel] = useState(false);
  const [showCloudPanel, setShowCloudPanel] = useState(false);
  const [cloudSyncing, setCloudSyncing] = useState(false);  // AeroCloud sync in progress
  const [isCloudActive, setIsCloudActive] = useState(false);  // AeroCloud is enabled (persistent)
  const [cloudServerName, setCloudServerName] = useState<string>('');  // Cloud server profile name
  const [cloudLastSync, setCloudLastSync] = useState<string | null>(null);  // Last sync timestamp for badges
  const [cloudLocalFolder, setCloudLocalFolder] = useState<string>('');  // Cloud local folder path
  const [showConnectionScreen, setShowConnectionScreen] = useState(true);  // Initial connection screen, can be skipped
  const [showMenuBar, setShowMenuBar] = useState(true);  // Internal header visibility
  const [systemMenuVisible, setSystemMenuVisible] = useState(true);  // Native system menu bar
  const [compactMode, setCompactMode] = useState(false);  // Compact UI mode
  const [isSyncNavigation, setIsSyncNavigation] = useState(false); // Navigation Sync feature
  const [syncBasePaths, setSyncBasePaths] = useState<{ remote: string; local: string } | null>(null);
  const [syncNavDialog, setSyncNavDialog] = useState<{ missingPath: string; isRemote: boolean; targetPath: string } | null>(null);

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

  // Universal Preview Modal (for media files: images, audio, video, pdf)
  const [universalPreviewOpen, setUniversalPreviewOpen] = useState(false);
  const [universalPreviewFile, setUniversalPreviewFile] = useState<PreviewFileData | null>(null);

  // View Mode (list/grid)
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const isImageFile = (name: string) => /\.(jpg|jpeg|png|gif|svg|webp|bmp|ico)$/i.test(name);

  // Sync Badge Helper - returns badge element if file is in cloud folder
  const getSyncBadge = (filePath: string, fileModified: string | undefined, isLocal: boolean) => {
    // Only show badges if cloud is active and we're in a cloud folder
    if (!isCloudActive || !cloudLastSync || !cloudLocalFolder) return null;

    // Check if current path is within cloud folder
    const currentPath = isLocal ? currentLocalPath : currentRemotePath;
    const isInCloudFolder = isLocal
      ? currentPath.startsWith(cloudLocalFolder) || currentPath === cloudLocalFolder
      : true; // For remote, we assume if cloud is active, we show badges

    if (!isInCloudFolder) return null;

    const lastSyncTime = new Date(cloudLastSync).getTime();
    const fileTime = fileModified ? new Date(fileModified).getTime() : 0;

    // If syncing right now
    if (cloudSyncing) {
      return (
        <span title="Syncing...">
          <RefreshCw size={12} className="text-cyan-500 animate-spin ml-1" />
        </span>
      );
    }

    // If file modified after last sync -> pending
    if (fileTime > lastSyncTime) {
      return (
        <span title="Pending sync">
          <RefreshCw size={12} className="text-yellow-500 ml-1" />
        </span>
      );
    }

    // Otherwise synced
    return (
      <span title="Synced">
        <CheckCircle2 size={12} className="text-green-500 ml-1" />
      </span>
    );
  };

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

  // FTP Keep-Alive: Send NOOP every 60 seconds to prevent connection timeout
  useEffect(() => {
    if (!isConnected) return;

    const KEEP_ALIVE_INTERVAL = 60000; // 60 seconds

    const keepAliveInterval = setInterval(async () => {
      try {
        await invoke('ftp_noop');
      } catch (error) {
        console.warn('Keep-alive NOOP failed, attempting reconnect...', error);

        // Connection lost - attempt auto-reconnect
        setIsReconnecting(true);
        toast.info('Reconnecting...', 'Connection lost, attempting to reconnect');

        try {
          await invoke('reconnect_ftp');
          toast.success('Reconnected', 'FTP connection restored');
          // Refresh file list after reconnection
          const response = await invoke<{ files: RemoteFile[]; current_path: string }>('list_files');
          setRemoteFiles(response.files);
          setCurrentRemotePath(response.current_path);
        } catch (reconnectError) {
          console.error('Auto-reconnect failed:', reconnectError);
          toast.error('Connection Lost', 'Could not reconnect. Please reconnect manually.');
          setIsConnected(false);
        } finally {
          setIsReconnecting(false);
        }
      }
    }, KEEP_ALIVE_INTERVAL);

    return () => clearInterval(keepAliveInterval);
  }, [isConnected]);

  // Filtered files (search filter applied)
  const filteredLocalFiles = localFiles.filter(f =>
    f.name.toLowerCase().includes(localSearchFilter.toLowerCase())
  );

  // Keyboard Shortcuts
  useKeyboardShortcuts({
    'F1': () => setShowShortcutsDialog(v => !v),
    'F10': () => setShowMenuBar(v => !v),
    'Ctrl+,': () => setShowSettingsPanel(true),
    // Space key: Open preview for selected file
    ' ': () => {
      // Get the first selected file (prefer remote, fallback to local)
      const selectedRemoteName = Array.from(selectedRemoteFiles)[0];
      const selectedLocalName = Array.from(selectedLocalFiles)[0];

      if (selectedRemoteName) {
        const file = remoteFiles.find(f => f.name === selectedRemoteName);
        if (file && !file.is_dir) {
          const category = getPreviewCategory(file.name);
          if (['image', 'audio', 'video', 'pdf', 'markdown', 'text'].includes(category)) {
            openUniversalPreview(file, true);
          } else if (isPreviewable(file.name)) {
            openDevToolsPreview(file, true);
          }
        }
      } else if (selectedLocalName) {
        const file = localFiles.find(f => f.name === selectedLocalName);
        if (file && !file.is_dir) {
          const category = getPreviewCategory(file.name);
          if (['image', 'audio', 'video', 'pdf', 'markdown', 'text'].includes(category)) {
            openUniversalPreview(file, false);
          } else if (isPreviewable(file.name)) {
            openDevToolsPreview(file, false);
          }
        }
      }
    },
    'Escape': () => {
      // Close any open dialogs priority-wise
      if (universalPreviewOpen) closeUniversalPreview();
      else if (showShortcutsDialog) setShowShortcutsDialog(false);
      else if (showAboutDialog) setShowAboutDialog(false);
      else if (showSettingsPanel) setShowSettingsPanel(false);
      else if (inputDialog) setInputDialog(null);
      else if (confirmDialog) setConfirmDialog(null);
    }
  }, [showShortcutsDialog, showAboutDialog, showSettingsPanel, inputDialog, confirmDialog,
    universalPreviewOpen, selectedRemoteFiles, selectedLocalFiles, remoteFiles, localFiles]);

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

      // Load compact mode setting
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        if (typeof parsed.compactMode === 'boolean') {
          setCompactMode(parsed.compactMode);
        }
      }
    } catch (e) {
      console.error("Failed to init menu", e);
    }

    // Listen for settings changes from SettingsPanel
    const handleSettingsChange = () => {
      try {
        const savedSettings = localStorage.getItem(SETTINGS_KEY);
        if (savedSettings) {
          const parsed = JSON.parse(savedSettings);
          if (typeof parsed.compactMode === 'boolean') {
            setCompactMode(parsed.compactMode);
          }
        }
      } catch (e) { }
    };
    window.addEventListener('storage', handleSettingsChange);
    // Also listen for custom event when settings saved from same tab
    window.addEventListener('aeroftp-settings-changed', handleSettingsChange);
    return () => {
      window.removeEventListener('storage', handleSettingsChange);
      window.removeEventListener('aeroftp-settings-changed', handleSettingsChange);
    };
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
        case 'toggle_devtools':
          setDevToolsOpen(prev => !prev);
          break;
        case 'toggle_editor':
        case 'toggle_terminal':
        case 'toggle_agent':
          // Emit event for DevToolsV2 to handle
          window.dispatchEvent(new CustomEvent('devtools-panel-toggle', { detail: id.replace('toggle_', '') }));
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

  // Check AeroCloud state on mount and listen for status changes
  useEffect(() => {
    // Check initial cloud config
    const checkCloudConfig = async () => {
      try {
        const config = await invoke<{
          enabled: boolean;
          server_profile?: string;
          last_sync?: string;
          local_folder?: string;
        }>('get_cloud_config');
        setIsCloudActive(config.enabled);
        if (config.server_profile) {
          setCloudServerName(config.server_profile);
        }
        if (config.last_sync) {
          setCloudLastSync(config.last_sync);
        }
        if (config.local_folder) {
          setCloudLocalFolder(config.local_folder);
        }

        // Auto-start background sync if cloud is enabled
        if (config.enabled) {
          console.log('Cloud enabled, starting background sync...');
          try {
            await invoke('start_background_sync');
            console.log('Background sync started');
          } catch (syncError) {
            console.log('Background sync start error (may already be running):', syncError);
          }
        }
      } catch (e) {
        console.error('Failed to check cloud config:', e);
      }
    };
    checkCloudConfig();

    // Listen for cloud sync status events
    const unlistenStatus = listen<{ status: string; message: string }>('cloud-sync-status', (event) => {
      const { status, message } = event.payload;
      console.log('Cloud status:', status, message);

      if (status === 'active') {
        // Sync completed, back to idle (active = enabled but not syncing)
        setCloudSyncing(false);
        setIsCloudActive(true);
        // Refresh last_sync timestamp for badges
        setCloudLastSync(new Date().toISOString());
      } else if (status === 'idle') {
        setCloudSyncing(false);
        setIsCloudActive(true);
      } else if (status === 'syncing') {
        // Actually transferring files now
        setCloudSyncing(true);
        setIsCloudActive(true);
      } else if (status === 'error') {
        setCloudSyncing(false);
        console.error('Cloud sync error:', message);
      } else if (status === 'disabled') {
        setCloudSyncing(false);
        setIsCloudActive(false);
      }
    });

    // Listen for tray menu events
    const unlistenMenu = listen<string>('menu-event', async (event) => {
      const action = event.payload;
      console.log('Tray menu action:', action);

      if (action === 'cloud_sync_now') {
        // Trigger manual sync
        try {
          await invoke('trigger_cloud_sync');
          console.log('Cloud sync triggered from tray');
        } catch (e) {
          console.error('Failed to trigger sync:', e);
        }
      } else if (action === 'cloud_pause') {
        // Stop background sync
        try {
          await invoke('stop_background_sync');
          console.log('Background sync paused from tray');
        } catch (e) {
          console.error('Failed to pause sync:', e);
        }
      } else if (action === 'cloud_open_folder') {
        // Open cloud folder in file manager
        try {
          const config = await invoke<{ local_folder: string }>('get_cloud_config');
          if (config.local_folder) {
            await invoke('open_in_file_manager', { path: config.local_folder });
          }
        } catch (e) {
          console.error('Failed to open cloud folder:', e);
        }
      }
    });

    return () => {
      unlistenStatus.then(fn => fn());
      unlistenMenu.then(fn => fn());
    };
  }, []);

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
      // Close DevTools panel and clear preview
      setDevToolsOpen(false);
      setDevToolsPreviewFile(null);
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

  // Handle click on Cloud Tab - auto-connect to cloud server profile
  const handleCloudTabClick = async () => {
    console.log('Cloud Tab clicked');

    try {
      // Get cloud config to know which server profile and folders
      const cloudConfig = await invoke<{
        enabled: boolean;
        local_folder: string;
        remote_folder: string;
        server_profile: string;
      }>('get_cloud_config');

      console.log('Cloud config:', cloudConfig);

      if (!cloudConfig.enabled) {
        setShowCloudPanel(true);
        return;
      }

      // If already connected, just trigger sync and navigate to cloud folders
      if (isConnected) {
        console.log('Already connected, just syncing and navigating...');
        // Navigate to cloud folders
        try {
          const remoteResponse: FileListResponse = await invoke('change_directory', { path: cloudConfig.remote_folder });
          setRemoteFiles(remoteResponse.files);
          setCurrentRemotePath(remoteResponse.current_path);

          const localFilesData: LocalFile[] = await invoke('get_local_files', { path: cloudConfig.local_folder });
          setLocalFiles(localFilesData);
          setCurrentLocalPath(cloudConfig.local_folder);
        } catch (navError) {
          console.log('Navigation error:', navError);
        }

        // Trigger sync
        try {
          await invoke('trigger_cloud_sync');
          toast.info('Sync Started', 'Syncing cloud files...');
        } catch (syncError) {
          console.log('Sync error:', syncError);
        }
        return;
      }

      // Get saved servers from localStorage
      const savedServersStr = localStorage.getItem('aeroftp-saved-servers');
      if (!savedServersStr) {
        toast.error('No saved servers', 'Please save your server first');
        setShowCloudPanel(true);
        return;
      }

      const savedServers = JSON.parse(savedServersStr);
      const cloudServer = savedServers.find((s: { name: string }) => s.name === cloudConfig.server_profile);

      if (!cloudServer) {
        toast.error('Server not found', `Server profile "${cloudConfig.server_profile}" not found`);
        setShowCloudPanel(true);
        return;
      }

      // Build connection params
      const serverString = cloudServer.port && cloudServer.port !== 21
        ? `${cloudServer.host}:${cloudServer.port}`
        : cloudServer.host;

      const params = {
        server: serverString,
        username: cloudServer.username || '',
        password: cloudServer.password || '',
      };

      // Connect
      setLoading(true);
      toast.info('Connecting', `Connecting to ${cloudConfig.server_profile}...`);

      await invoke('connect_ftp', { params });
      setIsConnected(true);
      setConnectionParams(params);

      // Navigate to cloud folders
      // Remote: navigate to cloud remote folder
      const remoteResponse: FileListResponse = await invoke('change_directory', { path: cloudConfig.remote_folder });
      setRemoteFiles(remoteResponse.files);
      setCurrentRemotePath(remoteResponse.current_path);

      // Local: navigate to cloud local folder
      const localFiles: LocalFile[] = await invoke('get_local_files', { path: cloudConfig.local_folder });
      setLocalFiles(localFiles);
      setCurrentLocalPath(cloudConfig.local_folder);

      toast.success('Connected', `Connected to AeroCloud (${cloudConfig.server_profile})`);

      // Trigger a sync after connecting to cloud
      try {
        await invoke('trigger_cloud_sync');
        toast.info('Sync Started', 'Syncing cloud files...');
      } catch (e) {
        console.log('Sync trigger error:', e);
      }

    } catch (error) {
      toast.error('Connection Failed', String(error));
      setShowCloudPanel(true);
    } finally {
      setLoading(false);
    }
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
        // Check if local path exists
        try {
          const files: LocalFile[] = await invoke('get_local_files', { path: newLocalPath });
          setLocalFiles(files);
          setCurrentLocalPath(newLocalPath);
        } catch {
          // Local directory doesn't exist - show dialog
          setSyncNavDialog({ missingPath: newLocalPath, isRemote: false, targetPath: newLocalPath });
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
      // Check if remote path exists
      try {
        const response: FileListResponse = await invoke('change_directory', { path: newRemotePath });
        setRemoteFiles(response.files);
        setCurrentRemotePath(response.current_path);
      } catch {
        // Remote directory doesn't exist - show dialog
        setSyncNavDialog({ missingPath: newRemotePath, isRemote: true, targetPath: newRemotePath });
      }
    }
  };

  // Handle sync nav dialog actions
  const handleSyncNavCreateFolder = async () => {
    if (!syncNavDialog) return;
    try {
      if (syncNavDialog.isRemote) {
        await invoke('create_remote_folder', { path: syncNavDialog.targetPath });
        const response: FileListResponse = await invoke('change_directory', { path: syncNavDialog.targetPath });
        setRemoteFiles(response.files);
        setCurrentRemotePath(response.current_path);
        toast.success('Folder Created', syncNavDialog.missingPath);
      } else {
        await invoke('create_local_folder', { path: syncNavDialog.targetPath });
        await loadLocalFiles(syncNavDialog.targetPath);
        toast.success('Folder Created', syncNavDialog.missingPath);
      }
    } catch (error) {
      toast.error('Failed to create folder', String(error));
    }
    setSyncNavDialog(null);
  };

  const handleSyncNavDisable = () => {
    setIsSyncNavigation(false);
    setSyncBasePaths(null);
    toast.info('Navigation Sync Disabled');
    setSyncNavDialog(null);
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

  const downloadFile = async (remoteFilePath: string, fileName: string, destinationPath?: string, isDir: boolean = false) => {
    try {
      if (isDir) {
        const downloadPath = destinationPath || await open({ directory: true, multiple: false, defaultPath: await downloadDir() });
        if (downloadPath) {
          const folderPath = `${downloadPath}/${fileName}`;
          const params: DownloadFolderParams = { remote_path: remoteFilePath, local_path: folderPath };
          await invoke('download_folder', { params });
        }
      } else {
        const downloadPath = destinationPath || await open({ directory: true, multiple: false, defaultPath: await downloadDir() });
        if (downloadPath) {
          const params: DownloadParams = { remote_path: remoteFilePath, local_path: `${downloadPath}/${fileName}` };
          await invoke('download_file', { params });
        }
      }
    } catch (error) { toast.error('Download Failed', String(error)); }
  };

  const uploadFile = async (localFilePath: string, fileName: string, isDir: boolean = false) => {
    try {
      if (isDir) {
        const remotePath = `${currentRemotePath}${currentRemotePath.endsWith('/') ? '' : '/'}${fileName}`;
        const params: UploadFolderParams = { local_path: localFilePath, remote_path: remotePath };
        await invoke('upload_folder', { params });
      } else {
        const remotePath = `${currentRemotePath}${currentRemotePath.endsWith('/') ? '' : '/'}${fileName}`;
        await invoke('upload_file', { params: { local_path: localFilePath, remote_path: remotePath } as UploadParams });
      }
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

  // Open Universal Preview Modal (for media files: images, audio, video, pdf)
  const openUniversalPreview = async (file: RemoteFile | LocalFile, isRemote: boolean) => {
    try {
      const filePath = isRemote ? (file as RemoteFile).path : (file as LocalFile).path;
      let blobUrl: string | undefined;

      const category = getPreviewCategory(file.name);
      const ext = file.name.split('.').pop()?.toLowerCase() || '';

      // Show loading toast for large files
      const fileSize = file.size || 0;
      const sizeMB = (fileSize / (1024 * 1024)).toFixed(1);
      const loadingToastId = fileSize > 1024 * 1024
        ? toast.info(`Loading ${file.name}`, `${sizeMB} MB - Please wait...`)
        : null;

      // MIME type mapping for all media types
      const mimeMap: Record<string, string> = {
        // Images
        jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
        gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
        bmp: 'image/bmp', ico: 'image/x-icon',
        // Audio
        mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg',
        flac: 'audio/flac', aac: 'audio/aac', m4a: 'audio/mp4',
        // Video
        mp4: 'video/mp4', webm: 'video/webm', mkv: 'video/x-matroska',
        avi: 'video/x-msvideo', mov: 'video/quicktime', ogv: 'video/ogg',
      };

      if (!isRemote) {
        // LOCAL FILES: Load as base64 via Rust command
        // asset:// protocol returns 403 Forbidden, so we use read_local_file_base64 instead
        const base64 = await invoke<string>('read_local_file_base64', { path: filePath });
        blobUrl = `data:${mimeMap[ext] || 'application/octet-stream'};base64,${base64}`;
      } else {
        // REMOTE FILES: Download as base64 for images (audio/video need streaming - future)
        if (category === 'image') {
          const base64 = await invoke<string>('ftp_read_file_base64', { path: filePath });
          blobUrl = `data:${mimeMap[ext] || 'image/png'};base64,${base64}`;
        }
        // For remote audio/video, we'd need to implement streaming download
        // For now, show a message that remote media preview requires download first
      }

      // Dismiss loading toast
      if (loadingToastId) {
        toast.removeToast(loadingToastId);
      }

      setUniversalPreviewFile({
        name: file.name,
        path: filePath,
        size: file.size || 0,
        isRemote,
        blobUrl,
        mimeType: mimeMap[ext],
        modified: file.modified || undefined,
      });
      setUniversalPreviewOpen(true);
    } catch (error) {
      toast.error('Preview Failed', String(error));
    }
  };

  // Close Universal Preview
  const closeUniversalPreview = () => {
    setUniversalPreviewOpen(false);
    setUniversalPreviewFile(null);
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
            const file = localFiles.find(f => f.path === item.filePath);
            await uploadFile(item.filePath, item.fileName, file?.is_dir || false);
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
        await uploadFile(filePath, fileName, false);
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
      toast.info('Download Started', `Downloading ${filesToDownload.length} items...`);
      for (const file of filesToDownload) {
        await downloadFile(file.path, file.name, currentLocalPath, file.is_dir);
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
        const folderCount = names.filter(n => remoteFiles.find(f => f.name === n)?.is_dir).length;
        const fileCount = names.length - folderCount;
        const messages = [];
        if (folderCount > 0) messages.push(`${folderCount} folder${folderCount > 1 ? 's' : ''}`);
        if (fileCount > 0) messages.push(`${fileCount} file${fileCount > 1 ? 's' : ''}`);
        toast.success(messages.join(', '), `${messages.join(' and ')} deleted`);
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
        const folderCount = names.filter(n => localFiles.find(f => f.name === n)?.is_dir).length;
        const fileCount = names.length - folderCount;
        const messages = [];
        if (folderCount > 0) messages.push(`${folderCount} folder${folderCount > 1 ? 's' : ''}`);
        if (fileCount > 0) messages.push(`${fileCount} file${fileCount > 1 ? 's' : ''}`);
        toast.success(messages.join(', '), `${messages.join(' and ')} deleted`);
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
      { label: downloadLabel, icon: <Download size={14} />, action: () => downloadMultipleFiles(filesToUse) },
      // Media files (images, audio, video, pdf) use Universal Preview modal
      { label: 'Preview', icon: <Eye size={14} />, action: () => openUniversalPreview(file, true), disabled: count > 1 || file.is_dir || !isMediaPreviewable(file.name) },
      // Code files use DevTools source viewer
      { label: 'View Source', icon: <Code size={14} />, action: () => openDevToolsPreview(file, true), disabled: count > 1 || file.is_dir || !isPreviewable(file.name) },
      { label: 'Rename', icon: <Pencil size={14} />, action: () => renameFile(file.path, file.name, true), disabled: count > 1 },
      { label: 'Permissions', icon: <Shield size={14} />, action: () => setPermissionsDialog({ file, visible: true }), disabled: count > 1 },
      { label: 'Delete', icon: <Trash2 size={14} />, action: () => deleteMultipleRemoteFiles(filesToUse), danger: true, divider: true },
      { label: 'Copy Path', icon: <Copy size={14} />, action: () => { navigator.clipboard.writeText(file.path); toast.success('Path copied'); } },
      { label: 'Copy Name', icon: <Clipboard size={14} />, action: () => { navigator.clipboard.writeText(file.name); toast.success('Name copied'); } },
      {
        label: 'Copy FTP URL', icon: <Link2 size={14} />, action: () => {
          const url = `ftp://${connectionParams.username}@${connectionParams.server}${file.path}`;
          navigator.clipboard.writeText(url);
          toast.success('FTP URL copied');
        }
      },
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
        icon: <Cloud size={14} />,
        action: () => uploadMultipleFiles(filesToUpload),
        disabled: !isConnected
      },
      // Media files (images, audio, video, pdf) use Universal Preview modal
      { label: 'Preview', icon: <Eye size={14} />, action: () => openUniversalPreview(file, false), disabled: count > 1 || file.is_dir || !isMediaPreviewable(file.name) },
      // Code files use DevTools source viewer
      { label: 'View Source', icon: <Code size={14} />, action: () => openDevToolsPreview(file, false), disabled: count > 1 || file.is_dir || !isPreviewable(file.name) },
      { label: 'Rename', icon: <Pencil size={14} />, action: () => renameFile(file.path, file.name, false), disabled: count > 1 },
      { label: 'Delete', icon: <Trash2 size={14} />, action: () => deleteMultipleLocalFiles(filesToUpload), danger: true, divider: true },
      { label: 'Copy Path', icon: <Copy size={14} />, action: () => { navigator.clipboard.writeText(file.path); toast.success('Path copied'); } },
      { label: 'Copy Name', icon: <Clipboard size={14} />, action: () => { navigator.clipboard.writeText(file.name); toast.success('Name copied'); }, divider: true },
      { label: 'Open in File Manager', icon: <ExternalLink size={14} />, action: () => openInFileManager(file.is_dir ? file.path : currentLocalPath) },
    ];
    contextMenu.show(e, items);
  };

  const handleRemoteFileAction = async (file: RemoteFile) => {
    if (file.is_dir) await changeRemoteDirectory(file.name);
    else await downloadFile(file.path, file.name, currentLocalPath, false);
  };

  const openInFileManager = async (path: string) => { try { await invoke('open_in_file_manager', { path }); } catch { } };

  return (
    <div className={`h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 text-gray-900 dark:text-gray-100 transition-colors duration-300 flex flex-col overflow-hidden ${compactMode ? 'compact-mode' : ''}`}>
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
      {syncNavDialog && (
        <SyncNavDialog
          missingPath={syncNavDialog.missingPath}
          isRemote={syncNavDialog.isRemote}
          onCreateFolder={handleSyncNavCreateFolder}
          onDisableSync={handleSyncNavDisable}
          onCancel={() => setSyncNavDialog(null)}
        />
      )}
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

      {/* Universal Preview Modal for Media Files */}
      <UniversalPreview
        isOpen={universalPreviewOpen}
        file={universalPreviewFile}
        onClose={closeUniversalPreview}
      />
      <SyncPanel
        isOpen={showSyncPanel}
        onClose={() => setShowSyncPanel(false)}
        localPath={currentLocalPath}
        remotePath={currentRemotePath}
        isConnected={isConnected}
        onSyncComplete={async () => {
          await loadRemoteFiles();
          await loadLocalFiles(currentLocalPath);
        }}
      />
      <CloudPanel
        isOpen={showCloudPanel}
        onClose={() => setShowCloudPanel(false)}
      />

      {/* Header - can be hidden */}
      {showMenuBar && (
        <header className="sticky top-0 z-30 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between px-6 py-3">
            <Logo size="md" isConnected={isConnected} hasActivity={hasActivity} isReconnecting={isReconnecting} />
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
              {isConnected ? (
                <button onClick={disconnectFromFtp} className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors shadow-sm hover:shadow-md flex items-center gap-2">
                  <X size={16} /> Disconnect
                </button>
              ) : !showConnectionScreen && (
                <button
                  onClick={() => setShowConnectionScreen(true)}
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-all shadow-sm hover:shadow-md flex items-center gap-2"
                >
                  <Cloud size={16} /> Connect
                </button>
              )}
            </div>
          </div>
        </header>
      )}

      <main className="flex-1 p-6 overflow-auto">
        {!isConnected && showConnectionScreen ? (
          <ConnectionScreen
            connectionParams={connectionParams}
            quickConnectDirs={quickConnectDirs}
            loading={loading}
            onConnectionParamsChange={setConnectionParams}
            onQuickConnectDirsChange={setQuickConnectDirs}
            onConnect={connectToFtp}
            onSavedServerConnect={async (params, initialPath, localInitialPath) => {
              setConnectionParams(params);
              setLoading(true);
              try {
                await invoke('connect_ftp', { params });
                setIsConnected(true);
                toast.success('Connected', `Connected to ${params.server}`);
                if (initialPath) {
                  await changeRemoteDirectory(initialPath);
                } else {
                  await loadRemoteFiles();
                }
                if (localInitialPath) {
                  await changeLocalDirectory(localInitialPath);
                }
                createSession(
                  params.server.split(':')[0],
                  params,
                  initialPath || currentRemotePath,
                  localInitialPath || currentLocalPath
                );
              } catch (error) {
                toast.error('Connection Failed', String(error));
              } finally {
                setLoading(false);
              }
            }}
            onSkipToFileManager={async () => {
              setShowConnectionScreen(false);
              setActivePanel('local');
              await loadLocalFiles(currentLocalPath || '/');
            }}
          />
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl overflow-hidden">
            {/* Session Tabs - visible when there are sessions or cloud is enabled */}
            {(sessions.length > 0 || isCloudActive) && (
              <SessionTabs
                sessions={sessions}
                activeSessionId={activeSessionId}
                onTabClick={switchSession}
                onTabClose={closeSession}
                onNewTab={handleNewTabFromSavedServer}
                cloudTab={isCloudActive ? {
                  enabled: true,
                  syncing: cloudSyncing,
                  active: isCloudActive,
                  serverName: cloudServerName || 'AeroCloud'
                } : undefined}
                onCloudTabClick={handleCloudTabClick}
              />
            )}
            {/* Toolbar */}
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
              <div className="flex gap-2">
                <button onClick={() => activePanel === 'remote' ? changeRemoteDirectory('..') : loadLocalFiles(currentLocalPath.split('/').slice(0, -1).join('/') || '/')} className="px-3 py-1.5 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 rounded-lg text-sm flex items-center gap-1.5">
                  <FolderUp size={16} /> Up
                </button>
                <button onClick={() => activePanel === 'remote' ? loadRemoteFiles() : loadLocalFiles(currentLocalPath)} className="group px-3 py-1.5 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 rounded-lg text-sm flex items-center gap-1.5 transition-all hover:scale-105 hover:shadow-md">
                  <RefreshCw size={16} className="group-hover:rotate-180 transition-transform duration-500" /> Refresh
                </button>
                <button onClick={() => createFolder(activePanel === 'remote')} className="group px-3 py-1.5 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 rounded-lg text-sm flex items-center gap-1.5 transition-all hover:scale-105 hover:shadow-md">
                  <FolderPlus size={16} className="group-hover:scale-110 transition-transform" /> New
                </button>
                {activePanel === 'local' && (
                  <button onClick={() => openInFileManager(currentLocalPath)} className="px-3 py-1.5 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 rounded-lg text-sm flex items-center gap-1.5">
                    <FolderOpen size={16} /> Open
                  </button>
                )}
                {/* View Mode Toggle */}
                <button
                  onClick={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}
                  className="px-3 py-1.5 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 rounded-lg text-sm flex items-center gap-1.5"
                  title={viewMode === 'list' ? 'Switch to Grid View' : 'Switch to List View'}
                >
                  {viewMode === 'list' ? <LayoutGrid size={16} /> : <List size={16} />}
                </button>
                {isConnected && (
                  <>
                    <button onClick={() => uploadMultipleFiles()} className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm flex items-center gap-1.5 shadow-sm hover:shadow-md transition-all" title="Upload multiple files">
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
                <div className="w-px h-6 bg-gray-300 dark:bg-gray-500 mx-1 hidden lg:block" />
                {/* Search Filter - hidden on small screens */}
                <div className="relative hidden lg:block">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Filter local files..."
                    value={localSearchFilter}
                    onChange={e => setLocalSearchFilter(e.target.value)}
                    className="w-40 pl-8 pr-2 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                {/* Preview Toggle - hidden on small screens */}
                <button
                  onClick={() => setShowLocalPreview(p => !p)}
                  className={`px-3 py-1.5 rounded-lg text-sm items-center gap-1.5 hidden md:flex ${showLocalPreview ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500'}`}
                  title="Toggle Preview Panel"
                >
                  <Eye size={16} /><span className="hidden lg:inline">Preview</span>
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
                <div className="px-3 py-2 bg-gray-100 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 text-sm font-medium flex items-center gap-2">
                  <Globe size={14} className={isSyncNavigation ? 'text-purple-500' : 'text-green-500'} />
                  <input
                    type="text"
                    value={isConnected ? currentRemotePath : 'Not Connected'}
                    onChange={(e) => setCurrentRemotePath(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && isConnected && changeRemoteDirectory((e.target as HTMLInputElement).value)}
                    disabled={!isConnected}
                    className="flex-1 bg-transparent border-none outline-none text-sm cursor-text select-all disabled:cursor-default disabled:text-gray-400"
                    title={isConnected ? "Click to edit path, Enter to navigate" : "Not connected to server"}
                  />
                </div>
                <div className="flex-1 overflow-auto">
                  {!isConnected ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400">
                      <Cloud size={64} className="mb-4 opacity-30" />
                      <p className="text-lg font-medium">Not Connected</p>
                      <p className="text-sm mt-1">Click "Connect" to access remote files</p>
                      <button
                        onClick={() => setShowConnectionScreen(true)}
                        className="mt-4 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg shadow-sm hover:shadow-md transition-all flex items-center gap-2"
                      >
                        <Cloud size={16} /> Connect to Server
                      </button>
                    </div>
                  ) : viewMode === 'list' ? (
                    <table className="w-full">
                      <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                        <tr>
                          <SortableHeader label="Name" field="name" currentField={remoteSortField} order={remoteSortOrder} onClick={handleRemoteSort} />
                          <SortableHeader label="Size" field="size" currentField={remoteSortField} order={remoteSortOrder} onClick={handleRemoteSort} />
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">Perms</th>
                          <SortableHeader label="Modified" field="modified" currentField={remoteSortField} order={remoteSortOrder} onClick={handleRemoteSort} />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {/* Go Up Row */}
                        {currentRemotePath !== '/' && (
                          <tr
                            className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                            onClick={() => changeRemoteDirectory('..')}
                          >
                            <td className="px-4 py-2 flex items-center gap-2 text-gray-500">
                              <FolderUp size={16} />
                              <span className="italic">Go up</span>
                            </td>
                            <td className="px-4 py-2 text-xs text-gray-400">—</td>
                            <td className="px-4 py-2 text-xs text-gray-400">—</td>
                            <td className="px-4 py-2 text-xs text-gray-400">—</td>
                          </tr>
                        )}
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
                              {file.is_dir ? <Folder size={16} className="text-yellow-500" /> : getFileIcon(file.name).icon}
                              {file.name}
                              {getSyncBadge(file.path, file.modified || undefined, false)}
                            </td>
                            <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{file.size ? formatBytes(file.size) : '-'}</td>
                            <td className="px-3 py-2 text-xs text-gray-500 font-mono" title={file.permissions || undefined}>{file.permissions || '-'}</td>
                            <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{formatDate(file.modified)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    /* Grid View */
                    <div className="file-grid">
                      {/* Go Up Item */}
                      {currentRemotePath !== '/' && (
                        <div
                          className="file-grid-item file-grid-go-up"
                          onClick={() => changeRemoteDirectory('..')}
                        >
                          <div className="file-grid-icon">
                            <FolderUp size={32} className="text-gray-400" />
                          </div>
                          <span className="file-grid-name italic text-gray-500">Go up</span>
                        </div>
                      )}
                      {sortedRemoteFiles.map((file) => (
                        <div
                          key={file.name}
                          className={`file-grid-item ${selectedRemoteFiles.has(file.name) ? 'selected' : ''}`}
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
                        >
                          {file.is_dir ? (
                            <div className="file-grid-icon">
                              <Folder size={32} className="text-yellow-500" />
                            </div>
                          ) : isImageFile(file.name) ? (
                            <ImageThumbnail
                              path={currentRemotePath === '/' ? `/${file.name}` : `${currentRemotePath}/${file.name}`}
                              name={file.name}
                              fallbackIcon={getFileIcon(file.name).icon}
                              isRemote={true}
                            />
                          ) : (
                            <div className="file-grid-icon">
                              {getFileIcon(file.name).icon}
                            </div>
                          )}
                          <span className="file-grid-name">{file.name}</span>
                          {!file.is_dir && file.size && (
                            <span className="file-grid-size">{formatBytes(file.size)}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Local */}
              <div className={`${showLocalPreview ? 'w-1/3' : 'w-1/2'} flex flex-col transition-all duration-300`}>
                <div className="px-3 py-2 bg-gray-100 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 text-sm font-medium flex items-center gap-2">
                  <HardDrive size={14} className={isSyncNavigation ? 'text-purple-500' : 'text-blue-500'} />
                  <input
                    type="text"
                    value={currentLocalPath}
                    onChange={(e) => setCurrentLocalPath(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && changeLocalDirectory((e.target as HTMLInputElement).value)}
                    className="flex-1 bg-transparent border-none outline-none text-sm cursor-text select-all"
                    title="Click to edit path, Enter to navigate"
                  />
                </div>
                <div className="flex-1 overflow-auto">
                  {viewMode === 'list' ? (
                    <table className="w-full">
                      <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                        <tr>
                          <SortableHeader label="Name" field="name" currentField={localSortField} order={localSortOrder} onClick={handleLocalSort} />
                          <SortableHeader label="Size" field="size" currentField={localSortField} order={localSortOrder} onClick={handleLocalSort} />
                          <SortableHeader label="Modified" field="modified" currentField={localSortField} order={localSortOrder} onClick={handleLocalSort} />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {/* Go Up Row */}
                        {currentLocalPath !== '/' && (
                          <tr
                            className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                            onClick={() => changeLocalDirectory(currentLocalPath.split('/').slice(0, -1).join('/') || '/')}
                          >
                            <td className="px-4 py-2 flex items-center gap-2 text-gray-500">
                              <FolderUp size={16} />
                              <span className="italic">Go up</span>
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-400">—</td>
                            <td className="px-4 py-2 text-sm text-gray-400">—</td>
                          </tr>
                        )}
                        {sortedLocalFiles.map((file, i) => (
                          <tr
                            key={file.name}
                            onClick={(e) => {
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
                                setPreviewFile(file);
                              }
                            }}
                            onDoubleClick={() => {
                              if (file.is_dir) {
                                changeLocalDirectory(file.path);
                              } else {
                                if (isConnected) {
                                  uploadFile(file.path, file.name, false);
                                } else {
                                  openInFileManager(file.path);
                                }
                              }
                            }}
                            onContextMenu={(e: React.MouseEvent) => showLocalContextMenu(e, file)}
                            className={`cursor-pointer transition-colors ${selectedLocalFiles.has(file.name)
                              ? 'bg-blue-100 dark:bg-blue-900/40'
                              : 'hover:bg-blue-50 dark:hover:bg-gray-700'
                              }`}
                          >
                            <td className="px-4 py-2 flex items-center gap-2">
                              {file.is_dir ? <Folder size={16} className="text-yellow-500" /> : getFileIcon(file.name).icon}
                              {file.name}
                              {getSyncBadge(file.path, file.modified || undefined, true)}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-500">{file.size !== null ? formatBytes(file.size) : '-'}</td>
                            <td className="px-4 py-2 text-xs text-gray-500">{formatDate(file.modified)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    /* Grid View */
                    <div className="file-grid">
                      {/* Go Up Item */}
                      {currentLocalPath !== '/' && (
                        <div
                          className="file-grid-item file-grid-go-up"
                          onClick={() => changeLocalDirectory(currentLocalPath.split('/').slice(0, -1).join('/') || '/')}
                        >
                          <div className="file-grid-icon">
                            <FolderUp size={32} className="text-gray-400" />
                          </div>
                          <span className="file-grid-name italic text-gray-500">Go up</span>
                        </div>
                      )}
                      {sortedLocalFiles.map((file) => (
                        <div
                          key={file.name}
                          className={`file-grid-item ${selectedLocalFiles.has(file.name) ? 'selected' : ''}`}
                          onClick={(e) => {
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
                              setPreviewFile(file);
                            }
                          }}
                          onDoubleClick={() => {
                            if (file.is_dir) {
                              changeLocalDirectory(file.path);
                            } else {
                              if (isConnected) {
                                uploadFile(file.path, file.name, false);
                              } else {
                                openInFileManager(file.path);
                              }
                            }
                          }}
                          onContextMenu={(e: React.MouseEvent) => showLocalContextMenu(e, file)}
                        >
                          {file.is_dir ? (
                            <div className="file-grid-icon">
                              <Folder size={32} className="text-yellow-500" />
                            </div>
                          ) : isImageFile(file.name) ? (
                            <ImageThumbnail
                              path={file.path}
                              name={file.name}
                              fallbackIcon={getFileIcon(file.name).icon}
                            />
                          ) : (
                            <div className="file-grid-icon">
                              {getFileIcon(file.name).icon}
                            </div>
                          )}
                          <span className="file-grid-name">{file.name}</span>
                          {!file.is_dir && file.size !== null && (
                            <span className="file-grid-size">{formatBytes(file.size)}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Preview Panel */}
              {showLocalPreview && (
                <div className="w-1/6 flex flex-col bg-gray-50 dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 animate-slide-in-right min-w-[200px]">
                  <div className="px-3 py-2 bg-gray-100 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 text-sm font-medium flex items-center gap-2">
                    <Eye size={14} className="text-blue-500" /> File Info
                  </div>
                  <div className="flex-1 overflow-auto p-3">
                    {previewFile ? (
                      <div className="space-y-4">
                        {/* File Icon/Thumbnail */}
                        <div className="aspect-square bg-gray-100 dark:bg-gray-700 rounded-xl flex items-center justify-center overflow-hidden shadow-inner">
                          {previewImageBase64 ? (
                            <img
                              src={previewImageBase64}
                              alt={previewFile.name}
                              className="w-full h-full object-contain"
                            />
                          ) : /\.(jpg|jpeg|png|gif|svg|webp|bmp)$/i.test(previewFile.name) ? (
                            <div className="text-gray-400 animate-pulse flex flex-col items-center">
                              <Image size={32} className="text-blue-400 mb-1" />
                              <span className="text-xs">Loading...</span>
                            </div>
                          ) : /\.(mp4|webm|mov|avi|mkv)$/i.test(previewFile.name) ? (
                            <Video size={48} className="text-purple-500" />
                          ) : /\.(mp3|wav|ogg|flac|m4a|aac)$/i.test(previewFile.name) ? (
                            <Music size={48} className="text-green-500" />
                          ) : /\.pdf$/i.test(previewFile.name) ? (
                            <FileText size={48} className="text-red-500" />
                          ) : /\.(js|jsx|ts|tsx|py|rs|go|java|php|rb|c|cpp|h|css|scss|html|xml|json|yaml|yml|toml|sql|sh|bash)$/i.test(previewFile.name) ? (
                            <Code size={48} className="text-cyan-400" />
                          ) : /\.(zip|tar|gz|rar|7z)$/i.test(previewFile.name) ? (
                            <Archive size={48} className="text-yellow-500" />
                          ) : previewFile.is_dir ? (
                            <Folder size={48} className="text-yellow-400" />
                          ) : (
                            <FileText size={48} className="text-gray-400" />
                          )}
                        </div>

                        {/* File Name */}
                        <div className="text-center">
                          <p className="font-medium text-sm truncate" title={previewFile.name}>{previewFile.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                            {previewFile.is_dir ? 'Folder' : previewFile.name.split('.').pop() || 'File'}
                          </p>
                        </div>

                        {/* Detailed Info */}
                        <div className="bg-gray-100 dark:bg-gray-700/50 rounded-lg p-3 space-y-2 text-xs">
                          {/* Size */}
                          {!previewFile.is_dir && (
                            <div className="flex items-center justify-between">
                              <span className="text-gray-500 flex items-center gap-1.5">
                                <HardDrive size={12} /> Size
                              </span>
                              <span className="font-medium">{formatBytes(previewFile.size || 0)}</span>
                            </div>
                          )}

                          {/* Type */}
                          <div className="flex items-center justify-between">
                            <span className="text-gray-500 flex items-center gap-1.5">
                              <FileType size={12} /> Type
                            </span>
                            <span className="font-medium">
                              {previewFile.is_dir ? 'Directory' : (() => {
                                const ext = previewFile.name.split('.').pop()?.toLowerCase();
                                if (/^(jpg|jpeg|png|gif|svg|webp|bmp)$/.test(ext || '')) return 'Image';
                                if (/^(mp4|webm|mov|avi|mkv)$/.test(ext || '')) return 'Video';
                                if (/^(mp3|wav|ogg|flac|m4a|aac)$/.test(ext || '')) return 'Audio';
                                if (ext === 'pdf') return 'PDF';
                                if (/^(js|jsx|ts|tsx|py|rs|go|java|php|rb|c|cpp|h|css|scss|html|xml|json|yaml|yml|toml|sql|sh|bash)$/.test(ext || '')) return 'Code';
                                if (/^(zip|tar|gz|rar|7z)$/.test(ext || '')) return 'Archive';
                                if (/^(txt|md|log|csv)$/.test(ext || '')) return 'Text';
                                return ext?.toUpperCase() || 'File';
                              })()}
                            </span>
                          </div>

                          {/* Modified */}
                          <div className="flex items-center justify-between">
                            <span className="text-gray-500 flex items-center gap-1.5">
                              <Clock size={12} /> Modified
                            </span>
                            <span className="font-medium text-right">{previewFile.modified || '—'}</span>
                          </div>

                          {/* Extension */}
                          {!previewFile.is_dir && (
                            <div className="flex items-center justify-between">
                              <span className="text-gray-500 flex items-center gap-1.5">
                                <Database size={12} /> Extension
                              </span>
                              <span className="font-mono text-xs px-1.5 py-0.5 bg-gray-200 dark:bg-gray-600 rounded">
                                .{previewFile.name.split('.').pop()?.toLowerCase() || '—'}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Quick Actions */}
                        <div className="space-y-2">
                          {/* Open Preview button */}
                          {isMediaPreviewable(previewFile.name) && (
                            <button
                              onClick={() => openUniversalPreview(previewFile, activePanel === 'remote')}
                              className="w-full px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded-lg flex items-center justify-center gap-2 transition-colors"
                            >
                              <Eye size={14} /> Open Preview
                            </button>
                          )}

                          {/* View Source - for text/code files */}
                          {/\.(js|jsx|ts|tsx|py|rs|go|java|php|rb|c|cpp|h|css|scss|html|xml|json|yaml|yml|toml|sql|sh|bash|txt|md|log)$/i.test(previewFile.name) && (
                            <button
                              onClick={() => openUniversalPreview(previewFile, activePanel === 'remote')}
                              className="w-full px-3 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-xs rounded-lg flex items-center justify-center gap-2 transition-colors"
                            >
                              <Code size={14} /> View Source
                            </button>
                          )}

                          {/* Copy Path */}
                          <button
                            onClick={() => {
                              const path = activePanel === 'local'
                                ? `${currentLocalPath}/${previewFile.name}`
                                : `${currentRemotePath}/${previewFile.name}`;
                              navigator.clipboard.writeText(path);
                              toast.success('Copied', 'Path copied to clipboard');
                            }}
                            className="w-full px-3 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-xs rounded-lg flex items-center justify-center gap-2 transition-colors"
                          >
                            <Copy size={14} /> Copy Path
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-gray-400 text-sm">
                        <Eye size={32} className="mb-3 opacity-30" />
                        <p className="font-medium">No file selected</p>
                        <p className="text-xs mt-1 text-center">Click on a file to view its details</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* DevTools V2 - 3-Column Responsive Layout */}
      <DevToolsV2
        isOpen={devToolsOpen}
        previewFile={devToolsPreviewFile}
        localPath={currentLocalPath}
        remotePath={currentRemotePath}
        onClose={() => setDevToolsOpen(false)}
        onClearFile={() => setDevToolsPreviewFile(null)}
        onSaveFile={async (content, file) => {
          try {
            if (file.isRemote) {
              await invoke('save_remote_file', { path: file.path, content });
              toast.success('File Saved', `${file.name} saved to server`);
              await loadRemoteFiles();
            } else {
              await invoke('save_local_file', { path: file.path, content });
              toast.success('File Saved', `${file.name} saved locally`);
              await loadLocalFiles(currentLocalPath);
            }
          } catch (error) {
            toast.error('Save Failed', String(error));
          }
        }}
      />

      <StatusBar
        isConnected={isConnected}
        serverInfo={isConnected ? `${connectionParams.username}@${connectionParams.server}` : undefined}
        remotePath={currentRemotePath}
        localPath={currentLocalPath}
        remoteFileCount={remoteFiles.length}
        localFileCount={localFiles.length}
        activePanel={activePanel}
        devToolsOpen={devToolsOpen}
        onToggleDevTools={() => setDevToolsOpen(!devToolsOpen)}
        onToggleSync={() => setShowSyncPanel(true)}
        onToggleCloud={() => setShowCloudPanel(true)}
        cloudEnabled={isCloudActive}
        cloudSyncing={cloudSyncing}
      />
    </div>
  );
};

export default App;