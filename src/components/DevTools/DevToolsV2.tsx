import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Code, Terminal, MessageSquare, X, Maximize2, Minimize2, Columns2, Columns3, LayoutList } from 'lucide-react';
import { PreviewFile } from './types';
import { CodeEditor } from './CodeEditor';
import { SSHTerminal } from './SSHTerminal';
import { AIChat } from './AIChat';

interface DevToolsV2Props {
    isOpen: boolean;
    previewFile: PreviewFile | null;
    localPath?: string;
    remotePath?: string;
    onClose: () => void;
    onSaveFile?: (content: string, file: PreviewFile) => Promise<void>;
}

type PanelVisibility = {
    editor: boolean;
    terminal: boolean;
    chat: boolean;
};

// Breakpoints for responsive layout (based on DevTools panel width)
const BREAKPOINTS = {
    THREE_COLS: 900,   // Show 3 columns above 900px
    TWO_COLS: 600,     // Show 2 columns above 600px
};

export const DevToolsV2: React.FC<DevToolsV2Props> = ({
    isOpen,
    previewFile,
    localPath,
    remotePath,
    onClose,
    onSaveFile,
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerWidth, setContainerWidth] = useState(window.innerWidth);
    const [isMaximized, setIsMaximized] = useState(false);
    const [height, setHeight] = useState(350);
    const isDragging = useRef(false);

    // Panel visibility state
    const [panels, setPanels] = useState<PanelVisibility>({
        editor: true,
        terminal: true,
        chat: true,
    });

    // Track container width for responsive layout
    useEffect(() => {
        const updateWidth = () => {
            if (containerRef.current) {
                setContainerWidth(containerRef.current.offsetWidth);
            } else {
                setContainerWidth(window.innerWidth);
            }
        };

        // Initial update
        updateWidth();

        // Listen to window resize
        window.addEventListener('resize', updateWidth);

        // Also use ResizeObserver for container-specific changes
        let observer: ResizeObserver | null = null;
        if (containerRef.current) {
            observer = new ResizeObserver(() => updateWidth());
            observer.observe(containerRef.current);
        }

        return () => {
            window.removeEventListener('resize', updateWidth);
            observer?.disconnect();
        };
    }, [isOpen]);

    // Calculate visible columns based on width and panel state
    const getVisiblePanels = useCallback((): (keyof PanelVisibility)[] => {
        const activePanels: (keyof PanelVisibility)[] = [];

        // Priority order: editor > terminal > chat
        if (panels.editor) activePanels.push('editor');
        if (panels.terminal) activePanels.push('terminal');
        if (panels.chat) activePanels.push('chat');

        // Use actual width (fallback to window width if 0)
        const width = containerWidth || window.innerWidth;

        // Limit based on responsive breakpoints
        let maxPanels = 3;
        if (width < BREAKPOINTS.TWO_COLS) {
            maxPanels = 1;
        } else if (width < BREAKPOINTS.THREE_COLS) {
            maxPanels = 2;
        }

        // Return priority-based visible panels
        return activePanels.slice(0, maxPanels);
    }, [panels, containerWidth]);

    const visiblePanels = getVisiblePanels();

    // Resize handling
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        isDragging.current = true;
        const startY = e.clientY;
        const startHeight = height;

        const handleMouseMove = (moveEvent: MouseEvent) => {
            if (!isDragging.current) return;
            const delta = startY - moveEvent.clientY;
            const newHeight = Math.min(800, Math.max(200, startHeight + delta));
            setHeight(newHeight);
        };

        const handleMouseUp = () => {
            isDragging.current = false;
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }, [height]);

    const togglePanel = (panel: keyof PanelVisibility) => {
        setPanels(prev => ({ ...prev, [panel]: !prev[panel] }));
    };

    if (!isOpen) return null;

    const panelWidth = visiblePanels.length > 0 ? `${100 / visiblePanels.length}%` : '100%';

    return (
        <div
            ref={containerRef}
            className="bg-gray-900 text-gray-100 border-t border-gray-700 flex flex-col"
            style={{ height: isMaximized ? '80vh' : height }}
        >
            {/* Resize handle */}
            <div
                onMouseDown={handleMouseDown}
                className="h-1.5 bg-gray-700 hover:bg-blue-500 cursor-ns-resize transition-colors flex-shrink-0"
            />

            {/* Toolbar */}
            <div className="flex items-center justify-between px-3 py-1.5 bg-gray-800 border-b border-gray-700 flex-shrink-0">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-400">DevTools</span>
                    <div className="w-px h-4 bg-gray-600" />

                    {/* Panel toggles */}
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => togglePanel('editor')}
                            className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors ${panels.editor
                                ? 'bg-blue-600 text-white'
                                : 'text-gray-400 hover:text-white hover:bg-gray-700'
                                }`}
                            title="Toggle Editor"
                        >
                            <Code size={12} />
                            Editor
                        </button>
                        <button
                            onClick={() => togglePanel('terminal')}
                            className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors ${panels.terminal
                                ? 'bg-green-600 text-white'
                                : 'text-gray-400 hover:text-white hover:bg-gray-700'
                                }`}
                            title="Toggle Terminal"
                        >
                            <Terminal size={12} />
                            Terminal
                        </button>
                        <button
                            onClick={() => togglePanel('chat')}
                            className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors ${panels.chat
                                ? 'bg-purple-600 text-white'
                                : 'text-gray-400 hover:text-white hover:bg-gray-700'
                                }`}
                            title="Toggle AI Chat"
                        >
                            <MessageSquare size={12} />
                            AI
                        </button>
                    </div>

                    {/* Responsive indicator */}
                    <div className="ml-2 text-gray-500" title={`${visiblePanels.length} column${visiblePanels.length !== 1 ? 's' : ''} visible`}>
                        {containerWidth < BREAKPOINTS.TWO_COLS && <LayoutList size={14} />}
                        {containerWidth >= BREAKPOINTS.TWO_COLS && containerWidth < BREAKPOINTS.THREE_COLS && <Columns2 size={14} />}
                        {containerWidth >= BREAKPOINTS.THREE_COLS && <Columns3 size={14} />}
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setIsMaximized(!isMaximized)}
                        className="p-1 hover:bg-gray-700 rounded transition-colors"
                        title={isMaximized ? 'Restore' : 'Maximize'}
                    >
                        {isMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                    </button>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-gray-700 rounded transition-colors"
                        title="Close DevTools"
                    >
                        <X size={14} />
                    </button>
                </div>
            </div>

            {/* 3-Column Content Area */}
            <div className="flex-1 flex overflow-hidden">
                {visiblePanels.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
                        <Columns3 size={24} className="mr-2 opacity-50" />
                        No panels active. Click the buttons above to show Editor, Terminal, or AI Chat.
                    </div>
                ) : (
                    <>
                        {visiblePanels.includes('editor') && (
                            <div
                                className="border-r border-gray-700 flex flex-col overflow-hidden"
                                style={{ width: panelWidth }}
                            >
                                <div className="px-2 py-1 bg-gray-800/50 border-b border-gray-700 flex items-center gap-2">
                                    <Code size={12} className="text-blue-400" />
                                    <span className="text-xs text-gray-400">
                                        {previewFile?.name || 'No file open'}
                                    </span>
                                </div>
                                <div className="flex-1 overflow-hidden">
                                    <CodeEditor
                                        file={previewFile}
                                        onSave={async (content) => {
                                            if (onSaveFile && previewFile) {
                                                await onSaveFile(content, previewFile);
                                            }
                                        }}
                                        onClose={() => { }}
                                        className="h-full"
                                    />
                                </div>
                            </div>
                        )}

                        {visiblePanels.includes('terminal') && (
                            <div
                                className="border-r border-gray-700 flex flex-col overflow-hidden"
                                style={{ width: panelWidth }}
                            >
                                <div className="px-2 py-1 bg-gray-800/50 border-b border-gray-700 flex items-center gap-2">
                                    <Terminal size={12} className="text-green-400" />
                                    <span className="text-xs text-gray-400">Terminal</span>
                                </div>
                                <div className="flex-1 overflow-hidden">
                                    <SSHTerminal className="h-full" localPath={localPath} />
                                </div>
                            </div>
                        )}

                        {visiblePanels.includes('chat') && (
                            <div
                                className="flex flex-col overflow-hidden"
                                style={{ width: panelWidth }}
                            >
                                <div className="px-2 py-1 bg-gray-800/50 border-b border-gray-700 flex items-center gap-2">
                                    <MessageSquare size={12} className="text-purple-400" />
                                    <span className="text-xs text-gray-400">AI Assistant</span>
                                </div>
                                <div className="flex-1 overflow-hidden">
                                    <AIChat className="h-full" remotePath={remotePath} localPath={localPath} />
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default DevToolsV2;
