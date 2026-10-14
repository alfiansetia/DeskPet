//! Privacy + display defaults (PRD §9). Local-first, no telemetry.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AppSettings {
    /// Telemetry is ALWAYS off; no opt-in path exists (PRD §9 must-have).
    pub telemetry_enabled: bool,
    pub always_on_top: bool,
    pub reduced_motion: bool,
    pub sound_muted: bool,
    pub speech_muted: bool,
    pub click_through_when_idle: bool,
    pub character_id: String,
    #[serde(default = "default_true")]
    pub wander_enabled: bool,
    #[serde(default = "default_true")]
    pub quiet_hours_enabled: bool,
    #[serde(default = "default_quiet_start")]
    pub quiet_start: u8,
    #[serde(default = "default_quiet_end")]
    pub quiet_end: u8,
}

fn default_true() -> bool { true }
fn default_quiet_start() -> u8 { 22 }
fn default_quiet_end() -> u8 { 7 }

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            telemetry_enabled: false,
            always_on_top: true,
            reduced_motion: false,
            sound_muted: false,
            speech_muted: false,
            click_through_when_idle: false,
            character_id: "deskpet.cat.lavender".to_string(),
            wander_enabled: true,
            quiet_hours_enabled: true,
            quiet_start: 22,
            quiet_end: 7,
        }
    }
}

impl AppSettings {
    /// Guard: telemetry must never default on.
    pub fn validate(&self) -> Result<(), String> {
        if self.telemetry_enabled {
            return Err("telemetry_enabled must be false in P1 (no telemetry)".to_string());
        }
        if self.character_id.trim().is_empty() {
            return Err("character_id must not be empty".to_string());
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_are_local_first_private() {
        let s = AppSettings::default();
        assert!(!s.telemetry_enabled);
        assert!(s.validate().is_ok());
    }

    #[test]
    fn telemetry_cannot_be_enabled_in_p1() {
        let mut s = AppSettings::default();
        s.telemetry_enabled = true;
        assert!(s.validate().is_err());
    }

    #[test]
    fn empty_character_rejected() {
        let mut s = AppSettings::default();
        s.character_id = "  ".to_string();
        assert!(s.validate().is_err());
    }
}
