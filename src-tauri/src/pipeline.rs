use std::fs;
use std::path::PathBuf;

use image::RgbaImage;
use md5::{Digest, Md5};

use crate::codecs;
use crate::files::{get_file_path, tmpdir};
use crate::metadata::{self, Meta};
use crate::native_decode;
use crate::types::{ImageFile, OptimizeOptions, ResizeOptions};

/// Full port of modules/backend/optimize.ts + modules/optimizers/index.ts:
/// mozjpeg (quality/progressive), quantized PNG (colors), libwebp, ravif
/// AVIF, HEIC/AVIF input via macOS ImageIO, EXIF/ICC preservation, SIMD
/// Lanczos3 resize with the three resize modes.
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

    // webviews cannot render HEIC: the decoded PNG intermediate doubles
    // as the source preview (same contract as the Electron backend)
    let intermediate: Option<PathBuf> = matches!(image_file.ext.as_str(), "heic" | "avif")
        .then(|| tmpdir().join(format!("{}.1.png", image_file.id)));
    let wants_preview = image_file.ext == "heic";

    // content-addressed cache hit: same input + options already encoded
    if let Ok(meta) = fs::metadata(&dest_path) {
        dest.size = meta.len();
        if wants_preview {
            if let Some(inter) = &intermediate {
                if inter.exists() {
                    dest.source_preview_url = Some(inter.to_string_lossy().into_owned());
                }
            }
        }
        return Ok(dest);
    }

    // decode (via the ImageIO PNG intermediate for heic/avif)
    let decode_path = if let Some(inter) = &intermediate {
        if !inter.exists() {
            native_decode::decode_to_png(&source_path, inter)?;
        }
        if wants_preview {
            dest.source_preview_url = Some(inter.to_string_lossy().into_owned());
        }
        inter.clone()
    } else {
        source_path
    };

    let source_bytes = fs::read(&decode_path).map_err(|e| e.to_string())?;

    let keep_metadata = options.keep_metadata.unwrap_or(true);
    let meta: Meta = if keep_metadata {
        metadata::extract(&source_bytes)
    } else {
        Meta::default()
    };

    let img = image::load_from_memory(&source_bytes).map_err(|e| e.to_string())?;
    let mut rgba = img.into_rgba8();

    if let Some(resize) = &options.resize {
        if resize.enabled {
            rgba = apply_resize(rgba, resize)?;
        }
    }

    let progressive = options.progressive.unwrap_or(true);

    let encoded = match export_ext.as_str() {
        "jpg" => {
            let quality = options.quality.unwrap_or(70);
            let bytes = codecs::encode_jpeg(&rgba, quality, progressive)?;
            metadata::embed(bytes, &meta)
        }
        "png" => {
            let colors = options.color.unwrap_or(256);
            let bytes = codecs::encode_png(&rgba, colors)?;
            metadata::embed(bytes, &meta)
        }
        "webp" => {
            let quality = options.quality.unwrap_or(80);
            let bytes = codecs::encode_webp(&rgba, quality)?;
            metadata::embed(bytes, &meta)
        }
        "avif" => {
            let quality = options.quality.unwrap_or(50);
            // AVIF cannot carry the ICC profile (ravif limitation): convert
            // the pixels to sRGB instead so colors still match the source
            if let Some(icc) = &meta.icc {
                convert_to_srgb(&mut rgba, icc);
            }
            codecs::encode_avif(&rgba, quality, meta.exif.as_deref())?
        }
        other => {
            return Err(format!("Unsupported file format: {other}"));
        }
    };

    fs::write(&dest_path, &encoded).map_err(|e| e.to_string())?;
    dest.size = encoded.len() as u64;

    Ok(dest)
}

/// In-place ICC -> sRGB pixel conversion via qcms (Firefox's CMS).
/// No-ops when the profile fails to parse or already is sRGB-like.
fn convert_to_srgb(rgba: &mut RgbaImage, icc: &[u8]) {
    let Some(input) = qcms::Profile::new_from_slice(icc, false) else {
        return;
    };
    let output = qcms::Profile::new_sRGB();

    let Some(transform) = qcms::Transform::new(
        &input,
        &output,
        qcms::DataType::RGBA8,
        qcms::Intent::Perceptual,
    ) else {
        return;
    };

    transform.apply(rgba.as_mut());
}

/// Port of `applyResize` in modules/optimizers/index.ts, on top of
/// fast_image_resize.
fn apply_resize(rgba: RgbaImage, resize: &ResizeOptions) -> Result<RgbaImage, String> {
    let (width, height) = rgba.dimensions();
    let value = resize.value.max(1);

    let (new_width, new_height) = match resize.mode.as_str() {
        "LONG_EDGE" => {
            // fit inside value x value, never enlarging
            let long = width.max(height);
            if long <= value {
                return Ok(rgba);
            }
            let scale = value as f64 / long as f64;
            scaled(width, height, scale)
        }
        "SHORT_EDGE" => {
            let short = width.min(height);
            if short <= value {
                return Ok(rgba);
            }
            let scale = value as f64 / short as f64;
            scaled(width, height, scale)
        }
        // SCALE: value is a percentage (e.g. 50 = 50%)
        _ => {
            let factor = value as f64 / 100.0;
            if (factor - 1.0).abs() < f64::EPSILON {
                return Ok(rgba);
            }
            scaled(width, height, factor)
        }
    };

    codecs::resize(rgba, new_width, new_height)
}

fn scaled(width: u32, height: u32, scale: f64) -> (u32, u32) {
    (
        ((width as f64 * scale).round() as u32).max(1),
        ((height as f64 * scale).round() as u32).max(1),
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::files;
    use image::Rgba;

    /// deterministic gradient + pseudo-noise so codecs do real work
    fn test_image(width: u32, height: u32) -> RgbaImage {
        let mut seed = 0x12345678u32;
        RgbaImage::from_fn(width, height, |x, y| {
            seed = seed.wrapping_mul(1664525).wrapping_add(1013904223);
            let noise = (seed >> 24) as u8;
            Rgba([
                ((x * 255) / width) as u8,
                ((y * 255) / height) as u8,
                noise,
                255,
            ])
        })
    }

    fn ingest(img: &RgbaImage, ext: &str, id: &str) -> ImageFile {
        let _ = std::fs::create_dir_all(tmpdir());
        let path = get_file_path(id, ext);
        img.save(&path).expect("save test input");
        ImageFile {
            id: id.to_string(),
            url: path.to_string_lossy().into_owned(),
            size: std::fs::metadata(&path).unwrap().len(),
            ext: ext.to_string(),
            original_name: format!("/tmp/test-source.{ext}"),
            source_preview_url: None,
        }
    }

    fn resize_opts(mode: &str, value: u32) -> ResizeOptions {
        ResizeOptions {
            enabled: true,
            mode: mode.to_string(),
            value,
        }
    }

    #[test]
    fn jpg_with_long_edge_resize() {
        let src = ingest(&test_image(800, 600), "png", "t-jpg-src");
        let options = OptimizeOptions {
            quality: Some(80),
            export_ext: Some("jpg".into()),
            resize: Some(resize_opts("LONG_EDGE", 400)),
            ..Default::default()
        };

        let out = optimize(&src, &options).expect("jpg optimize");
        let decoded = image::open(files::get_file_path(&out.id, &out.ext)).unwrap();
        assert_eq!((decoded.width(), decoded.height()), (400, 300));
        assert!(out.size > 0);
    }

    #[test]
    fn long_edge_never_enlarges() {
        let src = ingest(&test_image(300, 200), "png", "t-noenlarge");
        let options = OptimizeOptions {
            export_ext: Some("jpg".into()),
            resize: Some(resize_opts("LONG_EDGE", 4000)),
            ..Default::default()
        };

        let out = optimize(&src, &options).expect("optimize");
        let decoded = image::open(files::get_file_path(&out.id, &out.ext)).unwrap();
        assert_eq!((decoded.width(), decoded.height()), (300, 200));
    }

    #[test]
    fn png_palette_quantization() {
        let src = ingest(&test_image(320, 240), "png", "t-png-src");
        let options = OptimizeOptions {
            color: Some(64),
            export_ext: Some("png".into()),
            ..Default::default()
        };

        let out = optimize(&src, &options).expect("png optimize");
        let bytes = std::fs::read(files::get_file_path(&out.id, &out.ext)).unwrap();
        // palette PNG: color type 3 at byte 25 of the IHDR
        assert_eq!(bytes[25], 3, "expected indexed-color PNG");
        assert!(out.size < src.size, "quantized PNG should shrink");
    }

    #[test]
    fn webp_and_avif_encode() {
        let src = ingest(&test_image(320, 240), "png", "t-multi-src");

        for (ext, quality) in [("webp", 80u8), ("avif", 50u8)] {
            let options = OptimizeOptions {
                quality: Some(quality),
                export_ext: Some(ext.into()),
                ..Default::default()
            };
            let out = optimize(&src, &options)
                .unwrap_or_else(|e| panic!("{ext} optimize failed: {e}"));
            assert_eq!(out.ext, ext);
            assert!(out.size > 0);
        }
    }

    #[test]
    fn scale_mode_percentage() {
        let src = ingest(&test_image(400, 200), "png", "t-scale");
        let options = OptimizeOptions {
            export_ext: Some("png".into()),
            resize: Some(resize_opts("SCALE", 50)),
            ..Default::default()
        };

        let out = optimize(&src, &options).expect("optimize");
        let decoded = image::open(files::get_file_path(&out.id, &out.ext)).unwrap();
        assert_eq!((decoded.width(), decoded.height()), (200, 100));
    }

    #[test]
    fn metadata_roundtrip() {
        use img_parts::{Bytes, ImageEXIF, ImageICC};

        fn plain_jpeg(width: u32, height: u32) -> Vec<u8> {
            let mut buf = std::io::Cursor::new(Vec::new());
            image::DynamicImage::ImageRgba8(test_image(width, height))
                .to_rgb8()
                .write_to(&mut buf, image::ImageFormat::Jpeg)
                .unwrap();
            buf.into_inner()
        }

        // craft a jpeg carrying EXIF + ICC
        let mut jpeg = img_parts::jpeg::Jpeg::from_bytes(Bytes::from(plain_jpeg(64, 64))).unwrap();
        jpeg.set_exif(Some(Bytes::from_static(b"fake-exif-payload")));
        jpeg.set_icc_profile(Some(Bytes::from_static(b"fake-icc-payload")));
        let mut with_meta = Vec::new();
        jpeg.encoder().write_to(&mut with_meta).unwrap();

        // extract from the source, embed into a fresh encode
        let meta = metadata::extract(&with_meta);
        assert!(meta.exif.is_some(), "exif extracted");
        assert!(meta.icc.is_some(), "icc extracted");

        let embedded = metadata::embed(plain_jpeg(32, 32), &meta);
        let reread = metadata::extract(&embedded);
        assert_eq!(reread.exif.as_deref(), Some(b"fake-exif-payload".as_ref()));
        assert_eq!(reread.icc.as_deref(), Some(b"fake-icc-payload".as_ref()));
    }

    /// perf sanity vs sharp; run with:
    /// IMAGINE_BENCH_SRC=/path/to/big.jpg cargo test --release bench_real_image -- --ignored --nocapture
    #[test]
    #[ignore]
    fn bench_real_image() {
        let Ok(src_path) = std::env::var("IMAGINE_BENCH_SRC") else {
            return;
        };
        let _ = std::fs::create_dir_all(tmpdir());
        let bytes = std::fs::read(&src_path).expect("read bench source");
        let path = get_file_path("t-bench", "jpg");
        std::fs::write(&path, &bytes).unwrap();

        let src = ImageFile {
            id: "t-bench".into(),
            url: path.to_string_lossy().into_owned(),
            size: bytes.len() as u64,
            ext: "jpg".into(),
            original_name: src_path.clone(),
            source_preview_url: None,
        };

        for run in 0..3 {
            let options = OptimizeOptions {
                quality: Some(80),
                export_ext: Some("jpg".into()),
                resize: Some(resize_opts("LONG_EDGE", 1600 + run)), // bust cache
                ..Default::default()
            };
            let t = std::time::Instant::now();
            let out = optimize(&src, &options).expect("bench optimize");
            println!(
                "run {run}: {:?} -> {} bytes",
                t.elapsed(),
                out.size
            );
        }
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn heic_input_via_imageio() {
        // build a heic with sips, then run it through the pipeline
        let png = ingest(&test_image(320, 240), "png", "t-heic-png");
        let png_path = files::get_file_path(&png.id, &png.ext);
        let heic_path = files::get_file_path("t-heic-src", "heic");

        let status = std::process::Command::new("sips")
            .args(["-s", "format", "heic"])
            .arg(&png_path)
            .arg("--out")
            .arg(&heic_path)
            .output()
            .expect("run sips");
        assert!(status.status.success(), "sips heic encode failed");

        let src = ImageFile {
            id: "t-heic-src".into(),
            url: heic_path.to_string_lossy().into_owned(),
            size: std::fs::metadata(&heic_path).unwrap().len(),
            ext: "heic".into(),
            original_name: "/tmp/test.heic".into(),
            source_preview_url: None,
        };

        let options = OptimizeOptions {
            quality: Some(80),
            ..Default::default() // no exportExt: heic remaps to jpg
        };

        let out = optimize(&src, &options).expect("heic optimize");
        assert_eq!(out.ext, "jpg");
        assert!(out.size > 0);
        assert!(
            out.source_preview_url.is_some(),
            "heic must expose a preview intermediate"
        );
        assert!(PathBuf::from(out.source_preview_url.unwrap()).exists());
    }
}

