import React from 'react';

interface LogoProps {
    className?: string;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    showText?: boolean;
}

const sizes = {
    sm: { icon: 24, text: 'text-lg' },
    md: { icon: 32, text: 'text-xl' },
    lg: { icon: 48, text: 'text-2xl' },
    xl: { icon: 64, text: 'text-3xl' },
};

export const Logo: React.FC<LogoProps> = ({
    className = '',
    size = 'md',
    showText = true
}) => {
    const { icon, text } = sizes[size];

    return (
        <div className={`flex items-center gap-2.5 ${className}`}>
            {/* SVG Logo - Placeholder */}
            <svg
                width={icon}
                height={icon}
                viewBox="0 0 48 48"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="shrink-0"
            >
                {/* Background gradient */}
                <defs>
                    <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#0ea5e9" />
                        <stop offset="50%" stopColor="#06b6d4" />
                        <stop offset="100%" stopColor="#22d3ee" />
                    </linearGradient>
                    <linearGradient id="arrowGradient" x1="0%" y1="100%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
                        <stop offset="100%" stopColor="#ffffff" />
                    </linearGradient>
                    <filter id="glow">
                        <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                        <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>

                {/* Main shape - rounded square */}
                <rect
                    x="2"
                    y="2"
                    width="44"
                    height="44"
                    rx="12"
                    fill="url(#logoGradient)"
                    filter="url(#glow)"
                />

                {/* Arrow icon representing upload/transfer */}
                <g transform="translate(12, 12)">
                    {/* Arrow body */}
                    <path
                        d="M4 20L4 8C4 6.89543 4.89543 6 6 6L18 6"
                        stroke="url(#arrowGradient)"
                        strokeWidth="3"
                        strokeLinecap="round"
                        fill="none"
                    />
                    {/* Arrow head */}
                    <path
                        d="M14 10L18 6L14 2"
                        stroke="url(#arrowGradient)"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                    />
                    {/* Second arrow for depth */}
                    <path
                        d="M8 20L20 8"
                        stroke="rgba(255,255,255,0.3)"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeDasharray="2 4"
                    />
                </g>

                {/* Shine effect */}
                <ellipse
                    cx="16"
                    cy="14"
                    rx="10"
                    ry="6"
                    fill="url(#arrowGradient)"
                    opacity="0.15"
                />
            </svg>

            {/* Text */}
            {showText && (
                <span className={`font-semibold ${text} bg-gradient-to-r from-sky-500 via-cyan-500 to-teal-400 bg-clip-text text-transparent`}>
                    AeroFTP
                </span>
            )}
        </div>
    );
};

export default Logo;
