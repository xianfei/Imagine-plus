use tauri::menu::{Menu, MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder};
use tauri::{AppHandle, Runtime};

use crate::types::BackendState;

pub const APP_NAME: &str = "ImaginePlus";

fn label(state: &BackendState, key: &str, default: &str) -> String {
    state
        .labels
        .get(key)
        .cloned()
        .unwrap_or_else(|| default.to_string())
}

/// Port of AppMenu.render(): rebuilt on every SYNC with localized labels
/// supplied by the renderer (English until the first sync arrives).
pub fn build_menu<R: Runtime>(
    app: &AppHandle<R>,
    state: &BackendState,
) -> tauri::Result<Menu<R>> {
    let about = MenuItemBuilder::with_id("about", label(state, "about", "About"))
        .build(app)?;
    let quit = PredefinedMenuItem::quit(app, None)?;

    let app_menu = SubmenuBuilder::new(app, APP_NAME)
        .item(&about)
        .separator()
        .item(&quit)
        .build()?;

    let open = MenuItemBuilder::with_id("open", label(state, "open", "Open"))
        .accelerator("CmdOrCtrl+O")
        .build(app)?;

    let mut file_menu = SubmenuBuilder::new(app, label(state, "file", "File")).item(&open);

    if state.task_count > 0 {
        let save = MenuItemBuilder::with_id("save_over", label(state, "save", "Save"))
            .accelerator("CmdOrCtrl+S")
            .build(app)?;
        file_menu = file_menu.item(&save);

        if state.alone_mode {
            let save_as =
                MenuItemBuilder::with_id("save_as", label(state, "save_as", "Save as"))
                    .build(app)?;
            file_menu = file_menu.item(&save_as);
        } else {
            let save_new =
                MenuItemBuilder::with_id("save_new", label(state, "save_new", "Save (new name)"))
                    .build(app)?;
            let save_dir =
                MenuItemBuilder::with_id("save_dir", label(state, "save_dir", "Save to folder"))
                    .build(app)?;
            file_menu = file_menu.item(&save_new).item(&save_dir);
        }
    }

    let file_menu = file_menu.build()?;

    MenuBuilder::new(app)
        .item(&app_menu)
        .item(&file_menu)
        .build()
}
