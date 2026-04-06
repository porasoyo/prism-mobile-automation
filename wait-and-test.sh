#!/bin/bash

##################################################################
# Wait for Emulator and Run Tests
# This script waits for emulator to be fully ready, then runs tests
##################################################################

echo "⏳ Waiting for emulator to be fully ready..."
echo ""

# Wait for device to appear
echo "Step 1: Waiting for device to appear..."
for i in {1..60}; do
    if adb devices | grep -q "emulator.*device"; then
        DEVICE=$(adb devices | awk 'NR>1 && $2 == "device" {print $1; exit}')
        echo "✅ Device detected: $DEVICE"
        break
    fi
    echo -n "."
    sleep 2
done
echo ""

if [ -z "$DEVICE" ]; then
    echo "❌ No emulator found. Please start emulator first:"
    echo "   cd \$HOME/Library/Android/sdk/emulator && ./emulator -avd Pixel_7_Pro -gpu swiftshader_indirect -memory 4096 -no-snapshot-load -no-boot-anim &"
    exit 1
fi

# Wait for boot complete
echo "Step 2: Waiting for boot to complete..."
for i in {1..120}; do
    BOOT_COMPLETE=$(adb -s "$DEVICE" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r\n')
    if [ "$BOOT_COMPLETE" = "1" ]; then
        echo "✅ Emulator booted successfully!"
        break
    fi
    echo -n "."
    sleep 2
done
echo ""

if [ "$BOOT_COMPLETE" != "1" ]; then
    echo "⚠️  Boot timed out, but will try to run tests anyway..."
fi

# Check if app is installed
echo "Step 3: Checking if app is installed..."
APP_INSTALLED=$(adb -s "$DEVICE" shell pm list packages | grep "com.my6.android" || echo "")
if [ -z "$APP_INSTALLED" ]; then
    echo "⚠️  App not installed. Tests will install it automatically."
else
    echo "✅ App already installed: com.my6.android"
fi

echo ""
echo "======================================"
echo "🚀 READY TO RUN TESTS!"
echo "======================================"
echo "Device: $DEVICE"
echo "Boot: Complete"
echo ""

# Run tests
echo "Running tests..."
npx wdio wdio.motel6.android.conf.ts

echo ""
echo "======================================"
echo "✅ TESTS COMPLETED!"
echo "======================================"
echo "Check reports: test-reports/test-report-*.html"
echo ""
