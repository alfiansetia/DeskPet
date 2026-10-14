//! Pet state machine — authoritative definition of P1 animation states.
//! Mirrors PRD §5.1 initial states: idle, walk, dragged, react, sleep, speak,
//! reminder, attention.

use serde::{Deserialize, Serialize};

/// All animation states supported in P1.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum PetState {
    #[default]
    Idle,
    Walk,
    Dragged,
    React,
    Sleep,
    Speak,
    Reminder,
    Attention,
    Jump,
}

impl PetState {
    pub fn as_str(&self) -> &'static str {
        match self {
            PetState::Idle      => "idle",
            PetState::Walk      => "walk",
            PetState::Dragged   => "dragged",
            PetState::React     => "react",
            PetState::Sleep     => "sleep",
            PetState::Speak     => "speak",
            PetState::Reminder  => "reminder",
            PetState::Attention => "attention",
            PetState::Jump      => "jump",
        }
    }

    /// Whether the state is transient (auto-returns to idle after a timeout).
    /// Per PRD UX: never block the user with repeated attention-grabbing animation.
    pub fn is_transient(&self) -> bool {
        matches!(
            self,
            PetState::React | PetState::Speak | PetState::Reminder | PetState::Attention | PetState::Jump
        )
    }

    /// Validate a transition. Dragged can come from any state; sleep only
    /// exits via idle/react/attention; everything else is allowed but the
    /// caller should prefer returning transient states to idle.
    pub fn can_transition_to(&self, next: PetState) -> bool {
        if *self == next {
            return true;
        }
        // Dragging is always allowed (user grabs the pet).
        if next == PetState::Dragged {
            return true;
        }
        // Releasing a drag always lands on idle.
        if *self == PetState::Dragged && next == PetState::Idle {
            return true;
        }
        // Sleeping pet should be woken explicitly, not jump to walk/speak.
        if *self == PetState::Sleep {
            return matches!(
                next,
                PetState::Idle | PetState::React | PetState::Attention | PetState::Dragged
            );
        }
        true
    }
}

impl std::str::FromStr for PetState {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "idle"      => Ok(PetState::Idle),
            "walk"      => Ok(PetState::Walk),
            "dragged"   => Ok(PetState::Dragged),
            "react"     => Ok(PetState::React),
            "sleep"     => Ok(PetState::Sleep),
            "speak"     => Ok(PetState::Speak),
            "reminder"  => Ok(PetState::Reminder),
            "attention" => Ok(PetState::Attention),
            "jump"      => Ok(PetState::Jump),
            other => Err(format!("unknown pet state: {other}")),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::str::FromStr;

    #[test]
    fn all_prd_states_parse() {
        for s in ["idle", "walk", "dragged", "react", "sleep", "speak", "reminder", "attention", "jump"] {
            assert!(PetState::from_str(s).is_ok(), "state {s} should parse");
        }
    }

    #[test]
    fn unknown_state_rejected() {
        assert!(PetState::from_str("fly").is_err());
        assert!(PetState::from_str("").is_err());
    }

    #[test]
    fn drag_allowed_from_any_state() {
        for s in [PetState::Idle, PetState::Sleep, PetState::Walk, PetState::Speak] {
            assert!(s.can_transition_to(PetState::Dragged));
        }
    }

    #[test]
    fn sleep_exit_is_constrained() {
        assert!(PetState::Sleep.can_transition_to(PetState::Idle));
        assert!(!PetState::Sleep.can_transition_to(PetState::Walk));
        assert!(!PetState::Sleep.can_transition_to(PetState::Speak));
    }

    #[test]
    fn transient_states_flagged() {
        assert!(PetState::React.is_transient());
        assert!(PetState::Attention.is_transient());
        assert!(PetState::Jump.is_transient());
        assert!(!PetState::Idle.is_transient());
        assert!(!PetState::Sleep.is_transient());
    }
}
