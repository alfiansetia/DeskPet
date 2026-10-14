//! Action registry + permission engine (PRD §5.7). Rust is authoritative.
//! Allowlist only: unknown actions and invalid payloads are rejected.
//! No shell, no network, no direct DB/secret access from actions.

use serde::{Deserialize, Serialize};

/// Risk/permission class per PRD default policy table.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PermissionClass {
    ReadLocal,
    WriteLocal,
    Scheduled,
    ExternalRead,
    ExternalWrite,
    HighRisk,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ActionRequest {
    #[serde(rename = "reminder.create")]
    ReminderCreate { title: String, #[serde(rename = "dueAt")] due_at: String, timezone: String },
    #[serde(rename = "todo.create")]
    TodoCreate { title: String, #[serde(rename = "dueAt")] due_at: Option<String> },
    #[serde(rename = "note.create")]
    NoteCreate { title: String, content: String },
    #[serde(rename = "timer.start")]
    TimerStart { #[serde(rename = "durationSeconds")] duration_seconds: i64 },
    #[serde(rename = "tasks.query")]
    TasksQuery { scope: String },
    #[serde(rename = "calendar.create")]
    CalendarCreate { title: String, #[serde(rename = "startAt")] start_at: String, #[serde(rename = "endAt")] end_at: String },
}

impl ActionRequest {
    pub fn id(&self) -> &'static str {
        match self {
            ActionRequest::ReminderCreate { .. } => "reminder.create",
            ActionRequest::TodoCreate { .. } => "todo.create",
            ActionRequest::NoteCreate { .. } => "note.create",
            ActionRequest::TimerStart { .. } => "timer.start",
            ActionRequest::TasksQuery { .. } => "tasks.query",
            ActionRequest::CalendarCreate { .. } => "calendar.create",
        }
    }

    pub fn permission(&self) -> PermissionClass {
        match self {
            ActionRequest::TasksQuery { .. } => PermissionClass::ReadLocal,
            ActionRequest::TodoCreate { .. } | ActionRequest::NoteCreate { .. } => PermissionClass::WriteLocal,
            ActionRequest::ReminderCreate { .. } | ActionRequest::TimerStart { .. } => PermissionClass::Scheduled,
            ActionRequest::CalendarCreate { .. } => PermissionClass::WriteLocal,
        }
    }

    /// External writes always need preview+confirm; calendar create is local so confirm is advisory.
    pub fn needs_confirm(&self) -> bool {
        matches!(self, ActionRequest::CalendarCreate { .. })
    }

    pub fn validate(&self) -> Result<(), String> {
        match self {
            ActionRequest::ReminderCreate { title, due_at, timezone } => {
                let t = title.trim();
                if t.is_empty() { return Err("reminder title must not be empty".into()); }
                if t.len() > 200 { return Err("reminder title too long (max 200)".into()); }
                chrono::DateTime::parse_from_rfc3339(due_at).map_err(|_| "reminder dueAt must be RFC3339".to_string())?;
                if timezone.trim().is_empty() { return Err("timezone must not be empty".into()); }
                // IANA check: must contain '/' or be UTC
                if !timezone.contains('/') && timezone != "UTC" {
                    return Err("timezone must be IANA (e.g. Asia/Jakarta) or UTC".into());
                }
                Ok(())
            }
            ActionRequest::TodoCreate { title, due_at } => {
                if title.trim().is_empty() { return Err("todo title must not be empty".into()); }
                if title.len() > 200 { return Err("todo title too long".into()); }
                if let Some(d) = due_at {
                    chrono::DateTime::parse_from_rfc3339(d).map_err(|_| "todo dueAt must be RFC3339".to_string())?;
                }
                Ok(())
            }
            ActionRequest::NoteCreate { title, content } => {
                if title.len() > 200 { return Err("note title too long".into()); }
                if content.len() > 20000 { return Err("note content too long (max 20000)".into()); }
                Ok(())
            }
            ActionRequest::TimerStart { duration_seconds } => {
                if *duration_seconds <= 0 || *duration_seconds > 43200 {
                    return Err("timer duration must be 1..43200 seconds".into());
                }
                Ok(())
            }
            ActionRequest::TasksQuery { scope } => {
                if !["today", "all", "overdue"].contains(&scope.as_str()) {
                    return Err("unknown tasks.query scope".into());
                }
                Ok(())
            }
            ActionRequest::CalendarCreate { title, start_at, end_at } => {
                if title.trim().is_empty() { return Err("event title must not be empty".into()); }
                let s = chrono::DateTime::parse_from_rfc3339(start_at).map_err(|_| "startAt must be RFC3339".to_string())?;
                let e = chrono::DateTime::parse_from_rfc3339(end_at).map_err(|_| "endAt must be RFC3339".to_string())?;
                if e <= s { return Err("endAt must be after startAt".into()); }
                Ok(())
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn reminder() -> ActionRequest {
        ActionRequest::ReminderCreate {
            title: "Deploy".into(),
            due_at: "2026-10-15T09:00:00Z".into(),
            timezone: "Asia/Jakarta".into(),
        }
    }

    #[test]
    fn valid_actions_pass() {
        assert!(reminder().validate().is_ok());
        assert!(ActionRequest::TimerStart { duration_seconds: 1500 }.validate().is_ok());
        assert!(ActionRequest::TodoCreate { title: "x".into(), due_at: None }.validate().is_ok());
    }

    #[test]
    fn empty_titles_rejected() {
        assert!(ActionRequest::TodoCreate { title: "  ".into(), due_at: None }.validate().is_err());
        assert!(ActionRequest::NoteCreate { title: "".into(), content: "x".repeat(20001) }.validate().is_err());
    }

    #[test]
    fn bad_timestamps_rejected() {
        assert!(ActionRequest::ReminderCreate { title: "x".into(), due_at: "besok".into(), timezone: "Asia/Jakarta".into() }.validate().is_err());
        assert!(ActionRequest::TimerStart { duration_seconds: 0 }.validate().is_err());
        assert!(ActionRequest::TimerStart { duration_seconds: 999999 }.validate().is_err());
    }

    #[test]
    fn bad_timezone_rejected() {
        assert!(ActionRequest::ReminderCreate { title: "x".into(), due_at: "2026-10-15T09:00:00Z".into(), timezone: "Jakarta".into() }.validate().is_err());
    }

    #[test]
    fn unknown_json_shape_rejected() {
        let v: Result<ActionRequest, _> = serde_json::from_str(r#"{"type":"shell.exec","cmd":"rm -rf /"}"#);
        assert!(v.is_err(), "allowlist must reject unknown action types");
    }

    #[test]
    fn permission_classes_match_policy() {
        assert_eq!(reminder().permission(), PermissionClass::Scheduled);
        assert_eq!(ActionRequest::TasksQuery { scope: "today".into() }.permission(), PermissionClass::ReadLocal);
    }
}
