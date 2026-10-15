// Prevents an extra console window on Windows in release builds.
// (Debug builds keep the console so `eprintln!` logs stay visible.)
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    deskpet_lib::run();
}
