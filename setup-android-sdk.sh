#!/bin/bash

# Android SDK Setup Script for macOS
# This script installs Android SDK without Android Studio

set -e

echo "========================================="
echo "Android SDK Setup for Test Automation"
echo "========================================="
echo ""

# Set variables
ANDROID_HOME="$HOME/Library/Android/sdk"
CMDLINE_TOOLS_URL="https://dl.google.com/android/repository/commandlinetools-mac-11076708_latest.zip"
CMDLINE_TOOLS_ZIP="commandlinetools.zip"

# Step 1: Create SDK directory
echo "Step 1: Creating SDK directory..."
mkdir -p "$ANDROID_HOME/cmdline-tools"

# Step 2: Download command-line tools if not exists
if [ ! -f "$CMDLINE_TOOLS_ZIP" ]; then
    echo "Step 2: Downloading Android command-line tools..."
    curl -o "$CMDLINE_TOOLS_ZIP" "$CMDLINE_TOOLS_URL"
else
    echo "Step 2: Command-line tools already downloaded"
fi

# Step 3: Extract command-line tools
echo "Step 3: Extracting command-line tools..."
unzip -q -o "$CMDLINE_TOOLS_ZIP" -d "$ANDROID_HOME/cmdline-tools"
mv "$ANDROID_HOME/cmdline-tools/cmdline-tools" "$ANDROID_HOME/cmdline-tools/latest" 2>/dev/null || true

# Step 4: Set environment variables
echo "Step 4: Setting environment variables..."
export ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"

# Step 5: Accept licenses
echo "Step 5: Accepting Android SDK licenses..."
yes | $ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager --licenses 2>&1 | head -50

# Step 6: Install required SDK components
echo "Step 6: Installing SDK components..."
echo "  - Platform tools (adb, fastboot)"
$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager "platform-tools"

echo "  - Build tools"
$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager "build-tools;33.0.0"

echo "  - Android platform (API 33)"
$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager "platforms;android-33"

echo "  - Emulator"
$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager "emulator"

echo "  - System image (x86_64 for M1/M2 Mac)"
$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager "system-images;android-33;google_apis;arm64-v8a"

# Step 7: Create AVD (Android Virtual Device)
echo "Step 7: Creating Android Virtual Device..."
echo "no" | $ANDROID_HOME/cmdline-tools/latest/bin/avdmanager create avd \
    -n Pixel_7_API_33 \
    -k "system-images;android-33;google_apis;arm64-v8a" \
    -d "pixel_7" \
    --force

# Step 8: Verify installation
echo ""
echo "========================================="
echo "Installation Complete!"
echo "========================================="
echo ""
echo "Installed components:"
$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager --list_installed | head -20
echo ""
echo "Available emulators:"
$ANDROID_HOME/emulator/emulator -list-avds
echo ""
echo "Environment variables (add to ~/.zshrc):"
echo "export ANDROID_HOME=$HOME/Library/Android/sdk"
echo "export PATH=\$ANDROID_HOME/cmdline-tools/latest/bin:\$ANDROID_HOME/platform-tools:\$ANDROID_HOME/emulator:\$PATH"
echo ""
echo "Next steps:"
echo "1. Run: export ANDROID_HOME=$HOME/Library/Android/sdk"
echo "2. Run: export PATH=\$ANDROID_HOME/cmdline-tools/latest/bin:\$ANDROID_HOME/platform-tools:\$ANDROID_HOME/emulator:\$PATH"
echo "3. Start emulator: emulator -avd Pixel_7_API_33 -no-window -no-audio &"
echo "4. Start Appium: npx appium --allow-insecure chromedriver_autodownload &"
echo "5. Run tests: npx wdio wdio.motel6.android.conf.ts --spec src/motel6/android/tests/homepageTest.spec.ts"
echo ""
