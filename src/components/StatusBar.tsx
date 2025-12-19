import * as React from 'react';
import { Globe, HardDrive, Wifi, WifiOff, FolderOpen, FileText } from 'lucide-react';

interface StatusBarProps {
    isConnected: boolean;
    serverInfo?: string; // e.g. "user@ftp.example.com:21"
    remotePath?: string;
    localPath?: string;
    remoteFileCount?: number;
    localFileCount?: number;
    activePanel: 'remote' | 'local';
}

export const StatusBar: React.FC<StatusBarProps> = ({
    isConnected,
    serverInfo,
    remotePath,
    localPath,
    remoteFileCount = 0,
    localFileCount = 0,
    activePanel
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
                                {serverInfo || 'Connesso'}
                            </span>
                        </>
                    ) : (
                        <>
                            <div className="w-2 h-2 rounded-full bg-gray-400" />
                            <WifiOff size={12} className="text-gray-400" />
                            <span className="text-gray-500">Non connesso</span>
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

            {/* Right: File Count */}
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
            </div>
        </div>
    );
};

export default StatusBar;
