// AeroCloud Panel - Personal FTP-Based Cloud Sync
// Setup wizard, cloud dashboard, and sync controls

import React, { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen, emit } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-dialog';
import {
    Cloud, CloudOff, CloudUpload, CloudDownload, RefreshCw,
    Folder, FolderOpen, Settings, Play, Pause, Check, X,
    AlertCircle, Clock, HardDrive, Server, ChevronRight,
    Loader2, Zap, Shield, History, Radio
} from 'lucide-react';
import { useTraySync } from '../hooks/useTraySync';
import './CloudPanel.css';

// TypeScript interfaces matching Rust structs
interface CloudConfig {
    enabled: boolean;
    local_folder: string;
    remote_folder: string;
    server_profile: string;
    sync_interval_secs: number;
    sync_on_change: boolean;
    sync_on_startup: boolean;
    exclude_patterns: string[];
    last_sync: string | null;
    conflict_strategy: 'ask_user' | 'keep_both' | 'prefer_local' | 'prefer_remote' | 'prefer_newer';
}

interface CloudSyncStatus {
    type: 'not_configured' | 'idle' | 'syncing' | 'paused' | 'has_conflicts' | 'error';
    last_sync?: string;
    next_sync?: string;
    current_file?: string;
    progress?: number;
    files_done?: number;
    files_total?: number;
    count?: number;
    message?: string;
}

interface SyncResult {
    uploaded: number;
    downloaded: number;
    deleted: number;
    skipped: number;
    conflicts: number;
    errors: string[];
    duration_secs: number;
}

interface CloudPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

// Setup Wizard Component
const SetupWizard: React.FC<{
    savedServers: { name: string; host: string; port?: number; username?: string; password?: string; initialPath?: string }[];
    onComplete: (config: CloudConfig) => void;
    onCancel: () => void;
}> = ({ savedServers, onComplete, onCancel }) => {
    const [step, setStep] = useState(1);
    const [localFolder, setLocalFolder] = useState('');
    const [remoteFolder, setRemoteFolder] = useState('/cloud/');
    const [serverProfile, setServerProfile] = useState('');
    const [syncOnChange, setSyncOnChange] = useState(true);
    const [syncInterval, setSyncInterval] = useState(5); // minutes
    const [isLoading, setIsLoading] = useState(false);

    // Load default folder on mount
    useEffect(() => {
        invoke<string>('get_default_cloud_folder').then(setLocalFolder);
    }, []);

    const selectLocalFolder = async () => {
        const selected = await open({
            directory: true,
            multiple: false,
            title: 'Select AeroCloud Folder',
        });
        if (selected) {
            setLocalFolder(selected as string);
        }
    };

    const handleComplete = async () => {
        setIsLoading(true);
        try {
            // First, save server credentials for background sync
            const selectedServer = savedServers.find(s => s.name === serverProfile);
            if (selectedServer && selectedServer.username && selectedServer.password) {
                const serverString = selectedServer.port && selectedServer.port !== 21
                    ? `${selectedServer.host}:${selectedServer.port}`
                    : selectedServer.host;

                await invoke('save_server_credentials', {
                    profileName: serverProfile,
                    server: serverString,
                    username: selectedServer.username,
                    password: selectedServer.password,
                });
                console.log('Server credentials saved for background sync');
            }

            // Then setup AeroCloud
            const config = await invoke<CloudConfig>('setup_aerocloud', {
                localFolder,
                remoteFolder,
                serverProfile,
                syncOnChange,
                syncIntervalSecs: syncInterval * 60,
            });
            onComplete(config);
        } catch (error) {
            console.error('Setup failed:', error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="cloud-wizard">
            <div className="wizard-header">
                <Cloud size={48} className="wizard-icon" />
                <h2>AeroCloud</h2>
                <p>Create Your Personal Cloud</p>
            </div>

            <div className="wizard-progress">
                {[1, 2, 3].map((s) => (
                    <div
                        key={s}
                        className={`progress-step ${step >= s ? 'active' : ''} ${step > s ? 'complete' : ''}`}
                    >
                        {step > s ? <Check size={16} /> : s}
                    </div>
                ))}
            </div>

            <div className="wizard-content">
                {step === 1 && (
                    <div className="wizard-step">
                        <h3><FolderOpen size={20} /> Local Folder</h3>
                        <p>Choose where AeroCloud will sync files on your computer.</p>
                        <div className="folder-input">
                            <input
                                type="text"
                                value={localFolder}
                                onChange={(e) => setLocalFolder(e.target.value)}
                                placeholder="Select folder..."
                                readOnly
                            />
                            <button onClick={selectLocalFolder} className="browse-btn">
                                <Folder size={16} /> Browse
                            </button>
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div className="wizard-step">
                        <h3><Server size={20} /> Remote Folder</h3>
                        <p>Choose the folder on your FTP server to sync with.</p>
                        <div className="folder-input">
                            <input
                                type="text"
                                value={remoteFolder}
                                onChange={(e) => setRemoteFolder(e.target.value)}
                                placeholder="/cloud/"
                            />
                        </div>
                        <div className="server-select">
                            <label>Server Profile:</label>
                            <select
                                value={serverProfile}
                                onChange={(e) => {
                                    const selectedName = e.target.value;
                                    setServerProfile(selectedName);
                                    // Auto-fill remoteFolder from saved server's initialPath
                                    const server = savedServers.find(s => s.name === selectedName);
                                    if (server?.initialPath) {
                                        // Use initialPath + /cloud/ or just the path with /cloud/ appended
                                        const basePath = server.initialPath.endsWith('/')
                                            ? server.initialPath.slice(0, -1)
                                            : server.initialPath;
                                        setRemoteFolder(`${basePath}/cloud/`);
                                    }
                                }}
                            >
                                <option value="">Select a saved server...</option>
                                {savedServers.map((server) => (
                                    <option key={server.name} value={server.name}>
                                        {server.name} ({server.host})
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                )}

                {step === 3 && (
                    <div className="wizard-step">
                        <h3><Settings size={20} /> Sync Settings</h3>
                        <div className="settings-options">
                            <label className="checkbox-option">
                                <input
                                    type="checkbox"
                                    checked={syncOnChange}
                                    onChange={(e) => setSyncOnChange(e.target.checked)}
                                />
                                <Zap size={16} />
                                <span>Sync on file change (real-time)</span>
                            </label>

                            <div className="interval-option">
                                <Clock size={16} />
                                <span>Also sync every</span>
                                <input
                                    type="number"
                                    min="1"
                                    max="60"
                                    value={syncInterval}
                                    onChange={(e) => setSyncInterval(parseInt(e.target.value) || 5)}
                                />
                                <span>minutes</span>
                            </div>
                        </div>

                        <div className="summary-box">
                            <h4>Summary</h4>
                            <p><Folder size={14} /> Local: <code>{localFolder}</code></p>
                            <p><Server size={14} /> Remote: <code>{remoteFolder}</code></p>
                            <p><Shield size={14} /> Server: <code>{serverProfile || 'Not selected'}</code></p>
                        </div>
                    </div>
                )}
            </div>

            <div className="wizard-footer">
                <button onClick={onCancel} className="btn-secondary">
                    Cancel
                </button>
                <div className="wizard-nav">
                    {step > 1 && (
                        <button onClick={() => setStep(step - 1)} className="btn-secondary">
                            Back
                        </button>
                    )}
                    {step < 3 ? (
                        <button
                            onClick={() => setStep(step + 1)}
                            className="btn-primary"
                            disabled={step === 1 && !localFolder || step === 2 && !serverProfile}
                        >
                            Next <ChevronRight size={16} />
                        </button>
                    ) : (
                        <button
                            onClick={handleComplete}
                            className="btn-primary btn-cloud"
                            disabled={isLoading || !localFolder || !serverProfile}
                        >
                            {isLoading ? <Loader2 className="spin" size={16} /> : <Cloud size={16} />}
                            Enable AeroCloud
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

// Cloud Dashboard Component
const CloudDashboard: React.FC<{
    config: CloudConfig;
    status: CloudSyncStatus;
    onSyncNow: () => void;
    onPause: () => void;
    onResume: () => void;
    onDisable: () => void;
    onOpenFolder: () => void;
    onSettings: () => void;
}> = ({ config, status, onSyncNow, onPause, onResume, onDisable, onOpenFolder, onSettings }) => {
    const formatLastSync = (timestamp: string | null) => {
        if (!timestamp) return 'Never';
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
        return date.toLocaleDateString();
    };

    const getStatusIcon = () => {
        switch (status.type) {
            case 'syncing': return <RefreshCw className="spin" size={24} />;
            case 'paused': return <Pause size={24} />;
            case 'has_conflicts': return <AlertCircle size={24} />;
            case 'error': return <X size={24} />;
            default: return <Check size={24} />;
        }
    };

    const getStatusText = () => {
        switch (status.type) {
            case 'syncing':
                return `Syncing: ${status.current_file || 'Starting...'} (${status.progress?.toFixed(0) || 0}%)`;
            case 'paused': return 'Sync paused';
            case 'has_conflicts': return `${status.count} conflicts need attention`;
            case 'error': return status.message || 'Sync error';
            default: return `Synced ${formatLastSync(config.last_sync)}`;
        }
    };

    return (
        <div className="cloud-dashboard">
            <div className="dashboard-header">
                <div className={`status-indicator status-${status.type}`}>
                    {getStatusIcon()}
                </div>
                <div className="status-info">
                    <h2>AeroCloud</h2>
                    <p className="status-text">{getStatusText()}</p>
                </div>
                <button onClick={onSettings} className="btn-icon" title="Settings">
                    <Settings size={20} />
                </button>
            </div>

            {status.type === 'syncing' && (
                <div className="sync-progress">
                    <div
                        className="progress-bar"
                        style={{ width: `${status.progress || 0}%` }}
                    />
                    <span className="progress-text">
                        {status.files_done || 0} / {status.files_total || 0} files
                    </span>
                </div>
            )}

            <div className="dashboard-cards">
                <div className="info-card">
                    <Folder size={20} />
                    <div>
                        <span className="label">Local Folder</span>
                        <span className="value">{config.local_folder}</span>
                    </div>
                </div>

                <div className="info-card">
                    <Server size={20} />
                    <div>
                        <span className="label">Remote Folder</span>
                        <span className="value">{config.remote_folder}</span>
                    </div>
                </div>

                <div className="info-card">
                    <Shield size={20} />
                    <div>
                        <span className="label">Server</span>
                        <span className="value">{config.server_profile}</span>
                    </div>
                </div>

                <div className="info-card">
                    <History size={20} />
                    <div>
                        <span className="label">Last Sync</span>
                        <span className="value">{formatLastSync(config.last_sync)}</span>
                    </div>
                </div>

                <div className="info-card">
                    <Clock size={20} />
                    <div>
                        <span className="label">Sync Interval</span>
                        <span className="value">{Math.round(config.sync_interval_secs / 60)} min</span>
                    </div>
                </div>
            </div>

            <div className="dashboard-actions">
                <button
                    onClick={onSyncNow}
                    className="btn-primary"
                    disabled={status.type === 'syncing'}
                >
                    <RefreshCw size={16} /> Sync Now
                </button>

                {status.type === 'paused' ? (
                    <button onClick={onResume} className="btn-secondary">
                        <Play size={16} /> Resume
                    </button>
                ) : (
                    <button
                        onClick={onPause}
                        className="btn-secondary"
                        disabled={status.type === 'not_configured' || status.type === 'error'}
                    >
                        <Pause size={16} /> Pause
                    </button>
                )}

                <button onClick={onOpenFolder} className="btn-secondary">
                    <FolderOpen size={16} /> Open Folder
                </button>

                <button onClick={onDisable} className="btn-danger">
                    <CloudOff size={16} /> Disable
                </button>
            </div>
        </div>
    );
};

// Main CloudPanel Component
export const CloudPanel: React.FC<CloudPanelProps> = ({ isOpen, onClose }) => {
    const [config, setConfig] = useState<CloudConfig | null>(null);
    const [status, setStatus] = useState<CloudSyncStatus>({ type: 'not_configured' });
    const [isLoading, setIsLoading] = useState(true);
    const [showSettings, setShowSettings] = useState(false);

    // Use modular tray sync hook
    const {
        trayState,
        isRunning: isBackgroundSyncRunning,
        startBackgroundSync,
        stopBackgroundSync,
        toggleBackgroundSync
    } = useTraySync();

    // Load saved servers from localStorage (same key as SavedServers component)
    // Include all credentials for background sync support
    const savedServers = React.useMemo(() => {
        try {
            const stored = localStorage.getItem('aeroftp-saved-servers');
            if (stored) {
                const servers = JSON.parse(stored);
                return servers.map((s: {
                    name?: string;
                    host: string;
                    port?: number;
                    username?: string;
                    password?: string;
                    initialPath?: string;
                }) => ({
                    name: s.name || s.host,
                    host: s.host,
                    port: s.port || 21,
                    username: s.username || '',
                    password: s.password || '',
                    initialPath: s.initialPath || ''
                }));
            }
        } catch (e) {
            console.error('Failed to load saved servers:', e);
        }
        return [];
    }, [isOpen]); // Reload when panel opens

    // Load config on mount
    useEffect(() => {
        loadConfig();
    }, []);

    // Listen for status changes
    useEffect(() => {
        const unlisten = listen<CloudSyncStatus>('cloud_status_change', (event) => {
            setStatus(event.payload);
        });

        const unlistenComplete = listen<SyncResult>('cloud_sync_complete', (event) => {
            const result = event.payload;
            if (result.errors.length > 0) {
                console.log(`Sync completed with ${result.errors.length} errors`, 'error');
            } else {
                console.log(
                    `Synced: ↑${result.uploaded} ↓${result.downloaded} files`,
                    'success'
                );
            }
        });

        return () => {
            unlisten.then((f) => f());
            unlistenComplete.then((f) => f());
        };
    }, []);

    const loadConfig = async () => {
        setIsLoading(true);
        try {
            const cfg = await invoke<CloudConfig>('get_cloud_config');
            setConfig(cfg);

            if (cfg.enabled) {
                const sts = await invoke<CloudSyncStatus>('get_cloud_status');
                // The status from Rust already has the correct type
                setStatus(sts);
            }
        } catch (error) {
            console.error('Failed to load cloud config:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSetupComplete = (newConfig: CloudConfig) => {
        setConfig(newConfig);
        setStatus({ type: 'idle' });
        // Notify parent that cloud is now active
        emit('cloud-sync-status', { status: 'active', message: 'AeroCloud enabled' });
        console.log('AeroCloud enabled successfully!', 'success');
    };

    const handleSyncNow = async () => {
        console.log('Starting sync...');
        setStatus({ type: 'syncing', current_file: 'Scanning...', progress: 0 });
        try {
            // Start background sync if not already running
            if (!isBackgroundSyncRunning) {
                await startBackgroundSync();
            }
            const result = await invoke<string>('trigger_cloud_sync');
            console.log('Sync result:', result);
            setStatus({ type: 'idle' });
            // Reload config to update last_sync
            loadConfig();
        } catch (error) {
            console.error('Sync failed:', error);
            setStatus({ type: 'error', message: String(error) });
        }
    };

    const handlePause = async () => {
        try {
            await stopBackgroundSync();
            setStatus({ type: 'paused' });
            console.log('Sync paused', 'info');
        } catch (error) {
            console.error('Failed to pause sync:', error);
        }
    };

    const handleResume = async () => {
        try {
            await startBackgroundSync();
            setStatus({ type: 'idle', last_sync: config?.last_sync || undefined });
            console.log('Sync resumed', 'info');
        } catch (error) {
            console.error('Failed to resume sync:', error);
        }
    };

    const handleDisable = async () => {
        try {
            await stopBackgroundSync();
            await invoke('enable_aerocloud', { enabled: false });
            setConfig(prev => prev ? { ...prev, enabled: false } : null);
            setStatus({ type: 'not_configured' });
            // Notify parent that cloud is now disabled
            emit('cloud-sync-status', { status: 'disabled', message: 'AeroCloud disabled' });
            console.log('AeroCloud disabled', 'info');
        } catch (error) {
            console.log(`Failed to disable: ${error}`, 'error');
        }
    };

    const handleOpenFolder = async () => {
        if (config?.local_folder) {
            try {
                await invoke('open_in_file_manager', { path: config.local_folder });
            } catch (error) {
                console.log(`Failed to open folder: ${error}`, 'error');
            }
        }
    };

    // Don't render if not open
    if (!isOpen) return null;

    if (isLoading) {
        return (
            <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center backdrop-blur-sm" onClick={onClose}>
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-8 max-w-2xl w-full mx-4 max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-center gap-3">
                        <Loader2 className="animate-spin" size={32} />
                        <p>Loading AeroCloud...</p>
                    </div>
                </div>
            </div>
        );
    }

    // Show setup wizard if not configured
    if (!config?.enabled) {
        return (
            <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center backdrop-blur-sm" onClick={onClose}>
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-semibold flex items-center gap-2"><Cloud className="text-cyan-500" /> AeroCloud Setup</h2>
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"><X size={20} /></button>
                    </div>
                    <SetupWizard
                        savedServers={savedServers}
                        onComplete={handleSetupComplete}
                        onCancel={onClose}
                    />
                </div>
            </div>
        );
    }

    // Show settings panel
    if (showSettings) {
        return (
            <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center backdrop-blur-sm" onClick={onClose}>
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-semibold flex items-center gap-2"><Settings className="text-cyan-500" /> AeroCloud Settings</h2>
                        <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"><X size={20} /></button>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Local Folder</label>
                            <input
                                type="text"
                                value={config?.local_folder || ''}
                                readOnly
                                className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Remote Folder</label>
                            <input
                                type="text"
                                value={config?.remote_folder || '/cloud/'}
                                onChange={e => setConfig(prev => prev ? { ...prev, remote_folder: e.target.value } : null)}
                                className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
                                placeholder="/cloud/"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Server Profile</label>
                            <input
                                type="text"
                                value={config?.server_profile || ''}
                                readOnly
                                className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm"
                            />
                        </div>

                        <div className="flex gap-3 pt-4">
                            <button
                                onClick={async () => {
                                    if (config) {
                                        try {
                                            await invoke('save_cloud_config_cmd', { config });
                                            setShowSettings(false);
                                            console.log('Settings saved!');
                                        } catch (e) {
                                            console.error('Failed to save settings:', e);
                                        }
                                    }
                                }}
                                className="flex-1 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg font-medium"
                            >
                                Save Settings
                            </button>
                            <button
                                onClick={() => setShowSettings(false)}
                                className="flex-1 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg font-medium"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Show dashboard
    return (
        <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold flex items-center gap-2"><Cloud className="text-cyan-500" /> AeroCloud</h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"><X size={20} /></button>
                </div>
                <CloudDashboard
                    config={config}
                    status={status}
                    onSyncNow={handleSyncNow}
                    onPause={handlePause}
                    onResume={handleResume}
                    onDisable={handleDisable}
                    onOpenFolder={handleOpenFolder}
                    onSettings={() => setShowSettings(true)}
                />
            </div>
        </div>
    );
};

export default CloudPanel;
