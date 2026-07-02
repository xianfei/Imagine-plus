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

This branch is the [Tauri 2](https://v2.tauri.app/) edition: the app shell
is Rust (`src-tauri/`) and image processing runs on a statically linked
Rust codec stack — mozjpeg for JPEG (the same encoder sharp used),
libimagequant palette quantization for PNG, libwebp for WebP, ravif
(rav1e) for AVIF, macOS ImageIO for HEIC/AVIF decode with a webview
libheif fallback elsewhere, and fast_image_resize for SIMD Lanczos3
resizing. EXIF/ICC metadata is preserved via img-parts. Everything
compiles into a single binary: the macOS app bundle is ~9 MB (vs
~100 MB+ for the Electron build, which lives on the `master` branch).

Node.js is only needed as a build tool (Vite bundles the React UI);
there is no Node runtime in the shipped app.

```bash
git clone https://github.com/xianfei/Imagine-plus.git
npm install
npm run dev      # tauri dev (requires the Rust toolchain)
npm run build    # package (bundle in src-tauri/target/release/bundle)
npm test         # tsc + jest
cd src-tauri && cargo test   # Rust image pipeline tests
```

PNG quantization uses
[libimagequant](https://github.com/ImageOptim/libimagequant) (the pngquant
engine). Note that libimagequant is **GPL-3.0-or-later**, so distributed
builds of the Tauri edition are effectively GPL-3.0 licensed.

Known gaps vs the Electron build: interlaced PNG output is not supported
(the png crate encoder cannot write Adam7).

## Built on

 - [Tauri 2](https://v2.tauri.app/): build small cross-platform desktop apps with a Rust backend and system webviews
 - [mozjpeg](https://github.com/mozilla/mozjpeg), [libimagequant](https://github.com/ImageOptim/libimagequant), [libwebp](https://developers.google.com/speed/webp), [ravif](https://github.com/kornelski/cavif-rs), [fast_image_resize](https://github.com/cykooz/fast_image_resize), [image-rs](https://github.com/image-rs/image): the Rust image codec stack
