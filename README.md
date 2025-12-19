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

- 🚀 **Lightning Fast** - Built with Rust for maximum performance
- 🎨 **Beautiful UI** - Apple-inspired design with glass morphism effects
- 🌙 **Dark Mode** - Full dark mode support with smooth transitions
- 📁 **Dual Panel** - Remote and local file browsing side by side
- 🔒 **Secure** - Supports FTPS (FTP over TLS)
- ⚡ **Async** - Non-blocking file transfers
- 🔍 **Search** - Quick file search functionality
- 💾 **Profiles** - Save your favorite server connections

## 📸 Screenshots

<p align="center">
  <img src="docs/screenshot-light.png" alt="AeroFTP Light Mode" width="800">
</p>

<p align="center">
  <img src="docs/screenshot-dark.png" alt="AeroFTP Dark Mode" width="800">
</p>

## 🛠️ Installation

### From Releases

Download the latest release for your platform:
- **Linux**: `.deb` or `.AppImage`
- **Windows**: `.msi` installer
- **macOS**: `.dmg` image

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