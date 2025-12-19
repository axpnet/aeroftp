### Piano di Sviluppo per FTP_CLIENT_GUI (AeroFTP)

#### Fase 1: Funzionalità Core (Priorità Alta)
- **Download/Upload file con progress bar**: Implementare trasferimenti reali con progress bar collegata al backend, non simulata. Aggiungere cancellazione trasferimenti e retry automatico su errori.
- **Browser file locali (dual-panel)**: Completare il pannello locale con stat reali (dimensione, data modifica), preview immagini, e filtri. Integrazione con upload via drag&drop.
- **Gestione errori migliorata**: Sostituire alert con toast integrati (React Toastify), suggerimenti automatici, e logging avanzato.

#### Fase 2: Miglioramenti UX e Sicurezza (Priorità Media)
- **Integrazione Nativa con Ubuntu**: Temi GTK, notifiche desktop, apertura Nautilus.
- **Progress Bar e Trasferimenti Intelligenti**: Streaming asincrono, transfer manager con coda, modalità batch.
- **Browser File Locali Avanzato**: Ricerca fuzzy, selezione multipla, operazioni batch.
- **Sistema di Gestione Errori Intelligente**: Toast, suggerimenti, log file.
- **Funzionalità Smart e Creatività**: Temi dinamici, modalità offline, integrazione cloud.

#### Fase 3: Estensioni Avanzate (Priorità Bassa)
- Supporto FTPS/SFTP.
- Configurazione avanzata (salvataggio profili).
- UI migliorata (ridimensionamento pannelli, temi personalizzabili).
- Testing e audit.

#### Note Generali
- Mantieni separazione frontend/backend.
- Testa su Ubuntu per integrazione nativa.
- Focus su affidabilità e UX premium per differenziarsi da FileZilla.