import * as React from 'react';
import { X, Plus, Loader2, Wifi, WifiOff, Database, Cloud, CloudOff } from 'lucide-react';
import { FtpSession, SessionStatus } from '../types';

interface CloudTabState {
    enabled: boolean;
    syncing: boolean;
    active: boolean;  // background sync running
    serverName?: string;
}

interface SessionTabsProps {
    sessions: FtpSession[];
    activeSessionId: string | null;
    onTabClick: (sessionId: string) => void;
    onTabClose: (sessionId: string) => void;
    onNewTab: () => void;
    // Cloud tab props
    cloudTab?: CloudTabState;
    onCloudTabClick?: () => void;
}

const statusConfig: Record<SessionStatus, { icon: React.ReactNode; color: string; title: string }> = {
    connected: { icon: <Wifi size={12} />, color: 'text-green-500', title: 'Connected' },
    connecting: { icon: <Loader2 size={12} className="animate-spin" />, color: 'text-yellow-500', title: 'Connecting...' },
    cached: { icon: <Database size={12} />, color: 'text-blue-500', title: 'Cached (reconnecting...)' },
    disconnected: { icon: <WifiOff size={12} />, color: 'text-gray-400', title: 'Disconnected' },
};

export const SessionTabs: React.FC<SessionTabsProps> = ({
    sessions,
    activeSessionId,
    onTabClick,
    onTabClose,
    onNewTab,
    cloudTab,
    onCloudTabClick,
}) => {
    const showTabs = sessions.length > 0 || (cloudTab?.enabled);

    if (!showTabs) return null;

    return (
        <div className="flex items-center gap-1 px-3 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
            {/* Cloud Tab - Special tab for AeroCloud */}
            {cloudTab?.enabled && (
                <div
                    className={`group flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer transition-all min-w-0 max-w-[200px] ${cloudTab.active || cloudTab.syncing
                            ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 dark:from-cyan-900/40 dark:to-blue-900/40 border border-cyan-400/30'
                            : 'hover:bg-gray-200 dark:hover:bg-gray-700/50'
                        }`}
                    onClick={onCloudTabClick}
                    title={cloudTab.syncing ? 'Syncing...' : cloudTab.active ? 'Background sync active' : 'AeroCloud (click to open)'}
                >
                    {/* Cloud status indicator */}
                    <span className={`shrink-0 ${cloudTab.syncing
                            ? 'text-cyan-500 animate-pulse'
                            : cloudTab.active
                                ? 'text-cyan-500'
                                : 'text-gray-400'
                        }`}>
                        {cloudTab.active || cloudTab.syncing ? (
                            <Cloud size={14} className={cloudTab.syncing ? 'animate-bounce' : ''} />
                        ) : (
                            <CloudOff size={14} />
                        )}
                    </span>

                    {/* Cloud name */}
                    <span className={`truncate text-sm ${cloudTab.active || cloudTab.syncing
                            ? 'font-medium text-cyan-700 dark:text-cyan-300'
                            : 'text-gray-500 dark:text-gray-400'
                        }`}>
                        {cloudTab.serverName || 'AeroCloud'}
                    </span>

                    {/* Syncing indicator */}
                    {cloudTab.syncing && (
                        <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-cyan-500 animate-ping" />
                    )}
                </div>
            )}

            {/* Separator between Cloud and FTP sessions */}
            {cloudTab?.enabled && sessions.length > 0 && (
                <div className="w-px h-5 bg-gray-300 dark:bg-gray-600 mx-1" />
            )}

            {/* FTP Session Tabs */}
            {sessions.map((session) => {
                const isActive = session.id === activeSessionId;
                const status = statusConfig[session.status];

                return (
                    <div
                        key={session.id}
                        className={`group flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer transition-all min-w-0 max-w-[200px] ${isActive
                            ? 'bg-white dark:bg-gray-700 shadow-sm'
                            : 'hover:bg-gray-200 dark:hover:bg-gray-700/50'
                            }`}
                        onClick={() => onTabClick(session.id)}
                    >
                        {/* Status indicator */}
                        <span className={`shrink-0 ${status.color}`} title={status.title}>
                            {status.icon}
                        </span>

                        {/* Server name */}
                        <span className={`truncate text-sm ${isActive ? 'font-medium' : 'text-gray-600 dark:text-gray-400'}`}>
                            {session.serverName}
                        </span>

                        {/* Close button */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onTabClose(session.id);
                            }}
                            className="shrink-0 p-0.5 rounded hover:bg-gray-300 dark:hover:bg-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Close tab"
                        >
                            <X size={12} />
                        </button>
                    </div>
                );
            })}

            {/* New tab button */}
            <button
                onClick={onNewTab}
                className="shrink-0 p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                title="New connection"
            >
                <Plus size={16} />
            </button>
        </div>
    );
};

export default SessionTabs;

