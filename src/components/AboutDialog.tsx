import * as React from 'react';
import { X, Github, Heart, Cpu, Globe } from 'lucide-react';

interface AboutDialogProps {
    isOpen: boolean;
    onClose: () => void;
}

export const AboutDialog: React.FC<AboutDialogProps> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

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

                    {/* Logo */}
                    <div className="w-20 h-20 mx-auto mb-4 bg-white rounded-2xl shadow-lg flex items-center justify-center">
                        <svg viewBox="0 0 100 100" className="w-14 h-14">
                            <defs>
                                <linearGradient id="aboutLogoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" stopColor="#0ea5e9" />
                                    <stop offset="50%" stopColor="#06b6d4" />
                                    <stop offset="100%" stopColor="#14b8a6" />
                                </linearGradient>
                            </defs>
                            <path
                                d="M50 15 L75 35 L75 65 L50 85 L25 65 L25 35 Z"
                                fill="url(#aboutLogoGradient)"
                                stroke="none"
                            />
                            <path
                                d="M40 45 L50 35 L60 45 M50 35 L50 65"
                                stroke="white"
                                strokeWidth="4"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                fill="none"
                            />
                        </svg>
                    </div>

                    <h1 className="text-2xl font-bold">AeroFTP</h1>
                    <p className="text-white/80 text-sm mt-1">Version 1.0.0</p>
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
                    <div className="flex justify-center gap-4 pt-2">
                        <a
                            href="https://github.com/axpdev/aeroftp"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors text-sm"
                        >
                            <Github size={16} />
                            GitHub
                        </a>
                    </div>

                    {/* Credits */}
                    <div className="text-center pt-4 border-t border-gray-200 dark:border-gray-700">
                        <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center justify-center gap-1">
                            Made with <Heart size={12} className="text-red-500" /> by AxpDev
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
