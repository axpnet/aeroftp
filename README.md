# ✈️ AeroFTP

<p align="center">
  <img src="docs/logo.png" alt="AeroFTP Logo" width="128" height="128">
</p>

<p align="center">
  <strong>Fast. Beautiful. Reliable.</strong>
</p>

<p align="center">
  A modern, cross-platform FTP client built with Rust and React.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Platform-Linux%20%7C%20Windows%20%7C%20macOS-blue" alt="Platform">
  <img src="https://img.shields.io/badge/Built%20with-Tauri%20%2B%20React-purple" alt="Built with">
  <img src="https://img.shields.io/badge/License-MIT-green" alt="License">
</p>

---

## ✨ Features

### Core
- 🚀 **Lightning Fast** - Built with Rust for maximum performance
- 🎨 **Beautiful UI** - Apple-inspired design with glass morphism effects
- 🌙 **Dark Mode** - Full dark mode support with smooth transitions
- 📁 **Dual Panel** - Remote and local file browsing side by side
- 🔄 **File Sync** - Compare and synchronize local/remote directories
- 🔒 **Secure** - Supports FTPS (FTP over TLS)
- ⚡ **Async** - Non-blocking file transfers with progress tracking
- 💾 **Profiles** - Save your favorite server connections
- 🔗 **Sync Navigation** - Keep remote/local directories in sync

### DevTools Panel 🛠️
AeroFTP includes an integrated DevTools panel (like Chrome DevTools) for web developers:

| Tab          | Feature                                     | Status   |
| ------------ | ------------------------------------------- | -------- |
| **Preview**  | Syntax-highlighted file preview             | ✅ Active |
| **Editor**   | Monaco Editor (VS Code) with inline editing | ✅ Active |
| **Terminal** | Local PTY Terminal                          | ✅ Active |

#### Editor Features
- Full **Monaco Editor** (same as VS Code)
- **Syntax highlighting** for 20+ languages
- **Tokyo Night** 🌃 theme (in honor of Antigravity)
- **Save** directly to server (auto-upload on save)
- **Reset** to undo changes
- Minimap, line numbers, folding, bracket colorization

### Multi-Session Tabs
- Open multiple server connections as tabs
- Instant tab switching with cached file lists
- Background reconnection

### 🤖 AI Assistant (AeroAgent)
Integrated AI-powered assistant for intelligent FTP operations:

| Feature            | Description                                           |
| ------------------ | ----------------------------------------------------- |
| **Multi-Provider** | Google Gemini, OpenAI, Anthropic, Ollama (local)      |
| **Auto-Routing**   | Automatic model selection based on task type          |
| **FTP Tools**      | List, read, compare, sync files via natural language  |
| **Smart Context**  | Insert current paths with `@` mention or `+` menu     |
| **Markdown Chat**  | Code blocks, syntax highlighting, formatted responses |

#### Advanced Settings
- **Conversation Style**: Precise / Balanced / Creative
- **Temperature**: Control response randomness (0.0 - 2.0)
- **Max Tokens**: Limit response length (256 - 32768)

## 📸 Screenshots

<p align="center">
  <img src="docs/screenshot-light.png" alt="AeroFTP Light Mode" width="800">
</p>

<p align="center">
  <img src="docs/screenshot-dark.png" alt="AeroFTP Dark Mode" width="800">
</p>

## 🛠️ Installation

### Snap Store (Recommended for Linux)

```bash
sudo snap install aeroftp
```

[![Get it from the Snap Store](https://snapcraft.io/static/images/badges/en/snap-store-black.svg)](https://snapcraft.io/aeroftp)

### From Releases

Download the latest release for your platform:
- **Linux**: `.deb`, `.rpm`, `.AppImage`, or `.snap`
- **Windows**: `.msi` installer or `.exe`
- **macOS**: `.dmg` image (coming soon)

### Build from Source

```bash
# Clone the repository
git clone https://github.com/axpnet/aeroftp.git
cd aeroftp

# Install dependencies
npm install

# Run in development mode
npm run tauri dev

# Build for production
npm run tauri build
```

### Prerequisites

- **Node.js** 18+ 
- **Rust** 1.77+
- **Tauri CLI** (`cargo install tauri-cli`)

## 🚀 Usage

1. **Launch AeroFTP**
2. **Enter server details**:
   - Server: `ftp.example.com:21`
   - Username: `your-username`
   - Password: `your-password`
3. **Click Connect**
4. **Browse and transfer files!**

### Using DevTools

1. **Right-click** on any file → "Preview"
2. DevTools panel opens at the bottom
3. Switch to **Editor** tab for inline editing
4. Edit code with Monaco Editor
5. Click **Save** to upload changes

### Keyboard Shortcuts

| Key         | Action            |
| ----------- | ----------------- |
| `Ctrl+R`    | Refresh file list |
| `Ctrl+U`    | Upload file       |
| `Ctrl+D`    | Download file     |
| `Ctrl+N`    | New folder        |
| `Delete`    | Delete selected   |
| `F2`        | Rename            |
| `Backspace` | Go up directory   |

## 🏗️ Tech Stack

- **Backend**: Rust + Tauri
- **Frontend**: React + TypeScript
- **Styling**: TailwindCSS
- **FTP**: suppaftp crate
- **Editor**: Monaco Editor (VS Code)
- **Icons**: Lucide React

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md).

## 📝 License

MIT License - see [LICENSE](LICENSE) for details.

## 👥 Credits

> **🤖 AI-Assisted Development Project**
> - **Lead Developer & Supervisor:** axpdev
> - **Architect & Tech Lead:** Gemini 3 Pro (AI)
> - **Initial Execution:** KIMI K2 (AI)
> - **Refinement & Finalization:** Claude Opus 4.5 via Antigravity (AI)

---

<p align="center">
  Made with ❤️ and ☕
</p>