#!/usr/bin/env bash
set -e

echo "🚀 Starting Swift Build for HelloWorldApp (Release)..."
swift build -c release

echo "📦 Creating App Bundle Structure for HelloWorldApp.app..."
BUILD_DIR="build"
APP_DIR="$BUILD_DIR/HelloWorldApp.app"
CONTENTS_DIR="$APP_DIR/Contents"
MACOS_DIR="$CONTENTS_DIR/MacOS"
RESOURCES_DIR="$CONTENTS_DIR/Resources"

rm -rf "$BUILD_DIR"
mkdir -p "$MACOS_DIR" "$RESOURCES_DIR"

echo "🔍 Searching for binary: HelloWorldApp..."
# First, try to get the path directly from Swift
SPM_BIN_PATH=$(swift build -c release --show-bin-path 2>/dev/null || echo "")
echo "📂 SPM Suggestion: $SPM_BIN_PATH"

# Robust, case-insensitive binary detection across the whole .build folder (excluding debug symbols and derived data)
BINARY_SOURCE=$(find .build -type f -iname "HelloWorldApp" 2>/dev/null | grep -i -v ".dSYM" | grep -v "derived-data" | head -n 1)

if [ -z "$BINARY_SOURCE" ] && [ -n "$SPM_BIN_PATH" ] && [ -d "$SPM_BIN_PATH" ]; then
    BINARY_SOURCE=$(find "$SPM_BIN_PATH" -type f -iname "HelloWorldApp" 2>/dev/null | head -n 1)
fi

if [ -z "$BINARY_SOURCE" ]; then
    echo "❌ Error: Binary HelloWorldApp not found anywhere in .build/"
    echo "📂 Directory structure of .build (Depth 4):"
    find .build -maxdepth 4 -not -path '*/.*' 2>/dev/null || echo "Could not list .build"
    exit 1
fi

echo "✅ Found binary at: $BINARY_SOURCE"

echo "📂 Assembling App Bundle..."
cp "$BINARY_SOURCE" "$MACOS_DIR/HelloWorldApp"

# Copy Resources/Bundles
echo "📦 Copying Resources..."
find "$SPM_BIN_PATH" -name "*.bundle" -type d -exec cp -R {} "$RESOURCES_DIR/" \; 2>/dev/null || true

ICON_SOURCE="Resources/AppIcon.png"
if [ -f "$ICON_SOURCE" ]; then
    echo "🎨 Generating App Icons..."
    ICONSET_DIR="Resources/AppIcon.iconset"
    mkdir -p "$ICONSET_DIR"
    for SIZE in 16 32 64 128 256 512 1024; do
        HALF_SIZE=$((SIZE/2))
        if [ $SIZE -le 512 ]; then sips -z $SIZE $SIZE "$ICON_SOURCE" --out "$ICONSET_DIR/icon_${SIZE}x${SIZE}.png" >/dev/null 2>&1 || true; fi
        if [ $SIZE -ge 32 ]; then sips -z $SIZE $SIZE "$ICON_SOURCE" --out "$ICONSET_DIR/icon_${HALF_SIZE}x${HALF_SIZE}@2x.png" >/dev/null 2>&1 || true; fi
    done
    iconutil -c icns "$ICONSET_DIR" -o "$RESOURCES_DIR/AppIcon.icns" || true
    rm -rf "$ICONSET_DIR"
fi

echo "📄 Creating Info.plist..."
cat << 'EOF_PLIST' > "$CONTENTS_DIR/Info.plist"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>HelloWorldApp</string>
    <key>CFBundleIdentifier</key>
    <string>com.native.helloworldapp</string>
    <key>CFBundleName</key>
    <string>HelloWorldApp</string>
    <key>CFBundleDisplayName</key>
    <string>HelloWorldApp</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0</string>
    <key>CFBundleIconFile</key>
    <string>AppIcon</string>
    <key>LSMinimumSystemVersion</key>
    <string>13.0</string>
    <key>NSHighResolutionCapable</key>
    <true/>
</dict>
</plist>
EOF_PLIST

echo "APPL????" > "$CONTENTS_DIR/PkgInfo"

echo "🚀 Opening the App..."
# Check if the app bundle exists before opening
if [ -d "$PWD/$APP_DIR" ]; then
    open "$PWD/$APP_DIR" || true
else
    echo "⚠️ Warning: Application bundle not found at $PWD/$APP_DIR"
fi

echo "🗜 Compressing App Bundle..."
cd "$BUILD_DIR"
if [ -d "HelloWorldApp.app" ]; then
    zip -q -r "HelloWorldApp.zip" "HelloWorldApp.app"
    ZIP_PATH="$PWD/HelloWorldApp.zip"
    echo "✅ Packaging Complete: $PWD/HelloWorldApp.app"
    echo "📦 ZIP_READY: $ZIP_PATH"
else
    echo "❌ Error: Packaging failed, HelloWorldApp.app does not exist in build directory."
fi
