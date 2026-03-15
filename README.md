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

## Built on

 - [sharp](https://github.com/lovell/sharp): High performance Node.js image processing, the fastest module to resize JPEG, PNG, WebP, AVIF and TIFF images. Uses the libvips library.
 - [Electron](https://electron.atom.io/): Build cross platform desktop apps with JavaScript, HTML, and CSS
