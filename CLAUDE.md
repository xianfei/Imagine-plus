# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Imagine+ is a Tauri 2 desktop app for image optimization and conversion (PNG/JPEG/WebP/AVIF/HEIC/BMP). The UI is React 17 + Redux in a webview; all image processing is native Rust (mozjpeg / imagequant / libwebp / ravif). It was ported from Electron + Sharp — the renderer code and the `ImagineAPI` bridge shape still carry that lineage, but there is no Electron or Node.js at runtime.

## Commands

```bash
# Development
npm run dev          # tauri dev: Rust backend + Vite dev server on :9999
npm run vite         # renderer only in a plain browser (no backend; most features need Tauri)

# Build
npm run vite:build   # renderer → dist/web/
npm run build        # tauri build: full app bundle (runs vite:build first)

# Lint & type check
npm run lint         # tsc --noEmit + ESLint on modules/

# Tests
npm run test                                  # tsc --noEmit + jest
npx jest modules/__tests__/renderer/store.test.ts   # single test file
cargo test --manifest-path src-tauri/Cargo.toml     # Rust tests
```

`tauri build` needs the Rust toolchain plus NASM (rav1e's SIMD assembly). CI (`.github/workflows/ci.yml`) runs the frontend and Rust jobs separately and uploads installable bundles for every push; `release.yml` builds macOS arm64/x64, Windows and Linux on `v*` tags.

TS test files live in `modules/__tests__/**/*.test.(ts|tsx)`. `@tauri-apps/api` is ESM-only, so jest maps it to `modules/__tests__/__stubs__/tauri-api.ts`.

## Architecture

### Process Separation

- **Backend** (`src-tauri/src/`): Rust. File I/O, image decode/encode, native menu, dialogs, taskbar progress, persistent config.
- **Renderer** (`modules/renderer/`): React + Redux UI. Never touches the filesystem directly.
- **Bridge** (`modules/bridge/`): the seam between them. `interface.ts` defines `ImagineAPI`; `tauri.ts` implements it over `invoke`/`listen`; `web.ts` picks the implementation (Tauri if `__TAURI_INTERNALS__` is present, otherwise `window.imagineAPI`) and exports `bridgeReady`, which the renderer awaits before first render.

### IPC Pattern

The renderer keeps an Electron-shaped channel API (`ipcSend` / `ipcSendSync` / `ipcListen`, channels in `IpcChannel`), and `bridge/tauri.ts` translates each channel into a Tauri command or event:

- Renderer → Rust: `ipcSend` switches on the channel and calls `invoke('file_add' | 'file_select' | 'save' | 'sync' | 'store_set' | 'set_progress_bar' | …)`; handlers live in `src-tauri/src/commands.rs`.
- Rust → renderer: `ipcListen` subscribes to emitted events (`FILE_SELECTED`, `SAVE`, `SAVED`); the renderer side is wired in `modules/renderer/ipc/listen.ts`.
- `ipcSendSync('store-get')` reads from a config cache primed by `store_get_all` during `initTauriBridge()` — there is no synchronous IPC in Tauri.
- Rust returns plain filesystem paths; `normalizeImage()` converts them to asset-protocol URLs via `convertFileSrc`.

Things Electron gave for free and the bridge now emulates: menu labels are localized in the renderer and passed to Rust with `ready`/`sync`; update checks are a plain GitHub releases API call; `beforeunload` is synthesized from Tauri's `onCloseRequested`; Windows gets custom window controls (`windowControls`) since it has no native overlay.

### Data Flow for Image Optimization

1. Files arrive via native drag-drop (`onFileDrop`, absolute paths — webviews expose no `File.path`), the menu, or CLI args → `file_add`/`file_select` → Rust sniffs and copies them into the temp dir → `FILE_SELECTED` event → Redux `TASK_ADD`.
2. `modules/renderer/store/job-runner.ts` subscribes to the store, picks `PENDING` tasks up to the concurrency limit, and calls `imagineAPI.optimize()`. It also drives the taskbar progress bar via `setProgressBar`.
3. `optimize` → `src-tauri/src/pipeline.rs` → `codecs.rs`. Content-addressed by `md5(id + options)` in the temp dir, so re-encoding identical work is a cache hit.
4. Results dispatch `TASK_OPTIMIZE_SUCCESS`/`FAIL` → UI re-renders.
5. Saving goes through `modules/renderer/apis/index.ts` → `save` command → `src-tauri/src/files.rs`, which emits `SAVED` back.

HEIC/AVIF input: macOS decodes with ImageIO via `sips` (`native_decode.rs`); elsewhere `modules/bridge/webview-decode.ts` decodes in the webview (libheif-js WASM for HEIC, canvas for AVIF) and hands raw RGBA to `write_intermediate` before `optimize` runs. Either path produces the same `{id}.1.png` intermediate.

### State Management

Redux store in `modules/renderer/store/`:
- `store.ts` — store setup with redux-devtools
- `reducer.ts` — single reducer handling all app state
- `actionCreaters.ts` / `actions.ts` — action creators and the `ACTIONS` enum (redux-actions)
- `job-runner.ts` — side-effect manager that subscribes to the store and drives optimization tasks
- `storage.ts` — localStorage-backed default options and renderer-only settings (language, concurrency)

Two separate persistence layers: renderer preferences live in localStorage (`storage.ts`), while `keepmeta` / `progressive` / `checkupdate` go through the Rust `ConfigStore` (`config.json` in the app config dir) because the backend reads them too.

### Localization

Translation files in `modules/locales/` (14 languages, `en.ts` is the fallback). i18n setup in `modules/common/i18n.ts`; `{0}`-style positional args. New keys only need `en.ts` and `zh-CN.ts` — missing keys in other locales fall back to English.

### Build Pipeline

- Vite bundles the renderer → `dist/web/` (`frontendDist` in `src-tauri/tauri.conf.json`); dev mode loads the Vite server on :9999 instead.
- `tauri::generate_context!` requires `dist/web` to exist, so a renderer build must precede any `cargo build`.
- `tsconfig.json` still has an `outDir` of `lib/` from the Electron era; nothing consumes it — TypeScript is only used for type checking (`tsc --noEmit`), Vite does the transpiling. `lib/` and `dist/` are gitignored.

### Key Dependencies

- **Rust codecs** — `mozjpeg` (JPEG), `imagequant` + `png` (quantized PNG), `webp`, `ravif` (AVIF), `fast_image_resize` (Lanczos3), `img-parts`/`qcms` (EXIF/ICC preservation)
- **Tauri plugins** — dialog, opener, single-instance, log
- **libheif-js** — WASM HEIC decode fallback for non-macOS platforms; dynamically imported to keep the ~1 MB bundle out of the initial load
