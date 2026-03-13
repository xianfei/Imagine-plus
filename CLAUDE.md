# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Imagine+ is an Electron desktop app for image optimization and conversion (PNG/JPEG/WebP/AVIF/HEIC/BMP). It uses React + Redux on the renderer side and Sharp (libvips) for image processing on the main process side.

## Commands

```bash
# Development (requires compiled lib/ first)
npm run dev         # tsc + launch Electron in dev mode (loads Vite dev server on :9999)

# Build
npm run build       # Clean + tsc + Vite bundle → lib/ and dist/web/
npm run start       # Build then launch

# Lint & type check
npm run lint        # tsc --noEmit + ESLint on modules/

# Tests
npm run test        # tsc + lint + jest
npx jest modules/__tests__/specific.test.ts  # Run a single test file

# Packaging
npm run pack        # Package app (no publish)
npm run release     # Build and publish to GitHub releases
npm run buildarm    # macOS Apple Silicon build
npm run buildx64    # macOS x64 build
```

Test files live in `modules/__tests__/*.test.(ts|tsx)`.

## Architecture

### Process Separation

This is a standard Electron app with two processes:

- **Main process** (`modules/backend/`): Handles file I/O, image optimization via Sharp, window management, app menu, auto-updates, and persistent config.
- **Renderer process** (`modules/renderer/`): React + Redux UI. Never touches the filesystem directly.
- **Bridge** (`modules/bridge/`): Preload script + async IPC abstraction that connects the two processes. `bridge/preload.ts` exposes a safe API on `window.__electron`; `bridge/web.ts` provides the same interface for web/non-Electron environments.

### IPC Pattern

All renderer→main communication goes through `modules/bridge/async-call/`. The renderer calls functions in `modules/renderer/apis/`, which invoke IPC methods that are handled by `modules/backend/app.ts`. Main→renderer events (progress updates, etc.) are received in `modules/renderer/ipc/`.

### Data Flow for Image Optimization

1. User drops files → `App.tsx` drag handler → `fileAdd()` API → Redux `ADD_FILES` action
2. `modules/renderer/store/job-runner.ts` watches the Redux store and dispatches optimization tasks
3. Job runner calls backend `optimize()` via IPC → `modules/backend/optimize.ts` → `modules/optimizers/index.ts` (Sharp)
4. Progress/results come back via IPC events → Redux store update → UI re-renders
5. User saves → `save()` IPC call → `modules/backend/save.ts` writes output file

### Build Pipeline

- TypeScript compiles `modules/` → `lib/` (CommonJS, Electron main process uses `lib/bootstrap.js`)
- Vite bundles the renderer → `dist/web/` (loaded as static files in production, or from dev server port 9999 in dev mode)
- `IMAGINE_ENV` environment variable controls dev vs production mode

### State Management

Redux store in `modules/renderer/store/`. Key files:
- `store.ts` — store setup with redux-devtools
- `reducer.ts` — single reducer handling all app state
- `actions.ts` — action creators (redux-actions)
- `job-runner.ts` — side-effect manager that subscribes to the store and drives optimization tasks

### Localization

Translation files in `modules/locales/` (11+ languages). i18n setup in `modules/common/i18n.ts`.

### Key Dependencies

- **Sharp** — native Node addon for image processing; architecture-specific builds required (see `buildarm`/`buildx64` scripts)
- **electron-builder** — packaging and auto-update infrastructure
- **electron-updater** — runtime auto-update (configured in `modules/backend/updater.ts`)
