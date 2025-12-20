import * as React from 'react';
import { useState, useEffect, useRef } from 'react';

export interface ContextMenuItem {
    label: string;
    icon: React.ReactNode;  // Changed from string to ReactNode for Lucide icons
    action: () => void;
    disabled?: boolean;
    danger?: boolean;
    divider?: boolean;
}

export interface ContextMenuProps {
    x: number;
    y: number;
    items: ContextMenuItem[];
    onClose: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, items, onClose }) => {
    const menuRef = useRef<HTMLDivElement>(null);
    const [isVisible, setIsVisible] = useState(false);

    // Smooth entrance animation
    useEffect(() => {
        requestAnimationFrame(() => setIsVisible(true));
    }, []);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onClose();
            }
        };

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEscape);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [onClose]);

    // Adjust position to not overflow viewport
    const adjustedPosition = () => {
        const menuWidth = 200;
        const menuHeight = items.length * 38;
        const padding = 10;

        let adjustedX = x;
        let adjustedY = y;

        if (x + menuWidth > window.innerWidth - padding) {
            adjustedX = window.innerWidth - menuWidth - padding;
        }

        if (y + menuHeight > window.innerHeight - padding) {
            adjustedY = window.innerHeight - menuHeight - padding;
        }

        return { left: adjustedX, top: adjustedY };
    };

    const pos = adjustedPosition();

    return (
        <div
            ref={menuRef}
            className={`
                fixed z-50 bg-white/95 dark:bg-gray-800/95 backdrop-blur-lg 
                rounded-xl shadow-2xl border border-gray-200/50 dark:border-gray-700/50 
                py-1 min-w-[180px] overflow-hidden
                transition-all duration-150 ease-out
                ${isVisible
                    ? 'opacity-100 scale-100 translate-y-0'
                    : 'opacity-0 scale-95 -translate-y-1'}
            `}
            style={{ left: pos.left, top: pos.top }}
        >
            {items.map((item, index) => (
                <React.Fragment key={index}>
                    {item.divider && index > 0 && (
                        <div className="h-px bg-gray-200/80 dark:bg-gray-700/80 my-1 mx-2" />
                    )}
                    <button
                        onClick={() => {
                            if (!item.disabled) {
                                item.action();
                                onClose();
                            }
                        }}
                        disabled={item.disabled}
                        className={`
                            w-full px-3 py-1.5 text-left text-[13px] flex items-center gap-2.5 
                            transition-all duration-100
                            ${item.disabled
                                ? 'text-gray-400 cursor-not-allowed'
                                : item.danger
                                    ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/40'
                                    : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100/80 dark:hover:bg-gray-700/80'
                            }
                        `}
                    >
                        <span className="w-4 h-4 flex items-center justify-center opacity-70">
                            {item.icon}
                        </span>
                        <span className="font-medium">{item.label}</span>
                    </button>
                </React.Fragment>
            ))}
        </div>
    );
};

// Hook for managing context menu
export interface ContextMenuState {
    visible: boolean;
    x: number;
    y: number;
    items: ContextMenuItem[];
}

export const useContextMenu = () => {
    const [state, setState] = useState<ContextMenuState>({
        visible: false,
        x: 0,
        y: 0,
        items: [],
    });

    const show = (e: React.MouseEvent, items: ContextMenuItem[]) => {
        e.preventDefault();
        e.stopPropagation();
        setState({
            visible: true,
            x: e.clientX,
            y: e.clientY,
            items,
        });
    };

    const hide = () => {
        setState(prev => ({ ...prev, visible: false }));
    };

    return { state, show, hide };
};

export default ContextMenu;

