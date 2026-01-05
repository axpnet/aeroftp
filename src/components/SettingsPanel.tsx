import * as React from 'react';
import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { X, Settings, Server, Upload, Palette, Trash2, Edit, Plus, FolderOpen, Wifi, FileCheck, Globe } from 'lucide-react';
import { ServerProfile } from '../types';
import { useI18n, Language, AVAILABLE_LANGUAGES } from '../i18n';

interface SettingsPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

// Settings storage key
const SETTINGS_KEY = 'aeroftp_settings';
const SERVERS_KEY = 'aeroftp-saved-servers';

interface AppSettings {
    // General
    defaultLocalPath: string;
    showHiddenFiles: boolean;
    confirmBeforeDelete: boolean;
    // Connection
    timeoutSeconds: number;
    tlsVersion: 'auto' | '1.2' | '1.3';
    reconnectAttempts: number;
    reconnectDelay: number;
    ftpMode: 'passive' | 'active';
    // Transfers
    maxConcurrentTransfers: number;
    retryCount: number;
    // File Handling
    fileExistsAction: 'ask' | 'overwrite' | 'skip' | 'rename' | 'resume';
    preserveTimestamps: boolean;
    transferMode: 'auto' | 'ascii' | 'binary';
    // UI
    showStatusBar: boolean;
    compactMode: boolean;
    showSystemMenu: boolean;
}

const defaultSettings: AppSettings = {
    defaultLocalPath: '',
    showHiddenFiles: false,
    confirmBeforeDelete: true,
    timeoutSeconds: 30,
    tlsVersion: 'auto',
    reconnectAttempts: 3,
    reconnectDelay: 5,
    ftpMode: 'passive',
    maxConcurrentTransfers: 2,
    retryCount: 3,
    fileExistsAction: 'ask',
    preserveTimestamps: true,
    transferMode: 'auto',
    showStatusBar: true,
    compactMode: false,
    showSystemMenu: false,
};

type TabId = 'general' | 'connection' | 'servers' | 'transfers' | 'filehandling' | 'ui';

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ isOpen, onClose }) => {
    const [activeTab, setActiveTab] = useState<TabId>('general');
    const [settings, setSettings] = useState<AppSettings>(defaultSettings);
    const [servers, setServers] = useState<ServerProfile[]>([]);
    const [editingServer, setEditingServer] = useState<ServerProfile | null>(null);
    const [hasChanges, setHasChanges] = useState(false);

    // i18n hook
    const { language, setLanguage, t, availableLanguages } = useI18n();

    // Load settings on open
    useEffect(() => {
        if (isOpen) {
            try {
                const saved = localStorage.getItem(SETTINGS_KEY);
                if (saved) setSettings({ ...defaultSettings, ...JSON.parse(saved) });
                const savedServers = localStorage.getItem(SERVERS_KEY);
                if (savedServers) setServers(JSON.parse(savedServers));
            } catch { }
        }
    }, [isOpen]);

    const handleSave = () => {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
        localStorage.setItem(SERVERS_KEY, JSON.stringify(servers));
        // Apply system menu setting immediately
        invoke('toggle_menu_bar', { visible: settings.showSystemMenu });
        // Notify App.tsx of settings change (for compactMode etc)
        window.dispatchEvent(new CustomEvent('aeroftp-settings-changed'));
        setHasChanges(false);
        onClose();
    };

    const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
        setSettings(prev => ({ ...prev, [key]: value }));
        setHasChanges(true);
    };

    const deleteServer = (id: string) => {
        setServers(prev => prev.filter(s => s.id !== id));
        setHasChanges(true);
    };

    if (!isOpen) return null;

    const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
        { id: 'general', label: 'General', icon: <Settings size={16} /> },
        { id: 'connection', label: 'Connection', icon: <Wifi size={16} /> },
        { id: 'servers', label: 'Servers', icon: <Server size={16} /> },
        { id: 'transfers', label: 'Transfers', icon: <Upload size={16} /> },
        { id: 'filehandling', label: 'File Handling', icon: <FileCheck size={16} /> },
        { id: 'ui', label: 'Appearance', icon: <Palette size={16} /> },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

            {/* Panel */}
            <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden animate-scale-in flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg">
                            <Settings size={20} className="text-white" />
                        </div>
                        <h2 className="text-lg font-semibold">Settings</h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                        <X size={18} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex flex-1 overflow-hidden">
                    {/* Sidebar */}
                    <div className="w-48 border-r border-gray-200 dark:border-gray-700 p-2 space-y-1">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${activeTab === tab.id
                                    ? 'bg-blue-500 text-white'
                                    : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                                    }`}
                            >
                                {tab.icon}
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Main content */}
                    <div className="flex-1 p-6 overflow-y-auto">
                        {activeTab === 'general' && (
                            <div className="space-y-6">
                                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">General Settings</h3>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Default Local Path</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={settings.defaultLocalPath}
                                                onChange={e => updateSetting('defaultLocalPath', e.target.value)}
                                                placeholder="e.g., /home/user/Downloads"
                                                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm"
                                            />
                                            <button
                                                onClick={async () => {
                                                    try {
                                                        const selected = await open({ directory: true, multiple: false, title: 'Select Default Local Folder' });
                                                        if (selected && typeof selected === 'string') {
                                                            updateSetting('defaultLocalPath', selected);
                                                        }
                                                    } catch (e) { console.error('Folder picker error:', e); }
                                                }}
                                                className="px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                                                title="Browse"
                                            >
                                                <FolderOpen size={16} />
                                            </button>
                                        </div>
                                    </div>

                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={settings.showHiddenFiles}
                                            onChange={e => updateSetting('showHiddenFiles', e.target.checked)}
                                            className="w-4 h-4 rounded"
                                        />
                                        <span className="text-sm">Show hidden files (dotfiles)</span>
                                    </label>

                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={settings.confirmBeforeDelete}
                                            onChange={e => updateSetting('confirmBeforeDelete', e.target.checked)}
                                            className="w-4 h-4 rounded"
                                        />
                                        <span className="text-sm">Confirm before deleting files</span>
                                    </label>
                                </div>
                            </div>
                        )}

                        {activeTab === 'connection' && (
                            <div className="space-y-6">
                                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Connection Settings</h3>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Connection Timeout</label>
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="range"
                                                min="10"
                                                max="120"
                                                value={settings.timeoutSeconds}
                                                onChange={e => updateSetting('timeoutSeconds', parseInt(e.target.value))}
                                                className="flex-1"
                                            />
                                            <span className="text-sm w-16 text-right">{settings.timeoutSeconds}s</span>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1">Time before connection attempt times out</p>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium mb-1">TLS Version</label>
                                        <select
                                            value={settings.tlsVersion}
                                            onChange={e => updateSetting('tlsVersion', e.target.value as 'auto' | '1.2' | '1.3')}
                                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                                        >
                                            <option value="auto">Auto (Recommended)</option>
                                            <option value="1.2">TLS 1.2 Minimum</option>
                                            <option value="1.3">TLS 1.3 Only</option>
                                        </select>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Reconnect Attempts</label>
                                            <select
                                                value={settings.reconnectAttempts}
                                                onChange={e => updateSetting('reconnectAttempts', parseInt(e.target.value))}
                                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                                            >
                                                {[0, 1, 2, 3, 5, 10].map(n => (
                                                    <option key={n} value={n}>{n === 0 ? 'Disabled' : `${n} attempts`}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Reconnect Delay</label>
                                            <select
                                                value={settings.reconnectDelay}
                                                onChange={e => updateSetting('reconnectDelay', parseInt(e.target.value))}
                                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                                            >
                                                {[1, 3, 5, 10, 30].map(n => (
                                                    <option key={n} value={n}>{n} seconds</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium mb-2">FTP Mode</label>
                                        <div className="flex gap-4">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="ftpMode"
                                                    checked={settings.ftpMode === 'passive'}
                                                    onChange={() => updateSetting('ftpMode', 'passive')}
                                                    className="w-4 h-4"
                                                />
                                                <span className="text-sm">Passive (Recommended)</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="ftpMode"
                                                    checked={settings.ftpMode === 'active'}
                                                    onChange={() => updateSetting('ftpMode', 'active')}
                                                    className="w-4 h-4"
                                                />
                                                <span className="text-sm">Active</span>
                                            </label>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1">Passive mode works better behind NAT/firewalls</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'servers' && (
                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Saved Servers</h3>
                                    <button
                                        onClick={() => setEditingServer({ id: crypto.randomUUID(), name: '', host: '', port: 21, username: '', password: '' })}
                                        className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm flex items-center gap-1.5"
                                    >
                                        <Plus size={14} /> Add Server
                                    </button>
                                </div>

                                {servers.length === 0 ? (
                                    <div className="text-center py-8 text-gray-500">
                                        <Server size={48} className="mx-auto mb-3 opacity-30" />
                                        <p>No saved servers</p>
                                        <p className="text-sm">Add servers from the connection screen</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {servers.map(server => (
                                            <div
                                                key={server.id}
                                                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                                            >
                                                <div>
                                                    <p className="font-medium">{server.name}</p>
                                                    <p className="text-sm text-gray-500">
                                                        {server.host}:{server.port} • {server.username}
                                                    </p>
                                                    {(server.initialPath || server.localInitialPath) && (
                                                        <p className="text-xs text-gray-400 mt-1">
                                                            {server.initialPath && <span>📁 Remote: {server.initialPath}</span>}
                                                            {server.initialPath && server.localInitialPath && ' • '}
                                                            {server.localInitialPath && <span>💻 Local: {server.localInitialPath}</span>}
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => setEditingServer(server)}
                                                        className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                                                    >
                                                        <Edit size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => deleteServer(server.id)}
                                                        className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 rounded"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Edit Server Modal */}
                                {editingServer && (
                                    <div className="fixed inset-0 z-60 flex items-center justify-center">
                                        <div className="absolute inset-0 bg-black/30" onClick={() => setEditingServer(null)} />
                                        <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-md space-y-4">
                                            <h3 className="text-lg font-semibold">Edit Server</h3>
                                            <div className="space-y-3">
                                                <input
                                                    type="text"
                                                    placeholder="Server Name"
                                                    value={editingServer.name}
                                                    onChange={e => setEditingServer({ ...editingServer, name: e.target.value })}
                                                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg"
                                                />
                                                <div className="flex gap-2">
                                                    <input
                                                        type="text"
                                                        placeholder="Host"
                                                        value={editingServer.host}
                                                        onChange={e => setEditingServer({ ...editingServer, host: e.target.value })}
                                                        className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg"
                                                    />
                                                    <input
                                                        type="number"
                                                        placeholder="Port"
                                                        value={editingServer.port}
                                                        onChange={e => setEditingServer({ ...editingServer, port: parseInt(e.target.value) || 21 })}
                                                        className="w-20 px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg"
                                                    />
                                                </div>
                                                <input
                                                    type="text"
                                                    placeholder="Username"
                                                    value={editingServer.username}
                                                    onChange={e => setEditingServer({ ...editingServer, username: e.target.value })}
                                                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg"
                                                />
                                                <input
                                                    type="password"
                                                    placeholder="Password"
                                                    value={editingServer.password || ''}
                                                    onChange={e => setEditingServer({ ...editingServer, password: e.target.value })}
                                                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg"
                                                />
                                                <input
                                                    type="text"
                                                    placeholder="Remote Path (optional)"
                                                    value={editingServer.initialPath || ''}
                                                    onChange={e => setEditingServer({ ...editingServer, initialPath: e.target.value })}
                                                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg"
                                                />
                                                <div className="flex gap-2">
                                                    <input
                                                        type="text"
                                                        placeholder="Local Path (optional)"
                                                        value={editingServer.localInitialPath || ''}
                                                        onChange={e => setEditingServer({ ...editingServer, localInitialPath: e.target.value })}
                                                        className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={async () => {
                                                            try {
                                                                const selected = await open({ directory: true, multiple: false, title: 'Select Local Folder' });
                                                                if (selected && typeof selected === 'string') {
                                                                    setEditingServer({ ...editingServer, localInitialPath: selected });
                                                                }
                                                            } catch (e) { console.error('Folder picker error:', e); }
                                                        }}
                                                        className="px-3 py-2 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-lg transition-colors"
                                                        title="Browse"
                                                    >
                                                        <FolderOpen size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="flex gap-2 justify-end">
                                                <button
                                                    onClick={() => setEditingServer(null)}
                                                    className="px-4 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 rounded-lg"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        const exists = servers.some(s => s.id === editingServer.id);
                                                        if (exists) {
                                                            setServers(prev => prev.map(s => s.id === editingServer.id ? editingServer : s));
                                                        } else {
                                                            setServers(prev => [...prev, editingServer]);
                                                        }
                                                        setEditingServer(null);
                                                        setHasChanges(true);
                                                    }}
                                                    className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg"
                                                >
                                                    Save
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                        {activeTab === 'filehandling' && (
                            <div className="space-y-6">
                                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">File Handling</h3>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1">When file exists on destination</label>
                                        <select
                                            value={settings.fileExistsAction}
                                            onChange={e => updateSetting('fileExistsAction', e.target.value as 'ask' | 'overwrite' | 'skip' | 'rename' | 'resume')}
                                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                                        >
                                            <option value="ask">Ask each time</option>
                                            <option value="overwrite">Overwrite</option>
                                            <option value="skip">Skip</option>
                                            <option value="rename">Rename (add number)</option>
                                            <option value="resume">Resume if possible</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium mb-1">Transfer Mode</label>
                                        <select
                                            value={settings.transferMode}
                                            onChange={e => updateSetting('transferMode', e.target.value as 'auto' | 'ascii' | 'binary')}
                                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                                        >
                                            <option value="auto">Auto (Recommended)</option>
                                            <option value="binary">Binary (images, archives)</option>
                                            <option value="ascii">ASCII (text files)</option>
                                        </select>
                                        <p className="text-xs text-gray-500 mt-1">Auto mode detects file type and chooses appropriately</p>
                                    </div>

                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={settings.preserveTimestamps}
                                            onChange={e => updateSetting('preserveTimestamps', e.target.checked)}
                                            className="w-4 h-4 rounded"
                                        />
                                        <div>
                                            <p className="font-medium">Preserve file timestamps</p>
                                            <p className="text-sm text-gray-500">Keep original modification dates when transferring</p>
                                        </div>
                                    </label>
                                </div>
                            </div>
                        )}

                        {activeTab === 'transfers' && (
                            <div className="space-y-6">
                                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Transfer Settings</h3>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Concurrent Transfers</label>
                                        <select
                                            value={settings.maxConcurrentTransfers}
                                            onChange={e => updateSetting('maxConcurrentTransfers', parseInt(e.target.value))}
                                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                                        >
                                            {[1, 2, 3, 4, 5].map(n => (
                                                <option key={n} value={n}>{n} {n === 1 ? 'file' : 'files'} at a time</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium mb-1">Retry Count on Error</label>
                                        <select
                                            value={settings.retryCount}
                                            onChange={e => updateSetting('retryCount', parseInt(e.target.value))}
                                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                                        >
                                            {[0, 1, 2, 3, 5].map(n => (
                                                <option key={n} value={n}>{n === 0 ? 'No retries' : `${n} retries`}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium mb-1">Connection Timeout</label>
                                        <select
                                            value={settings.timeoutSeconds}
                                            onChange={e => updateSetting('timeoutSeconds', parseInt(e.target.value))}
                                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                                        >
                                            {[10, 30, 60, 120].map(n => (
                                                <option key={n} value={n}>{n} seconds</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'ui' && (
                            <div className="space-y-6">
                                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{t('settings.appearance')}</h3>

                                <div className="space-y-4">
                                    {/* Language Selector */}
                                    <div>
                                        <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                                            <Globe size={16} className="text-blue-500" />
                                            {t('settings.interfaceLanguage')}
                                        </label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {availableLanguages.map(lang => (
                                                <button
                                                    key={lang.code}
                                                    onClick={() => setLanguage(lang.code as Language)}
                                                    className={`flex items-center gap-3 px-4 py-3 rounded-lg border-2 transition-all ${language === lang.code
                                                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                                                            : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                                                        }`}
                                                >
                                                    <span className="text-2xl">{lang.flag}</span>
                                                    <div className="text-left">
                                                        <p className={`font-medium ${language === lang.code ? 'text-blue-600 dark:text-blue-400' : ''}`}>
                                                            {lang.nativeName}
                                                        </p>
                                                        <p className="text-xs text-gray-500">{lang.name}</p>
                                                    </div>
                                                    {language === lang.code && (
                                                        <span className="ml-auto text-blue-500">✓</span>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                        <p className="text-xs text-gray-400 mt-2">{t('settings.restartRequired')}</p>
                                    </div>

                                    <div className="border-t border-gray-200 dark:border-gray-700 my-4" />

                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={settings.showSystemMenu}
                                            onChange={e => updateSetting('showSystemMenu', e.target.checked)}
                                            className="w-4 h-4 rounded"
                                        />
                                        <div>
                                            <p className="font-medium">Show System Menu Bar</p>
                                            <p className="text-sm text-gray-500">Show the native File/Edit/View menu at the top of the window</p>
                                        </div>
                                    </label>

                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={settings.compactMode}
                                            onChange={e => updateSetting('compactMode', e.target.checked)}
                                            className="w-4 h-4 rounded"
                                        />
                                        <div>
                                            <p className="font-medium">Compact Mode</p>
                                            <p className="text-sm text-gray-500">Decrease spacing for higher density</p>
                                        </div>
                                    </label>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!hasChanges}
                        className={`px-4 py-2 text-sm rounded-lg transition-colors ${hasChanges
                            ? 'bg-blue-500 hover:bg-blue-600 text-white'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
                            }`}
                    >
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SettingsPanel;
