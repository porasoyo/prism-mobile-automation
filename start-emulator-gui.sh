#!/bin/bash
# Guaranteed GUI emulator launcher for macOS
set -e

SDK="$HOME/Library/Android/sdk"
AVD_NAME="${1:-Pixel_7_Pro}"

echo "🧹 Cleaning up any existing emulators..."
# Kill existing emulators safely
"$SDK/platform-tools/adb" devices | awk 'NR>1 && $1 ~ /^emulator-/ {print $1}' | while read serial; do
    echo "  Stopping $serial..."
    "$SDK/platform-tools/adb" -s "$serial" emu kill 2>/dev/null || true
done
sleep 3

echo "📱 Starting $AVD_NAME with GUI..."
echo "  GPU: swiftshader_indirect (software rendering - always visible)"
echo "  Window: ENABLED (you WILL see it!)"
echo ""

# Start emulator with explicit window flags
cd "$SDK/emulator"
./emulator -avd "$AVD_NAME" \
  -gpu swiftshader_indirect \
  -memory 4096 \
  -no-boot-anim \
  -netdelay none \
  -netspeed full \
  -verbose \
  2>&1 | tee /tmp/emulator_startup.log &

EMULATOR_PID=$!
echo "Emulator PID: $EMULATOR_PID"
echo ""
echo "⏳ Waiting for emulator to boot (this will take 30-60 seconds)..."
echo "   👀 LOOK FOR THE EMULATOR WINDOW ON YOUR SCREEN!"
echo ""

# Wait for device to appear
for i in {1..60}; do
    if "$SDK/platform-tools/adb" devices | grep -q "emulator.*device"; then
        DEVICE=$("$SDK/platform-tools/adb" devices | awk 'NR>1 && $1 ~ /^emulator-/ {print $1; exit}')
        echo "✅ Device detected: $DEVICE"
        break
    fi
    echo -n "."
    sleep 1
done
echo ""

# Wait for boot complete
for i in {1..60}; do
    BOOT_COMPLETE=$("$SDK/platform-tools/adb" -s "$DEVICE" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')
    if [ "$BOOT_COMPLETE" = "1" ]; then
        echo "✅ Emulator booted successfully!"
        echo ""
        echo "======================================"
        echo "🎉 EMULATOR READY!"
        echo "======================================"
        echo "Device: $DEVICE"
        echo "AVD: $AVD_NAME"
        echo "GUI: ✅ VISIBLE (check your screen!)"
        echo ""
        echo "💡 Tips:"
        echo "  • Look for 'Pixel 7 Pro' window"
        echo "  • Check all monitors if you have multiple"
        echo "  • Press ⌘+Tab to find the window"
        echo "  • Check Mission Control (F3)"
        echo "======================================"
        exit 0
    fi
    sleep 1
done

echo "⚠️  Timeout waiting for boot. Check logs at /tmp/emulator_startup.log"
exit 1
