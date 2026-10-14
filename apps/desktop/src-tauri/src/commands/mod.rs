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
