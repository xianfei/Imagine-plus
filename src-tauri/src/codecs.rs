use fast_image_resize as fir;
use image::RgbaImage;
use rgb::FromSlice;

/// SIMD Lanczos3 resize (fast_image_resize), alpha-aware.
pub fn resize(rgba: RgbaImage, new_width: u32, new_height: u32) -> Result<RgbaImage, String> {
    let (width, height) = rgba.dimensions();
    if width == new_width && height == new_height {
        return Ok(rgba);
    }

    let src = fir::images::Image::from_vec_u8(
        width,
        height,
        rgba.into_raw(),
        fir::PixelType::U8x4,
    )
    .map_err(|e| e.to_string())?;

    let mut dst = fir::images::Image::new(new_width, new_height, fir::PixelType::U8x4);

    fir::Resizer::new()
        .resize(
            &src,
            &mut dst,
            &fir::ResizeOptions::new()
                .resize_alg(fir::ResizeAlg::Convolution(fir::FilterType::Lanczos3)),
        )
        .map_err(|e| e.to_string())?;

    RgbaImage::from_raw(new_width, new_height, dst.into_vec())
        .ok_or_else(|| "resize produced an invalid buffer".into())
}

/// Flatten alpha over black, matching sharp's default flatten behavior.
fn to_rgb_flat(rgba: &RgbaImage) -> Vec<u8> {
    rgba.pixels()
        .flat_map(|p| {
            let [r, g, b, a] = p.0;
            if a == 255 {
                [r, g, b]
            } else {
                let a = a as u16;
                [
                    ((r as u16 * a) / 255) as u8,
                    ((g as u16 * a) / 255) as u8,
                    ((b as u16 * a) / 255) as u8,
                ]
            }
        })
        .collect()
}

/// MozJPEG encode — the same encoder sharp uses with `mozjpeg: true`
/// (trellis quantisation etc. are mozjpeg defaults), progressive optional.
pub fn encode_jpeg(rgba: &RgbaImage, quality: u8, progressive: bool) -> Result<Vec<u8>, String> {
    let (width, height) = rgba.dimensions();
    let rgb = to_rgb_flat(rgba);

    std::panic::catch_unwind(move || -> Result<Vec<u8>, String> {
        let mut comp = mozjpeg::Compress::new(mozjpeg::ColorSpace::JCS_RGB);
        comp.set_size(width as usize, height as usize);
        comp.set_quality(quality as f32);
        comp.set_optimize_coding(true);
        if progressive {
            comp.set_progressive_mode();
            comp.set_optimize_scans(true);
        }

        let mut started = comp.start_compress(Vec::new()).map_err(|e| e.to_string())?;
        started.write_scanlines(&rgb).map_err(|e| e.to_string())?;
        started.finish().map_err(|e| e.to_string())
    })
    .map_err(|_| "mozjpeg panicked".to_string())?
}

/// Palette-quantized PNG matching sharp's `colors` option.
/// Opaque images go through quantette (Wu + k-means refinement +
/// Floyd-Steinberg); images with transparency use NeuQuant, which
/// supports RGBA palettes (quantette is opaque-only).
/// Note: interlaced/progressive PNG output is not supported by the
/// png crate encoder; the option is ignored (divergence from sharp).
pub fn encode_png(rgba: &RgbaImage, colors: u32) -> Result<Vec<u8>, String> {
    let (width, height) = rgba.dimensions();
    let colors = colors.clamp(2, 256);
    let has_alpha = rgba.pixels().any(|p| p.0[3] != 255);

    let (palette, trns, indices) = if has_alpha {
        quantize_neuquant(rgba, colors)
    } else {
        quantize_quantette(rgba, colors)?
    };

    let mut out = Vec::new();
    {
        let mut encoder = png::Encoder::new(&mut out, width, height);
        encoder.set_color(png::ColorType::Indexed);
        encoder.set_depth(png::BitDepth::Eight);
        encoder.set_palette(palette);
        if let Some(trns) = trns {
            encoder.set_trns(trns);
        }
        encoder.set_compression(png::Compression::High);

        let mut writer = encoder.write_header().map_err(|e| e.to_string())?;
        writer.write_image_data(&indices).map_err(|e| e.to_string())?;
    }

    Ok(out)
}

fn quantize_quantette(
    rgba: &RgbaImage,
    colors: u32,
) -> Result<(Vec<u8>, Option<Vec<u8>>, Vec<u8>), String> {
    use quantette::deps::palette::Srgb;
    use quantette::dither::FloydSteinberg;
    use quantette::{PaletteSize, Pipeline, QuantizeMethod};

    let pixels: Vec<Srgb<u8>> = rgba
        .pixels()
        .map(|p| Srgb::new(p.0[0], p.0[1], p.0[2]))
        .collect();

    let (width, height) = rgba.dimensions();
    let image = quantette::ImageRef::new(width, height, &pixels).map_err(|e| e.to_string())?;

    let palette_size = PaletteSize::try_from(colors as u16).map_err(|e| e.to_string())?;

    let indexed = Pipeline::new()
        .palette_size(palette_size)
        .quantize_method(QuantizeMethod::kmeans())
        .ditherer(FloydSteinberg::new())
        .parallel(true)
        .input_image(image)
        .output_srgb8_indexed_image();

    let (palette, indices) = indexed.into_parts();
    let palette_flat: Vec<u8> = palette
        .iter()
        .flat_map(|c| [c.red, c.green, c.blue])
        .collect();

    Ok((palette_flat, None, indices))
}

fn quantize_neuquant(rgba: &RgbaImage, colors: u32) -> (Vec<u8>, Option<Vec<u8>>, Vec<u8>) {
    let raw = rgba.as_raw();
    let nq = color_quant::NeuQuant::new(10, colors as usize, raw);

    let palette_rgba = nq.color_map_rgba();
    let palette: Vec<u8> = palette_rgba
        .chunks_exact(4)
        .flat_map(|c| [c[0], c[1], c[2]])
        .collect();
    let trns: Vec<u8> = palette_rgba.chunks_exact(4).map(|c| c[3]).collect();

    let indices: Vec<u8> = raw
        .chunks_exact(4)
        .map(|px| nq.index_of(px) as u8)
        .collect();

    (palette, Some(trns), indices)
}

/// Lossy WebP via libwebp (statically linked).
pub fn encode_webp(rgba: &RgbaImage, quality: u8) -> Result<Vec<u8>, String> {
    let encoder = webp::Encoder::from_rgba(rgba.as_raw(), rgba.width(), rgba.height());
    Ok(encoder.encode(quality as f32).to_vec())
}

/// AVIF via ravif/rav1e (pure Rust, internally rayon-threaded).
/// EXIF can be embedded directly; ICC is not supported by ravif.
pub fn encode_avif(
    rgba: &RgbaImage,
    quality: u8,
    exif: Option<&[u8]>,
) -> Result<Vec<u8>, String> {
    let (width, height) = rgba.dimensions();

    let mut encoder = ravif::Encoder::new()
        .with_quality(quality as f32)
        .with_speed(4);

    if let Some(exif) = exif {
        encoder = encoder.with_exif(exif.to_vec());
    }

    let img = ravif::Img::new(
        rgba.as_raw().as_rgba(),
        width as usize,
        height as usize,
    );

    encoder
        .encode_rgba(img)
        .map(|encoded| encoded.avif_file)
        .map_err(|e| e.to_string())
}
