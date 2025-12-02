#!/bin/bash

# =============================================================================
# FocosX Cross-Platform Build Script
# Builds installers and executables for Linux, Windows, and macOS
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

print_header() {
    echo ""
    echo -e "${BLUE}╔══════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║                     FocosX Build System                          ║${NC}"
    echo -e "${BLUE}╚══════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

print_section() {
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}  $1${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

usage() {
    echo "Usage: $0 [OPTIONS] [PLATFORM]"
    echo ""
    echo "Options:"
    echo "  -h, --help        Show this help message"
    echo "  -d, --debug       Build in debug mode"
    echo "  -v, --verbose     Enable verbose output"
    echo "  --skip-icons      Skip icon generation"
    echo "  --skip-frontend   Skip frontend build (use existing dist)"
    echo ""
    echo "Platforms:"
    echo "  all               Build for all platforms (default)"
    echo "  linux             Build for Linux only"
    echo "  windows           Build for Windows only"
    echo "  macos             Build for macOS only"
    echo "  current           Build for current platform only"
    echo ""
    echo "Examples:"
    echo "  $0                    # Build for all platforms"
    echo "  $0 linux              # Build for Linux only"
    echo "  $0 --debug current    # Debug build for current platform"
    echo ""
    echo "Output:"
    echo "  Built files will be in: src-tauri/target/release/bundle/"
    echo ""
    echo "Cross-compilation notes:"
    echo "  - For Windows builds on Linux: Install cross, mingw-w64"
    echo "  - For macOS builds on Linux: Requires macOS SDK and osxcross"
    echo "  - Native builds are always recommended for production"
}

# Default options
DEBUG_MODE=false
VERBOSE=false
SKIP_ICONS=false
SKIP_FRONTEND=false
PLATFORM="current"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            usage
            exit 0
            ;;
        -d|--debug)
            DEBUG_MODE=true
            shift
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        --skip-icons)
            SKIP_ICONS=true
            shift
            ;;
        --skip-frontend)
            SKIP_FRONTEND=true
            shift
            ;;
        all|linux|windows|macos|current)
            PLATFORM=$1
            shift
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            usage
            exit 1
            ;;
    esac
done

print_header

echo -e "${YELLOW}Build Configuration:${NC}"
echo "  Platform:      $PLATFORM"
echo "  Debug Mode:    $DEBUG_MODE"
echo "  Skip Icons:    $SKIP_ICONS"
echo "  Skip Frontend: $SKIP_FRONTEND"
echo "  Project Root:  $PROJECT_ROOT"

cd "$PROJECT_ROOT"

# ============================================================================
# Step 1: Generate Icons
# ============================================================================

if [ "$SKIP_ICONS" = false ]; then
    print_section "Step 1: Generating Icons"
    
    if [ -f "$SCRIPT_DIR/generate-icons.sh" ]; then
        bash "$SCRIPT_DIR/generate-icons.sh"
    else
        echo -e "${YELLOW}Warning: generate-icons.sh not found, skipping icon generation${NC}"
    fi
else
    echo -e "${YELLOW}Skipping icon generation as requested${NC}"
fi

# ============================================================================
# Step 2: Install Dependencies
# ============================================================================

print_section "Step 2: Installing Dependencies"

if [ -f "pnpm-lock.yaml" ]; then
    echo "Using pnpm..."
    pnpm install
elif [ -f "yarn.lock" ]; then
    echo "Using yarn..."
    yarn install
else
    echo "Using npm..."
    npm install
fi

# ============================================================================
# Step 3: Build Frontend (if not skipped)
# ============================================================================

if [ "$SKIP_FRONTEND" = false ]; then
    print_section "Step 3: Building Frontend"
    
    if [ -f "pnpm-lock.yaml" ]; then
        pnpm run build
    elif [ -f "yarn.lock" ]; then
        yarn build
    else
        npm run build
    fi
else
    echo -e "${YELLOW}Skipping frontend build as requested${NC}"
fi

# ============================================================================
# Step 4: Build Tauri Application
# ============================================================================

print_section "Step 4: Building Tauri Application"

# Determine build flags
BUILD_FLAGS=""
if [ "$DEBUG_MODE" = true ]; then
    BUILD_FLAGS="--debug"
fi

if [ "$VERBOSE" = true ]; then
    BUILD_FLAGS="$BUILD_FLAGS --verbose"
fi

build_for_target() {
    local target=$1
    local target_name=$2
    
    echo -e "${BLUE}Building for $target_name...${NC}"
    
    if [ -n "$target" ]; then
        pnpm tauri build $BUILD_FLAGS --target "$target"
    else
        pnpm tauri build $BUILD_FLAGS
    fi
}

case $PLATFORM in
    current)
        echo -e "${BLUE}Building for current platform...${NC}"
        pnpm tauri build $BUILD_FLAGS
        ;;
    linux)
        echo -e "${BLUE}Building for Linux...${NC}"
        # Check for Linux targets
        if [[ "$(uname -s)" == "Linux" ]]; then
            pnpm tauri build $BUILD_FLAGS
        else
            build_for_target "x86_64-unknown-linux-gnu" "Linux x64"
        fi
        ;;
    windows)
        echo -e "${BLUE}Building for Windows...${NC}"
        if [[ "$(uname -s)" == *"MINGW"* ]] || [[ "$(uname -s)" == *"MSYS"* ]]; then
            pnpm tauri build $BUILD_FLAGS
        else
            # Cross-compilation for Windows
            echo -e "${YELLOW}Cross-compiling for Windows requires additional setup.${NC}"
            echo "Install: rustup target add x86_64-pc-windows-msvc"
            echo "Or use: rustup target add x86_64-pc-windows-gnu"
            build_for_target "x86_64-pc-windows-gnu" "Windows x64"
        fi
        ;;
    macos)
        echo -e "${BLUE}Building for macOS...${NC}"
        if [[ "$(uname -s)" == "Darwin" ]]; then
            # Build for both architectures on macOS
            echo "Building for Intel Macs..."
            pnpm tauri build $BUILD_FLAGS --target x86_64-apple-darwin
            echo "Building for Apple Silicon..."
            pnpm tauri build $BUILD_FLAGS --target aarch64-apple-darwin
            # Optionally create universal binary
            echo "Creating universal binary..."
            pnpm tauri build $BUILD_FLAGS --target universal-apple-darwin || true
        else
            echo -e "${RED}macOS builds require running on macOS.${NC}"
            echo "Consider using GitHub Actions for cross-platform builds."
            exit 1
        fi
        ;;
    all)
        echo -e "${BLUE}Building for all platforms...${NC}"
        echo -e "${YELLOW}Note: Cross-platform builds may require additional tools.${NC}"
        
        # Build for current platform first
        echo ""
        echo -e "${CYAN}Building for current platform...${NC}"
        pnpm tauri build $BUILD_FLAGS
        
        # Attempt cross-compilation
        OS="$(uname -s)"
        case $OS in
            Linux)
                echo -e "${YELLOW}On Linux: Windows cross-compilation requires mingw-w64${NC}"
                echo -e "${YELLOW}On Linux: macOS cross-compilation requires osxcross${NC}"
                ;;
            Darwin)
                echo ""
                echo -e "${CYAN}Building for all macOS architectures...${NC}"
                pnpm tauri build $BUILD_FLAGS --target x86_64-apple-darwin || true
                pnpm tauri build $BUILD_FLAGS --target aarch64-apple-darwin || true
                ;;
            *)
                echo -e "${YELLOW}For complete cross-platform builds, use GitHub Actions.${NC}"
                ;;
        esac
        ;;
esac

# ============================================================================
# Step 5: Summary
# ============================================================================

print_section "Build Complete!"

BUNDLE_DIR="$PROJECT_ROOT/src-tauri/target"
if [ "$DEBUG_MODE" = true ]; then
    BUNDLE_DIR="$BUNDLE_DIR/debug/bundle"
else
    BUNDLE_DIR="$BUNDLE_DIR/release/bundle"
fi

echo -e "${GREEN}Build artifacts:${NC}"
echo ""

if [ -d "$BUNDLE_DIR" ]; then
    echo -e "${BLUE}Bundle directory: $BUNDLE_DIR${NC}"
    echo ""
    
    # List generated bundles
    if [ -d "$BUNDLE_DIR/deb" ]; then
        echo -e "${GREEN}  Linux .deb packages:${NC}"
        ls -la "$BUNDLE_DIR/deb/"*.deb 2>/dev/null || echo "    (none found)"
    fi
    
    if [ -d "$BUNDLE_DIR/rpm" ]; then
        echo -e "${GREEN}  Linux .rpm packages:${NC}"
        ls -la "$BUNDLE_DIR/rpm/"*.rpm 2>/dev/null || echo "    (none found)"
    fi
    
    if [ -d "$BUNDLE_DIR/appimage" ]; then
        echo -e "${GREEN}  Linux AppImage:${NC}"
        ls -la "$BUNDLE_DIR/appimage/"*.AppImage 2>/dev/null || echo "    (none found)"
    fi
    
    if [ -d "$BUNDLE_DIR/msi" ]; then
        echo -e "${GREEN}  Windows .msi installers:${NC}"
        ls -la "$BUNDLE_DIR/msi/"*.msi 2>/dev/null || echo "    (none found)"
    fi
    
    if [ -d "$BUNDLE_DIR/nsis" ]; then
        echo -e "${GREEN}  Windows .exe installers (NSIS):${NC}"
        ls -la "$BUNDLE_DIR/nsis/"*.exe 2>/dev/null || echo "    (none found)"
    fi
    
    if [ -d "$BUNDLE_DIR/dmg" ]; then
        echo -e "${GREEN}  macOS .dmg files:${NC}"
        ls -la "$BUNDLE_DIR/dmg/"*.dmg 2>/dev/null || echo "    (none found)"
    fi
    
    if [ -d "$BUNDLE_DIR/macos" ]; then
        echo -e "${GREEN}  macOS .app bundles:${NC}"
        ls -la "$BUNDLE_DIR/macos/" 2>/dev/null || echo "    (none found)"
    fi
else
    echo -e "${YELLOW}Bundle directory not found. Build may have failed.${NC}"
fi

# ============================================================================
# Step 6: Copy to Production Folder
# ============================================================================

print_section "Copying to Production Folder"

PRODUCTION_DIR="$PROJECT_ROOT/production"
VERSION=$(grep -o '"version": "[^"]*"' "$PROJECT_ROOT/src-tauri/tauri.conf.json" | head -1 | cut -d'"' -f4)

# Create production directory
mkdir -p "$PRODUCTION_DIR"

# Clear old files (optional - comment out if you want to keep old versions)
rm -f "$PRODUCTION_DIR"/*.deb "$PRODUCTION_DIR"/*.rpm "$PRODUCTION_DIR"/*.AppImage \
      "$PRODUCTION_DIR"/*.msi "$PRODUCTION_DIR"/*.exe "$PRODUCTION_DIR"/*.dmg \
      "$PRODUCTION_DIR"/*.zip 2>/dev/null || true

echo -e "${BLUE}Copying installers to: $PRODUCTION_DIR${NC}"
echo ""

COPIED_COUNT=0

# Copy Linux packages
if [ -d "$BUNDLE_DIR/deb" ]; then
    for f in "$BUNDLE_DIR/deb/"*.deb; do
        if [ -f "$f" ]; then
            cp "$f" "$PRODUCTION_DIR/"
            echo -e "${GREEN}  ✓ $(basename "$f")${NC}"
            COPIED_COUNT=$((COPIED_COUNT + 1))
        fi
    done
fi

if [ -d "$BUNDLE_DIR/rpm" ]; then
    for f in "$BUNDLE_DIR/rpm/"*.rpm; do
        if [ -f "$f" ]; then
            cp "$f" "$PRODUCTION_DIR/"
            echo -e "${GREEN}  ✓ $(basename "$f")${NC}"
            COPIED_COUNT=$((COPIED_COUNT + 1))
        fi
    done
fi

if [ -d "$BUNDLE_DIR/appimage" ]; then
    for f in "$BUNDLE_DIR/appimage/"*.AppImage; do
        if [ -f "$f" ]; then
            cp "$f" "$PRODUCTION_DIR/"
            echo -e "${GREEN}  ✓ $(basename "$f")${NC}"
            COPIED_COUNT=$((COPIED_COUNT + 1))
        fi
    done
fi

# Copy Windows packages
if [ -d "$BUNDLE_DIR/msi" ]; then
    for f in "$BUNDLE_DIR/msi/"*.msi; do
        if [ -f "$f" ]; then
            cp "$f" "$PRODUCTION_DIR/"
            echo -e "${GREEN}  ✓ $(basename "$f")${NC}"
            COPIED_COUNT=$((COPIED_COUNT + 1))
        fi
    done
fi

if [ -d "$BUNDLE_DIR/nsis" ]; then
    for f in "$BUNDLE_DIR/nsis/"*.exe; do
        if [ -f "$f" ]; then
            cp "$f" "$PRODUCTION_DIR/"
            echo -e "${GREEN}  ✓ $(basename "$f")${NC}"
            COPIED_COUNT=$((COPIED_COUNT + 1))
        fi
    done
fi

# Copy macOS packages
if [ -d "$BUNDLE_DIR/dmg" ]; then
    for f in "$BUNDLE_DIR/dmg/"*.dmg; do
        if [ -f "$f" ]; then
            cp "$f" "$PRODUCTION_DIR/"
            echo -e "${GREEN}  ✓ $(basename "$f")${NC}"
            COPIED_COUNT=$((COPIED_COUNT + 1))
        fi
    done
fi

# Create a manifest file for the landing page
MANIFEST_FILE="$PRODUCTION_DIR/releases.json"
echo -e "${BLUE}Creating release manifest: $MANIFEST_FILE${NC}"

# Start the JSON
echo '{' > "$MANIFEST_FILE"
echo "  \"version\": \"$VERSION\"," >> "$MANIFEST_FILE"
echo "  \"date\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\"," >> "$MANIFEST_FILE"
echo '  "downloads": {' >> "$MANIFEST_FILE"

# Add entries for each file
FIRST_ENTRY=true
for f in "$PRODUCTION_DIR"/*; do
    if [ -f "$f" ]; then
        FILENAME=$(basename "$f")
        # Skip non-installer files
        case "$FILENAME" in
            *.deb|*.rpm|*.AppImage|*.msi|*.exe|*.dmg)
                FILESIZE=$(stat -c%s "$f" 2>/dev/null || stat -f%z "$f" 2>/dev/null || echo "0")
                
                # Determine platform and type
                case "$FILENAME" in
                    *.deb) PLATFORM_NAME="linux"; FILE_TYPE="deb" ;;
                    *.rpm) PLATFORM_NAME="linux"; FILE_TYPE="rpm" ;;
                    *.AppImage) PLATFORM_NAME="linux"; FILE_TYPE="appimage" ;;
                    *.msi) PLATFORM_NAME="windows"; FILE_TYPE="msi" ;;
                    *.exe) PLATFORM_NAME="windows"; FILE_TYPE="exe" ;;
                    *.dmg) PLATFORM_NAME="macos"; FILE_TYPE="dmg" ;;
                    *) continue ;;
                esac
                
                if [ "$FIRST_ENTRY" = true ]; then
                    FIRST_ENTRY=false
                else
                    echo "," >> "$MANIFEST_FILE"
                fi
                
                echo "    \"$FILENAME\": {" >> "$MANIFEST_FILE"
                echo "      \"platform\": \"$PLATFORM_NAME\"," >> "$MANIFEST_FILE"
                echo "      \"type\": \"$FILE_TYPE\"," >> "$MANIFEST_FILE"
                echo "      \"size\": $FILESIZE," >> "$MANIFEST_FILE"
                echo "      \"url\": \"/downloads/$FILENAME\"" >> "$MANIFEST_FILE"
                echo -n "    }" >> "$MANIFEST_FILE"
                ;;
        esac
    fi
done

echo "" >> "$MANIFEST_FILE"
echo '  }' >> "$MANIFEST_FILE"
echo '}' >> "$MANIFEST_FILE"

echo -e "${GREEN}  ✓ releases.json${NC}"

echo ""
if [ $COPIED_COUNT -gt 0 ]; then
    echo -e "${GREEN}Successfully copied $COPIED_COUNT installer(s) to production folder!${NC}"
else
    echo -e "${YELLOW}No installers found to copy.${NC}"
fi

echo ""
echo -e "${BLUE}Production folder contents:${NC}"
ls -lh "$PRODUCTION_DIR/"

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                        Build Finished!                           ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════════════╝${NC}"
