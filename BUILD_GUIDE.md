# tiga-dua-booth-app: Build & Package Guide

## Development
1. Start Vite dev server:
   ```
   npm run dev
   ```
2. In another terminal, run Electron in dev mode:
   ```
   $env:NODE_ENV="development"; npm start
   ```

## Production Build (Windows .exe)
1. Build renderer assets with Vite:
   ```
   npm run build or npx vite build
   ```
   (This runs `vite build` and outputs to `src/renderer/dist`)
2. Package the Electron app:
   ```
   npm run dist
   ```
   (This runs electron-builder and creates a Windows installer in `dist/`)
3. Find your installer:
   - `dist/tiga-dua-booth-app Setup <version>.exe`

## Installation Notes
After you install the .exe on a new computer, you need to manually place your .env file in the correct location so the running application can find it. The simplest place is usually right next to the installed .exe file itself inside the installation folder, e.g., in `C:\Users\YourUser\AppData\Local\Programs\tiga-dua-booth-app`

## Notes
- Always run `npm run build` before `npm run dist` to ensure latest assets are packaged.
- For development, use the Vite dev server and Electron with dev environment variables.
- For production, Electron loads the built HTML and assets from `src/renderer/dist`.
- If you change asset paths or config, rebuild before packaging.

---
For troubleshooting, check console logs and ensure all assets are present in `src/renderer/dist` before packaging.
