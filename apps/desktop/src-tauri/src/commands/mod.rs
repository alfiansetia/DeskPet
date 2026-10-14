//! Tauri commands. Rust is authoritative (PRD §7).
//! Only safe window/pet/settings/action commands. No shell, no network, no secrets.

use crate::actions::{ActionRequest, PermissionClass};
use crate::pet::PetState;
use crate::settings::AppSettings;
use std::str::FromStr;
use std::sync::Mutex;
use tauri::State;

pub struct PetVisibility(pub Mutex<bool>);
pub struct CurrentPetState(pub Mutex<PetState>);
pub struct SharedSettings(pub Mutex<AppSettings>);

#[tauri::command]
pub fn pet_get_state(state: State<'_, CurrentPetState>) -> PetState {
    *state.0.lock().unwrap()
}

#[tauri::command]
pub fn pet_set_state(state: State<'_, CurrentPetState>, next: String) -> Result<PetState, String> {
    let next_state = PetState::from_str(&next)?;
    let mut guard = state.0.lock().map_err(|e| e.to_string())?;
    if !guard.can_transition_to(next_state) {
        return Err(format!(
            "transition {} -> {} not allowed",
            guard.as_str(),
            next_state.as_str()
        ));
    }
    *guard = next_state;
    Ok(next_state)
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
