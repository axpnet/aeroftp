import React, { useState, useEffect } from 'react';

interface LogoProps {
    className?: string;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    showText?: boolean;  // For compatibility, but now using horizontal logos with text
}

// Logo sizes mapping to actual logo files with text
const logoSizes = {
    sm: { width: 100, height: 32, file: '150x48' },   // Small header
    md: { width: 150, height: 48, file: '150x48' },   // Default header
    lg: { width: 225, height: 72, file: '300x96' },   // About dialog
    xl: { width: 300, height: 96, file: '300x96' },   // Splash/Large
};

// Icon-only sizes for places where we need just the symbol
const iconSizes = {
    sm: 24,
    md: 32,
    lg: 48,
    xl: 64,
};

export const Logo: React.FC<LogoProps> = ({
    className = '',
    size = 'md',
    showText = true
}) => {
    const [isDark, setIsDark] = useState(false);

    // Detect theme changes
    useEffect(() => {
        const checkDarkMode = () => {
            setIsDark(document.documentElement.classList.contains('dark'));
        };

        checkDarkMode();

        // Watch for theme changes
        const observer = new MutationObserver(checkDarkMode);
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['class']
        });

        return () => observer.disconnect();
    }, []);

    // If showText is true, use horizontal logo with text
    if (showText) {
        const { width, height, file } = logoSizes[size];
        // Use white logo for dark theme, color for light theme
        const logoSrc = isDark
            ? '/icons/AeroFTP_logo_white_150x48.png'
            : `/icons/AeroFTP_logo_color_${file}.png`;

        return (
            <div className={`flex items-center ${className}`}>
                <img
                    src={logoSrc}
                    alt="AeroFTP"
                    width={width}
                    height={height}
                    className="shrink-0 object-contain"
                    onError={(e) => {
                        // Fallback to color version
                        (e.target as HTMLImageElement).src = `/icons/AeroFTP_logo_color_${file}.png`;
                    }}
                />
            </div>
        );
    }

    // Icon-only mode (for favicon, taskbar, etc.)
    const iconSize = iconSizes[size];
    return (
        <div className={`flex items-center ${className}`}>
            <img
                src="/icons/AeroFTP_simbol_color_512x512.png"
                alt="AeroFTP"
                width={iconSize}
                height={iconSize}
                className="shrink-0 object-contain"
            />
        </div>
    );
};

export default Logo;
