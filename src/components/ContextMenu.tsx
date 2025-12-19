import * as React from 'react';
import { useState, useEffect, useRef } from 'react';

export interface ContextMenuItem {
    label: string;
    icon: string;
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
        const menuHeight = items.length * 40;
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
            className="fixed z-50 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 py-1.5 min-w-48 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            style={{ left: pos.left, top: pos.top }}
        >
            {items.map((item, index) => (
                <React.Fragment key={index}>
                    {item.divider && index > 0 && (
                        <div className="h-px bg-gray-200 dark:bg-gray-700 my-1" />
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
              w-full px-4 py-2 text-left text-sm flex items-center gap-3 transition-colors
              ${item.disabled
                                ? 'text-gray-400 cursor-not-allowed'
                                : item.danger
                                    ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30'
                                    : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                            }
            `}
                    >
                        <span className="text-base w-5 text-center">{item.icon}</span>
                        <span>{item.label}</span>
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
