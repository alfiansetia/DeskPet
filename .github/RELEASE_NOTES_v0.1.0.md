# Draf catatan rilis v0.1.0 (tempel ke halaman Release)

> File ini adalah bahan mentah untuk body release GitHub.
> Salin-tempel ke draft release, atau jadikan `releaseBody` workflow.

---

## 🐾 DeskPet v0.1.0 — rilis awal publik

Karakter desktop + asisten produktivitas **local-first**: pengingat, tugas,
catatan, timer, kalender lokal, jadwal sholat + cuaca, multi-kawan — tanpa
akun, tanpa cloud wajib, tanpa telemetri.

### 📥 Download

| OS | File | Cara instal |
| --- | --- | --- |
| Windows 10/11 (64-bit) | `DeskPet_0.1.0_x64-setup.exe` | Jalankan, ikuti wizard NSIS |
| Windows 10/11 (64-bit) | `DeskPet_0.1.0_x64_en-US.msi` | Alternatif MSI |
| macOS Apple Silicon (M1+) | `DeskPet_0.1.0_aarch64.dmg` | Buka DMG → seret ke Applications |
| macOS Intel | `DeskPet_0.1.0_x86_64.dmg` | Buka DMG → seret ke Applications |

### ⚠️ Penting: bundle ini unsigned

Rilis ini **belum di-sign / notarize** (butuh sertifikat berbayar):

- **Windows:** SmartScreen akan menampilkan "Unknown publisher" →
  klik *More info* → *Run anyway*.
- **macOS:** Gatekeeper akan menolak ("cannot be opened") → klik kanan app →
  *Open* → konfirmasi. Atau:
  `xattr -dr com.apple.quarantine /Applications/DeskPet.app`

### ✨ Isi rilis

- 5 karakter (kucing, ular, kodok, burung hantu, penguin), recolorable,
  drag/klik/elus/dobel-klik/klik-kanan, jalan otomatis, topi unlockable.
- Multi-kawan: hingga 5 window, role presenter, live-sync, restore restart.
- Pengingat (recurrence/snooze/quiet-hours), tugas, catatan (autosave),
  timer fokus, kalender lokal, 4 otomatisasi bawaan.
- Asisten NL ID+EN offline + validasi Rust + audit log.
- Jadwal sholat (MyQuran/Kemenag) + cuaca (Open-Meteo), cache-first offline.
- ntfy opt-in, TTS opt-in, backup/restore JSON, autostart, tray.
- Detail: [`CHANGELOG.md`](https://github.com/alfiansetia/DeskPet/blob/main/CHANGELOG.md)

### Yang sengaja belum

- Login Google/Gmail (stub terputus — butuh OAuth, demi privasi).
- Sinkronisasi cloud / akun. Plugin pihak-3 (butuh sandbox).
- Alarm tidak bunyi saat komputer mati (keterbatasan OS).

### Verifikasi

Bandingkan checksum (SHA-256) yang tertera di bawah tiap asset sebelum
menjalankan installer.
