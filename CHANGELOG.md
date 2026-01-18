# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.9.9] - 2026-01-18

### Added
- **Per-Session Navigation Sync** 🔗: Each tab now maintains its own independent sync state
  - Sync settings saved/restored when switching between tabs
  - New connections start with sync disabled by default
  - Sync state persists per-session, not globally

- **Path Coherence Check** ⚠️: Visual warning when local path doesn't match remote server
  - Orange warning icon replaces disk icon when mismatch detected
  - Path text turns orange to highlight the issue
  - Tooltip explains the mismatch

- **AeroCloud Log Filter** ☁️: Toggle button to hide/show cloud sync messages
  - New cloud icon button in Activity Log header
  - Filter out "AeroCloud sync" messages when disabled
  - Reduces log noise during active sync operations

- **Tab Switch Logging** 📋: Reconnection status now logged in Activity Log
  - "🔄 Reconnecting to {server}..." during connection
  - "✅ Reconnected to {server}" on success
  - "❌ Failed to reconnect to {server}" on error

### Fixed
- **Local path not restoring on tab switch**: Fixed race condition with explicit state capture
- **Navigation sync staying active on new connections**: Now properly reset when connecting to new server
- **Folder progress badge showing bytes**: Fixed to show file count [X/Y] instead of bytes

### Changed
- Session switching now uses captured state values to prevent race conditions
- `handleNewTabFromSavedServer` also captures state before saving session

## [0.9.7] - 2026-01-17

### Added
- **Activity Log Panel** 📋: New FileZilla-style activity log with real-time operation tracking
  - Typewriter animation effect for new log entries
  - Live indicator with pulsing animation
  - Auto-scroll with user scroll detection
  - Clear all logs functionality
  - **Badge counter** in StatusBar showing log count (0 → 99+)

- **Dual Theme System** 🎨:
  - **Professional** (default): Tokio Night/Antigravity-inspired elegant dark theme
  - **Cyber** (optional): Neon glow effects with CRT scanlines overlay
  - Theme toggle button in Activity Log header
  - Glow effects on operation text only (CONNECT, UPLOAD, etc.) in cyber mode

- **Humanized Log Messages** 🌍: Friendly, conversational log messages in 5 languages
  - English, Italian, French, Spanish, Chinese
  - Contextual messages with emojis (🚀 connection, 📁 navigation, ⬆️ upload, etc.)
  - File size and transfer time displayed for uploads/downloads
  - Smart pluralization and formatting

- **Comprehensive Operation Logging**:
  - Connection/disconnection with server details
  - Upload/download with file size and duration
  - Navigation (remote and local directories)
  - File operations: delete, rename, mkdir
  - Bulk delete operations with file count
  - Tab close events
  - Sync navigation toggle state
  - AeroCloud sync status (syncing/completed/error) with SYNCED indicator
  - Keep-alive timeout and reconnection events
  - **Monaco Editor saves**: File edits now logged with size info

### Fixed
- **Multi-tab switching bug**: Switching between FTP sessions now correctly refreshes BOTH remote and local panels
- **Keep-alive logging**: Timeout and reconnection events now properly logged with humanized messages
- **TypeScript type safety**: All theme properties properly typed across professional and cyber themes
- **Cloud sync log deduplication**: Added debounce to prevent duplicate log entries from React StrictMode

### Changed
- Activity Log is now closed by default (toggle via StatusBar)
- DevTools panel moved below Activity Log in layout
- Connection welcome messages simplified to "Benvenuto! 🚀 Connesso a {server}"

---

## [0.9.5] - 2026-01-15

### Added
- **Unified Transfer Queue**: New `TransferQueue` component showing both uploads and downloads
  - Visual indicators for upload (↑ cyan) and download (↓ orange) operations
  - Real-time progress counter `[N/total]`
  - Auto-scroll to active transfer
  - "Queue" button in StatusBar with item count badge
  - Auto-hide after 5 seconds, reopens on click
- **Sync Badge visibility fix**: Sync badges now only appear in AeroCloud folder paths

### Fixed
- **Tab switching with Cloud**: Fixed session state persistence when switching between FTP servers and AeroCloud
- **Notification spam**: Removed per-file toast notifications during bulk transfers (queue shows progress instead)
- **Logo activity animation**: Now correctly pulses during all transfer operations

### Changed
- Transfer notifications consolidated: only error/warning toasts are shown

## [0.9.1] - 2026-01-06

### Fixed
- Fixed audio/video player playback issues for local files
- Optimized media streaming performance using Blob URLs
- Fixed memory leaks in media preview

## [0.9.0] - 2026-01-06

### Changed
- **Pre-release for v1.0.0**: Stabilization and final polish
- Restructured GitHub Actions workflow for direct release upload
- Eliminated artifact storage quota issues

### Added
- Full macOS support in CI/CD pipeline (.dmg builds)

---

## [0.8.3] - 2026-01-05

### Added
- **Internationalization (i18n) System**: Complete multi-language support infrastructure
  - Lightweight React Context-based system (zero external dependencies)
  - Full TypeScript support with autocompletion
  - English (base) and Italian translations included
  - Browser language auto-detection with localStorage persistence
  - Language selector in Settings → Appearance with flag icons
  - Fallback to English for missing translations
  - Parameter interpolation support (`{variable}` syntax)
  - Documentation: `docs/TRANSLATIONS.md`
  - Migrated components: StatusBar, ConnectionScreen, SavedServers, AboutDialog, Dialogs, SettingsPanel, CloudPanel, DevToolsPanel

### Fixed
- **AeroCloud Sync Interval Persistence Bug**: Added missing sync interval setting in CloudPanel Settings
  - Users can now modify the sync interval (1-60 minutes) after initial setup
  - Previously, the interval was only configurable during setup wizard


## [0.8.2] - 2025-12-25 🎄

### Fixed
- Text file preview (TXT, MD, LOG, etc.) not loading in Universal Preview modal
- Added proper content loading for text/markdown files in both local and remote modes

## [0.5.6] - 2025-12-22

### Fixed
- TypeScript build errors in ToolApproval component (replaced && operators with ternary for type safety)
- Cross-platform compatibility issues with PTY module on Windows
- Snap package configuration for Ubuntu Software distribution

### Added
- Snap package support for easy installation on Ubuntu and other Linux distributions
- Desktop entry file for better Linux desktop integration

### Changed
- Improved GitHub Actions workflow for more reliable builds
- Updated all version numbers across package.json, tauri.conf.json, and Cargo.toml

## [0.3.2] - 2025-12-21

### Fixed
- GitHub Actions workflow to create releases only on tags
- Updated Tauri action to latest version for better compatibility

## [0.3.1] - 2025-12-20

### Fixed
- Build synchronization issues
- Updated GitHub Actions workflow for automatic releases
- Corrected versioning across all configuration files

## [0.1.0] - 2025-12-19

### Added
- Initial release of AeroFTP
- Modern, cross-platform FTP client built with Rust and React
- Beautiful UI with glass morphism effects and dark mode support
- Dual panel interface for remote and local file browsing
- Support for FTPS (FTP over TLS)
- Async file transfers
- File search functionality
- Server connection profiles
- Linux releases: .deb, .rpm, and .AppImage packages

### Features
- 🚀 Lightning fast performance with Rust backend
- 🎨 Apple-inspired design
- 🌙 Full dark mode support
- 📁 Dual panel file browser
- 🔒 Secure FTPS connections
- ⚡ Non-blocking transfers
- 🔍 Quick file search
- 💾 Saved server profiles