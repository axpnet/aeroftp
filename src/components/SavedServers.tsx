import * as React from 'react';
import { useState, useEffect } from 'react';
import { Server, Plus, Trash2, Star, Edit2, X, Check } from 'lucide-react';
import { ServerProfile, ConnectionParams } from '../types';

interface SavedServersProps {
    onConnect: (params: ConnectionParams, initialPath?: string) => void;
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
    const [servers, setServers] = useState<ServerProfile[]>([]);
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState<Partial<ServerProfile>>({
        name: '',
        host: '',
        port: 21,
        username: '',
        password: '',
        initialPath: '',
    });

    useEffect(() => {
        setServers(getSavedServers());
    }, []);

    const handleSave = () => {
        if (!formData.host || !formData.username) return;

        const newServer: ServerProfile = {
            id: editingId || generateId(),
            name: formData.name || formData.host || '',
            host: formData.host || '',
            port: formData.port || 21,
            username: formData.username || '',
            password: formData.password,
            initialPath: formData.initialPath,
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

    const handleConnect = (server: ServerProfile) => {
        // Update last connected
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
        }, server.initialPath);
    };

    const resetForm = () => {
        setFormData({ name: '', host: '', port: 21, username: '', password: '', initialPath: '' });
        setEditingId(null);
        setShowAddForm(false);
    };

    return (
        <div className={`${className}`}>
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Server size={20} />
                    Saved Servers
                </h3>
                <button
                    onClick={() => setShowAddForm(true)}
                    className="p-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition-colors"
                    title="Add server"
                >
                    <Plus size={16} />
                </button>
            </div>

            {/* Server list */}
            {servers.length === 0 && !showAddForm && (
                <p className="text-gray-500 dark:text-gray-400 text-sm text-center py-4">
                    No saved servers. Click + to add one.
                </p>
            )}

            <div className="space-y-2">
                {servers.map(server => (
                    <div
                        key={server.id}
                        className="flex items-center justify-between p-3 bg-gray-100 dark:bg-gray-700 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors group"
                    >
                        <button
                            onClick={() => handleConnect(server)}
                            className="flex-1 text-left flex items-center gap-3"
                        >
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-white font-bold">
                                {(server.name || server.host).charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <div className="font-medium">{server.name || server.host}</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                    {server.username}@{server.host}:{server.port}
                                </div>
                            </div>
                        </button>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                                onClick={() => handleEdit(server)}
                                className="p-2 text-gray-500 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                            >
                                <Edit2 size={14} />
                            </button>
                            <button
                                onClick={() => handleDelete(server.id)}
                                className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
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
                        <h4 className="font-medium">{editingId ? 'Edit Server' : 'Add Server'}</h4>
                        <button onClick={resetForm} className="p-1 text-gray-500 hover:text-gray-700">
                            <X size={16} />
                        </button>
                    </div>
                    <input
                        type="text"
                        placeholder="Name (optional)"
                        value={formData.name || ''}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
                    />
                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder="Host *"
                            value={formData.host || ''}
                            onChange={e => setFormData({ ...formData, host: e.target.value })}
                            className="flex-1 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
                        />
                        <input
                            type="number"
                            placeholder="Port"
                            value={formData.port || 21}
                            onChange={e => setFormData({ ...formData, port: parseInt(e.target.value) || 21 })}
                            className="w-20 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
                        />
                    </div>
                    <input
                        type="text"
                        placeholder="Username *"
                        value={formData.username || ''}
                        onChange={e => setFormData({ ...formData, username: e.target.value })}
                        className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
                    />
                    <input
                        type="password"
                        placeholder="Password"
                        value={formData.password || ''}
                        onChange={e => setFormData({ ...formData, password: e.target.value })}
                        className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
                    />
                    <input
                        type="text"
                        placeholder="Initial Path (e.g. /www.axpdev.it)"
                        value={formData.initialPath || ''}
                        onChange={e => setFormData({ ...formData, initialPath: e.target.value })}
                        className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
                    />
                    <button
                        onClick={handleSave}
                        disabled={!formData.host || !formData.username}
                        className="w-full py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white rounded-lg flex items-center justify-center gap-2 transition-colors"
                    >
                        <Check size={16} />
                        {editingId ? 'Update' : 'Save'}
                    </button>
                </div>
            )}
        </div>
    );
};

export default SavedServers;
