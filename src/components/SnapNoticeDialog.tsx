/**
 * SnapNoticeDialog
 * Shows a one-time informational dialog when running as a Snap package
 * Explains the limitations of strict confinement
 */

import React, { useEffect, useState } from 'react';
import { AlertTriangle, X, ExternalLink, FolderOpen } from 'lucide-react';
import { useI18n } from '../i18n';

const SNAP_NOTICE_KEY = 'aeroftp-snap-notice-shown';

interface SnapNoticeDialogProps {
    onClose: () => void;
}

const SnapNoticeDialog: React.FC<SnapNoticeDialogProps> = ({ onClose }) => {
    const { t } = useI18n();

    const handleDismiss = () => {
        localStorage.setItem(SNAP_NOTICE_KEY, 'true');
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden">
                {/* Header */}
                <div className="bg-amber-500 px-6 py-4 flex items-center gap-3">
                    <AlertTriangle className="text-white" size={24} />
                    <h2 className="text-lg font-semibold text-white">
                        Snap Package Notice
                    </h2>
                    <button
                        onClick={handleDismiss}
                        className="ml-auto text-white/80 hover:text-white transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="px-6 py-5 space-y-4">
                    <p className="text-gray-700 dark:text-gray-300">
                        You're running AeroFTP as a <strong>Snap package</strong> with strict confinement.
                        This provides enhanced security but limits file access.
                    </p>

                    <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 space-y-2">
                        <div className="flex items-start gap-2">
                            <FolderOpen size={18} className="text-green-500 mt-0.5 flex-shrink-0" />
                            <div>
                                <p className="font-medium text-gray-800 dark:text-gray-200">Accessible locations:</p>
                                <ul className="text-sm text-gray-600 dark:text-gray-400 mt-1 space-y-1">
                                    <li>• Your home folder (~)</li>
                                    <li>• Removable media (/media, /run/media)</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                        <p className="text-sm text-amber-800 dark:text-amber-200">
                            <strong>Tip:</strong> Use the system file picker when prompted - it grants temporary access
                            to files outside the sandbox.
                        </p>
                    </div>

                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        For unrestricted file access, consider using the <strong>.deb</strong> or <strong>Flatpak</strong> version.
                    </p>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700/50 flex items-center justify-between">
                    <a
                        href="https://github.com/axpnet/aeroftp/releases"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-500 hover:text-blue-600 flex items-center gap-1"
                    >
                        <ExternalLink size={14} />
                        Download other formats
                    </a>
                    <button
                        onClick={handleDismiss}
                        className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                    >
                        Got it
                    </button>
                </div>
            </div>
        </div>
    );
};

/**
 * Hook to check if running as Snap and if notice should be shown
 */
export function useSnapNotice() {
    const [showNotice, setShowNotice] = useState(false);

    useEffect(() => {
        const checkSnapEnvironment = async () => {
            try {
                // Use Rust backend to check SNAP environment variable
                const { invoke } = await import('@tauri-apps/api/core');
                const isSnap = await invoke<boolean>('is_running_as_snap');

                // For development/testing, also check for a manual flag
                const forceSnapNotice = localStorage.getItem('aeroftp-force-snap-notice') === 'true';

                const alreadyShown = localStorage.getItem(SNAP_NOTICE_KEY) === 'true';

                if ((isSnap || forceSnapNotice) && !alreadyShown) {
                    // Small delay to let the app render first
                    setTimeout(() => setShowNotice(true), 500);
                }
            } catch (error) {
                console.error('Failed to check Snap environment:', error);
            }
        };

        checkSnapEnvironment();
    }, []);

    const closeNotice = () => setShowNotice(false);

    return { showNotice, closeNotice };
}

export default SnapNoticeDialog;
