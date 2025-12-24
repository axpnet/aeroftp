# AeroCloud TODO - Prossimi Fix

## 🔧 Bug Fix (Priorità Alta)

### 1. Sync Progress 0% durante download
- **Problema:** La barra di progresso resta a 0% anche durante il download
- **Causa:** Il backend non emette eventi di progresso durante `perform_full_sync`
- **Fix:** Aggiungere emit di `cloud_status_change` con progress aggiornato nel loop di `process_comparison`

### 2. StatusBar Cloud indicator persistente
- **Problema:** Il pulsante Cloud si spegne quando chiudo il modal, anche se sync è attivo
- **Causa:** `cloudEnabled` è legato a `showCloudPanel` invece che allo stato sync effettivo
- **Fix:** Creare uno state separato `isCloudActive` che resta true finché AeroCloud è abilitato/syncing

### 3. Upload progress simulation
- **Problema:** Upload non mostra progresso (già noto)
- **Fix:** Usare `upload_file_with_progress` con callback per emettere eventi

---

## ⬆️ Upgrade (Phase 5)

### 4. System Tray Icon (Ubuntu)
- **Obiettivo:** Icona AeroCloud nella system tray (in alto a destra su Ubuntu)
- **Features:**
  - Icona cloud che cambia durante sync (animazione)
  - Click destro → menu con: Sync Now, Pause, Open Folder, Quit
  - Notifica quando sync completato
- **Tauri:** Usare `tauri::tray` module
- **Riferimento:** https://tauri.app/v2/guides/features/system-tray/

---

## 📋 Altri miglioramenti futuri

- [ ] Conflict Resolution UI (mostrare conflitti e permettere scelta)
- [ ] Sync history/log viewer nel CloudPanel
- [ ] Notifiche desktop per sync completato/errori
- [ ] Auto-sync al cambio file (file watcher già implementato, serve collegare)
- [ ] i18n per CloudPanel (dopo Phase X)

---

*Ultimo aggiornamento: 2025-12-24 03:41*
