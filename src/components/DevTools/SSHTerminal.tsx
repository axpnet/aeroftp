import React, { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Terminal as TerminalIcon, Settings } from 'lucide-react';
import 'xterm/css/xterm.css';

interface SSHTerminalProps {
    className?: string;
    localPath?: string;
}

export const SSHTerminal: React.FC<SSHTerminalProps> = ({
    className = '',
    localPath = '~',
}) => {
    const terminalRef = useRef<HTMLDivElement>(null);
    const xtermRef = useRef<XTerm | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const [isTerminalReady, setIsTerminalReady] = useState(false);

    useEffect(() => {
        if (!terminalRef.current) return;

        const xterm = new XTerm({
            theme: {
                background: '#1a1b26',
                foreground: '#c0caf5',
                cursor: '#c0caf5',
                cursorAccent: '#1a1b26',
                selectionBackground: '#33467c',
                black: '#15161e',
                red: '#f7768e',
                green: '#9ece6a',
                yellow: '#e0af68',
                blue: '#7aa2f7',
                magenta: '#bb9af7',
                cyan: '#7dcfff',
                white: '#a9b1d6',
                brightBlack: '#414868',
                brightRed: '#f7768e',
                brightGreen: '#9ece6a',
                brightYellow: '#e0af68',
                brightBlue: '#7aa2f7',
                brightMagenta: '#bb9af7',
                brightCyan: '#7dcfff',
                brightWhite: '#c0caf5',
            },
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
            fontSize: 13,
            cursorBlink: true,
            cursorStyle: 'block',
            allowProposedApi: true,
        });

        const fitAddon = new FitAddon();
        const webLinksAddon = new WebLinksAddon();

        xterm.loadAddon(fitAddon);
        xterm.loadAddon(webLinksAddon);
        xterm.open(terminalRef.current);
        fitAddon.fit();

        xtermRef.current = xterm;
        fitAddonRef.current = fitAddon;

        // Welcome message - Local Terminal
        xterm.writeln('\x1b[1;35m╔════════════════════════════════════════╗\x1b[0m');
        xterm.writeln('\x1b[1;35m║\x1b[0m   \x1b[1;36mAeroFTP Terminal\x1b[0m                     \x1b[1;35m║\x1b[0m');
        xterm.writeln('\x1b[1;35m╚════════════════════════════════════════╝\x1b[0m');
        xterm.writeln('');
        xterm.writeln('\x1b[32m✓\x1b[0m Terminal UI ready (xterm.js)');
        xterm.writeln('\x1b[33m⏳\x1b[0m Shell integration coming soon');
        xterm.writeln('');
        xterm.writeln('\x1b[90mPlanned features:\x1b[0m');
        xterm.writeln('  \x1b[36m•\x1b[0m Local shell (bash/zsh/powershell)');
        xterm.writeln('  \x1b[36m•\x1b[0m SSH to remote servers (configurable)');
        xterm.writeln('  \x1b[36m•\x1b[0m Quick commands for file operations');
        xterm.writeln('');
        xterm.writeln(`\x1b[90mCurrent directory:\x1b[0m \x1b[36m${localPath}\x1b[0m`);
        xterm.writeln('');
        xterm.write('\x1b[1;32maero@ftp\x1b[0m:\x1b[1;34m~\x1b[0m$ ');

        setIsTerminalReady(true);

        const handleResize = () => fitAddonRef.current?.fit();
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            xterm.dispose();
        };
    }, [localPath]);

    useEffect(() => {
        if (isTerminalReady && fitAddonRef.current) {
            setTimeout(() => fitAddonRef.current?.fit(), 50);
        }
    }, [isTerminalReady]);

    return (
        <div className={`flex flex-col h-full bg-[#1a1b26] ${className}`}>
            <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
                <div className="flex items-center gap-2 text-sm text-gray-300">
                    <TerminalIcon size={14} className="text-green-400" />
                    <span className="font-medium">Terminal</span>
                    <span className="text-gray-500 text-xs">• Local Shell</span>
                </div>
                <button
                    disabled
                    className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-700/50 text-gray-500 cursor-not-allowed rounded"
                    title="Configure SSH (Future feature)"
                >
                    <Settings size={12} />
                    SSH Config
                </button>
            </div>
            <div ref={terminalRef} className="flex-1 p-2 overflow-hidden" />
        </div>
    );
};

export default SSHTerminal;
