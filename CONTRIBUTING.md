# Contributing to FocosX

Thanks for your interest in contributing! This document explains how to set up the project for development, common workflows, expectations for patches and PRs, and where to get help.

If you're here to make user-facing improvements, developer ergonomics, or bug fixes: welcome. Below you'll find the essential information to make a clean, reviewable contribution.

---
## Table of contents

- [Getting started (prerequisites)](#getting-started-prerequisites)
- [Local setup (quick)](#local-setup-quick)
- [Available scripts](#available-scripts)
- [Environment variables](#environment-variables)
- [Coding standards & tooling](#coding-standards--tooling)
- [Branching and PR workflow](#branching-and-pr-workflow)
- [Pull request checklist](#pull-request-checklist)
- [Testing and quality assurance](#testing-and-quality-assurance)
- [Working with optional heavy deps (PDF engine / CDN)](#working-with-optional-heavy-deps-pdf-engine--cdn)
- [Releasing & deploying to GitHub Pages](#releasing--deploying-to-github-pages)
- [Reporting issues](#reporting-issues)
- [Code of conduct & license](#code-of-conduct--license)
- [Need help?](#need-help)

---

## Getting started (prerequisites)

You will need:

- Node.js 18+ (LTS recommended)
- pnpm (preferred package manager)
- Git (obvious, for forks/PRs)
- A code editor (VS Code recommended) and TypeScript support

Install pnpm if you don't have it:
```bash
npm install -g pnpm
```

---

## Local setup (quick)

Clone the repo and install dependencies:

```bash
git clone git@github.com:EV-OD/focosx.git
cd focosx
pnpm install
```

Start the dev server:

```bash
pnpm dev
# then open the dev URL shown by Vite (typically http://localhost:3000)
```

Build for production:

```bash
pnpm build
```

Build for GitHub Pages (uses the repo base `/focosx/`):

```bash
pnpm run build:ghpages
```

Preview a production build locally:

```bash
pnpm preview
```

Deploy to GitHub Pages (pushes `dist/` to `gh-pages` branch):

```bash
pnpm run deploy
```

---

## Available scripts

Check `package.json` scripts. Common ones included:

- `pnpm dev` — start Vite dev server
- `pnpm build` — production build
- `pnpm run build:ghpages` — production build with `/focosx/` base for GitHub Pages
- `pnpm preview` — preview production build locally
- `pnpm run deploy` — publish `dist/` to `gh-pages` (requires repository access)

---

## Environment variables

Create `.env.local` in the project root to provide secrets for local development:

Example:
```
GEMINI_API_KEY=your_api_key_here
```

The Vite config uses `loadEnv` to inject selected env vars. Do not commit `.env.local`.

---

## Coding standards & tooling

- Language: TypeScript + React.
- Use consistent formatting:
  - Use Prettier for formatting (if not present, use an editor Prettier plugin).
  - Use your editor's TypeScript linter to catch basic issues.
- Imports:
  - Prefer explicit imports and keep large runtime-only dependencies loaded dynamically where appropriate (see PDF engine section).
- Commit messages:
  - Use concise, imperative messages: `feat: add XYZ`, `fix: correct behavior of ABC`, `chore: update deps`.
  - Include a short description and, when relevant, reference an issue: `fix: handle null input (#123)`

If you add linters or formatters, include configuration files and mention them in this doc.

---

## Branching and PR workflow

1. Fork the repository (if you do not have push access).
2. Create a feature branch from `main`:
   ```bash
   git checkout -b feat/my-feature
   ```
3. Make incremental, focused commits. Rebase/squash as appropriate before creating the PR.
4. Push your branch to your fork or the repository remote:
   ```bash
   git push origin feat/my-feature
   ```
5. Open a Pull Request against `EV-OD/focosx` `main` branch.
6. In the PR description: explain what you changed, why, and any manual steps to test.

Keep PRs small and focused — they are easier to review.

---

## Pull request checklist

Before requesting review, make sure:

- [ ] The change is functionally complete and tested locally.
- [ ] The code compiles: `pnpm build` succeeds.
- [ ] There are no TypeScript errors.
- [ ] Formatting and style look consistent.
- [ ] You updated the `README.md` or other docs if the UX/behavior changed.
- [ ] Commit history is tidy (squash minor/fixup commits if needed).
- [ ] PR description clearly explains the changes and testing steps.

---

## Testing and quality assurance

This project does not include a test harness by default. For contributions that require tests, add a test framework (Jest, Vitest, React Testing Library pattern) and include tests with your PR.

If you add tests:

- Add scripts for running tests (e.g., `pnpm test`).
- Document how to run tests and any test-specific setup in `CONTRIBUTING.md`.

---

## Working with optional heavy deps (PDF engine / CDN)

The app contains a PDF viewer plugin that relies on a WebAssembly engine. To keep builds portable, the project dynamically loads the PDF engine JS/WASM assets from public CDNs at runtime. This has implications:

- During development: you can run the app normally; the runtime will attempt to fetch the engine from CDN.
- If you require the engine to be bundled (for air-gapped or offline deployments), you must:
  - Add the `@embedpdf` packages to `package.json` and pin compatible versions.
  - Update the plugin to import and initialize the engine from the installed packages instead of dynamic CDN imports.
  - Ensure licensing and binary distribution terms are followed.
- When contributing changes to the PDF plugin:
  - Document how to test both CDN-loaded and bundled variations.
  - Provide fallbacks and clear error messages for runtime CDN failures.

---

## Releasing & deploying to GitHub Pages

- The repo is configured with:
  - `homepage` set to the GitHub Pages URL (project path).
  - `build:ghpages` script to set the correct base for assets.
  - `deploy` script using `gh-pages` to publish `dist/` to `gh-pages` branch.

Manual deployment steps:
1. `pnpm run build:ghpages`
2. `pnpm run deploy`

If you add a CI workflow (GitHub Actions) for automatic deployment, include:
- Node setup (match local Node version).
- pnpm setup via Corepack.
- `pnpm install` + `pnpm run build:ghpages`.
- Deploy step (e.g., `peaceiris/actions-gh-pages`).

If you create or change CI workflows, include them in your PR.

---

## Reporting issues

Please open issues for:
- Bugs (include reproduction steps, expected vs actual behavior).
- Feature requests (describe the goal and user story).
- Performance problems or security concerns (if sensitive, follow the repo security policy or contact the maintainers privately).

Good issue template tips:
- Browser / OS version
- Steps to reproduce
- Console logs or screenshots
- Minimal reproduction link or repo when feasible

---

## Code of conduct & license

- Respectful, collaborative behavior is expected. If you want a formal Code of Conduct added to the repo, propose one via PR.
- Add a `LICENSE` file if you wish to publish under an open-source license (MIT is a common default). If no license is present, assume "all rights reserved."

---

## Need help?

If you need help with setup, testing, or contributing code:
- Open an issue describing the problem and include relevant logs/screenshots.
- If you prefer, ask in your team's communication channel and reference the repository.

Thanks again for helping improve FocosX. Your contributions make the project better for everyone.
