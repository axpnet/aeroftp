# AeroCloud UX Enhancements - Phase 2

## ✅ Completato (v0.7.x)

- [x] Background sync con tokio (connessione FTP dedicata)
- [x] Tray icon con menu funzionante
- [x] Hide to tray quando sync attivo
- [x] Pause/Resume sync
- [x] Cartelle vuote sincronizzate (upload + download)
- [x] Cloud tab nella barra sessioni

---

## 🎨 UX Enhancements (Prossima Release)

### 1. Sync Animation - Solo durante trasferimento
**Problema:** L'animazione "Syncing" è attiva continuamente
**Soluzione:** 
- Status `active` (tra un sync e l'altro) → icona statica cyan
- Status `syncing` (durante trasferimento) → animazione bounce

### 2. Countdown Timer in Status Bar
**Feature:** Mostrare tempo rimanente al prossimo sync
- Timer visibile: "Next sync: 2:45"
- Si resetta dopo ogni sync completato
- Usa evento backend per countdown

### 3. Sync Interval Persistence Bug
**Bug:** Intervallo impostato (1 min) torna a 5 min default
**Fix:** Verificare salvataggio `sync_interval_secs` in cloud_config.json

### 4. Cloud Tab → FTP Browser
**Feature:** Click su Cloud Tab apre dual-panel con:
- Sinistra: Cartella cloud locale
- Destra: Cartella cloud remota (auto-connect)

### 5. Sync Badges (Dropbox-style)
**Feature:** Badge sui file per mostrare stato sync
- ✓ Verde: sincronizzato
- ↻ Giallo: in attesa/pending
- ↑↓ Blu: in trasferimento

---

## Priorità Suggerita

1. **Fix Animation** (facile, UX immediata)
2. **Fix Interval Bug** (importante per usabilità)
3. **Countdown Timer** (nice-to-have)
4. **Cloud Tab Browser** (media complessità)
5. **Sync Badges** (alta complessità, richiede file tracking)
