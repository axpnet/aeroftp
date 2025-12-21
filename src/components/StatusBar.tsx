import * as React from 'react';
import { Globe, HardDrive, Wifi, WifiOff, Code, FolderSync } from 'lucide-react';

interface StatusBarProps {
    isConnected: boolean;
    serverInfo?: string;
    remotePath?: string;
    localPath?: string;
    remoteFileCount?: number;
    localFileCount?: number;
    activePanel: 'remote' | 'local';
    devToolsOpen?: boolean;
    onToggleDevTools?: () => void;
    onToggleSync?: () => void;
}

export const StatusBar: React.FC<StatusBarProps> = ({
    isConnected,
    serverInfo,
    remotePath,
    localPath,
    remoteFileCount = 0,
    localFileCount = 0,
    activePanel,
    devToolsOpen = false,
    onToggleDevTools,
    onToggleSync,
}) => {
    return (
        <div className="h-7 bg-gray-100 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-4 flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 select-none shrink-0">
            {/* Left: Connection Status */}
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                    {isConnected ? (
                        <>
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                            <Wifi size={12} className="text-green-500" />
                            <span className="font-medium text-green-600 dark:text-green-400">
                                {serverInfo || 'Connected'}
                            </span>
                        </>
                    ) : (
                        <>
                            <div className="w-2 h-2 rounded-full bg-gray-400" />
                            <WifiOff size={12} className="text-gray-400" />
                            <span className="text-gray-500">Not connected</span>
                        </>
                    )}
                </div>

                {/* Separator */}
                <div className="w-px h-4 bg-gray-300 dark:bg-gray-600" />

                {/* Current Path */}
                <div className="flex items-center gap-1.5 max-w-md truncate">
                    {activePanel === 'remote' ? (
                        <>
                            <Globe size={12} className="text-blue-500 shrink-0" />
                            <span className="truncate" title={remotePath}>
                                {isConnected ? (remotePath || '/') : '—'}
                            </span>
                        </>
                    ) : (
                        <>
                            <HardDrive size={12} className="text-amber-500 shrink-0" />
                            <span className="truncate" title={localPath}>
                                {localPath || '~'}
                            </span>
                        </>
                    )}
                </div>
            </div>

            {/* Right: File Count + Sync + DevTools */}
            <div className="flex items-center gap-4">
                {isConnected && (
                    <div className="flex items-center gap-1.5">
                        <Globe size={12} className="text-blue-500" />
                        <span>{remoteFileCount} files</span>
                    </div>
                )}
                <div className="flex items-center gap-1.5">
                    <HardDrive size={12} className="text-amber-500" />
                    <span>{localFileCount} files</span>
                </div>

                {/* Separator */}
                <div className="w-px h-4 bg-gray-300 dark:bg-gray-600" />

                {/* Sync Button */}
                {onToggleSync && isConnected && (
                    <button
                        onClick={onToggleSync}
                        className="flex items-center gap-1.5 px-2 py-0.5 rounded transition-colors hover:bg-gray-200 dark:hover:bg-gray-700"
                        title="Compare & Synchronize Files"
                    >
                        <FolderSync size={12} />
                        <span>Sync Files</span>
                    </button>
                )}

                {/* DevTools Toggle */}
                {onToggleDevTools && (
                    <button
                        onClick={onToggleDevTools}
                        className={`flex items-center gap-1.5 px-2 py-0.5 rounded transition-colors ${devToolsOpen
                            ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400'
                            : 'hover:bg-gray-200 dark:hover:bg-gray-700'
                            }`}
                        title="Toggle DevTools (Preview/Editor)"
                    >
                        <Code size={12} />
                        <span>DevTools</span>
                    </button>
                )}
            </div>
        </div>
    );
};

export default StatusBar;
