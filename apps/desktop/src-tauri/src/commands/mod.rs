//! Tauri commands. Rust is authoritative (PRD §7).
//! Only safe window/pet/settings/action commands. No shell, no network, no secrets.

use crate::actions::{ActionRequest, PermissionClass};
use crate::companions::{
    companion_id_from_label, is_valid_companion_id, window_label_for, PetRegistry,
    MAIN_COMPANION_ID, MAX_COMPANIONS,
};
use crate::pet::PetState;
use crate::settings::AppSettings;
use std::str::FromStr;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};

pub struct PetVisibility(pub Mutex<bool>);
pub struct CurrentPetState(pub Mutex<PetState>);
pub struct SharedSettings(pub Mutex<AppSettings>);

#[tauri::command]
pub fn pet_get_state(state: State<'_, CurrentPetState>, registry: State<'_, PetRegistry>) -> PetState {
    // Sumber kebenaran: registry ("main"). Mirror lama dipertahankan untuk kompat.
    let s = registry.get(MAIN_COMPANION_ID);
    if let Ok(mut g) = state.0.lock() {
        *g = s;
    }
    s
}

#[tauri::command]
pub fn pet_set_state(
    state: State<'_, CurrentPetState>,
    registry: State<'_, PetRegistry>,
    next: String,
) -> Result<PetState, String> {
    let applied = registry.set(MAIN_COMPANION_ID, PetState::from_str(&next)?)?;
    if let Ok(mut g) = state.0.lock() {
        *g = applied;
    }
    Ok(applied)
}

/// State satu companion (multi-window opsi B). Fallback: id tak dikenal -> error
/// agar frontend tidak diam-diam mengendalikan pet yang salah.
#[tauri::command]
pub fn pet_get_state_of(registry: State<'_, PetRegistry>, id: String) -> Result<PetState, String> {
    if !is_valid_companion_id(&id) {
        return Err("unknown companion id (rejected)".into());
    }
    Ok(registry.get(&id))
}

#[tauri::command]
pub fn pet_set_state_of(
    state: State<'_, CurrentPetState>,
    registry: State<'_, PetRegistry>,
    id: String,
    next: String,
) -> Result<PetState, String> {
    if !is_valid_companion_id(&id) {
        return Err("unknown companion id (rejected)".into());
    }
    let next_state = PetState::from_str(&next)?;
    let applied = registry.set(&id, next_state)?;
    if id == MAIN_COMPANION_ID {
        if let Ok(mut g) = state.0.lock() {
            *g = applied;
        }
    }
    Ok(applied)
}

#[tauri::command]
pub fn pet_is_visible(vis: State<'_, PetVisibility>) -> bool {
    *vis.0.lock().unwrap()
}

#[tauri::command]
pub fn pet_set_visible(vis: State<'_, PetVisibility>, visible: bool) -> bool {
    *vis.0.lock().unwrap() = visible;
    visible
}

#[tauri::command]
pub fn settings_get(s: State<'_, SharedSettings>) -> AppSettings {
    s.0.lock().unwrap().clone()
}

#[tauri::command]
pub fn settings_update(s: State<'_, SharedSettings>, patch: AppSettings) -> Result<AppSettings, String> {
    // Guard: never allow telemetry on; never accept sensitive actions here.
    patch.validate()?;
    *s.0.lock().map_err(|e| e.to_string())? = patch.clone();
    Ok(patch)
}

#[tauri::command]
pub fn app_health() -> serde_json::Value {
    serde_json::json!({
        "status": "ok",
        "milestone": "P2-local-productivity",
        "telemetry": false,
        "networkRequired": false,
    })
}

/// Validate a structured action request (PRD §5.7). Allowlist-only.
/// Never executes shell/network; only validates + classifies.
#[tauri::command]
pub fn action_validate(request: serde_json::Value) -> Result<serde_json::Value, String> {
    let action: ActionRequest = serde_json::from_value(request)
        .map_err(|e| format!("unknown or malformed action (rejected): {e}"))?;
    action.validate()?;
    let perm: PermissionClass = action.permission();
    let perm_str = match perm {
        PermissionClass::ReadLocal => "read_local",
        PermissionClass::WriteLocal => "write_local",
        PermissionClass::Scheduled => "scheduled",
        PermissionClass::ExternalRead => "external_read",
        PermissionClass::ExternalWrite => "external_write",
        PermissionClass::HighRisk => "high_risk",
    };
    Ok(serde_json::json!({
        "actionId": action.id(),
        "permission": perm_str,
        "needsConfirm": action.needs_confirm(),
        "processedLocally": true,
    }))
}

/// Minimal local audit record (metadata only, never private content).
#[tauri::command]
pub fn audit_log(action_id: String, source: String, status: String, confirmation_required: bool) -> Result<serde_json::Value, String> {
    if action_id.trim().is_empty() || action_id.len() > 64 {
        return Err("invalid action_id".into());
    }
    if !["assistant", "panel", "scheduler", "automation"].contains(&source.as_str()) {
        return Err("unknown source (rejected)".into());
    }
    if !["executed", "previewed", "rejected", "confirmed"].contains(&status.as_str()) {
        return Err("unknown status (rejected)".into());
    }
    // NOTE: persisted to SQLite by a future repository layer; P2 keeps it in-memory-ack.
    Ok(serde_json::json!({
        "actionId": action_id,
        "source": source,
        "status": status,
        "confirmationRequired": confirmation_required,
    }))
}

#[tauri::command]
pub fn app_quit(app: tauri::AppHandle) {
    app.exit(0);
}

/// Daftar companion window yang hidup (label `pet*` saja). Local-only.
#[tauri::command]
pub fn companions_list(
    app: AppHandle,
    registry: State<'_, PetRegistry>,
) -> Vec<serde_json::Value> {
    registry
        .list()
        .into_iter()
        .map(|(id, st)| {
            let label = window_label_for(&id);
            let visible = app
                .get_webview_window(&label)
                .and_then(|w| w.is_visible().ok())
                .unwrap_or(false);
            serde_json::json!({ "id": id, "label": label, "state": st.as_str(), "visible": visible })
        })
        .collect()
}

/// Spawn (atau fokus bila sudah ada) window untuk satu companion.
/// Local-only: tanpa network, tanpa shell. ID divalidasi ketat; "main" = window `pet`.
#[tauri::command]
pub fn companions_spawn(
    app: AppHandle,
    registry: State<'_, PetRegistry>,
    id: String,
) -> Result<serde_json::Value, String> {
    if !is_valid_companion_id(&id) {
        return Err("unknown companion id (rejected)".into());
    }
    if id != MAIN_COMPANION_ID && registry.list().len() >= MAX_COMPANIONS {
        return Err("companion limit reached (max 5)".into());
    }
    registry.ensure(&id);
    let label = window_label_for(&id);
    if let Some(w) = app.get_webview_window(&label) {
        let _ = w.show();
        let _ = w.set_focus();
        return Ok(serde_json::json!({ "id": id, "label": label, "existed": true }));
    }
    // Posisi cascade dari window primary agar tidak menumpuk persis.
    let offset: i32 = 60 * (app.webview_windows().len() as i32);
    let (base_x, base_y) = app
        .get_webview_window("pet")
        .and_then(|w| w.outer_position().ok())
        .map(|p| (p.x, p.y))
        .unwrap_or((200, 200));
    let win = tauri::WebviewWindowBuilder::new(
        &app,
        &label,
        tauri::WebviewUrl::App("index.html".into()),
    )
    .title(format!("DeskPet {label}"))
    .inner_size(170.0, 200.0)
    .min_inner_size(80.0, 80.0)
    .transparent(true)
    .decorations(false)
    .always_on_top(true)
    .skip_taskbar(true)
    .resizable(true)
    .shadow(false)
    .accept_first_mouse(true)
    .position((base_x + offset).max(0) as f64, (base_y + offset).max(0) as f64)
    .build()
    .map_err(|e| e.to_string())?;
    let _ = win.show();
    let _ = app.emit("deskpet://companions-changed", "spawn");
    Ok(serde_json::json!({ "id": id, "label": label, "existed": false }))
}

/// Tutup + hapus window companion sekunder. Primary ("main") ditolak.
#[tauri::command]
pub fn companions_despawn(
    app: AppHandle,
    registry: State<'_, PetRegistry>,
    id: String,
) -> Result<serde_json::Value, String> {
    if !is_valid_companion_id(&id) {
        return Err("unknown companion id (rejected)".into());
    }
    if id == MAIN_COMPANION_ID {
        return Err("cannot despawn primary pet".into());
    }
    let label = window_label_for(&id);
    if let Some(w) = app.get_webview_window(&label) {
        w.destroy().map_err(|e| e.to_string())?;
    }
    registry.remove(&id);
    let _ = app.emit("deskpet://companions-changed", "despawn");
    Ok(serde_json::json!({ "id": id, "label": label }))
}

/// Label window pemanggil -> companion id pemiliknya (untuk frontend multi-window).
#[tauri::command]
pub fn companions_owner_of(app: AppHandle) -> String {
    // Dipanggil dari window itu sendiri; fallback "main" bila tak terpetakan.
    // `app` di sini adalah handle proses — window spesifik tidak tersedia di
    // command bebas; frontend memakai label lokalnya sendiri. API ini hanya
    // echo daftar label agar web-preview tetap bisa jalan.
    let mut labels: Vec<String> = app.webview_windows().keys().cloned().collect();
    labels.sort();
    let first = labels
        .iter()
        .find(|l| l.as_str() == "pet" || l.starts_with("pet-"))
        .cloned()
        .unwrap_or_else(|| "pet".to_string());
    companion_id_from_label(&first)
}

/// Durable mirror of the FRONTEND settings object (opaque JSON blob).
/// Why: WebView localStorage is per-origin/per-profile and can be wiped;
/// users expect settings (city, toggles, pet scale) to survive restarts.
/// The frontend stays the schema owner — Rust only stores bytes in
/// `<app_local_data>/frontend-settings.json` (local-only, never leaves device).
/// Privacy guard: blobs with telemetry enabled are refused.
pub fn validate_settings_blob(json: &str) -> Result<(), String> {
    if json.len() > 65_536 {
        return Err("settings blob too large (max 64 KiB)".into());
    }
    let v: serde_json::Value =
        serde_json::from_str(json).map_err(|e| format!("invalid settings json: {e}"))?;
    let obj = v.as_object().ok_or("settings must be a JSON object")?;
    match obj.get("telemetryEnabled") {
        Some(serde_json::Value::Bool(false)) | None => Ok(()),
        _ => Err("telemetry must stay disabled".into()),
    }
}

fn frontend_settings_path(app: &tauri::AppHandle) -> Option<std::path::PathBuf> {
    use tauri::Manager;
    app.path().app_local_data_dir().ok().map(|mut d| {
        d.push("frontend-settings.json");
        d
    })
}

#[tauri::command]
pub fn frontend_settings_get(app: tauri::AppHandle) -> Option<String> {
    let path = frontend_settings_path(&app)?;
    std::fs::read_to_string(path)
        .ok()
        .filter(|s| validate_settings_blob(s).is_ok())
}

#[tauri::command]
pub fn frontend_settings_put(app: tauri::AppHandle, json: String) -> Result<(), String> {
    validate_settings_blob(&json)?;
    let path = frontend_settings_path(&app).ok_or("no app data dir")?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    // Write temp + rename so a crash never leaves a half-written file.
    let tmp = path.with_extension("json.tmp");
    std::fs::write(&tmp, &json).map_err(|e| e.to_string())?;
    std::fs::rename(&tmp, &path).map_err(|e| e.to_string())?;
    Ok(())
}

/// Durable mirror of ONE day of prayer schedule (opaque JSON blob).
/// Same story as settings: WebView localStorage can be wiped, and users
/// expect the countdown pill above the pet right after (re)start — without
/// waiting for a network round-trip. One tiny file per city+date:
/// `<app_local_data>/prayer-{city_id}-{yyyy-mm-dd}.json` (local-only).
/// Frontend owns the schema; Rust only checks size/shape. Old dates are
/// simply never read again (each day has its own key), so no cleanup needed.
pub fn validate_prayer_blob(json: &str) -> Result<(), String> {
    if json.len() > 16_384 {
        return Err("prayer blob too large (max 16 KiB)".into());
    }
    let v: serde_json::Value =
        serde_json::from_str(json).map_err(|e| format!("invalid prayer json: {e}"))?;
    let obj = v.as_object().ok_or("prayer cache must be a JSON object")?;
    match obj.get("date") {
        Some(serde_json::Value::String(_)) => Ok(()),
        _ => Err("prayer cache needs a date string".into()),
    }
}

fn sanitize_file_part(s: &str) -> String {
    s.chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' || c == '_' {
                c
            } else {
                '_'
            }
        })
        .take(32)
        .collect()
}

fn prayer_cache_path(
    app: &tauri::AppHandle,
    city_id: &str,
    ymd: &str,
) -> Option<std::path::PathBuf> {
    use tauri::Manager;
    // Tanggal valid: YYYY-MM-DD tepat 10 char selebihnya ditolak.
    if ymd.len() != 10 || ymd.as_bytes()[4] != b'-' || ymd.as_bytes()[7] != b'-' {
        return None;
    }
    app.path().app_local_data_dir().ok().map(|mut d| {
        d.push(format!(
            "prayer-{}-{}.json",
            sanitize_file_part(city_id),
            sanitize_file_part(ymd)
        ));
        d
    })
}

#[tauri::command]
pub fn prayer_cache_get(app: tauri::AppHandle, city_id: String, ymd: String) -> Option<String> {
    let path = prayer_cache_path(&app, &city_id, &ymd)?;
    std::fs::read_to_string(path)
        .ok()
        .filter(|s| validate_prayer_blob(s).is_ok())
}

#[tauri::command]
pub fn prayer_cache_put(
    app: tauri::AppHandle,
    city_id: String,
    ymd: String,
    json: String,
) -> Result<(), String> {
    validate_prayer_blob(&json)?;
    let path = prayer_cache_path(&app, &city_id, &ymd).ok_or("invalid city/date")?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let tmp = path.with_extension("json.tmp");
    std::fs::write(&tmp, &json).map_err(|e| e.to_string())?;
    std::fs::rename(&tmp, &path).map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(test)]
mod blob_tests {
    use super::validate_settings_blob;

    #[test]
    fn accepts_plain_settings_object() {
        assert!(validate_settings_blob(r#"{"alwaysOnTop":true,"telemetryEnabled":false}"#).is_ok());
        // Missing marker is fine too (older frontend shape) as long as no telemetry.
        assert!(validate_settings_blob(r#"{"alwaysOnTop":true}"#).is_ok());
    }

    #[test]
    fn rejects_telemetry_on() {
        assert!(validate_settings_blob(r#"{"telemetryEnabled":true}"#).is_err());
    }

    #[test]
    fn rejects_garbage_and_oversize() {
        assert!(validate_settings_blob("not json").is_err());
        assert!(validate_settings_blob("[1,2,3]").is_err());
        assert!(validate_settings_blob(&"x".repeat(70_000)).is_err());
    }

    #[test]
    fn sanitize_file_part_blocks_traversal() {
        assert_eq!(super::sanitize_file_part("../../etc"), "______etc");
        assert_eq!(super::sanitize_file_part("1301"), "1301");
    }
}

#[cfg(test)]
mod prayer_blob_tests {
    use super::validate_prayer_blob;

    #[test]
    fn accepts_schedule_object() {
        assert!(validate_prayer_blob(r#"{"date":"2026-10-14","subuh":"04:30"}"#).is_ok());
    }

    #[test]
    fn rejects_garbage_and_oversize() {
        assert!(validate_prayer_blob("not json").is_err());
        assert!(validate_prayer_blob(r#"{"subuh":"04:30"}"#).is_err());
        assert!(validate_prayer_blob(&"x".repeat(20_000)).is_err());
    }
}
