/**
 * Dialog components - Modal dialogs for confirmation, input, etc.
 * i18n integrated
 */

import React, { useState } from 'react';
import { useTranslation } from '../../i18n';

// ============ Confirm Dialog ============
interface ConfirmDialogProps {
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
    confirmLabel?: string;
    confirmColor?: 'red' | 'blue' | 'green';
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
    message,
    onConfirm,
    onCancel,
    confirmLabel,
    confirmColor = 'red'
}) => {
    const t = useTranslation();
    const colorMap = {
        red: 'bg-red-500 hover:bg-red-600',
        blue: 'bg-blue-500 hover:bg-blue-600',
        green: 'bg-green-500 hover:bg-green-600',
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-2xl max-w-sm">
                <p className="text-gray-900 dark:text-gray-100 mb-4">{message}</p>
                <div className="flex justify-end gap-2">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                    >
                        {t('common.cancel')}
                    </button>
                    <button
                        onClick={onConfirm}
                        className={`px-4 py-2 text-white rounded-lg ${colorMap[confirmColor]}`}
                    >
                        {confirmLabel || t('common.delete')}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ============ Input Dialog ============
interface InputDialogProps {
    title: string;
    defaultValue: string;
    onConfirm: (value: string) => void;
    onCancel: () => void;
    placeholder?: string;
}

export const InputDialog: React.FC<InputDialogProps> = ({
    title,
    defaultValue,
    onConfirm,
    onCancel,
    placeholder
}) => {
    const t = useTranslation();
    const [value, setValue] = useState(defaultValue);

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-2xl w-96">
                <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">{title}</h3>
                <input
                    type="text"
                    value={value}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setValue(e.target.value)}
                    placeholder={placeholder}
                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 mb-4 text-gray-900 dark:text-gray-100"
                    autoFocus
                    onKeyDown={(e: React.KeyboardEvent) => e.key === 'Enter' && onConfirm(value)}
                />
                <div className="flex justify-end gap-2">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                    >
                        {t('common.cancel')}
                    </button>
                    <button
                        onClick={() => onConfirm(value)}
                        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                    >
                        {t('common.ok')}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ============ Sync Navigation Choice Dialog ============
interface SyncNavDialogProps {
    missingPath: string;
    isRemote: boolean;
    onCreateFolder: () => void;
    onDisableSync: () => void;
    onCancel: () => void;
}

export const SyncNavDialog: React.FC<SyncNavDialogProps> = ({
    missingPath,
    isRemote,
    onCreateFolder,
    onDisableSync,
    onCancel
}) => {
    const t = useTranslation();

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-2xl max-w-md">
                <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">
                    📁 {t('browser.newFolder')}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-2 text-sm">
                    {isRemote ? t('browser.remote') : t('browser.local')} {t('browser.path')}:
                </p>
                <p className="text-blue-500 font-mono text-sm bg-gray-100 dark:bg-gray-700 p-2 rounded mb-4 break-all">
                    {missingPath}
                </p>
                <div className="flex flex-col gap-2">
                    <button
                        onClick={onCreateFolder}
                        className="w-full px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-left flex items-center gap-2"
                    >
                        <span>📂</span> {t('common.create')} {t('browser.newFolder')}
                    </button>
                    <button
                        onClick={onDisableSync}
                        className="w-full px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 text-left flex items-center gap-2"
                    >
                        <span>🔗</span> {t('cloud.disable')}
                    </button>
                    <button
                        onClick={onCancel}
                        className="w-full px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-left"
                    >
                        {t('common.cancel')}
                    </button>
                </div>
            </div>
        </div>
    );
};
