use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;

use serde_json::Value;
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons};

use crate::config_store::ConfigStore;
use crate::files;
use crate::menu;
use crate::pipeline;
use crate::types::{BackendState, ImageFile, OptimizeOptions, SaveType};

pub struct AppState {
    pub config: ConfigStore,
    pub ready: AtomicBool,
    pub pending: Mutex<Vec<ImageFile>>,
    pub menu_state: Mutex<BackendState>,
}

/// Ingest files/dirs (drag-drop, dialog, argv, file association) and either
/// push them to the renderer or queue them until it signals READY.
pub fn receive_files(app: &AppHandle, paths: Vec<String>) {
    let app = app.clone();

    tauri::async_runtime::spawn_blocking(move || {
        let files = files::flatten_files(&paths);
        let images = files::save_files_tmp(&files);

        if images.is_empty() {
            return;
        }

        let state = app.state::<AppState>();
        // the ready check and the pending insert must be atomic with the
        // drain in `ready`, or files ingested around READY are lost
        let emit_now = {
            let mut pending = state.pending.lock().unwrap();
            if state.ready.load(Ordering::SeqCst) {
                true
            } else {
                pending.extend(images.iter().cloned());
                false
            }
        };

        if emit_now {
            let _ = app.emit("FILE_SELECTED", &images);
        }
    });
}

/// READY also carries the localized menu labels (setupLocales has run by
/// then), so the menu switches from the English defaults immediately.
#[tauri::command]
pub fn ready(
    app: AppHandle,
    state: State<'_, AppState>,
    labels: std::collections::HashMap<String, String>,
) {
    let menu_state = {
        let mut menu_state = state.menu_state.lock().unwrap();
        menu_state.labels = labels;
        menu_state.clone()
    };

    let handle = app.clone();
    let _ = app.run_on_main_thread(move || {
        if let Ok(menu) = menu::build_menu(&handle, &menu_state) {
            let _ = handle.set_menu(menu);
        }
    });

    let pending: Vec<ImageFile> = {
        let mut pending = state.pending.lock().unwrap();
        state.ready.store(true, Ordering::SeqCst);
        pending.drain(..).collect()
    };
    if !pending.is_empty() {
        let _ = app.emit("FILE_SELECTED", &pending);
    }
}

#[tauri::command]
pub fn file_add(app: AppHandle, files: Vec<String>) {
    receive_files(&app, files);
}

/// Port of AppMenu.open(): file picker with image filters.
#[tauri::command]
pub fn file_select(app: AppHandle) {
    let handle = app.clone();

    let mut extensions = vec!["jpg", "jpeg", "png", "webp", "bmp"];
    if crate::native_decode::decode_supported() {
        extensions.extend(["avif", "heic"]);
    }

    app.dialog()
        .file()
        .add_filter("Images", &extensions)
        .pick_files(move |paths| {
            if let Some(paths) = paths {
                let list: Vec<String> = paths
                    .into_iter()
                    .filter_map(|p| p.into_path().ok())
                    .map(|p| p.to_string_lossy().into_owned())
                    .collect();
                receive_files(&handle, list);
            }
        });
}

/// Folder import: Electron's Open dialog allowed picking directories on
/// macOS; tauri-plugin-dialog cannot mix files and folders, so folders get
/// their own dialog (wired to an extra menu item).
#[tauri::command]
pub fn folder_select(app: AppHandle) {
    let handle = app.clone();

    app.dialog().file().pick_folders(move |folders| {
        if let Some(folders) = folders {
            let list: Vec<String> = folders
                .into_iter()
                .filter_map(|p| p.into_path().ok())
                .map(|p| p.to_string_lossy().into_owned())
                .collect();
            receive_files(&handle, list);
        }
    });
}

#[tauri::command]
pub async fn optimize(
    image: ImageFile,
    options: OptimizeOptions,
    state: State<'_, AppState>,
) -> Result<ImageFile, String> {
    let mut options = options;
    options.keep_metadata = Some(state.config.get_bool("keepmeta", true));
    options.progressive = Some(state.config.get_bool("progressive", true));

    tauri::async_runtime::spawn_blocking(move || pipeline::optimize(&image, &options))
        .await
        .map_err(|e| e.to_string())?
}

/// Port of handleIpcFileSave: dialogs + batch copy out of the tmp cache.
#[tauri::command]
pub async fn save(app: AppHandle, images: Vec<ImageFile>, save_type: SaveType) {
    match save_type {
        SaveType::NewDir => {
            app.dialog().file().pick_folder(move |folder| {
                let Some(folder) = folder else { return };
                let Ok(dir) = folder.into_path() else { return };

                let app2 = app.clone();
                tauri::async_runtime::spawn_blocking(move || {
                    files::save_files(&images, SaveType::NewDir, Some(&dir));
                    let _ = app2.emit("SAVED", ());
                    let _ = tauri_plugin_opener::open_path(&dir, None::<&str>);
                });
            });
        }
        SaveType::SaveAs => {
            let Some(image) = images.first().cloned() else { return };
            let default_name = files::reext(&image.original_name, &image.ext);

            app.dialog()
                .file()
                .set_file_name(
                    PathBuf::from(&default_name)
                        .file_name()
                        .map(|n| n.to_string_lossy().into_owned())
                        .unwrap_or(default_name),
                )
                .add_filter("Images", &[image.ext.clone().as_str()])
                .save_file(move |path| {
                    let Some(path) = path else { return };
                    let Ok(path) = path.into_path() else { return };
                    if files::save_file(&image, &path).is_ok() {
                        let _ = app.emit("SAVED", ());
                    }
                });
        }
        _ => {
            let app2 = app.clone();
            tauri::async_runtime::spawn_blocking(move || {
                files::save_files(&images, save_type, None);
                let _ = app2.emit("SAVED", ());
            })
            .await
            .ok();
        }
    }
}

/// Port of the SYNC channel: update menu state + rebuild the app menu.
#[tauri::command]
pub fn sync(app: AppHandle, state: State<'_, AppState>, backend_state: BackendState) {
    *state.menu_state.lock().unwrap() = backend_state.clone();

    // menu APIs must run on the main thread (muda requirement on macOS)
    let handle = app.clone();
    let _ = app.run_on_main_thread(move || {
        match menu::build_menu(&handle, &backend_state) {
            Ok(menu) => {
                if let Err(err) = handle.set_menu(menu) {
                    log::error!("failed to set menu: {err}");
                }
            }
            Err(err) => log::error!("failed to build menu: {err}"),
        }
    });
}

#[tauri::command]
pub fn store_get_all(state: State<'_, AppState>) -> Value {
    state.config.get_all()
}

#[tauri::command]
pub fn store_set(state: State<'_, AppState>, key: String, value: Value) {
    state.config.set(key, value);
}

/// Port of AppMenu.about(): info dialog with an OK and a Visit button.
pub fn show_about(app: &AppHandle) {
    let state = app.state::<AppState>();
    let (ok_label, visit_label) = {
        let menu_state = state.menu_state.lock().unwrap();
        (
            menu_state
                .labels
                .get("ok")
                .cloned()
                .unwrap_or_else(|| "OK".into()),
            menu_state
                .labels
                .get("visit")
                .cloned()
                .unwrap_or_else(|| "Visit".into()),
        )
    };

    let homepage = "https://github.com/xianfei/Imagine-plus";

    app.dialog()
        .message(format!(
            "Imagine v{}\n\nCreated by Meowtec & xianfei\n{homepage}",
            app.package_info().version
        ))
        .title(menu::APP_NAME)
        .buttons(MessageDialogButtons::OkCancelCustom(ok_label, visit_label))
        .show(move |ok| {
            if !ok {
                let _ = tauri_plugin_opener::open_url(homepage, None::<&str>);
            }
        });
}

#[tauri::command]
pub fn about(app: AppHandle) {
    show_about(&app);
}

#[tauri::command]
pub fn set_progress_bar(app: AppHandle, progress: f64) {
    use tauri::window::{ProgressBarState, ProgressBarStatus};

    let state = if progress < 0.0 {
        ProgressBarState {
            status: Some(ProgressBarStatus::None),
            progress: None,
        }
    } else {
        ProgressBarState {
            status: Some(ProgressBarStatus::Normal),
            progress: Some((progress * 100.0).clamp(0.0, 100.0) as u64),
        }
    };

    if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_progress_bar(state);
    }
}

#[tauri::command]
pub fn open_external(url: String) {
    if let Err(err) = tauri_plugin_opener::open_url(&url, None::<&str>) {
        log::error!("failed to open {url}: {err}");
    }
}
