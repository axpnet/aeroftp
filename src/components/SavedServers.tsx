import * as React from 'react';
import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Server, Plus, Trash2, Edit2, X, Check, FolderOpen, Cloud, AlertCircle } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { ServerProfile, ConnectionParams, ProviderType, isOAuthProvider } from '../types';
import { useTranslation } from '../i18n';
import { getProtocolInfo } from './ProtocolSelector';

// OAuth settings storage key (same as SettingsPanel)
const OAUTH_SETTINGS_KEY = 'aeroftp_oauth_settings';

interface OAuthSettings {
    googledrive: { clientId: string; clientSecret: string };
    dropbox: { clientId: string; clientSecret: string };
    onedrive: { clientId: string; clientSecret: string };
}

// Get OAuth settings from localStorage
const getOAuthSettings = (): OAuthSettings | null => {
    try {
        const stored = localStorage.getItem(OAUTH_SETTINGS_KEY);
        return stored ? JSON.parse(stored) : null;
    } catch {
        return null;
    }
};

// Map protocol to OAuth provider key
const getOAuthProviderKey = (protocol: ProviderType): keyof OAuthSettings | null => {
    switch (protocol) {
        case 'googledrive': return 'googledrive';
        case 'dropbox': return 'dropbox';
        case 'onedrive': return 'onedrive';
        default: return null;
    }
};

interface SavedServersProps {
    onConnect: (params: ConnectionParams, initialPath?: string, localInitialPath?: string) => void;
    className?: string;
}

const STORAGE_KEY = 'aeroftp-saved-servers';

// Generate a unique ID
const generateId = () => `srv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Get saved servers from localStorage
const getSavedServers = (): ServerProfile[] => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
};

// Save servers to localStorage
const saveServers = (servers: ServerProfile[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(servers));
};

export const SavedServers: React.FC<SavedServersProps> = ({ onConnect, className = '' }) => {
    const t = useTranslation();
    const [servers, setServers] = useState<ServerProfile[]>([]);
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [oauthConnecting, setOauthConnecting] = useState<string | null>(null);
    const [oauthError, setOauthError] = useState<string | null>(null);
    const [formData, setFormData] = useState<Partial<ServerProfile>>({
        name: '',
        host: '',
        port: 21,
        username: '',
        password: '',
        initialPath: '',
        localInitialPath: '',
        protocol: 'ftp',
    });

    // Protocol colors for avatar
    const protocolColors: Record<string, string> = {
        ftp: 'from-blue-500 to-cyan-400',
        ftps: 'from-green-500 to-emerald-400',
        sftp: 'from-purple-500 to-violet-400',
        webdav: 'from-orange-500 to-amber-400',
        s3: 'from-amber-500 to-yellow-400',
        aerocloud: 'from-sky-400 to-blue-500',
        googledrive: 'from-red-500 to-red-400',
        dropbox: 'from-blue-600 to-blue-400',
        onedrive: 'from-sky-500 to-sky-400',
    };

    useEffect(() => {
        setServers(getSavedServers());
    }, []);

    const handleSave = () => {
        // OAuth providers don't require host/username
        const isOAuth = formData.protocol && isOAuthProvider(formData.protocol);
        if (!isOAuth && (!formData.host || !formData.username)) return;
        if (isOAuth && !formData.name) return;

        const newServer: ServerProfile = {
            id: editingId || generateId(),
            name: formData.name || formData.host || '',
            host: formData.host || '',
            port: formData.port || 21,
            username: formData.username || '',
            password: formData.password,
            protocol: formData.protocol || 'ftp',
            initialPath: formData.initialPath,
            localInitialPath: formData.localInitialPath,
            lastConnected: editingId ? servers.find(s => s.id === editingId)?.lastConnected : undefined,
        };

        let updated: ServerProfile[];
        if (editingId) {
            updated = servers.map(s => s.id === editingId ? newServer : s);
        } else {
            updated = [...servers, newServer];
        }

        setServers(updated);
        saveServers(updated);
        resetForm();
    };

    const handleDelete = (id: string) => {
        const updated = servers.filter(s => s.id !== id);
        setServers(updated);
        saveServers(updated);
    };

    const handleEdit = (server: ServerProfile) => {
        setFormData(server);
        setEditingId(server.id);
        setShowAddForm(true);
    };

    const handleConnect = async (server: ServerProfile) => {
        // Clear any previous OAuth error
        setOauthError(null);
        
        // Check if this is an OAuth provider
        if (server.protocol && isOAuthProvider(server.protocol)) {
            const providerKey = getOAuthProviderKey(server.protocol);
            const oauthSettings = getOAuthSettings();
            
            if (!providerKey || !oauthSettings) {
                setOauthError('OAuth credentials not configured. Please go to Settings > Cloud Storage to configure your credentials.');
                return;
            }
            
            const credentials = oauthSettings[providerKey];
            if (!credentials?.clientId || !credentials?.clientSecret) {
                setOauthError(`Please configure ${server.protocol === 'googledrive' ? 'Google Drive' : server.protocol === 'dropbox' ? 'Dropbox' : 'OneDrive'} credentials in Settings > Cloud Storage.`);
                return;
            }
            
            // Start OAuth flow
            setOauthConnecting(server.id);
            try {
                // First authenticate
                await invoke('oauth2_full_auth', {
                    params: {
                        provider: server.protocol === 'googledrive' ? 'google_drive' : server.protocol,
                        client_id: credentials.clientId,
                        client_secret: credentials.clientSecret,
                    }
                });
                
                // Then connect
                const displayName = await invoke<string>('oauth2_connect', {
                    params: {
                        provider: server.protocol === 'googledrive' ? 'google_drive' : server.protocol,
                        client_id: credentials.clientId,
                        client_secret: credentials.clientSecret,
                    }
                });
                
                // Update last connected
                const updated = servers.map(s =>
                    s.id === server.id ? { ...s, lastConnected: new Date().toISOString() } : s
                );
                setServers(updated);
                saveServers(updated);
                
                // Call onConnect with OAuth params
                onConnect({
                    server: displayName,
                    username: '',
                    password: '',
                    protocol: server.protocol,
                }, server.initialPath, server.localInitialPath);
                
            } catch (e) {
                setOauthError(e instanceof Error ? e.message : String(e));
            } finally {
                setOauthConnecting(null);
            }
            return;
        }
        
        // Non-OAuth: Update last connected
        const updated = servers.map(s =>
            s.id === server.id ? { ...s, lastConnected: new Date().toISOString() } : s
        );
        setServers(updated);
        saveServers(updated);

        // Build connection params
        const serverString = server.port !== 21 ? `${server.host}:${server.port}` : server.host;
        onConnect({
            server: serverString,
            username: server.username,
            password: server.password || '',
            protocol: server.protocol || 'ftp',
            displayName: server.name,  // Pass custom name for tab display
        }, server.initialPath, server.localInitialPath);
    };

    const resetForm = () => {
        setFormData({ name: '', host: '', port: 21, username: '', password: '', initialPath: '', localInitialPath: '', protocol: 'ftp' });
        setEditingId(null);
        setShowAddForm(false);
    };

    return (
        <div className={`${className}`}>
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Server size={20} />
                    {t('connection.savedServers')}
                </h3>
                <button
                    onClick={() => setShowAddForm(true)}
                    className="p-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition-colors"
                    title={t('connection.saveServer')}
                >
                    <Plus size={16} />
                </button>
            </div>

            {/* Server list */}
            {servers.length === 0 && !showAddForm && (
                <p className="text-gray-500 dark:text-gray-400 text-sm text-center py-4">
                    {t('connection.noSavedServers')}
                </p>
            )}

            {/* OAuth Error Message */}
            {oauthError && (
                <div className="mb-3 p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg">
                    <div className="flex items-start gap-2 text-red-700 dark:text-red-300">
                        <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                            <span className="text-sm">{oauthError}</span>
                            <button
                                onClick={() => setOauthError(null)}
                                className="ml-2 text-xs underline hover:no-underline"
                            >
                                Dismiss
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="space-y-2">
                {servers.map(server => (
                    <div
                        key={server.id}
                        className={`flex items-center justify-between p-3 bg-gray-100 dark:bg-gray-700 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors group ${oauthConnecting === server.id ? 'opacity-75' : ''}`}
                    >
                        <button
                            onClick={() => handleConnect(server)}
                            disabled={oauthConnecting !== null}
                            className="flex-1 text-left flex items-center gap-3 disabled:cursor-wait"
                        >
                            <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${protocolColors[server.protocol || 'ftp']} flex items-center justify-center text-white ${oauthConnecting === server.id ? 'animate-pulse' : ''}`}>
                                {isOAuthProvider(server.protocol || 'ftp') ? (
                                    <Cloud size={18} />
                                ) : (
                                    <span className="font-bold">{(server.name || server.host).charAt(0).toUpperCase()}</span>
                                )}
                            </div>
                            <div>
                                <div className="font-medium flex items-center gap-2">
                                    {server.name || server.host}
                                    {oauthConnecting === server.id && (
                                        <span className="text-xs text-blue-500 animate-pulse">Authenticating...</span>
                                    )}
                                    <span className="text-xs px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 uppercase">
                                        {server.protocol || 'ftp'}
                                    </span>
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                    {isOAuthProvider(server.protocol || 'ftp') 
                                        ? 'OAuth2 Connection'
                                        : `${server.username}@${server.host}:${server.port}`
                                    }
                                </div>
                            </div>
                        </button>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                                onClick={() => handleEdit(server)}
                                className="p-2 text-gray-500 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                                title={t('connection.editServer')}
                            >
                                <Edit2 size={14} />
                            </button>
                            <button
                                onClick={() => handleDelete(server.id)}
                                className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                title={t('connection.deleteServer')}
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Add/Edit form */}
            {showAddForm && (
                <div className="mt-4 p-4 bg-gray-100 dark:bg-gray-700 rounded-xl space-y-3">
                    <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">{editingId ? t('connection.editServer') : t('connection.saveServer')}</h4>
                        <button onClick={resetForm} className="p-1 text-gray-500 hover:text-gray-700">
                            <X size={16} />
                        </button>
                    </div>
                    
                    {/* Protocol Selector */}
                    <select
                        value={formData.protocol || 'ftp'}
                        onChange={e => setFormData({ ...formData, protocol: e.target.value as ProviderType })}
                        className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
                    >
                        <optgroup label="Traditional">
                            <option value="ftp">FTP</option>
                            <option value="ftps">FTPS (Secure)</option>
                            <option value="webdav" disabled>WebDAV (Soon)</option>
                            <option value="s3" disabled>S3 (Soon)</option>
                        </optgroup>
                        <optgroup label="Cloud Providers">
                            <option value="aerocloud">☁️ AeroCloud (Sync)</option>
                            <option value="googledrive">Google Drive</option>
                            <option value="dropbox" disabled>Dropbox (Soon)</option>
                            <option value="onedrive" disabled>OneDrive (Soon)</option>
                        </optgroup>
                    </select>
                    
                    <input
                        type="text"
                        placeholder={t('connection.serverName') + (isOAuthProvider(formData.protocol || 'ftp') ? ' *' : '')}
                        value={formData.name || ''}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
                    />
                    
                    {/* Only show server/credentials for non-OAuth */}
                    {!isOAuthProvider(formData.protocol || 'ftp') && (
                        <>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder={t('connection.server') + ' *'}
                                    value={formData.host || ''}
                                    onChange={e => setFormData({ ...formData, host: e.target.value })}
                                    className="flex-1 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
                                />
                                <input
                                    type="number"
                                    placeholder={t('connection.port')}
                                    value={formData.port || 21}
                                    onChange={e => setFormData({ ...formData, port: parseInt(e.target.value) || 21 })}
                                    className="w-20 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
                                />
                            </div>
                            <input
                                type="text"
                                placeholder={t('connection.username') + ' *'}
                                value={formData.username || ''}
                                onChange={e => setFormData({ ...formData, username: e.target.value })}
                                className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
                            />
                            <input
                                type="password"
                                placeholder={t('connection.password')}
                                value={formData.password || ''}
                                onChange={e => setFormData({ ...formData, password: e.target.value })}
                                className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
                            />
                            <input
                                type="text"
                                placeholder={t('browser.remote') + ' ' + t('browser.path')}
                                value={formData.initialPath || ''}
                                onChange={e => setFormData({ ...formData, initialPath: e.target.value })}
                                className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
                            />
                        </>
                    )}
                    
                    {/* OAuth hint */}
                    {isOAuthProvider(formData.protocol || 'ftp') && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            OAuth credentials will be requested when you connect
                        </p>
                    )}
                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            placeholder={t('browser.local') + ' ' + t('browser.path')}
                            value={formData.localInitialPath || ''}
                            onChange={e => setFormData({ ...formData, localInitialPath: e.target.value })}
                            className="flex-1 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
                        />
                        <button
                            type="button"
                            onClick={async () => {
                                try {
                                    const selected = await open({
                                        directory: true,
                                        multiple: false,
                                        title: t('browser.local')
                                    });
                                    if (selected && typeof selected === 'string') {
                                        setFormData({ ...formData, localInitialPath: selected });
                                    }
                                } catch (e) {
                                    console.error('Failed to open folder picker:', e);
                                }
                            }}
                            className="px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                            title={t('common.browse')}
                        >
                            <FolderOpen size={16} />
                        </button>
                    </div>
                    <button
                        onClick={handleSave}
                        disabled={isOAuthProvider(formData.protocol || 'ftp') 
                            ? !formData.name 
                            : (!formData.host || !formData.username)}
                        className="w-full py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white rounded-lg flex items-center justify-center gap-2 transition-colors"
                    >
                        <Check size={16} />
                        {t('common.save')}
                    </button>
                </div>
            )}
        </div>
    );
};

export default SavedServers;
