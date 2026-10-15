//! DeskPet Tauri entry (P1 foundation + P2–P4 local core).
//! Transparent pet window + tray/menu-bar controls + SQLite init.
//! Local-first: no network, no telemetry, no sensitive actions.

pub mod actions;
pub mod applog;
pub mod commands;
pub mod companions;
pub mod db;
pub mod pet;
pub mod settings;

use commands::{CurrentPetState, PetVisibility, SharedSettings};
use companions::PetRegistry;
use pet::PetState;
use settings::AppSettings;
use std::sync::Mutex;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, WindowEvent,
};

fn build_tray(app: &tauri::AppHandle) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "tray-show", "Show pet", true, None::<&str>)?;
    let hide = MenuItem::with_id(app, "tray-hide", "Hide pet", true, None::<&str>)?;
    let toggle_top = MenuItem::with_id(app, "tray-top", "Toggle always-on-top", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "tray-quit", "Quit DeskPet", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &hide, &toggle_top, &quit])?;

    // Single tray icon: built here in code (NOT via tauri.conf `trayIcon`,
    // otherwise Tauri auto-creates a second, dead icon next to this one).
    // Per-platform icon:
    // - macOS: monochrome template glyph so the menu bar stays black-white
    //   and auto-tints for light/dark mode.
    // - Windows/Linux: full-color cat. The template glyph renders there as
    //   an ugly flat-black blob, so it must NOT be used outside macOS.
    #[cfg(target_os = "macos")]
    const TRAY_ICON_BYTES: &[u8] = include_bytes!("../icons/tray-icon.png");
    #[cfg(not(target_os = "macos"))]
    const TRAY_ICON_BYTES: &[u8] = include_bytes!("../icons/64x64.png");
    #[cfg(target_os = "macos")]
    const TRAY_ICON_TEMPLATE: bool = true;
    #[cfg(not(target_os = "macos"))]
    const TRAY_ICON_TEMPLATE: bool = false;
    let mut tray_builder = TrayIconBuilder::new()
        .menu(&menu)
        .icon_as_template(TRAY_ICON_TEMPLATE);
    match tauri::image::Image::from_bytes(TRAY_ICON_BYTES) {
        Ok(icon) => {
            tray_builder = tray_builder.icon(icon);
        }
        Err(e) => {
            crate::applog::warn(
                app,
                &format!("tray icon load failed, using app icon: {e}"),
            );
            if let Some(icon) = app.default_window_icon() {
                tray_builder = tray_builder.icon(icon.clone());
            }
        }
    }
    let _tray = tray_builder
        .tooltip("DeskPet — local-first companion")
        .on_menu_event(|app, event| match event.id.as_ref() {
            "tray-show" => set_pet_visible(app, true),
            "tray-hide" => set_pet_visible(app, false),
            "tray-top" => {
                if let Some(w) = app.get_webview_window("pet") {
                    let cur = w.is_always_on_top().unwrap_or(true);
                    let _ = w.set_always_on_top(!cur);
                }
            }
            "tray-quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click { button, button_state, .. } = event {
                if button == MouseButton::Left && button_state == MouseButtonState::Up {
                    let app = tray.app_handle();
                    toggle_pet_visible(app);
                }
            }
        })
        .build(app)?;
    Ok(())
}

fn set_pet_visible(app: &tauri::AppHandle, visible: bool) {
    // Multi-pet (opsi B): tray Show/Hide berlaku ke SEMUA window `pet*`.
    for (label, w) in app.webview_windows() {
        if label == "pet" || label.starts_with("pet-") {
            let _ = if visible { w.show() } else { w.hide() };
        }
    }
    if let Some(v) = app.try_state::<PetVisibility>() {
        *v.0.lock().unwrap() = visible;
    }
    let _ = app.emit("deskpet://pet-visibility", visible);
}

fn toggle_pet_visible(app: &tauri::AppHandle) {
    let next = if let Some(v) = app.try_state::<PetVisibility>() {
        !*v.0.lock().unwrap()
    } else {
        true
    };
    set_pet_visible(app, next);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Init local DB early; failure must not crash the pet window.
    // Path resolution happens at runtime; errors are logged, not panicked.
    tauri::Builder::default()
        // Autostart (login items Windows / LaunchAgent macOS). Tanpa args
        // khusus; frontend mengatur enable/disable via plugin JS API.
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_opener::init())
        .manage(PetVisibility(Mutex::new(true)))
        .manage(CurrentPetState(Mutex::new(PetState::Idle)))
        .manage(PetRegistry::default())
        .manage(SharedSettings(Mutex::new(AppSettings::default())))
        .invoke_handler(tauri::generate_handler![
            commands::pet_get_state,
            commands::pet_set_state,
            commands::pet_get_state_of,
            commands::pet_set_state_of,
            commands::companions_list,
            commands::companions_spawn,
            commands::companions_despawn,
            commands::companions_owner_of,
            commands::pet_is_visible,
            commands::pet_set_visible,
            commands::settings_get,
            commands::settings_update,
            commands::frontend_settings_get,
            commands::frontend_settings_put,
            commands::backup_export,
            commands::log_path,
            commands::log_read,
            commands::log_clear,
            commands::log_write,
            commands::prayer_cache_get,
            commands::prayer_cache_put,
            commands::app_health,
            commands::action_validate,
            commands::audit_log,
            commands::app_quit,
        ])
        .setup(|app| {
            // Best-effort local DB init (local-first, no telemetry).
            if let Ok(mut dir) = app.path().app_local_data_dir() {
                dir.push("deskpet.db");
                if let Err(e) = db::open_and_migrate(&dir) {
                    crate::applog::warn(app.handle(), &format!("db init failed (non-fatal in P1): {e}"));
                }
            }
            if let Err(e) = build_tray(app.handle()) {
                // Tray unsupported on some Linux/window managers; pet must still work.
                crate::applog::warn(app.handle(), &format!("tray init failed (non-fatal): {e}"));
            }
            // Keyboard shortcut path: frontend listens for CmdOrCtrl+Shift+D
            // to toggle visibility; also exposed via tray menu.
            Ok(())
        })
        .on_window_event(|window, event| {
            // Dragging the pet must not leak clicks behind it (PRD §5.1):
            // frontend uses drag-region; Rust keeps window frameless.
            if let WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "pet" || window.label().starts_with("pet-") {
                    // Hide instead of quit so tray can restore.
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running DeskPet");
}
