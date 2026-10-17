pub mod commands;
pub mod engine;
pub mod labs;
pub mod linkmodel;
pub mod models;
pub mod netbits;
pub mod ros;

use commands::*;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            exec_command,
            simulate_flow,
            ping_test,
            bw_test,
            converge_routes,
            evaluate_lab,
            get_export_config,
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}
