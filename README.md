# FocosX

FocosX is a minimal, extensible spatial workspace for deep study and annotation. It provides an infinite canvas and a plugin-based frame architecture for rendering documents, images, and interactive frames. This README explains how to run the project locally, build a production bundle, and deploy to GitHub Pages.

---

Table of contents
- Overview
- Prerequisites
- Quick start (development)
- Environment variables
- Building for production
- Deploying to GitHub Pages
- Continuous deployment (GitHub Actions example)
- Notes, troubleshooting & recommendations
- License & contribution

---

Overview
--------
FocosX is a client-side React + Vite application. The project prefers pnpm for package management and supports a static build suitable for hosting on GitHub Pages or any static hosting provider.

The app includes an optional advanced PDF viewer plugin that uses the PDFium WebAssembly engine. To keep builds portable, this plugin is configured to load heavy binaries and JS modules from CDNs at runtime. See the "Notes" section for implications.

Prerequisites
-------------
- Node.js (v18+ recommended)
- pnpm (v7+ recommended)
- Git (for deployment to GitHub Pages)
- A GitHub repository if you plan to deploy to GitHub Pages

Quick start (development)
-------------------------
1. Clone the repository and move into the project folder:
   `cd focosx` (where `focosx` is the project root)

2. Install dependencies using pnpm:
   `pnpm install`

3. Run the development server:
   `pnpm dev`

4. Open the app in your browser:
   `http://localhost:3000` (Vite will show the actual URL/port in the terminal)

Environment variables
---------------------
The project uses environment variables to manage optional API keys and sensitive values. Create a `.env.local` (or similar) in the `focosx` folder if you need to provide private keys.

Common example:
- `GEMINI_API_KEY` — used by some optional integrations. Export it as:
  `GEMINI_API_KEY=your_api_key_here`

Vite environment variables follow the `process.env` usage in code (the project uses `loadEnv` to pass selected vars at build time). Do not commit sensitive keys to source control.

Building for production
-----------------------
To create a production build:

1. Build the app:
   `pnpm build`

   - This runs the standard Vite production build and outputs the static site into `dist/`.

2. (Optional) Build specifically for GitHub Pages base path:
   - The repository includes a script `build:ghpages` which sets the base path to the repo name (check `package.json` and update `REPO_NAME`).
   - Example:
     `pnpm run build:ghpages`

Important:
- If you are deploying to a subpath (e.g. `https://USERNAME.github.io/REPO_NAME/`), make sure `build:ghpages` uses the correct `--base /REPO_NAME/` value or set `base` in `vite.config.ts` for your CI/deployment environment.

Deploying to GitHub Pages
-------------------------
The project includes a `deploy` script that uses the `gh-pages` package to push the `dist/` build to a `gh-pages` branch.

1. Configure `package.json`
   - Set `"homepage": "https://USERNAME.github.io/REPO_NAME"` (replace `USERNAME` and `REPO_NAME`).
   - Update the `build:ghpages` script `--base /REPO_NAME/` accordingly.

2. Build and deploy:
   - You can run:
     `pnpm run deploy`
   - `deploy` runs the `predeploy`/`prepublish` script (which builds) and then publishes `dist/` to the `gh-pages` branch.

3. Enable GitHub Pages in the repository settings:
   - Go to your repo → Settings → Pages.
   - Ensure the source is set to the `gh-pages` branch, and the correct folder (`/` or `/root`) is selected.

Continuous deployment (GitHub Actions example)
----------------------------------------------
A simple GitHub Actions workflow may perform the install/build/deploy steps automatically on push to `main`. A minimal flow should:

- Checkout repository
- Setup Node.js (matching your Node version)
- Install pnpm
- Run `pnpm install`
- Run `pnpm run build:ghpages`
- Use `peaceiris/actions-gh-pages` or `gh-pages` deploy action to push `dist/` to `gh-pages`

Example (conceptual; save under `.github/workflows/deploy.yml` — adapt to your org/repo):
    name: Deploy to GitHub Pages
    on:
      push:
        branches: [ main ]
    jobs:
      build-and-deploy:
        runs-on: ubuntu-latest
        steps:
          - uses: actions/checkout@v4
          - name: Setup Node
            uses: actions/setup-node@v4
            with:
              node-version: '18'
          - name: Install pnpm
            run: corepack enable && corepack prepare pnpm@latest --activate
          - name: Install dependencies
            run: pnpm install
          - name: Build (GH Pages base)
            run: pnpm run build:ghpages
          - name: Deploy to gh-pages
            uses: peaceiris/actions-gh-pages@v4
            with:
              github_token: ${{ secrets.GITHUB_TOKEN }}
              publish_dir: ./dist

Notes, troubleshooting & recommendations
---------------------------------------
- PDFium / @embedpdf modules:
  - The repo uses runtime/dynamic loading of PDFium JS and wasm from CDN fallbacks to make the static build portable and avoid registry install failures in some environments.
  - As a result, the PDF viewer requires client-side CDN access to work. If your environment blocks external CDNs, consider:
    - Adding the `@embedpdf` packages back to `dependencies` and bundling them (may increase bundle size and require the packages be available in the registry).
    - Hosting the wasm and JS artifacts on your own CDN and updating the plugin to reference your hosted assets.

- Large build chunks:
  - The build may produce large JS chunks (depending on optional libraries). To reduce initial bundle size:
    - Use dynamic `import()` for heavy features (code-splitting).
    - Use `build.rollupOptions.output.manualChunks` in `vite.config.ts` for explicit chunking.
    - Tree-shake unused libraries and prefer CDN runtime loads when appropriate.

- Missing `index.css` warning:
  - The project expects `/index.css` at runtime. A minimal `index.css` exists to cover base behavior, but you can replace with your preferred styling approach.

- Vite CLI flags:
  - Some tools (pnpm wrappers) may attempt to pass flags unsupported by Vite. Use the scripts defined in `package.json` rather than passing unknown CLI flags.

Contributing
------------
- Fork the repo and open a pull request for any non-trivial changes.
- For major changes (architecture, plugin API), please open an issue first and outline the proposed changes.
- Keep builds green: run `pnpm install` and `pnpm build` locally before submitting PRs.

License
-------
Include your project's license here (for example, MIT). If you do not want to add an explicit license, be aware that the default is "all rights reserved".

Contact / More information
--------------------------
For questions about the internal plugin API, or if you want me to scaffold a GitHub Actions workflow or revert the dynamic-CDN changes for PDFium so you can bundle it, tell me the preferred deployment method and repo details and I will prepare the artifacts or PR for you.
