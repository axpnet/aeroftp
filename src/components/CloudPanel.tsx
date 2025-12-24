// AeroCloud Panel - Personal FTP-Based Cloud Sync
// Setup wizard, cloud dashboard, and sync controls

import React, { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-dialog';
import {
    Cloud, CloudOff, CloudUpload, CloudDownload, RefreshCw,
    Folder, FolderOpen, Settings, Play, Pause, Check, X,
    AlertCircle, Clock, HardDrive, Server, ChevronRight,
    Loader2, Zap, Shield, History
} from 'lucide-react';
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
    savedServers: { name: string; host: string; }[];
    onToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

// Setup Wizard Component
const SetupWizard: React.FC<{
    savedServers: { name: string; host: string; }[];
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
                                onChange={(e) => setServerProfile(e.target.value)}
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
                    <button onClick={onPause} className="btn-secondary" disabled={status.type !== 'idle'}>
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
export const CloudPanel: React.FC<CloudPanelProps> = ({ savedServers, onToast }) => {
    const [config, setConfig] = useState<CloudConfig | null>(null);
    const [status, setStatus] = useState<CloudSyncStatus>({ type: 'not_configured' });
    const [isLoading, setIsLoading] = useState(true);
    const [showSettings, setShowSettings] = useState(false);

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
                onToast(`Sync completed with ${result.errors.length} errors`, 'error');
            } else {
                onToast(
                    `Synced: ↑${result.uploaded} ↓${result.downloaded} files`,
                    'success'
                );
            }
        });

        return () => {
            unlisten.then((f) => f());
            unlistenComplete.then((f) => f());
        };
    }, [onToast]);

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
        onToast('AeroCloud enabled successfully!', 'success');
    };

    const handleSyncNow = async () => {
        onToast('Starting sync...', 'info');
        try {
            // TODO: Invoke sync command
            // For now, just update status
            setStatus({ type: 'syncing', current_file: 'Scanning...', progress: 0 });
        } catch (error) {
            onToast(`Sync failed: ${error}`, 'error');
        }
    };

    const handlePause = async () => {
        setStatus({ type: 'paused' });
        onToast('Sync paused', 'info');
    };

    const handleResume = async () => {
        setStatus({ type: 'idle', last_sync: config?.last_sync || undefined });
        onToast('Sync resumed', 'info');
    };

    const handleDisable = async () => {
        try {
            await invoke('enable_aerocloud', { enabled: false });
            setConfig(prev => prev ? { ...prev, enabled: false } : null);
            setStatus({ type: 'not_configured' });
            onToast('AeroCloud disabled', 'info');
        } catch (error) {
            onToast(`Failed to disable: ${error}`, 'error');
        }
    };

    const handleOpenFolder = async () => {
        if (config?.local_folder) {
            try {
                await invoke('open_in_file_manager', { path: config.local_folder });
            } catch (error) {
                onToast(`Failed to open folder: ${error}`, 'error');
            }
        }
    };

    if (isLoading) {
        return (
            <div className="cloud-panel loading">
                <Loader2 className="spin" size={32} />
                <p>Loading AeroCloud...</p>
            </div>
        );
    }

    // Show setup wizard if not configured
    if (!config?.enabled) {
        return (
            <div className="cloud-panel">
                <SetupWizard
                    savedServers={savedServers}
                    onComplete={handleSetupComplete}
                    onCancel={() => { }}
                />
            </div>
        );
    }

    // Show dashboard
    return (
        <div className="cloud-panel">
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
    );
};

export default CloudPanel;
