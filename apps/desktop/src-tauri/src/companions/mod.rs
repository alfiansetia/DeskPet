//! Companion registry untuk multi-pet (opsi B: 1 window per companion).
//! Mirror frontend `src/features/pet/companions.ts` — label mapping harus sama.
//! Local-only, tanpa network. ID tidak pernah dipakai sebagai path file.

use std::collections::HashMap;
use std::sync::Mutex;

use crate::pet::PetState;

pub const MAIN_COMPANION_ID: &str = "main";
pub const MAX_COMPANIONS: usize = 5;

/// Window label Tauri untuk satu companion.
/// - "main" -> "pet" (primary, backward-compat)
/// - lain   -> "pet-{id}"
pub fn window_label_for(id: &str) -> String {
    if (id == MAIN_COMPANION_ID) {
        "pet".to_string()
    } else {
        format!("pet-{id}")
    }
}

/// Companion id dari label window. Tak dikenal -> "main" (fallback aman).
pub fn companion_id_from_label(label: &str) -> String {
    if (label == "pet") {
        return MAIN_COMPANION_ID.to_string();
    }
    if let Some(id) = label.strip_prefix("pet-") {
        if (is_valid_companion_id(id)) {
            return id.to_string();
        }
    }
    MAIN_COMPANION_ID.to_string()
}

/// ID valid: "main" atau `c_` + 1..32 char alnum lowercase.
pub fn is_valid_companion_id(id: &str) -> bool {
    if (id == MAIN_COMPANION_ID) {
        return true;
    }
    let rest = match id.strip_prefix("c_") {
        Some(r) => r,
        None => return false,
    };
    !rest.is_empty()
        && rest.len() <= 32
        && rest.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit())
}

/// Per-companion animation state registry. "main" selalu ada (Idle default).
pub struct PetRegistry(pub Mutex<HashMap<String, PetState>>);

impl Default for PetRegistry {
    fn default() -> Self {
        let mut m = HashMap::new();
        m.insert(MAIN_COMPANION_ID.to_string(), PetState::Idle);
        Self(Mutex::new(m))
    }
}

impl PetRegistry {
    pub fn get(&self, id: &str) -> PetState {
        self.0.lock().unwrap().get(id).copied().unwrap_or_default()
    }

    pub fn set(&self, id: &str, next: PetState) -> Result<PetState, String> {
        let mut guard = self.0.lock().map_err(|e| e.to_string())?;
        let cur = guard.get(id).copied().unwrap_or_default();
        if (!cur.can_transition_to(next)) {
            return Err(format!(
                "transition {} -> {} not allowed",
                cur.as_str(),
                next.as_str()
            ));
        }
        guard.insert(id.to_string(), next);
        Ok(next)
    }

    pub fn ensure(&self, id: &str) {
        self.0
            .lock()
            .unwrap()
            .entry(id.to_string())
            .or_insert(PetState::Idle);
    }

    pub fn remove(&self, id: &str) {
        self.0.lock().unwrap().remove(id);
    }

    pub fn list(&self) -> Vec<(String, PetState)> {
        let guard = self.0.lock().unwrap();
        let mut out: Vec<(String, PetState)> = guard.iter().map(|(k, v)| (k.clone(), *v)).collect();
        out.sort_by(|a, b| a.0.cmp(&b.0));
        out
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::str::FromStr;

    #[test]
    fn label_mapping_round_trips() {
        assert_eq!(window_label_for("main"), "pet");
        assert_eq!(window_label_for("c_abc123"), "pet-c_abc123");
        assert_eq!(companion_id_from_label("pet"), "main");
        assert_eq!(companion_id_from_label("pet-c_abc123"), "c_abc123");
        assert_eq!(companion_id_from_label("bogus"), "main");
        assert_eq!(companion_id_from_label("pet-!!!"), "main");
    }

    #[test]
    fn id_validation() {
        assert!(is_valid_companion_id("main"));
        assert!(is_valid_companion_id("c_abc123"));
        assert!(!is_valid_companion_id("main2"));
        assert!(!is_valid_companion_id("c_ABC"));
        assert!(!is_valid_companion_id("c_-x"));
        assert!(!is_valid_companion_id("../../etc"));
        assert!(!is_valid_companion_id(""));
    }

    #[test]
    fn registry_defaults_and_transitions() {
        let r = PetRegistry::default();
        assert_eq!(r.get("main"), PetState::Idle);
        assert_eq!(r.get("c_missing"), PetState::Idle); // fallback aman
        assert!(r.set("c_a1", PetState::from_str("walk").unwrap()).is_ok());
        // sleep hanya keluar via idle/react/attention/dragged
        assert!(r.set("c_a1", PetState::from_str("sleep").unwrap()).is_ok());
        assert!(r.set("c_a1", PetState::from_str("walk").unwrap()).is_err());
        assert!(r.set("c_a1", PetState::from_str("idle").unwrap()).is_ok());
        r.remove("c_a1");
        assert_eq!(r.get("c_a1"), PetState::Idle);
    }
}
