# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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