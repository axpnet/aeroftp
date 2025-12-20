import React, { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Terminal as TerminalIcon, Play, Square, RefreshCw } from 'lucide-react';
import 'xterm/css/xterm.css';

interface SSHTerminalProps {
    className?: string;
    serverHost?: string;
    isConnected?: boolean;
}

export const SSHTerminal: React.FC<SSHTerminalProps> = ({
    className = '',
    serverHost,
    isConnected = false,
}) => {
    const terminalRef = useRef<HTMLDivElement>(null);
    const xtermRef = useRef<XTerm | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const [isTerminalReady, setIsTerminalReady] = useState(false);

    useEffect(() => {
        if (!terminalRef.current) return;

        // Initialize xterm.js
        const xterm = new XTerm({
            theme: {
                background: '#1a1b26', // Tokyo Night background
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

        // Welcome message
        xterm.writeln('\x1b[1;35m╔═══════════════════════════════════════╗\x1b[0m');
        xterm.writeln('\x1b[1;35m║\x1b[0m   \x1b[1;36mAeroFTP SSH Terminal\x1b[0m               \x1b[1;35m║\x1b[0m');
        xterm.writeln('\x1b[1;35m║\x1b[0m   \x1b[33mPhase 3 - Coming Soon!\x1b[0m              \x1b[1;35m║\x1b[0m');
        xterm.writeln('\x1b[1;35m╚═══════════════════════════════════════╝\x1b[0m');
        xterm.writeln('');
        xterm.writeln('\x1b[90mSSH support will allow you to:\x1b[0m');
        xterm.writeln('  \x1b[32m•\x1b[0m Execute commands on remote servers');
        xterm.writeln('  \x1b[32m•\x1b[0m Manage files with full shell access');
        xterm.writeln('  \x1b[32m•\x1b[0m Run scripts and deploy directly');
        xterm.writeln('');

        if (serverHost) {
            xterm.writeln(`\x1b[90mTarget server:\x1b[0m \x1b[36m${serverHost}\x1b[0m`);
        } else {
            xterm.writeln('\x1b[33mConnect to a server to enable SSH\x1b[0m');
        }
        xterm.writeln('');

        setIsTerminalReady(true);

        // Handle resize
        const handleResize = () => {
            if (fitAddonRef.current) {
                fitAddonRef.current.fit();
            }
        };

        window.addEventListener('resize', handleResize);

        // Cleanup
        return () => {
            window.removeEventListener('resize', handleResize);
            xterm.dispose();
        };
    }, [serverHost]);

    // Re-fit on visibility change
    useEffect(() => {
        if (isTerminalReady && fitAddonRef.current) {
            setTimeout(() => fitAddonRef.current?.fit(), 50);
        }
    }, [isTerminalReady]);

    return (
        <div className={`flex flex-col h-full bg-[#1a1b26] ${className}`}>
            {/* Terminal Header */}
            <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
                <div className="flex items-center gap-2 text-sm text-gray-300">
                    <TerminalIcon size={14} className="text-green-400" />
                    <span className="font-medium">SSH Terminal</span>
                    {serverHost && (
                        <span className="text-gray-500">• {serverHost}</span>
                    )}
                    {!isConnected && (
                        <span className="text-yellow-400 text-xs ml-2">Coming in Phase 3</span>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <button
                        disabled
                        className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-700/50 text-gray-500 cursor-not-allowed rounded"
                        title="Connect SSH (Coming soon)"
                    >
                        <Play size={12} />
                        Connect
                    </button>
                </div>
            </div>

            {/* Terminal Container */}
            <div
                ref={terminalRef}
                className="flex-1 p-2 overflow-hidden"
            />
        </div>
    );
};

export default SSHTerminal;
