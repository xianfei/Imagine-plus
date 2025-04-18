# Imagine Plus

![Screenshot](https://github.com/user-attachments/assets/17e78f90-15ca-44c0-b689-fd2d0ab9c6c7)

What's changed in this fork:

- UI improvements
- More features (keep metadata, progressive encode, etc.)
- Added support for HEIC Decode
- Added support for WebP Encode/Decode
- Added support for AVIF Encode/Decode

Supported formats:

|  | from JPG | from PNG | from WebP | from AVIF | from HEIC |
| --- | --- | --- | --- | --- | --- |
| to JPG | ✅ | ✅ | ✅ | ✅ | ✅ |
| to PNG | ✅ | ✅ | ✅ | ✅ | ✅ |
| to WebP | ✅ | ✅ | ✅ | ✅ | ✅ |
| to AVIF | ✅ | ✅ | ✅ | ✅ | ✅ |

# Imagine

[![build](https://travis-ci.org/xianfei/Imagine-plus.svg?branch=master)](https://travis-ci.org/xianfei/Imagine-plus)

Imagine is a desktop app for compression of PNG and JPEG, with a modern and friendly UI.

Save for web.

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

## Screenshot

![Screenshot](./screenshots/shot.jpg)

## Features

 - Multi format (JPEG, PNG, WebP)
 - Format conversion
 - Cross platform
 - GUI
 - Batch optimization
 - i18n (English, 简体中文, Nederlands, Español, Français, Italiano, Deutsch)

## Build and Contribute

```bash
git clone https://github.com/xianfei/Imagine-plus.git
npm install
npm run dev
```

## Built on

 - [sharp](https://github.com/lovell/sharp): High performance Node.js image processing, the fastest module to resize JPEG, PNG, WebP, AVIF and TIFF images. Uses the libvips library.
 - [Electron](https://electron.atom.io/): Build cross platform desktop apps with JavaScript, HTML, and CSS
