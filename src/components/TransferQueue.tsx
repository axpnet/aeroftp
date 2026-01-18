import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { Upload, Download, Check, X, Clock, Loader2, Folder } from 'lucide-react';

export type TransferStatus = 'pending' | 'transferring' | 'completed' | 'error';
export type TransferType = 'upload' | 'download';

export interface TransferItem {
    id: string;
    filename: string;
    path: string;
    size: number;
    status: TransferStatus;
    type: TransferType;
    progress?: number;
    error?: string;
    startTime?: number;
    endTime?: number;
    // For folder transfers
    isFolder?: boolean;
    totalFiles?: number;
    completedFiles?: number;
}

interface TransferQueueProps {
    items: TransferItem[];
    onClear?: () => void;
    isVisible: boolean;
    onToggle: () => void;
}

const StatusIcon: React.FC<{ status: TransferStatus; type: TransferType }> = ({ status, type }) => {
    switch (status) {
        case 'pending':
            return <Clock size={12} className="text-gray-400" />;
        case 'transferring':
            return <Loader2 size={12} className="text-cyan-400 animate-spin" />;
        case 'completed':
            return <Check size={12} className="text-green-400" />;
        case 'error':
            return <X size={12} className="text-red-400" />;
    }
};

const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const formatTime = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
};

export const TransferQueue: React.FC<TransferQueueProps> = ({
    items,
    onClear,
    isVisible,
    onToggle
}) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [autoScroll, setAutoScroll] = useState(true);

    // Auto-scroll to bottom when new items added
    useEffect(() => {
        if (autoScroll && scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [items, autoScroll]);

    const handleScroll = () => {
        if (scrollRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
            setAutoScroll(scrollTop + clientHeight >= scrollHeight - 20);
        }
    };

    const completedCount = items.filter(i => i.status === 'completed').length;
    const errorCount = items.filter(i => i.status === 'error').length;
    const transferringCount = items.filter(i => i.status === 'transferring').length;
    const pendingCount = items.filter(i => i.status === 'pending').length;

    // Determine icon based on majority transfer type
    const uploadCount = items.filter(i => i.type === 'upload').length;
    const downloadCount = items.filter(i => i.type === 'download').length;
    const primaryType: TransferType = uploadCount >= downloadCount ? 'upload' : 'download';

    // Only render if visible AND has items
    if (!isVisible || items.length === 0) return null;

    return (
        <div className="fixed bottom-12 right-4 z-40 w-96 max-h-80 flex flex-col bg-gray-900 border border-gray-700 rounded-lg shadow-2xl overflow-hidden font-mono text-xs">
            {/* Header - Terminal Style */}
            <div
                className="flex items-center justify-between px-3 py-2 bg-gray-800 border-b border-gray-700 cursor-pointer select-none"
                onClick={onToggle}
            >
                <div className="flex items-center gap-2">
                    {primaryType === 'upload'
                        ? <Upload size={14} className="text-cyan-400" />
                        : <Download size={14} className="text-orange-400" />
                    }
                    <span className="text-gray-300 font-medium">Transfer Queue</span>
                    <span className="text-gray-500">
                        [{completedCount}/{items.length}]
                    </span>
                </div>
                <div className="flex items-center gap-3">
                    {transferringCount > 0 && (
                        <span className="text-cyan-400 flex items-center gap-1">
                            <Loader2 size={10} className="animate-spin" />
                            {transferringCount}
                        </span>
                    )}
                    {pendingCount > 0 && (
                        <span className="text-gray-400">{pendingCount} pending</span>
                    )}
                    {errorCount > 0 && (
                        <span className="text-red-400">{errorCount} failed</span>
                    )}
                    {onClear && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onClear(); }}
                            className="text-gray-500 hover:text-gray-300 transition-colors"
                        >
                            clear
                        </button>
                    )}
                </div>
            </div>

            {/* Queue List - Terminal Output */}
            <div
                ref={scrollRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto p-2 space-y-0.5 max-h-60 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent"
            >
                {items.map((item, index) => (
                    <div
                        key={item.id}
                        className={`flex items-center gap-2 px-2 py-1 rounded transition-all duration-300 ${item.status === 'transferring'
                            ? 'bg-cyan-900/20 border-l-2 border-cyan-400'
                            : item.status === 'error'
                                ? 'bg-red-900/20'
                                : item.status === 'completed'
                                    ? 'text-gray-500'
                                    : 'text-gray-400'
                            }`}
                        style={{
                            animation: item.status === 'transferring' ? 'pulse 2s infinite' : 'none'
                        }}
                    >
                        {/* Line Number */}
                        <span className="text-gray-600 w-6 text-right shrink-0">
                            {String(index + 1).padStart(3, '0')}
                        </span>

                        {/* Type Icon */}
                        {item.isFolder 
                            ? <Folder size={10} className={item.type === 'upload' ? 'text-cyan-500 shrink-0' : 'text-orange-500 shrink-0'} />
                            : item.type === 'upload'
                                ? <Upload size={10} className="text-cyan-500 shrink-0" />
                                : <Download size={10} className="text-orange-500 shrink-0" />
                        }

                        {/* Status Icon */}
                        <StatusIcon status={item.status} type={item.type} />

                        {/* Filename */}
                        <span className={`flex-1 truncate ${item.status === 'completed' ? 'text-gray-500' : 'text-gray-300'
                            }`}>
                            {item.filename}
                        </span>

                        {/* Folder file count badge */}
                        {item.isFolder && item.totalFiles !== undefined && item.totalFiles > 0 && (
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 ${
                                item.status === 'completed' 
                                    ? 'bg-green-900/50 text-green-400'
                                    : item.status === 'transferring'
                                        ? 'bg-cyan-900/50 text-cyan-400'
                                        : 'bg-gray-700 text-gray-400'
                            }`}>
                                {item.completedFiles || 0}/{item.totalFiles}
                            </span>
                        )}

                        {/* Size */}
                        <span className="text-gray-600 shrink-0">
                            {formatBytes(item.size)}
                        </span>

                        {/* Progress or Time */}
                        <span className="text-gray-500 w-14 text-right shrink-0">
                            {item.status === 'transferring' && item.progress !== undefined
                                ? `${item.progress}%`
                                : item.status === 'completed' && item.startTime && item.endTime
                                    ? formatTime(item.endTime - item.startTime)
                                    : item.status === 'error'
                                        ? 'FAIL'
                                        : '—'
                            }
                        </span>
                    </div>
                ))}
            </div>

            {/* Footer Progress Bar */}
            {transferringCount > 0 && (
                <div className="h-1 bg-gray-800">
                    <div
                        className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300"
                        style={{
                            width: `${(completedCount / items.length) * 100}%`
                        }}
                    />
                </div>
            )}
        </div>
    );
};

// Hook for managing transfer queue
let transferId = 0;

export const useTransferQueue = () => {
    const [items, setItems] = useState<TransferItem[]>([]);
    const [isVisible, setIsVisible] = useState(true);
    const autoHideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Auto-hide after all transfers complete (5 seconds)
    useEffect(() => {
        const allCompleted = items.length > 0 && items.every(i => i.status === 'completed' || i.status === 'error');
        const hasActive = items.some(i => i.status === 'transferring' || i.status === 'pending');

        // Clear any existing timeout
        if (autoHideTimeoutRef.current) {
            clearTimeout(autoHideTimeoutRef.current);
            autoHideTimeoutRef.current = null;
        }

        if (hasActive) {
            // Show queue when transfers are active
            setIsVisible(true);
        } else if (allCompleted) {
            // Auto-hide after 5 seconds when all done
            autoHideTimeoutRef.current = setTimeout(() => {
                setIsVisible(false);
            }, 5000);
        }

        return () => {
            if (autoHideTimeoutRef.current) {
                clearTimeout(autoHideTimeoutRef.current);
            }
        };
    }, [items]);

    const addItem = (filename: string, path: string, size: number, type: TransferType): string => {
        const id = `transfer-${++transferId}`;
        setItems(prev => [...prev, {
            id,
            filename,
            path,
            size,
            type,
            status: 'pending',
            startTime: Date.now()
        }]);
        // Show queue when adding items
        setIsVisible(true);
        return id;
    };

    const updateStatus = (id: string, status: TransferStatus, progress?: number, error?: string) => {
        setItems(prev => prev.map(item =>
            item.id === id
                ? {
                    ...item,
                    status,
                    progress,
                    error,
                    endTime: status === 'completed' || status === 'error' ? Date.now() : item.endTime
                }
                : item
        ));
    };

    const startTransfer = (id: string) => updateStatus(id, 'transferring', 0);
    const setProgress = (id: string, progress: number) => updateStatus(id, 'transferring', progress);
    const completeTransfer = (id: string) => updateStatus(id, 'completed', 100);
    const failTransfer = (id: string, error: string) => updateStatus(id, 'error', undefined, error);

    // Update folder transfer progress (total files and completed count)
    const updateFolderProgress = (id: string, totalFiles: number, completedFiles: number) => {
        setItems(prev => prev.map(item =>
            item.id === id
                ? {
                    ...item,
                    totalFiles,
                    completedFiles,
                    progress: totalFiles > 0 ? Math.round((completedFiles / totalFiles) * 100) : 0
                }
                : item
        ));
    };

    // Mark item as folder
    const markAsFolder = (id: string, totalFiles?: number) => {
        setItems(prev => prev.map(item =>
            item.id === id
                ? { ...item, isFolder: true, totalFiles: totalFiles || 0, completedFiles: 0 }
                : item
        ));
    };

    const clear = () => {
        setItems([]);
        setIsVisible(false);
    };

    // Simple toggle for manual control
    const toggle = () => {
        // Cancel any auto-hide when user manually toggles
        if (autoHideTimeoutRef.current) {
            clearTimeout(autoHideTimeoutRef.current);
            autoHideTimeoutRef.current = null;
        }
        setIsVisible(v => !v);
    };

    // Check if there's any active transfer
    const hasActiveTransfers = items.some(i => i.status === 'transferring' || i.status === 'pending');

    return {
        items,
        isVisible,
        hasActiveTransfers,
        addItem,
        startTransfer,
        setProgress,
        completeTransfer,
        failTransfer,
        updateFolderProgress,
        markAsFolder,
        clear,
        toggle
    };
};

export default TransferQueue;
