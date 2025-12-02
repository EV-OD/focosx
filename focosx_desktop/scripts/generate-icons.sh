#!/bin/bash

# =============================================================================
# FocosX Icon Generator Script
# Generates all required icon formats for Tauri cross-platform builds
# Requires: ImageMagick (convert), librsvg (rsvg-convert), and icnsutil or png2icns
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ICONS_DIR="$PROJECT_ROOT/src-tauri/icons"
SVG_SOURCE="$ICONS_DIR/icon.svg"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                 FocosX Icon Generator                            ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check dependencies
check_dependency() {
    if ! command -v $1 &> /dev/null; then
        echo -e "${RED}Error: $1 is not installed.${NC}"
        echo -e "${YELLOW}Please install it:${NC}"
        case $1 in
            rsvg-convert)
                echo "  Ubuntu/Debian: sudo apt install librsvg2-bin"
                echo "  macOS: brew install librsvg"
                echo "  Fedora: sudo dnf install librsvg2-tools"
                ;;
            convert)
                echo "  Ubuntu/Debian: sudo apt install imagemagick"
                echo "  macOS: brew install imagemagick"
                echo "  Fedora: sudo dnf install ImageMagick"
                ;;
            png2icns)
                echo "  Ubuntu/Debian: sudo apt install icnsutils"
                echo "  macOS: brew install libicns"
                echo "  (Alternative: use iconutil on macOS)"
                ;;
        esac
        return 1
    fi
    return 0
}

echo -e "${YELLOW}Checking dependencies...${NC}"

MISSING_DEPS=0

if ! check_dependency rsvg-convert; then
    MISSING_DEPS=1
fi

if ! check_dependency convert; then
    MISSING_DEPS=1
fi

# Check for icns tool (either png2icns or iconutil on macOS)
ICNS_TOOL=""
if command -v iconutil &> /dev/null; then
    ICNS_TOOL="iconutil"
elif command -v png2icns &> /dev/null; then
    ICNS_TOOL="png2icns"
else
    echo -e "${YELLOW}Warning: No ICNS converter found. .icns file generation will be skipped.${NC}"
    echo "  Install png2icns: sudo apt install icnsutils (Linux)"
    echo "  On macOS, iconutil should be available by default"
fi

if [ $MISSING_DEPS -eq 1 ]; then
    echo -e "${RED}Please install missing dependencies and try again.${NC}"
    exit 1
fi

echo -e "${GREEN}All required dependencies found!${NC}"
echo ""

# Check if source SVG exists
if [ ! -f "$SVG_SOURCE" ]; then
    echo -e "${RED}Error: Source SVG not found at $SVG_SOURCE${NC}"
    exit 1
fi

echo -e "${YELLOW}Source SVG: ${NC}$SVG_SOURCE"
echo -e "${YELLOW}Output directory: ${NC}$ICONS_DIR"
echo ""

# Create temporary directory
TMP_DIR=$(mktemp -d)
trap "rm -rf $TMP_DIR" EXIT

echo -e "${BLUE}Generating PNG icons...${NC}"

# Generate base PNG at high resolution (1024x1024)
echo "  Creating 1024x1024 base image..."
rsvg-convert -w 1024 -h 1024 "$SVG_SOURCE" -o "$TMP_DIR/icon-1024.png"

# Function to generate PNG at specific size
generate_png() {
    local size=$1
    local output=$2
    echo "  Creating ${size}x${size} -> $output"
    convert "$TMP_DIR/icon-1024.png" -resize "${size}x${size}" -quality 100 "$ICONS_DIR/$output"
}

# ============================================================================
# Standard Tauri Icons
# ============================================================================

echo -e "${BLUE}Creating standard Tauri icons...${NC}"
generate_png 32 "32x32.png"
generate_png 128 "128x128.png"
generate_png 256 "128x128@2x.png"
generate_png 512 "icon.png"

# ============================================================================
# Windows Store Icons (UWP)
# ============================================================================

echo -e "${BLUE}Creating Windows Store icons...${NC}"
generate_png 30 "Square30x30Logo.png"
generate_png 44 "Square44x44Logo.png"
generate_png 71 "Square71x71Logo.png"
generate_png 89 "Square89x89Logo.png"
generate_png 107 "Square107x107Logo.png"
generate_png 142 "Square142x142Logo.png"
generate_png 150 "Square150x150Logo.png"
generate_png 284 "Square284x284Logo.png"
generate_png 310 "Square310x310Logo.png"
generate_png 50 "StoreLogo.png"

# ============================================================================
# Windows ICO (multi-resolution)
# ============================================================================

echo -e "${BLUE}Creating Windows .ico file...${NC}"

# Create all sizes needed for ICO
for size in 16 24 32 48 64 128 256; do
    convert "$TMP_DIR/icon-1024.png" -resize "${size}x${size}" "$TMP_DIR/icon-${size}.png"
done

# Create ICO with multiple resolutions
convert "$TMP_DIR/icon-16.png" \
        "$TMP_DIR/icon-24.png" \
        "$TMP_DIR/icon-32.png" \
        "$TMP_DIR/icon-48.png" \
        "$TMP_DIR/icon-64.png" \
        "$TMP_DIR/icon-128.png" \
        "$TMP_DIR/icon-256.png" \
        "$ICONS_DIR/icon.ico"

echo -e "${GREEN}  ✓ Created icon.ico${NC}"

# ============================================================================
# macOS ICNS
# ============================================================================

if [ -n "$ICNS_TOOL" ]; then
    echo -e "${BLUE}Creating macOS .icns file...${NC}"
    
    if [ "$ICNS_TOOL" = "iconutil" ]; then
        # macOS native method using iconutil
        ICONSET_DIR="$TMP_DIR/icon.iconset"
        mkdir -p "$ICONSET_DIR"
        
        # Generate all required sizes for iconset
        convert "$TMP_DIR/icon-1024.png" -resize 16x16 "$ICONSET_DIR/icon_16x16.png"
        convert "$TMP_DIR/icon-1024.png" -resize 32x32 "$ICONSET_DIR/icon_16x16@2x.png"
        convert "$TMP_DIR/icon-1024.png" -resize 32x32 "$ICONSET_DIR/icon_32x32.png"
        convert "$TMP_DIR/icon-1024.png" -resize 64x64 "$ICONSET_DIR/icon_32x32@2x.png"
        convert "$TMP_DIR/icon-1024.png" -resize 128x128 "$ICONSET_DIR/icon_128x128.png"
        convert "$TMP_DIR/icon-1024.png" -resize 256x256 "$ICONSET_DIR/icon_128x128@2x.png"
        convert "$TMP_DIR/icon-1024.png" -resize 256x256 "$ICONSET_DIR/icon_256x256.png"
        convert "$TMP_DIR/icon-1024.png" -resize 512x512 "$ICONSET_DIR/icon_256x256@2x.png"
        convert "$TMP_DIR/icon-1024.png" -resize 512x512 "$ICONSET_DIR/icon_512x512.png"
        convert "$TMP_DIR/icon-1024.png" -resize 1024x1024 "$ICONSET_DIR/icon_512x512@2x.png"
        
        iconutil -c icns "$ICONSET_DIR" -o "$ICONS_DIR/icon.icns"
    else
        # Linux method using png2icns
        # Create sizes needed for ICNS
        convert "$TMP_DIR/icon-1024.png" -resize 16x16 "$TMP_DIR/icns-16.png"
        convert "$TMP_DIR/icon-1024.png" -resize 32x32 "$TMP_DIR/icns-32.png"
        convert "$TMP_DIR/icon-1024.png" -resize 128x128 "$TMP_DIR/icns-128.png"
        convert "$TMP_DIR/icon-1024.png" -resize 256x256 "$TMP_DIR/icns-256.png"
        convert "$TMP_DIR/icon-1024.png" -resize 512x512 "$TMP_DIR/icns-512.png"
        
        png2icns "$ICONS_DIR/icon.icns" \
            "$TMP_DIR/icns-16.png" \
            "$TMP_DIR/icns-32.png" \
            "$TMP_DIR/icns-128.png" \
            "$TMP_DIR/icns-256.png" \
            "$TMP_DIR/icns-512.png"
    fi
    
    echo -e "${GREEN}  ✓ Created icon.icns${NC}"
else
    echo -e "${YELLOW}Skipping .icns generation (no tool available)${NC}"
fi

# ============================================================================
# Summary
# ============================================================================

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                     Icon Generation Complete!                     ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Generated files:${NC}"
ls -la "$ICONS_DIR"
echo ""
echo -e "${GREEN}All icons are ready for production builds!${NC}"
