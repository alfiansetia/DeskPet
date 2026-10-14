//! P1 Tauri commands. Rust is authoritative (PRD §7).
//! Only safe window/pet/settings commands. No shell, no network, no secrets.

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
    // P1 guard: never allow telemetry on; never accept sensitive actions here.
    patch.validate()?;
    *s.0.lock().map_err(|e| e.to_string())? = patch.clone();
    Ok(patch)
}

#[tauri::command]
pub fn app_health() -> serde_json::Value {
    serde_json::json!({
        "status": "ok",
        "milestone": "P1-foundation",
        "telemetry": false,
        "networkRequired": false,
    })
}
