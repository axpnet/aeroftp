import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { FileComparison, CompareOptions, SyncStatus, SyncDirection } from '../types';
import { Loader2, Search, RefreshCw, Zap } from 'lucide-react';
import './SyncPanel.css';

interface SyncPanelProps {
    isOpen: boolean;
    onClose: () => void;
    localPath: string;
    remotePath: string;
    isConnected: boolean;
    onSyncComplete?: () => void;
}

// Status display configuration
const STATUS_CONFIG: Record<SyncStatus, { icon: string; label: string; color: string }> = {
    identical: { icon: '✓', label: 'Identical', color: '#10b981' },
    local_newer: { icon: '↑', label: 'Upload', color: '#3b82f6' },
    remote_newer: { icon: '↓', label: 'Download', color: '#f59e0b' },
    local_only: { icon: '+', label: 'New Local', color: '#10b981' },
    remote_only: { icon: '−', label: 'New Remote', color: '#f59e0b' },
    conflict: { icon: '⚠', label: 'Conflict', color: '#ef4444' },
    size_mismatch: { icon: '≠', label: 'Size Differs', color: '#ef4444' },
};

// Get action description based on direction
const getActionDescription = (direction: SyncDirection): string => {
    switch (direction) {
        case 'remote_to_local':
            return '📥 Verifica quali file sul server remoto sono più recenti e li scaricherà nella cartella locale.';
        case 'local_to_remote':
            return '📤 Verifica quali file locali sono più recenti e li caricherà sul server remoto.';
        case 'bidirectional':
            return '🔄 Verifica le differenze in entrambe le direzioni: scarica i file più recenti dal server e carica quelli locali più aggiornati.';
    }
};

export const SyncPanel: React.FC<SyncPanelProps> = ({
    isOpen,
    onClose,
    localPath,
    remotePath,
    isConnected,
    onSyncComplete,
}) => {
    const [comparisons, setComparisons] = useState<FileComparison[]>([]);
    const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
    const [isComparing, setIsComparing] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncProgress, setSyncProgress] = useState<{ current: number; total: number } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [options, setOptions] = useState<CompareOptions>({
        compare_timestamp: true,
        compare_size: true,
        compare_checksum: false,
        exclude_patterns: ['node_modules', '.git', '.DS_Store', 'Thumbs.db', '__pycache__', 'target'],
        direction: 'bidirectional',
    });

    // Load default options on mount
    useEffect(() => {
        const loadDefaults = async () => {
            try {
                const defaults = await invoke<CompareOptions>('get_compare_options_default');
                setOptions(defaults);
            } catch (e) {
                console.error('Failed to load default options:', e);
            }
        };
        loadDefaults();
    }, []);

    const handleCompare = async () => {
        if (!isConnected) {
            setError('Not connected to FTP server');
            return;
        }

        setIsComparing(true);
        setError(null);
        setComparisons([]);
        setSelectedPaths(new Set());

        try {
            const results = await invoke<FileComparison[]>('compare_directories', {
                localPath,
                remotePath,
                options,
            });

            // Filter to only show differences (not identical)
            let differences = results.filter(r => r.status !== 'identical');

            // Apply direction filter
            if (options.direction === 'remote_to_local') {
                // Only show files to download (remote newer or remote only)
                differences = differences.filter(r =>
                    r.status === 'remote_newer' || r.status === 'remote_only'
                );
            } else if (options.direction === 'local_to_remote') {
                // Only show files to upload (local newer or local only)
                differences = differences.filter(r =>
                    r.status === 'local_newer' || r.status === 'local_only'
                );
            }
            // 'bidirectional' shows all differences

            setComparisons(differences);

            // Auto-select all non-conflict items
            const autoSelect = new Set<string>();
            differences.forEach(c => {
                if (c.status !== 'conflict' && c.status !== 'size_mismatch') {
                    autoSelect.add(c.relative_path);
                }
            });
            setSelectedPaths(autoSelect);

        } catch (e: any) {
            setError(e.toString());
        } finally {
            setIsComparing(false);
        }
    };

    const handleSelectAll = () => {
        const all = new Set<string>();
        comparisons.forEach(c => all.add(c.relative_path));
        setSelectedPaths(all);
    };

    const handleDeselectAll = () => {
        setSelectedPaths(new Set());
    };

    const toggleSelection = (path: string) => {
        const newSelection = new Set(selectedPaths);
        if (newSelection.has(path)) {
            newSelection.delete(path);
        } else {
            newSelection.add(path);
        }
        setSelectedPaths(newSelection);
    };

    const formatSize = (bytes: number): string => {
        if (bytes === 0) return '—';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const handleDirectionChange = (direction: SyncDirection) => {
        setOptions(prev => ({ ...prev, direction }));
    };

    // Reset results
    const handleReset = () => {
        setComparisons([]);
        setSelectedPaths(new Set());
        setError(null);
        setSyncProgress(null);
    };

    // Close with auto-reset
    const handleClose = () => {
        handleReset();
        onClose();
    };

    // Execute sync
    const handleSync = async () => {
        if (selectedPaths.size === 0 || !isConnected) return;

        setIsSyncing(true);
        setError(null);
        setSyncProgress({ current: 0, total: selectedPaths.size });

        const selectedComparisons = comparisons.filter(c => selectedPaths.has(c.relative_path));
        let completed = 0;
        let errors: string[] = [];

        for (const item of selectedComparisons) {
            try {
                const localFilePath = `${localPath}/${item.relative_path}`;
                const remoteFilePath = `${remotePath}/${item.relative_path}`;

                const shouldUpload = (item.status === 'local_newer' || item.status === 'local_only') &&
                    (options.direction === 'local_to_remote' || options.direction === 'bidirectional');

                const shouldDownload = (item.status === 'remote_newer' || item.status === 'remote_only') &&
                    (options.direction === 'remote_to_local' || options.direction === 'bidirectional');

                if (shouldUpload) {
                    // Upload: local -> remote
                    await invoke('upload_file', {
                        params: {
                            local_path: localFilePath,
                            remote_path: remoteFilePath,
                        }
                    });
                } else if (shouldDownload) {
                    // Download: remote -> local
                    await invoke('download_file', {
                        params: {
                            remote_path: remoteFilePath,
                            local_path: localFilePath,
                        }
                    });
                }
                // Skip conflicts, identical, and items not matching direction
            } catch (e: any) {
                errors.push(`${item.relative_path}: ${e.toString()}`);
            }

            completed++;
            setSyncProgress({ current: completed, total: selectedPaths.size });
        }

        setIsSyncing(false);
        setSyncProgress(null);

        if (errors.length > 0) {
            setError(`Completed with ${errors.length} error(s): ${errors.slice(0, 3).join(', ')}${errors.length > 3 ? '...' : ''}`);
        } else {
            // Success - refresh and close
            if (onSyncComplete) {
                await onSyncComplete();
            }
            handleReset();
        }
    };

    if (!isOpen) return null;

    // Truncate path for display
    const truncatePath = (path: string, maxLen: number = 50): string => {
        if (path.length <= maxLen) return path;
        return '...' + path.slice(-maxLen + 3);
    };

    return (
        <div className="sync-panel-overlay">
            <div className="sync-panel">
                <div className="sync-panel-header">
                    <h2>🔄 Synchronize Files</h2>
                    <button className="sync-close-btn" onClick={handleClose}>×</button>
                </div>

                {/* Path Display */}
                <div className="sync-paths-display">
                    <div className="sync-path-row">
                        <span className="sync-path-label">📁 Local:</span>
                        <span className="sync-path-value" title={localPath}>{truncatePath(localPath)}</span>
                    </div>
                    <div className="sync-path-row">
                        <span className="sync-path-label">🌐 Remote:</span>
                        <span className="sync-path-value" title={remotePath}>{truncatePath(remotePath)}</span>
                    </div>
                </div>

                <div className="sync-panel-options">
                    <div className="sync-direction-selector">
                        <label>Direction:</label>
                        <div className="direction-buttons">
                            <button
                                className={options.direction === 'remote_to_local' ? 'active' : ''}
                                onClick={() => handleDirectionChange('remote_to_local')}
                            >
                                ↓ Remote → Local
                            </button>
                            <button
                                className={options.direction === 'local_to_remote' ? 'active' : ''}
                                onClick={() => handleDirectionChange('local_to_remote')}
                            >
                                ↑ Local → Remote
                            </button>
                            <button
                                className={options.direction === 'bidirectional' ? 'active' : ''}
                                onClick={() => handleDirectionChange('bidirectional')}
                            >
                                ↔ Both
                            </button>
                        </div>
                    </div>

                    {/* Action Description */}
                    <div className="sync-action-description">
                        {getActionDescription(options.direction)}
                    </div>

                    <div className="sync-compare-options">
                        <label>
                            <input
                                type="checkbox"
                                checked={options.compare_timestamp}
                                onChange={e => setOptions(prev => ({ ...prev, compare_timestamp: e.target.checked }))}
                            />
                            Timestamp
                        </label>
                        <label>
                            <input
                                type="checkbox"
                                checked={options.compare_size}
                                onChange={e => setOptions(prev => ({ ...prev, compare_size: e.target.checked }))}
                            />
                            Size
                        </label>
                        <label>
                            <input
                                type="checkbox"
                                checked={options.compare_checksum}
                                onChange={e => setOptions(prev => ({ ...prev, compare_checksum: e.target.checked }))}
                            />
                            Checksum (slow)
                        </label>
                    </div>

                    <button
                        className="sync-compare-btn"
                        onClick={handleCompare}
                        disabled={isComparing || !isConnected}
                    >
                        {isComparing ? (
                            <><Loader2 size={16} className="animate-spin" /> Comparing...</>
                        ) : (
                            <><Search size={16} /> Compare Now</>
                        )}
                    </button>
                </div>

                {error && (
                    <div className="sync-error">
                        ⚠️ {error}
                    </div>
                )}

                <div className="sync-results">
                    {isComparing && (
                        <div className="sync-loading">
                            <Loader2 size={32} className="animate-spin" />
                            <span>Scanning directories...</span>
                        </div>
                    )}

                    {comparisons.length === 0 && !isComparing && (
                        <div className="sync-empty">
                            {isConnected
                                ? 'Click "Compare Now" to scan for differences'
                                : 'Connect to FTP server first'}
                        </div>
                    )}

                    {comparisons.length > 0 && (
                        <>
                            <div className="sync-table-header">
                                <div className="sync-col-check">
                                    <input
                                        type="checkbox"
                                        checked={selectedPaths.size === comparisons.length}
                                        onChange={() =>
                                            selectedPaths.size === comparisons.length
                                                ? handleDeselectAll()
                                                : handleSelectAll()
                                        }
                                    />
                                </div>
                                <div className="sync-col-status">Status</div>
                                <div className="sync-col-file">File</div>
                                <div className="sync-col-local">Local</div>
                                <div className="sync-col-remote">Remote</div>
                            </div>

                            <div className="sync-table-body">
                                {comparisons.map((comparison) => {
                                    const config = STATUS_CONFIG[comparison.status];
                                    return (
                                        <div
                                            key={comparison.relative_path}
                                            className={`sync-row ${selectedPaths.has(comparison.relative_path) ? 'selected' : ''}`}
                                            onClick={() => toggleSelection(comparison.relative_path)}
                                        >
                                            <div className="sync-col-check">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedPaths.has(comparison.relative_path)}
                                                    onChange={() => toggleSelection(comparison.relative_path)}
                                                    onClick={e => e.stopPropagation()}
                                                />
                                            </div>
                                            <div className="sync-col-status" style={{ color: config.color }}>
                                                <span className="status-icon">{config.icon}</span>
                                                <span className="status-label">{config.label}</span>
                                            </div>
                                            <div className="sync-col-file">
                                                {comparison.is_dir ? '📁' : '📄'} {comparison.relative_path}
                                            </div>
                                            <div className="sync-col-local">
                                                {comparison.local_info
                                                    ? formatSize(comparison.local_info.size)
                                                    : '—'}
                                            </div>
                                            <div className="sync-col-remote">
                                                {comparison.remote_info
                                                    ? formatSize(comparison.remote_info.size)
                                                    : '—'}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>

                <div className="sync-panel-footer">
                    <div className="sync-summary">
                        {syncProgress ? (
                            <span className="sync-progress-indicator">
                                <Loader2 size={14} className="animate-spin" />
                                Syncing {syncProgress.current}/{syncProgress.total}...
                            </span>
                        ) : comparisons.length > 0 ? (
                            <span>{selectedPaths.size} of {comparisons.length} files selected</span>
                        ) : null}
                    </div>
                    <div className="sync-actions">
                        <button onClick={handleReset} disabled={comparisons.length === 0 || isSyncing}>
                            <RefreshCw size={14} /> Reset
                        </button>
                        <button onClick={handleDeselectAll} disabled={selectedPaths.size === 0 || isSyncing}>
                            Deselect
                        </button>
                        <button onClick={handleSelectAll} disabled={comparisons.length === 0 || isSyncing}>
                            Select All
                        </button>
                        <button
                            className="sync-execute-btn"
                            onClick={handleSync}
                            disabled={selectedPaths.size === 0 || isSyncing}
                        >
                            {isSyncing ? (
                                <><Loader2 size={16} className="animate-spin" /> Syncing ({syncProgress?.current || 0}/{syncProgress?.total || 0})...</>
                            ) : (
                                <><Zap size={16} /> Synchronize ({selectedPaths.size})</>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SyncPanel;
