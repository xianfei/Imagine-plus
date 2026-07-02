use serde::{Deserialize, Serialize};

pub const SUPPORTED_EXTS: [&str; 6] = ["png", "jpg", "webp", "avif", "heic", "bmp"];

/// Mirror of `IImageFile` in modules/common/types.ts.
/// `url` carries a plain absolute path; the frontend bridge converts it
/// with `convertFileSrc` before it reaches the Redux store.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageFile {
    pub id: String,
    pub url: String,
    pub size: u64,
    pub ext: String,
    pub original_name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_preview_url: Option<String>,
}

/// Mirror of `IResizeOptions`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResizeOptions {
    pub enabled: bool,
    pub mode: String,
    pub value: u32,
}

/// Mirror of `IOptimizeOptions`.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct OptimizeOptions {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub color: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub quality: Option<u8>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub export_ext: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub keep_metadata: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub progressive: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub resize: Option<ResizeOptions>,
}

/// Mirror of `IBackendState`, extended with localized menu labels so the
/// backend does not have to duplicate the frontend locale files.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct BackendState {
    pub task_count: usize,
    pub alone_mode: bool,
    #[serde(default)]
    pub labels: std::collections::HashMap<String, String>,
}

/// Mirror of `SaveType`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SaveType {
    #[serde(rename = "OVER")]
    Over,
    #[serde(rename = "NEW_NAME")]
    NewName,
    #[serde(rename = "NEW_DIR")]
    NewDir,
    #[serde(rename = "SAVE_AS")]
    SaveAs,
}
