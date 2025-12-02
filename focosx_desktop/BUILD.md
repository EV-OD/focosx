# FocosX Build Guide

This guide explains how to build FocosX for different platforms.

## Prerequisites

### All Platforms
- Node.js 18+ and pnpm
- Rust (install via [rustup](https://rustup.rs/))
- Tauri CLI: `cargo install tauri-cli`

### Linux
```bash
# Ubuntu/Debian
sudo apt install -y \
    libgtk-3-dev \
    libwebkit2gtk-4.1-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev \
    librsvg2-bin \
    imagemagick \
    icnsutils \
    patchelf

# Fedora
sudo dnf install -y \
    gtk3-devel \
    webkit2gtk4.1-devel \
    libayatana-appindicator-gtk3-devel \
    librsvg2-devel \
    librsvg2-tools \
    ImageMagick \
    libicns-utils
```

### Windows
- Microsoft Visual Studio C++ Build Tools
- WebView2 (usually pre-installed on Windows 10/11)
- ImageMagick (for icon generation): `choco install imagemagick`

### macOS
```bash
brew install librsvg imagemagick
xcode-select --install  # For iconutil
```

## Quick Start

```bash
cd focosx_desktop

# Install dependencies
pnpm install

# Generate icons from SVG
pnpm icons

# Development mode
pnpm tauri dev

# Build for current platform
pnpm build:desktop
```

## Build Commands

| Command | Description |
|---------|-------------|
| `pnpm icons` | Generate all icon formats from SVG |
| `pnpm build:desktop` | Build for current platform |
| `pnpm build:linux` | Build for Linux |
| `pnpm build:windows` | Build for Windows |
| `pnpm build:macos` | Build for macOS (Intel + Apple Silicon) |
| `pnpm build:all` | Build for all platforms |
| `pnpm build:debug` | Debug build for current platform |
| `pnpm release` | Production build for current platform |

## Build Output

Build artifacts are located in:
```
src-tauri/target/release/bundle/
├── appimage/     # Linux AppImage
├── deb/          # Debian packages
├── rpm/          # RPM packages
├── msi/          # Windows MSI installer
├── nsis/         # Windows NSIS installer (.exe)
├── dmg/          # macOS disk image
└── macos/        # macOS .app bundle
```

## Icon Files

The icons are generated from a single SVG source file:
- Source: `src-tauri/icons/icon.svg`

Generated formats:
- **PNG**: Various sizes for different OS requirements
- **ICO**: Windows icon (multi-resolution)
- **ICNS**: macOS icon bundle

To regenerate icons:
```bash
pnpm icons
```

## Cross-Platform Builds

### Using GitHub Actions (Recommended)

The project includes a GitHub Actions workflow (`.github/workflows/build-release.yml`) that automatically builds for all platforms when you push a tag:

```bash
# Create and push a release tag
git tag v0.1.0
git push origin v0.1.0
```

This will:
1. Build for Linux x64
2. Build for Windows x64
3. Build for macOS Intel (x64)
4. Build for macOS Apple Silicon (arm64)
5. Create a draft GitHub release with all artifacts

### Manual Cross-Compilation

Cross-compilation requires additional tools:

**Windows from Linux:**
```bash
rustup target add x86_64-pc-windows-gnu
sudo apt install mingw-w64
```

**macOS from Linux:**
Requires [osxcross](https://github.com/tpoechtrager/osxcross) and macOS SDK.

> **Note:** Native builds are always recommended for production releases.

## Signing

### macOS Code Signing

Set environment variables:
```bash
export APPLE_SIGNING_IDENTITY="Developer ID Application: Your Name"
export APPLE_ID="your@email.com"
export APPLE_PASSWORD="app-specific-password"
export APPLE_TEAM_ID="XXXXXXXXXX"
```

### Windows Code Signing

Add certificate thumbprint to `tauri.conf.json`:
```json
{
  "bundle": {
    "windows": {
      "certificateThumbprint": "YOUR_THUMBPRINT",
      "timestampUrl": "http://timestamp.digicert.com"
    }
  }
}
```

## Troubleshooting

### Linux: Missing libraries
```bash
# Check for missing dependencies
ldd target/release/focosx | grep "not found"
```

### macOS: Code signing issues
```bash
# Clear cached signatures
sudo xattr -r -d com.apple.quarantine target/release/bundle/macos/FocosX.app
```

### Windows: WebView2 issues
Ensure WebView2 Runtime is installed. Download from [Microsoft](https://developer.microsoft.com/microsoft-edge/webview2/).

## Version Bumping

Update version in these files:
1. `package.json` - `version` field
2. `src-tauri/tauri.conf.json` - `version` field
3. `src-tauri/Cargo.toml` - `version` field

Or use the Tauri CLI:
```bash
pnpm tauri build --version 0.2.0
```
