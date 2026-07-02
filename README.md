# Imagine Plus

![Screenshot](https://github.com/user-attachments/assets/a0ad2640-41bc-48e1-8f7e-95c95886c2b7)


What's changed in this fork:

- UI improvements
- More features (keep metadata, progressive encode, etc.)
- Comparison mode
- Support more formats (see the table below)

|  | from JPG | from PNG | from WebP | from AVIF | from HEIC | from BMP |
| --- | --- | --- | --- | --- | --- | --- |
| to JPG | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| to PNG | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| to WebP | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| to AVIF | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

- Added batch image resizing function (v0.9 and above)

<img width="500" alt="ScreenShot_2026-03-15_152835_450" src="https://github.com/user-attachments/assets/8ec2e38c-8ba5-4415-ba21-bb1855e87f34" />


## Install

For Windows, macOS and Linux, download binaries from:

[https://github.com/xianfei/Imagine-plus/releases](https://github.com/xianfei/Imagine-plus/releases)

 - `Imagine-Setup-x.y.z.exe`      - *Windows*
 - `Imagine-x.y.z.dmg`            - *macOS*
 - `Imagine-0.4.1-x.y.z.AppImage` - *Linux*

### Install on linux

App for linux is distributed in [AppImage](http://appimage.org/) format.
Install it with command line:

```bash
chmod a+x Imagine-x.y.z-x86_64.AppImage # make executable
./Imagine-x.y.z-x86_64.AppImage # install and run
```

## Build and Contribute

```bash
git clone https://github.com/xianfei/Imagine-plus.git
npm install
npm run dev
```

## Tauri edition (this branch, experimental)

This branch also contains a [Tauri 2](https://v2.tauri.app/) rewrite: the
Electron main process is ported to Rust (`src-tauri/`) and image processing
runs on a statically linked Rust codec stack instead of sharp — mozjpeg for
JPEG (same encoder sharp uses), quantette/NeuQuant palette quantization for
PNG, libwebp for WebP, ravif (rav1e) for AVIF, macOS ImageIO for HEIC/AVIF
decode, and fast_image_resize for SIMD Lanczos3 resizing. EXIF/ICC metadata
is preserved via img-parts. Everything is compiled into a single binary:
the macOS app bundle is ~9 MB (vs ~100 MB+ for the Electron build).

```bash
npm install
npm run tauri:dev    # develop (requires Rust toolchain)
npm run tauri:build  # package (bundle in src-tauri/target/release/bundle)
cd src-tauri && cargo test   # image pipeline tests
```

Known gaps vs the Electron build: HEIC/AVIF *input* is currently macOS-only
(Windows WIC / webview fallback planned), interlaced PNG output is not
supported, and PNG quantization quality is slightly below pngquant —
[libimagequant](https://github.com/ImageOptim/libimagequant) (GPL-3.0 or
commercial) would close that gap if the license is acceptable.

## Built on

 - [sharp](https://github.com/lovell/sharp): High performance Node.js image processing, the fastest module to resize JPEG, PNG, WebP, AVIF and TIFF images. Uses the libvips library.
 - [Electron](https://electron.atom.io/): Build cross platform desktop apps with JavaScript, HTML, and CSS
