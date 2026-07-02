use img_parts::{Bytes, DynImage, ImageEXIF, ImageICC};

/// EXIF + ICC payloads carried from the decoded source to the encoded output.
#[derive(Default, Clone)]
pub struct Meta {
    pub icc: Option<Bytes>,
    pub exif: Option<Bytes>,
}

impl Meta {
    pub fn is_empty(&self) -> bool {
        self.icc.is_none() && self.exif.is_none()
    }
}

/// Extract metadata from jpg/png/webp containers (img-parts auto-detects).
/// Other formats (bmp) simply have none to preserve.
pub fn extract(bytes: &[u8]) -> Meta {
    match DynImage::from_bytes(Bytes::copy_from_slice(bytes)) {
        Ok(Some(img)) => Meta {
            icc: img.icc_profile(),
            exif: img.exif(),
        },
        _ => Meta::default(),
    }
}

/// Re-embed metadata into a freshly encoded jpg/png/webp payload.
pub fn embed(encoded: Vec<u8>, meta: &Meta) -> Vec<u8> {
    if meta.is_empty() {
        return encoded;
    }

    match DynImage::from_bytes(Bytes::from(encoded.clone())) {
        Ok(Some(mut img)) => {
            if meta.icc.is_some() {
                img.set_icc_profile(meta.icc.clone());
            }
            if meta.exif.is_some() {
                img.set_exif(meta.exif.clone());
            }

            let mut out = Vec::new();
            if img.encoder().write_to(&mut out).is_ok() {
                out
            } else {
                encoded
            }
        }
        _ => encoded,
    }
}
