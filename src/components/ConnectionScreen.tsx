/**
 * ConnectionScreen Component
 * Initial connection form with Quick Connect and Saved Servers
 */

import React from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { FolderOpen, HardDrive, ChevronRight } from 'lucide-react';
import { ConnectionParams } from '../types';
import { SavedServers } from './SavedServers';
import { useTranslation } from '../i18n';

interface QuickConnectDirs {
    remoteDir: string;
    localDir: string;
}

interface ConnectionScreenProps {
    connectionParams: ConnectionParams;
    quickConnectDirs: QuickConnectDirs;
    loading: boolean;
    onConnectionParamsChange: (params: ConnectionParams) => void;
    onQuickConnectDirsChange: (dirs: QuickConnectDirs) => void;
    onConnect: () => void;
    onSavedServerConnect: (params: ConnectionParams, initialPath?: string, localInitialPath?: string) => Promise<void>;
    onSkipToFileManager: () => void;
}

export const ConnectionScreen: React.FC<ConnectionScreenProps> = ({
    connectionParams,
    quickConnectDirs,
    loading,
    onConnectionParamsChange,
    onQuickConnectDirsChange,
    onConnect,
    onSavedServerConnect,
    onSkipToFileManager,
}) => {
    const t = useTranslation();

    const handleBrowseLocalDir = async () => {
        try {
            const selected = await open({ directory: true, multiple: false, title: t('browser.local') });
            if (selected && typeof selected === 'string') {
                onQuickConnectDirsChange({ ...quickConnectDirs, localDir: selected });
            }
        } catch (e) {
            console.error('Folder picker error:', e);
        }
    };

    return (
        <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-6">
            {/* Quick Connect */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6">
                <h2 className="text-xl font-semibold mb-4">{t('connection.quickConnect')}</h2>
                <div className="space-y-3">
                    <div>
                        <label className="block text-sm font-medium mb-1.5">{t('connection.server')}</label>
                        <input
                            type="text"
                            value={connectionParams.server}
                            onChange={(e) => onConnectionParamsChange({ ...connectionParams, server: e.target.value })}
                            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl"
                            placeholder={t('connection.serverPlaceholder')}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1.5">{t('connection.username')}</label>
                        <input
                            type="text"
                            value={connectionParams.username}
                            onChange={(e) => onConnectionParamsChange({ ...connectionParams, username: e.target.value })}
                            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl"
                            placeholder={t('connection.usernamePlaceholder')}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1.5">{t('connection.password')}</label>
                        <input
                            type="password"
                            value={connectionParams.password}
                            onChange={(e) => onConnectionParamsChange({ ...connectionParams, password: e.target.value })}
                            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl"
                            placeholder={t('connection.passwordPlaceholder')}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1.5">{t('browser.remote')} {t('browser.path')}</label>
                        <input
                            type="text"
                            value={quickConnectDirs.remoteDir}
                            onChange={(e) => onQuickConnectDirsChange({ ...quickConnectDirs, remoteDir: e.target.value })}
                            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl"
                            placeholder="/www"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1.5">{t('browser.local')} {t('browser.path')}</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={quickConnectDirs.localDir}
                                onChange={(e) => onQuickConnectDirsChange({ ...quickConnectDirs, localDir: e.target.value })}
                                className="flex-1 px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl"
                                placeholder="/home/user/projects"
                            />
                            <button
                                type="button"
                                onClick={handleBrowseLocalDir}
                                className="px-4 py-3 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-xl transition-colors"
                                title={t('common.browse')}
                            >
                                <FolderOpen size={18} />
                            </button>
                        </div>
                    </div>
                    <button
                        onClick={onConnect}
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-medium py-3 rounded-xl disabled:opacity-50"
                    >
                        {loading ? t('connection.connecting') : t('common.connect')}
                    </button>
                </div>
            </div>

            {/* Saved Servers */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6">
                <SavedServers onConnect={onSavedServerConnect} />
            </div>

            {/* Skip to File Manager Button */}
            <div className="md:col-span-2 text-center mt-4">
                <button
                    onClick={onSkipToFileManager}
                    className="group px-6 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl text-gray-600 dark:text-gray-300 transition-all hover:scale-105 flex items-center gap-2 mx-auto"
                >
                    <HardDrive size={18} className="group-hover:text-blue-500 transition-colors" />
                    <span>{t('browser.local')} {t('browser.files')}</span>
                    <ChevronRight size={16} className="opacity-50 group-hover:translate-x-1 transition-transform" />
                </button>
                <p className="text-xs text-gray-500 mt-2">{t('statusBar.notConnected')}</p>
            </div>
        </div>
    );
};

export default ConnectionScreen;
