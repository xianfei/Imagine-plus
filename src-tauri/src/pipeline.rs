use std::fs;
use std::io::BufWriter;

use image::codecs::jpeg::JpegEncoder;
use image::codecs::png::PngEncoder;
use image::imageops::FilterType;
use image::DynamicImage;
use md5::{Digest, Md5};

use crate::files::{get_file_path, tmpdir};
use crate::types::{ImageFile, OptimizeOptions, ResizeOptions};

/// Phase 1 pipeline based on the `image` crate: covers png/jpg/webp/bmp.
/// Phase 2 replaces the codecs with mozjpeg/imagequant-class encoders and
/// adds avif/heic support plus metadata preservation.
pub fn optimize(image_file: &ImageFile, options: &OptimizeOptions) -> Result<ImageFile, String> {
    let source_path = get_file_path(&image_file.id, &image_file.ext);

    let options_json = serde_json::to_string(options).map_err(|e| e.to_string())?;
    let optimized_id = hex::encode(Md5::digest(format!("{}{}", image_file.id, options_json)));

    let mut export_ext = options
        .export_ext
        .clone()
        .unwrap_or_else(|| image_file.ext.clone());
    if export_ext == "heic" || export_ext == "bmp" {
        export_ext = "jpg".to_string();
    }

    let dest_path = tmpdir().join(format!("{optimized_id}.{export_ext}"));

    log::info!(
        "optimize [{}]{} to [{}]{}",
        image_file.ext,
        source_path.display(),
        export_ext,
        dest_path.display()
    );

    let mut dest = ImageFile {
        id: optimized_id,
        url: dest_path.to_string_lossy().into_owned(),
        size: 0,
        ext: export_ext.clone(),
        original_name: image_file.original_name.clone(),
        source_preview_url: None,
    };

    // content-addressed cache hit: same input + options already encoded
    if let Ok(meta) = fs::metadata(&dest_path) {
        dest.size = meta.len();
        return Ok(dest);
    }

    if image_file.ext == "heic" || image_file.ext == "avif" {
        return Err(format!(
            "{} input is not supported yet by the Rust pipeline (Phase 2)",
            image_file.ext
        ));
    }

    let mut img = image::open(&source_path).map_err(|e| e.to_string())?;

    if let Some(resize) = &options.resize {
        if resize.enabled {
            img = apply_resize(img, resize);
        }
    }

    match export_ext.as_str() {
        "jpg" => {
            let quality = options.quality.unwrap_or(70);
            let file = fs::File::create(&dest_path).map_err(|e| e.to_string())?;
            let encoder = JpegEncoder::new_with_quality(BufWriter::new(file), quality);
            img.to_rgb8()
                .write_with_encoder(encoder)
                .map_err(|e| e.to_string())?;
        }
        "png" => {
            let file = fs::File::create(&dest_path).map_err(|e| e.to_string())?;
            let encoder = PngEncoder::new(BufWriter::new(file));
            img.write_with_encoder(encoder).map_err(|e| e.to_string())?;
        }
        "webp" => {
            let quality = options.quality.unwrap_or(80) as f32;
            let rgba = img.to_rgba8();
            let encoder = webp::Encoder::from_rgba(&rgba, rgba.width(), rgba.height());
            let memory = encoder.encode(quality);
            fs::write(&dest_path, &*memory).map_err(|e| e.to_string())?;
        }
        other => {
            return Err(format!(
                "{other} output is not supported yet by the Rust pipeline (Phase 2)"
            ));
        }
    }

    dest.size = fs::metadata(&dest_path).map_err(|e| e.to_string())?.len();

    Ok(dest)
}

/// Port of `applyResize` in modules/optimizers/index.ts.
fn apply_resize(img: DynamicImage, resize: &ResizeOptions) -> DynamicImage {
    let (width, height) = (img.width(), img.height());
    let value = resize.value;

    match resize.mode.as_str() {
        "LONG_EDGE" => {
            // fit inside value x value, never enlarging
            if width.max(height) > value {
                img.resize(value, value, FilterType::Lanczos3)
            } else {
                img
            }
        }
        "SHORT_EDGE" => {
            let short = width.min(height);
            if short > value {
                let scale = value as f64 / short as f64;
                img.resize_exact(
                    (width as f64 * scale).round() as u32,
                    (height as f64 * scale).round() as u32,
                    FilterType::Lanczos3,
                )
            } else {
                img
            }
        }
        // SCALE: value is a percentage (e.g. 50 = 50%)
        _ => {
            let factor = value as f64 / 100.0;
            if (factor - 1.0).abs() > f64::EPSILON {
                img.resize_exact(
                    ((width as f64 * factor).round() as u32).max(1),
                    ((height as f64 * factor).round() as u32).max(1),
                    FilterType::Lanczos3,
                )
            } else {
                img
            }
        }
    }
}
