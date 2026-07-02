use std::fs;
use std::path::{Path, PathBuf};

use md5::{Digest, Md5};

use crate::types::{ImageFile, SaveType, SUPPORTED_EXTS};

pub fn tmpdir() -> PathBuf {
    std::env::temp_dir().join("imagine")
}

pub fn clean_tmpdir() {
    let dir = tmpdir();
    let _ = fs::remove_dir_all(&dir);
    let _ = fs::create_dir_all(&dir);
}

pub fn get_file_path(id: &str, ext: &str) -> PathBuf {
    tmpdir().join(format!("{id}.{ext}"))
}

fn md5_hex(data: &[u8]) -> String {
    hex::encode(Md5::digest(data))
}

/// Sniff the real image type from content, normalized the way the
/// Electron backend (file-type) did: jpeg -> jpg, heif -> heic.
/// heic/avif are rejected on platforms without a native decoder.
fn sniff_ext(path: &Path) -> Option<String> {
    let kind = infer::get_from_path(path).ok()??;
    let ext = match kind.extension() {
        "jpg" | "jpeg" => "jpg",
        "heif" => "heic",
        other => other,
    };

    if matches!(ext, "heic" | "avif") && !crate::native_decode::decode_supported() {
        return None;
    }

    SUPPORTED_EXTS
        .contains(&ext)
        .then(|| ext.to_string())
}

/// Port of `flattenFiles`: walk a dir/file list into a flat file list.
pub fn flatten_files(paths: &[String]) -> Vec<PathBuf> {
    let mut list = Vec::new();

    for p in paths {
        let path = PathBuf::from(p);
        let Ok(meta) = fs::metadata(&path) else {
            log::error!("Failed to access file {p}");
            continue;
        };

        if meta.is_file() {
            list.push(path);
        } else if meta.is_dir() {
            if let Ok(entries) = fs::read_dir(&path) {
                let children: Vec<String> = entries
                    .flatten()
                    .map(|e| e.path().to_string_lossy().into_owned())
                    .collect();
                list.extend(flatten_files(&children));
            }
        }
    }

    list
}

/// Port of `saveFilesTmp`: sniff, content-address, copy into the tmp cache.
pub fn save_files_tmp(files: &[PathBuf]) -> Vec<ImageFile> {
    let mut result = Vec::new();

    for file in files {
        let Some(ext) = sniff_ext(file) else { continue };
        let Ok(content) = fs::read(file) else { continue };

        let path_str = file.to_string_lossy();
        let id = format!("{}{}", md5_hex(path_str.as_bytes()), md5_hex(&content));
        let size = content.len() as u64;

        let dest = get_file_path(&id, &ext);
        if fs::write(&dest, &content).is_err() {
            continue;
        }

        result.push(ImageFile {
            id,
            url: dest.to_string_lossy().into_owned(),
            size,
            ext,
            original_name: path_str.into_owned(),
            source_preview_url: None,
        });
    }

    result
}

/// Port of `reext`: swap the extension of the original name,
/// preserving an already-matching extension's case.
pub fn reext(filename: &str, ext: &str) -> String {
    let path = Path::new(filename);
    let current = path
        .extension()
        .map(|e| e.to_string_lossy().to_lowercase());

    match current.as_deref() {
        Some(cur) if cur == ext || (cur == "jpeg" && ext == "jpg") => filename.to_string(),
        // NB: 'jpeg' deliberately not included — the TS SupportedExt check
        // makes 'photo.jpeg' + png append ('photo.jpeg.png'), not replace
        Some(cur) if SUPPORTED_EXTS.contains(&cur) => path
            .with_extension(ext)
            .to_string_lossy()
            .into_owned(),
        _ => format!("{filename}.{ext}"),
    }
}

#[cfg(test)]
mod tests {
    use super::reext;

    #[test]
    fn reext_matches_ts_behavior() {
        assert_eq!(reext("a/photo.jpg", "jpg"), "a/photo.jpg");
        assert_eq!(reext("a/photo.JPG", "jpg"), "a/photo.JPG");
        assert_eq!(reext("a/photo.jpeg", "jpg"), "a/photo.jpeg");
        assert_eq!(reext("a/photo.jpg", "png"), "a/photo.png");
        assert_eq!(reext("a/photo.jpeg", "png"), "a/photo.jpeg.png");
        assert_eq!(reext("a/photo.tiff", "png"), "a/photo.tiff.png");
        assert_eq!(reext("a/photo", "png"), "a/photo.png");
    }
}

/// Port of `unoccupiedFile`: `/path/to/a.png` -> `/path/to/a(1).png` ...
pub fn unoccupied_file(file_path: &Path) -> PathBuf {
    if !file_path.exists() {
        return file_path.to_path_buf();
    }

    let stem = file_path
        .file_stem()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_default();
    let ext = file_path
        .extension()
        .map(|e| format!(".{}", e.to_string_lossy()))
        .unwrap_or_default();
    let dir = file_path.parent().unwrap_or_else(|| Path::new(""));

    for index in 1.. {
        let candidate = dir.join(format!("{stem}({index}){ext}"));
        if !candidate.exists() {
            return candidate;
        }
    }

    unreachable!()
}

/// Port of `saveFiles`: copy optimized files out of the tmp cache.
/// Per-file copy errors are logged but do not abort the batch,
/// matching the Electron behavior.
pub fn save_files(images: &[ImageFile], save_type: SaveType, dirname: Option<&Path>) {
    for image in images {
        let mut save_path = PathBuf::from(reext(&image.original_name, &image.ext));

        match save_type {
            SaveType::Over => {}
            SaveType::NewName => {
                save_path = unoccupied_file(&save_path);
            }
            SaveType::NewDir => {
                let Some(dir) = dirname else { return };
                let name = save_path.file_name().map(PathBuf::from).unwrap_or_default();
                save_path = unoccupied_file(&dir.join(name));
            }
            SaveType::SaveAs => {}
        }

        let src = get_file_path(&image.id, &image.ext);
        if let Err(err) = fs::copy(&src, &save_path) {
            log::error!("failed to save {}: {err}", save_path.display());
        }
    }
}

pub fn save_file(image: &ImageFile, file_path: &Path) -> Result<(), String> {
    let src = get_file_path(&image.id, &image.ext);
    fs::copy(&src, file_path)
        .map(|_| ())
        .map_err(|e| e.to_string())
}
