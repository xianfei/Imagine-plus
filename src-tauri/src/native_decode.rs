use std::path::Path;

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

/// Non-macOS platforms decode in the webview instead (libheif-js WASM for
/// HEIC, canvas for AVIF) and deliver raw RGBA through the
/// `write_intermediate` command before optimize runs; reaching this stub
/// means that fallback did not produce the intermediate.
#[cfg(not(target_os = "macos"))]
pub fn decode_to_png(_source: &Path, _dest: &Path) -> Result<(), String> {
    Err("HEIC/AVIF decode fallback did not run (missing intermediate)".into())
}
