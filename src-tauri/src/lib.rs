mod codecs;
mod commands;
mod config_store;
mod files;
mod menu;
mod metadata;
mod native_decode;
mod pipeline;
mod types;

use std::sync::atomic::AtomicBool;
use std::sync::Mutex;

use tauri::{Emitter, Manager};

use commands::AppState;
use config_store::ConfigStore;
use types::{BackendState, SaveType};

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
            }
            commands::receive_files(app, argv.into_iter().skip(1).collect());
        }))
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(log::LevelFilter::Info)
                .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            files::clean_tmpdir();

            let config_dir = app
                .path()
                .app_config_dir()
                .expect("cannot resolve app config dir");

            app.manage(AppState {
                config: ConfigStore::load(config_dir),
                ready: AtomicBool::new(false),
                pending: Mutex::new(Vec::new()),
                menu_state: Mutex::new(BackendState::default()),
            });

            let initial_menu = menu::build_menu(app.handle(), &BackendState::default())?;
            app.set_menu(initial_menu)?;

            app.on_menu_event(|app, event| match event.id().as_ref() {
                "about" => commands::show_about(app),
                "open" => commands::file_select(app.clone()),
                "open_folder" => commands::folder_select(app.clone()),
                "save_over" => {
                    let _ = app.emit("SAVE", SaveType::Over);
                }
                "save_new" => {
                    let _ = app.emit("SAVE", SaveType::NewName);
                }
                "save_dir" => {
                    let _ = app.emit("SAVE", SaveType::NewDir);
                }
                "save_as" => {
                    let _ = app.emit("SAVE", SaveType::SaveAs);
                }
                _ => {}
            });

            let mut win_builder = tauri::WebviewWindowBuilder::new(
                app,
                "main",
                tauri::WebviewUrl::default(),
            )
            .title(menu::APP_NAME)
            .inner_size(800.0, 600.0)
            .min_inner_size(540.0, 380.0);

            #[cfg(target_os = "macos")]
            {
                win_builder = win_builder
                    .title_bar_style(tauri::TitleBarStyle::Overlay)
                    .hidden_title(true)
                    .traffic_light_position(tauri::LogicalPosition::new(20.0, 17.0));
            }

            let window = win_builder.build()?;

            #[cfg(debug_assertions)]
            window.open_devtools();

            #[cfg(not(debug_assertions))]
            let _ = window;

            // files passed on first launch (Windows/Linux file associations, CLI)
            let argv_files: Vec<String> = std::env::args().skip(1).collect();
            if !argv_files.is_empty() {
                commands::receive_files(app.handle(), argv_files);
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::ready,
            commands::file_add,
            commands::file_select,
            commands::folder_select,
            commands::has_intermediate,
            commands::read_source,
            commands::write_intermediate,
            commands::optimize,
            commands::save,
            commands::sync,
            commands::store_get_all,
            commands::store_set,
            commands::about,
            commands::set_progress_bar,
            commands::open_external,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            // macOS file associations / "Open with" deliver files here
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Opened { urls } = event {
                let paths: Vec<String> = urls
                    .into_iter()
                    .filter_map(|url| url.to_file_path().ok())
                    .map(|p| p.to_string_lossy().into_owned())
                    .collect();
                commands::receive_files(app, paths);
            }

            #[cfg(not(target_os = "macos"))]
            {
                let _ = (app, event);
            }
        });
}
