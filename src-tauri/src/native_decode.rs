use std::path::Path;

/// Whether this platform can decode HEIC/AVIF input at all; used to keep
/// unsupported formats out of the ingest sniffer and the file dialog.
pub fn decode_supported() -> bool {
    cfg!(target_os = "macos")
}

/// Decode HEIC/AVIF into a lossless PNG using macOS ImageIO via `sips`
/// (hardware HEVC decode on Apple Silicon, patent royalties covered by
/// the OS, EXIF/ICC carried into the PNG).
#[cfg(target_os = "macos")]
pub fn decode_to_png(source: &Path, dest: &Path) -> Result<(), String> {
    let output = std::process::Command::new("sips")
        .args(["-s", "format", "png"])
        .arg(source)
        .arg("--out")
        .arg(dest)
        .output()
        .map_err(|e| format!("failed to run sips: {e}"))?;

    if !output.status.success() {
        return Err(format!(
            "sips failed: {}",
            String::from_utf8_lossy(&output.stdout)
        ));
    }

    let size = std::fs::metadata(dest).map(|m| m.len()).unwrap_or(0);
    if size == 0 {
        return Err("sips produced an empty file".into());
    }

    Ok(())
}

/// TODO(win/linux): WIC + HEIF extension on Windows, or a webview-side
/// libheif-js fallback; until then HEIC/AVIF input is macOS-only.
#[cfg(not(target_os = "macos"))]
pub fn decode_to_png(_source: &Path, _dest: &Path) -> Result<(), String> {
    Err("HEIC/AVIF input is currently only supported on macOS".into())
}
