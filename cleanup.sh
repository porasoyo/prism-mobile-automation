#!/bin/bash
# cleanup.sh - Kill all test-related processes and clean up Android state
#
# Run this when:
# - Tests get stuck
# - UiAutomator2 keeps crashing
# - You see "port busy" errors
# - Appium won't start

echo "🧹 Cleaning up test environment..."

# Kill Appium processes
echo "Stopping Appium..."
pkill -9 -f "appium" 2>/dev/null || true

# Kill WDIO processes  
echo "Stopping WDIO..."
pkill -9 -f "wdio" 2>/dev/null || true

# Kill any node processes related to the project (be careful - this is aggressive)
echo "Stopping related Node processes..."
pkill -9 -f "ts-node.*motel6" 2>/dev/null || true

# Set up ADB path
SDK="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
ADB="$SDK/platform-tools/adb"

# Get device ID
DEVICE=$($ADB devices 2>/dev/null | awk 'NR>1 && $2=="device" {print $1; exit}')

if [ -n "$DEVICE" ]; then
    echo "Found device: $DEVICE"
    
    # Remove all ADB port forwards (CRITICAL for Android 16)
    echo "Clearing ADB forwards..."
    $ADB forward --remove-all 2>/dev/null || true
    
    # Stop UiAutomator2 server on device
    echo "Stopping UiAutomator2 server..."
    $ADB -s "$DEVICE" shell "am force-stop io.appium.uiautomator2.server" 2>/dev/null || true
    $ADB -s "$DEVICE" shell "am force-stop io.appium.uiautomator2.server.test" 2>/dev/null || true
    
    # Kill any instrumentation processes
    echo "Killing instrumentation..."
    $ADB -s "$DEVICE" shell "am kill-all" 2>/dev/null || true
    
    # Optional: Clear UiAutomator2 app data (uncomment if crashes persist)
    # echo "Clearing UiAutomator2 data..."
    # $ADB -s "$DEVICE" shell "pm clear io.appium.uiautomator2.server" 2>/dev/null || true
else
    echo "⚠️  No device connected"
fi

# Free up ports
echo "Freeing ports..."
lsof -ti:4725 | xargs kill -9 2>/dev/null || true
lsof -ti:8200 | xargs kill -9 2>/dev/null || true
lsof -ti:8201 | xargs kill -9 2>/dev/null || true

echo ""
echo "✅ Cleanup complete!"
echo ""
echo "To start fresh:"
echo "  1. Start Appium:  ./node_modules/.bin/appium --port 4725 --relaxed-security"
echo "  2. Run test:      npx wdio wdio.motel6.android.conf.ts --spec 'path/to/test'"
