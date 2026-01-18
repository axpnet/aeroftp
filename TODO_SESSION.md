# AeroFTP - Session TODO

> Creato: 18 gennaio 2026
> Stato: In attesa review Flathub

---

## 📊 Stato Versioni Attuale

| Store | Versione | Stato |
|-------|----------|-------|
| **GitHub Releases** | v0.9.8 | ✅ Rilasciato |
| **Snap Store** | 0.9.6 → 0.9.8 | 🚀 Build in corso (workflow fixato) |
| **Flathub** | v0.9.7 | 🔄 PR in review |

---

## 🔧 Fix Applicati in Questa Sessione

### 1. Fix Snap Build nel CI
**Problema**: Tauri NON genera file `.snap` - genera solo `.deb`, `.rpm`, `.AppImage`

**Soluzione applicata** in `.github/workflows/build.yml`:
- Aggiunto step `snapcore/action-build@v1` per buildare lo snap da `snap/snapcraft.yaml`
- Corretto riferimento al file snap usando `${{ steps.snap-build.outputs.snap }}`
- Upload non-fatale per non bloccare altri pacchetti

**Commit**: `8b19b2d` - "fix(ci): Build Snap package using Snapcraft action"

### 2. Bump Versione a 0.9.8
- `src-tauri/tauri.conf.json`: 0.9.7 → 0.9.8
- `snap/snapcraft.yaml`: 0.9.7 → 0.9.8

**Commit**: `f4b0b9b` - "chore: Bump version to 0.9.8"
**Tag**: `v0.9.8` creato e pushato

---

## 📋 TODO - Azioni Pendenti

### ⏳ In Attesa

- [ ] **Flathub Review**: Aspettare che Flathub faccia il merge della PR su `flathub/new-pr`
  - PR: branch `add-com.aeroftp.app` con v0.9.7
  - Repo fork: `/var/www/html/FTP_CLIENT_GUI/flathub-fork`

- [ ] **Verificare Snap Build**: Controllare su GitHub Actions che il build v0.9.8 sia passato
  - URL: https://github.com/axpnet/aeroftp/actions
  - Verificare che lo snap sia stato caricato su Snap Store

### 🔜 Dopo il Merge Flathub

- [ ] **Aggiornare Flathub a v0.9.8**:
  1. Il branch `update-v0.9.8` è già pronto in `/var/www/html/FTP_CLIENT_GUI/flathub-fork`
  2. Contiene commit `f4dcb3f` con tag/commit aggiornati a v0.9.8
  3. Dopo il merge, fare fork del repo ufficiale `flathub/com.aeroftp.AeroFTP`
  4. Applicare le modifiche e aprire PR

**Dettagli branch update-v0.9.8:**
```yaml
# In com.aeroftp.AeroFTP.yml
tag: v0.9.8
commit: f4b0b9bfdfdbca8332572f3cd90f2b988f4eb1db
```

---

## 📁 File Importanti

```
/var/www/html/FTP_CLIENT_GUI/
├── .github/workflows/build.yml      # CI workflow (fixato)
├── snap/snapcraft.yaml              # Config Snap (v0.9.8)
├── src-tauri/tauri.conf.json        # Config Tauri (v0.9.8)
└── flathub-fork/
    ├── com.aeroftp.AeroFTP.yml      # Manifest Flatpak
    ├── cargo-sources.json           # Dipendenze Rust (no changes)
    ├── node-sources.json            # Dipendenze Node (no changes)
    └── Branches:
        ├── add-com.aeroftp.app      # v0.9.7 - PR in review
        └── update-v0.9.8            # v0.9.8 - Pronto per dopo
```

---

## 🔗 Link Utili

- **GitHub Repo**: https://github.com/axpnet/aeroftp
- **GitHub Actions**: https://github.com/axpnet/aeroftp/actions
- **Snap Store Dashboard**: https://dashboard.snapcraft.io/stores/snaps/
- **Flathub PR**: (controllare su https://github.com/flathub/flathub/pulls)

---

## 📝 Note

1. **Dipendenze non cambiate** tra v0.9.7 e v0.9.8 - solo fix CI e version bump
2. **cargo-sources.json e node-sources.json** non devono essere rigenerati per v0.9.8
3. Il tag v0.9.7 NON è stato toccato per non interferire con la review Flathub
