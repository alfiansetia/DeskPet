# Konfigurasi (referensi settings)

Sumber kode: `apps/desktop/src/lib/store.ts` (`DeskSettings`,
`DEFAULT_SETTINGS`, `normalizeSettings`). Semua nilai dinormalisasi saat
load (skala dijepit, enum tak dikenal → default, `telemetryEnabled` selalu
`false`). Tersimpan di `deskpet:settings` (localStorage) + mirror tahan lama
backend (file app-data via `frontend_settings_get/put`).

## Tabel settings

| Key | Default | Keterangan |
| --- | --- | --- |
| `alwaysOnTop` | `true` | Window pet selalu di atas |
| `reducedMotion` | `false` | Gerakan tenang: hentikan wander + animasi idle |
| `soundMuted` | `false` | Bisukan efek suara (WebAudio) |
| `speechMuted` | `true` | Bisukan TTS (default mati = opt-in) |
| `wanderEnabled` | `true` | Jalan otomatis (bisa dioverride per-companion) |
| `wanderPace` | `"random"` | `random/slow/normal/fast` |
| `wanderDirection` | `"random"` | `random/horizontal/vertical/edges` |
| `quietHoursEnabled` | `true` | Hormati jam sepi untuk bunyi/TTS |
| `quietStart` / `quietEnd` | `22` / `7` | Rentang jam sepi (jam lokal) |
| `characterId` | `"deskpet.cat"` | ID kanonis turunan spesies (jangan isi manual) |
| `telemetryEnabled` | `false` | Selalu `false`; validator Rust menolak `true` |
| `petSpecies` | `"cat"` | `cat/snake/frog/owl/penguin` |
| `petPaletteId` | `"lavender"` | `lavender/sky/matcha/peach/rose/midnight/custom` |
| `petCustomColor` | `""` | Hex `#rgb`/`#rrggbb` bila palet = custom |
| `petScale` | `1` | 0.5–2.0 (50–200%) |
| `prayerEnabled` | `true` | Master jadwal sholat |
| `prayerCityId` / `prayerCityName` | `"1301"` / `"KOTA JAKARTA"` | Kota bersama untuk sholat + cuaca |
| `prayerAdzanEnabled` | `true` | Bunyi adzan (hormati quiet-hours) |
| `prayerReminderMins` | `10` | H-X menit (0–30; 0 = mati) |
| `prayerMiniEnabled` | `true` | Pill countdown mini |
| `prayerBubbleEnabled` | `true` | Bubble besar saat masuk waktu |
| `timerBadgeEnabled` | `true` | Badge countdown timer di atas pet |
| `timerDoneAlertEnabled` | `true` | Alert saat timer selesai (`false` = diam-diam) |
| `centerOnAlert` | `true` | Kembali ke tengah layar saat alert penting |
| `autoStart` | `false` | Jalankan saat login OS |
| `weatherEnabled` | `true` | Master cuaca Open-Meteo |
| `tempBubbleEnabled` | `true` | Pill suhu |
| `pettingTotal` | `0` | Hitungan elusan (unlock topi 0/5/15) |
| `activeHat` | `"none"` | Topi aktif (`none/baret/party/crown`) |
| `petStats` | `{hunger:100, mood:100, energy:100, updatedAt}` | Stat Tamagotchi-lite |

## Companion (per-window, tab Kawan)

Model: `features/pet/companions.ts`. Store `deskpet:companions` (maks 5).

| Field | Keterangan |
| --- | --- |
| `id` | `"main"` (primary) atau `c_*` (sekunder) |
| `name` | Nama tampilan |
| `species` / `paletteId` / `customColor` / `scale` | Tampilan window itu |
| `role` | `all/reminder/prayer/timer/decor` (routing alert; `decor` tidak pernah present) |
| `wanderEnabled` / `wanderPace` / `wanderDirection` | Gaya jalan per-pet (override global) |
| `showTemp` / `showMini` | Pill suhu/mini per-pet (default on; global tetap master switch) |
| `shy` | Mode pemalu (kabur saat hover; jinak sementara tahan `Shift`) |

## Otomatisasi bawaan

| ID | Pemicu | Default |
| --- | --- | --- |
| `auto_morning` | Weekday 09:00 ringkasan tugas | on |
| `auto_speak` | Bacakan pengingat jatuh tempo | on |
| `auto_friday` | Jumat 16:00 buat task review | **off** |
| `auto_task_nudge` | 13:00 & 17:30 bila ada tugas terbuka (1x/slot/hari) | on |

User lama otomatis mendapat ID baru yang belum ada
(`ensureAutomationDefaults()`, idempoten).

## Data lokal lain (keys)

`deskpet:reminders/todos/notes/events/automations/audit/timer`,
`deskpet:apiwatch`, `deskpet:prayer:<cityId>:<ymd>`,
`deskpet:prayer:cities`, `deskpet:prayer:fired`, `deskpet:companions`.
Backup JSON versi **2** mencakup semuanya (lihat `exportBackup`).
