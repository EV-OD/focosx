# FocosX — Spatial Study Workspace (Web App)

Live site: https://EV-OD.github.io/focosx/

This README is written for two audiences:
- End users who want to use the web app in a browser.
- Developers and contributors — see `CONTRIBUTING.md` for development setup and contribution guidelines.

If you are here to run or contribute to the code, open `CONTRIBUTING.md` (in the repo root) for technical and workflow details.

---

## For users — What FocosX is

FocosX is a browser-first spatial workspace designed for deep study, organizing materials, and lightweight annotation. It uses a plugin-based frame model so you can open documents, place them on an infinite canvas, and rearrange content visually.

Core user experiences:
- Open the app in your browser and arrange frames on the canvas.
- View documents (PDFs and supported file types) in dedicated frames.
- Pan and zoom the canvas to organize study materials spatially.
- Use built-in frame controls (move, resize, close) to manage content.

The app is provided as a static web app — no installation is required beyond a modern web browser.

---

## How to access the web app

- Open the hosted site: https://EV-OD.github.io/focosx/
  - If the site is not yet published, you can run a local instance (see the developer instructions in `CONTRIBUTING.md`).

Supported browsers
- Modern Chromium-based browsers (Chrome, Edge), Firefox, and Safari are supported.
- Ensure JavaScript is enabled. For the best experience, use an up-to-date browser version.

---

## Basic user guide

1. Launch the web app in your browser.
2. Create or add a frame:
   - Use the UI controls to add a new frame or open a file.
3. Open a document (PDF or supported format):
   - You can open local files or provide URLs depending on the frame type.
4. Arrange and organize:
   - Drag frames on the canvas, resize them, and position them spatially.
5. View controls:
   - Frames that render documents provide navigation (page controls), zoom, and other context-aware actions.
6. Export / share:
   - If export or snapshot features are enabled in the UI you can save or share frame contents (availability depends on the build and enabled plugins).

Note: Some features (for example advanced PDF rendering) use WebAssembly and third-party CDN assets which must be accessible from your browser to function correctly.

---

## Privacy & security notes for users

- Files you open in the browser are processed client-side. The app is designed to run entirely in the browser; it does not automatically upload your files to a server.
- If you provide API keys (for optional integrations), keep them secret and do not paste them into public pages.
- The PDF rendering engine and some optional libraries are loaded from public CDNs at runtime. If you require self-hosting or an air-gapped environment, contact the repository maintainers or consult the developer docs in `CONTRIBUTING.md` for guidance on bundling or hosting those assets locally.

---

## Troubleshooting (user-facing)

- If PDFs or advanced features fail to load:
  - Check your browser console for CORS or network errors (the browser can show blocked CDN requests).
  - Ensure your network allows requests to public CDNs (e.g., esm.sh, jsdelivr, unpkg).
- If the app appears broken or styles are missing:
  - Try a hard reload (Ctrl+Shift+R / Cmd+Shift+R). If the problem persists, open an issue in the repo with screenshots and console logs.

---

## For developers & contributors (brief)

This README is intentionally focused on the user's view. Development setup and contribution guidelines are in the repository file `CONTRIBUTING.md`.

Quick pointers for contributors:
- `CONTRIBUTING.md` contains:
  - Local development commands
  - How to build and test
  - Branching and PR guidelines
  - Coding standards and recommended tools
- The project uses Vite + React + TypeScript. `pnpm` is the recommended package manager.
- For changes that affect the web app UX, include:
  - Clear description of behavior
  - Screenshots or short recordings when practical
  - Any cross-browser considerations

---

If you need any specific user-facing documentation added (keyboard shortcuts, detailed step-by-step workflows, or a video walkthrough), tell me what you'd like to include and I will prepare it next.