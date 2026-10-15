//! File log aplikasi (debug + release).
//! Console hilang di release Windows (`windows_subsystem`), jadi kejadian
//! penting ditulis ke `<app_local_data>/deskpet.log` (local-only, tanpa
//! network). Rotasi sederhana: >512 KiB -> pindah ke `deskpet.log.old`.
//! Tab Log di frontend membaca via command `log_read` + membuka file via
//! plugin opener. Tidak pernah throw ke pemanggil (best-effort).

use tauri::AppHandle;

pub const MAX_BYTES: u64 = 512 * 1024;
pub const TAIL_DEFAULT: usize = 200;

fn file_name(dir: &std::path::Path) -> std::path::PathBuf {
    dir.join("deskpet.log")
}

pub fn log_path(app: &AppHandle) -> Option<std::path::PathBuf> {
    use tauri::Manager;
    app.path()
        .app_local_data_dir()
        .ok()
        .map(|d| file_name(&d))
}

/// Satu baris log: `2026-10-15T08:00:00Z [INFO] pesan`.
pub fn format_line(level: &str, msg: &str) -> String {
    let ts = chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ");
    format!("{ts} [{level}] {msg}")
}

fn rotate_if_needed(path: &std::path::Path) {
    let size = std::fs::metadata(path).map(|m| m.len()).unwrap_or(0);
    if size > MAX_BYTES {
        let old = path.with_extension("log.old");
        let _ = std::fs::remove_file(&old);
        let _ = std::fs::rename(path, &old);
    }
}

/// Tulis satu baris ke file log (+ mirror ke stderr agar console dev tetap hidup).
pub fn write(app: &AppHandle, level: &str, msg: &str) {
    let line = format_line(level, msg);
    eprintln!("[deskpet] {line}");
    if let Some(path) = log_path(app) {
        if let Some(parent) = path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        rotate_if_needed(&path);
        if let Ok(mut f) = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&path)
        {
            use std::io::Write;
            let _ = writeln!(f, "{line}");
        }
    }
}

pub fn info(app: &AppHandle, msg: &str) {
    write(app, "INFO", msg);
}

pub fn warn(app: &AppHandle, msg: &str) {
    write(app, "WARN", msg);
}

/// N baris terakhir file log (untuk tab Log). Kosong bila belum ada file.
pub fn read_tail(app: &AppHandle, max_lines: usize) -> String {
    let limit = max_lines.clamp(1, 2000);
    let Some(path) = log_path(app) else {
        return String::new();
    };
    let Ok(content) = std::fs::read_to_string(&path) else {
        return String::new();
    };
    tail_lines(&content, limit)
}

/// Murni: N baris terakhir dari teks (tanpa file, testable).
pub fn tail_lines(content: &str, n: usize) -> String {
    if n == 0 {
        return String::new();
    }
    let lines: Vec<&str> = content.lines().collect();
    let start = lines.len().saturating_sub(n);
    lines[start..].join("\n")
}

/// Kosongkan file log aktif + salinan rotasi (.old). Return byte dibebaskan.
/// Idempoten: tanpa file = Ok(0). Best-effort per file (satu gagal tak
/// menggagalkan yang lain).
pub fn clear(app: &AppHandle) -> u64 {
    let Some(path) = log_path(app) else {
        return 0;
    };
    let old = path.with_extension("log.old");
    let mut freed = 0u64;
    for p in [&path, &old] {
        if let Ok(m) = std::fs::metadata(p) {
            freed += m.len();
            let _ = std::fs::remove_file(p);
        }
    }
    freed
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn line_format_has_timestamp_and_level() {
        let l = format_line("INFO", "halo");
        assert!(l.contains("[INFO] halo"));
        assert!(l.len() > "2026-01-01T00:00:00Z [INFO] halo".len() - 5);
    }

    #[test]
    fn tail_takes_last_n_lines() {
        let c = "a\nb\nc\nd";
        assert_eq!(tail_lines(c, 2), "c\nd");
        assert_eq!(tail_lines(c, 99), "a\nb\nc\nd");
        assert_eq!(tail_lines(c, 0), "");
        assert_eq!(tail_lines("", 5), "");
    }
}
