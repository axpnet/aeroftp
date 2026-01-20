# AeroCloud 2.0 - Multi-Provider Cloud Storage Roadmap

> Created: 20 January 2026
> Version: AeroFTP 1.0.0 → 1.2.0
> Status: Sprint 2 Complete (v1.2.0 Released)

---

## 📦 Release Log

### v1.2.0 (20 January 2026)
**Commit:** `ed0d57f5e924a44e2c9286810344c7b79ce0a9c7`

**Features:**
- Google Drive OAuth2 integration (browse, download, upload, delete)
- Provider-specific tab icons
- OAuth credentials loading from Settings panel
- Session switching workaround for OAuth providers

**Packaging Updates:**
- ✅ Snap: Pushed to edge channel
- ✅ Flatpak PR: https://github.com/flathub/flathub/pull/7608
  - `com.aeroftp.AeroFTP.yml` → tag v1.2.0
  - `cargo-sources.json` → rigenerato (8184 righe)
  - `node-sources.json` → rigenerato (622 sources)
- ⏳ In attesa review Flathub

---

## 🎯 Vision

Transform AeroFTP from a pure FTP client into a **Universal Cloud Storage Browser** while maintaining the simplicity and elegance of the current design.

**Target Audience:**
- **Sprint 1-2**: Pro users, developers, sysadmins (WebDAV, S3)
- **Sprint 3+**: End users, consumers (Google Drive, Dropbox, OneDrive)

---

## 🏗️ Architecture Overview

### Provider Abstraction Layer

```
┌─────────────────────────────────────────────────────────────┐
│                    AeroFTP Frontend                         │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │
│  │   FTP   │ │ WebDAV  │ │   S3    │ │  Cloud  │ ← Tabs    │
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘           │
└───────┼───────────┼───────────┼───────────┼─────────────────┘
        │           │           │           │
        ▼           ▼           ▼           ▼
┌─────────────────────────────────────────────────────────────┐
│              Rust Backend - Provider Layer                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │     trait StorageProvider (async)                    │   │
│  │   ├── connect()     ├── list()     ├── mkdir()      │   │
│  │   ├── disconnect()  ├── download() ├── delete()     │   │
│  │   ├── upload()      ├── rename()   ├── get_info()   │   │
│  └─────────────────────────────────────────────────────┘   │
│           │              │              │                   │
│           ▼              ▼              ▼                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ FtpProvider │  │WebDavProvider│ │  S3Provider │         │
│  │ (suppaftp)  │  │  (reqwest)  │  │ (aws-sdk)   │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

---

## 📋 Sprint 1: WebDAV + S3 Support (v1.1.0)

### Goals
- [x] Create unified `StorageProvider` trait
- [x] Refactor FTP to implement `StorageProvider`
- [x] Implement WebDAV provider
- [x] Implement S3-compatible provider
- [x] Update frontend for protocol selection

### Tasks

#### 1. Backend - Provider Abstraction (`src-tauri/src/providers/`)
- [x] Create `providers/mod.rs` with `StorageProvider` trait
- [x] Create `providers/types.rs` with shared types (`RemoteEntry`, `ProviderConfig`)
- [x] Create `providers/ftp.rs` - FTP provider implementation
- [x] Create `providers/webdav.rs` - WebDAV implementation
- [x] Create `providers/s3.rs` - S3 implementation with SigV4 signing

#### 2. Frontend - Protocol Selection
- [x] Add `ProviderType` to types.ts
- [x] Create `ProtocolSelector.tsx` component
- [x] Update ConnectionScreen with protocol dropdown
- [x] Add S3-specific fields (bucket, region, endpoint)
- [x] Add WebDAV hints and documentation

#### 3. Backend - Integration (Tauri Commands)
- [x] Create `provider_commands.rs` with Tauri commands
- [x] Add ProviderState for active provider management  
- [x] Register all provider commands in invoke_handler
- [x] Create `useProvider.ts` React hook
- [x] Wire up frontend to use provider commands instead of FTP-only
- [x] Update AeroCloud sync to work with any provider

#### 4. Testing & Documentation
- [ ] Test with Nextcloud (WebDAV)
- [ ] Test with MinIO (S3-compatible)
- [ ] Test with AWS S3
- [ ] Update README with new features

### Dependencies to Add (Cargo.toml)
```toml
# S3 Support
aws-sdk-s3 = "1"
aws-config = "1"

# Already have reqwest for WebDAV
```

---

## 📋 Sprint 2: OAuth2 Cloud Providers (v1.2.0)

### Goals
- [x] Google Drive integration (PARTIAL)
- [ ] Dropbox integration  
- [ ] OneDrive integration

### Completed (v1.2.0)
- [x] OAuth2 flow with local callback server
- [x] Google Drive API v3 provider (browse, download, upload, delete)
- [x] Add OAuth providers to ProtocolSelector
- [x] Provider-specific tab icons (Google Drive, Dropbox, OneDrive)
- [x] OAuth credentials loading from Settings panel

### Known Limitations
> ⚠️ **Session Switching Workaround Applied**: v1.2.0 reconnects OAuth on each switch.
> For optimal experience, test full multi-session backend in Sprint 3.

### Remaining Tasks (v1.2.1)
- [ ] Dropbox API v2 provider implementation
- [ ] Microsoft Graph API provider (OneDrive)
- [ ] MEGA.nz provider (MEGAcmd REST API)
- [ ] WebDAV testing (Nextcloud, Synology)
- [ ] S3 testing (AWS, MinIO, R2)
- [ ] Secure token storage (keyring)
- [ ] Token refresh handling
- [ ] Test OAuth flow on macOS/Windows

---

## 📋 Sprint 3: Multi-Session Architecture & Encryption (v1.3.0)

### Goals
- [ ] **Multi-session backend support** (HIGH PRIORITY)
- [ ] Cryptomator-compatible client-side encryption
- [ ] Multi-cloud unified view
- [ ] Cross-cloud file operations

### Multi-Session Architecture (Required)
Current architecture uses single `ProviderState`:
```rust
pub struct ProviderState {
    pub provider: Arc<Mutex<Option<Box<dyn StorageProvider>>>>
}
```

**Target architecture** with session-based provider management:
```rust
pub struct MultiSessionState {
    // Map session_id -> provider instance
    pub providers: Arc<Mutex<HashMap<String, Box<dyn StorageProvider>>>>
}
```

### Tasks
- [ ] Refactor ProviderState to support multiple active sessions
- [ ] Add session_id parameter to all provider commands
- [ ] Update frontend to pass session_id with each operation
- [ ] Implement proper session lifecycle (create, switch, close)
- [ ] Implement Cryptomator vault format
- [ ] AES-256-GCM encryption layer
- [ ] Filename encryption/obfuscation
- [ ] Multi-tab cloud browser with independent sessions
- [ ] Drag & drop between clouds

---

## 📋 Sprint 4: Advanced Features (v1.4.0)

### Goals
- [ ] CDN integration (CloudFront)
- [ ] Share links generation
- [ ] File versioning support
- [ ] Bandwidth throttling

---

## 🔧 Technical Notes

### WebDAV Implementation
- Use `reqwest` with custom headers for WebDAV methods (PROPFIND, MKCOL, MOVE, COPY)
- Parse XML responses with `quick-xml`
- Support both HTTP and HTTPS
- Handle Nextcloud/ownCloud specific extensions

### S3 Implementation
- Use official `aws-sdk-s3` for maximum compatibility
- Support custom endpoints for MinIO, Backblaze B2, R2, etc.
- Handle large file uploads with multipart
- Support presigned URLs for sharing

### Cross-Platform Considerations
- All providers must work on Linux, macOS, Windows
- Avoid platform-specific APIs
- Test on all platforms before release
- Snap/Flatpak compatibility (no direct filesystem access for OAuth tokens - use XDG portal)

---

## 📁 File Structure After Sprint 1

```
src-tauri/src/
├── lib.rs                 # Main Tauri commands
├── main.rs                # Entry point
├── providers/             # NEW: Storage providers
│   ├── mod.rs             # Provider trait + registry
│   ├── types.rs           # Shared types
│   ├── ftp.rs             # FTP provider
│   ├── webdav.rs          # WebDAV provider
│   └── s3.rs              # S3 provider
├── cloud_config.rs        # AeroCloud configuration
├── cloud_service.rs       # AeroCloud sync (updated for providers)
├── sync.rs                # File comparison logic
├── watcher.rs             # File system watcher
├── ai.rs                  # AI features
└── pty.rs                 # Terminal (Unix only)
```

---

## 🔗 References

- [Cyberduck](https://cyberduck.io/) - Feature inspiration
- [AWS S3 SDK for Rust](https://docs.aws.amazon.com/sdk-for-rust/)
- [WebDAV RFC 4918](https://datatracker.ietf.org/doc/html/rfc4918)
- [Cryptomator Vault Format](https://docs.cryptomator.org/en/latest/security/vault/)

---

## 📊 Compatibility Matrix (Target)

| Provider     | Browse | Upload | Download | Sync | Share |
| ------------ | ------ | ------ | -------- | ---- | ----- |
| FTP/FTPS     | ✅      | ✅      | ✅        | ✅    | ❌     |
| SFTP         | ✅      | ✅      | ✅        | ✅    | ❌     |
| WebDAV       | 🔄      | 🔄      | 🔄        | 🔄    | 🔄     |
| S3           | 🔄      | 🔄      | 🔄        | 🔄    | 🔄     |
| Google Drive | ✅      | ✅      | ✅        | 📋    | 📋     |
| Dropbox      | 📋      | 📋      | 📋        | 📋    | 📋     |
| OneDrive     | 📋      | 📋      | 📋        | 📋    | 📋     |

Legend: ✅ Done | 🔄 In Progress | 📋 Planned | ❌ Not Applicable
