import * as React from 'react';
import { X, Github, Heart, Cpu, Globe, Mail, Bitcoin } from 'lucide-react';

interface AboutDialogProps {
    isOpen: boolean;
    onClose: () => void;
}

// Get version from package.json (injected at build time)
const APP_VERSION = '0.3.1';

export const AboutDialog: React.FC<AboutDialogProps> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    const copyBtcAddress = () => {
        navigator.clipboard.writeText('YOUR_BTC_ADDRESS_HERE');
        // Could add a toast notification here
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Dialog */}
            <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in">
                {/* Header with gradient */}
                <div className="bg-gradient-to-br from-blue-500 via-cyan-500 to-teal-400 p-8 text-white text-center relative">
                    {/* Close button */}
                    <button
                        onClick={onClose}
                        className="absolute top-3 right-3 p-1.5 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                    >
                        <X size={16} />
                    </button>

                    {/* Logo - using real AeroFTP logo */}
                    <div className="w-20 h-20 mx-auto mb-4 bg-white rounded-2xl shadow-lg flex items-center justify-center p-2">
                        <img
                            src="/icons/AeroFTP_simbol_color_512x512.png"
                            alt="AeroFTP"
                            className="w-full h-full object-contain"
                        />
                    </div>

                    <h1 className="text-2xl font-bold">AeroFTP</h1>
                    <p className="text-white/80 text-sm mt-1">Version {APP_VERSION}</p>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4">
                    <p className="text-center text-gray-600 dark:text-gray-300">
                        A fast, beautiful, and reliable FTP client built with modern technologies.
                    </p>

                    {/* Tech stack */}
                    <div className="flex justify-center gap-4 py-3">
                        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                            <Cpu size={16} />
                            <span>Rust + Tauri</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                            <Globe size={16} />
                            <span>React + TypeScript</span>
                        </div>
                    </div>

                    {/* Links */}
                    <div className="flex flex-wrap justify-center gap-3 pt-2">
                        <a
                            href="https://github.com/axpnet/aeroftp"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors text-sm"
                        >
                            <Github size={16} />
                            GitHub
                        </a>
                        <a
                            href="mailto:aeroftp@axpdev.it"
                            className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors text-sm"
                        >
                            <Mail size={16} />
                            Contact
                        </a>
                    </div>

                    {/* Donations */}
                    <div className="mt-4 p-3 bg-gradient-to-r from-orange-50 to-yellow-50 dark:from-orange-900/20 dark:to-yellow-900/20 rounded-xl">
                        <p className="text-center text-sm text-gray-600 dark:text-gray-300 mb-2">
                            ☕ Support the project
                        </p>
                        <div className="flex justify-center gap-2">
                            <button
                                onClick={copyBtcAddress}
                                className="flex items-center gap-2 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors text-xs"
                                title="Copy BTC address"
                            >
                                <Bitcoin size={14} />
                                Donate BTC
                            </button>
                        </div>
                    </div>

                    {/* Credits */}
                    <div className="text-center pt-4 border-t border-gray-200 dark:border-gray-700">
                        <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center justify-center gap-1">
                            Made with <Heart size={12} className="text-red-500" /> by AxpDev
                        </p>
                        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                            AI-Assisted: Claude Opus 4 (Antigravity) • Gemini Pro
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                            © 2025 All rights reserved
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AboutDialog;
