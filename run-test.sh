#!/bin/bash
# One-command test runner: starts emulator + Appium + runs tests
set -e

SPEC_FILE="${1:-src/motel6/android/tests/homepageTest.spec.ts}"
shift || true
SDK="$HOME/Library/Android/sdk"
ADB="$SDK/platform-tools/adb"

echo "========================================="
echo "🚀 All-in-One Test Runner"
echo "========================================="

# 1. Check Device (Priority: Real Device > Emulator)
echo "📱 Checking device..."

echo "  ↳ adb devices -l:"
$ADB devices -l | sed -n '1,20p' 2>/dev/null || $ADB devices -l 2>/dev/null || true

# Wait briefly for a real device to appear (helps when USB reconnects / RSA prompt).
WAIT_FOR_REAL_DEVICE_SECONDS="${WAIT_FOR_REAL_DEVICE_SECONDS:-15}"
FORCE_REAL_DEVICE="${FORCE_REAL_DEVICE:-false}"
SKIP_EMULATOR_START="${SKIP_EMULATOR_START:-false}"

# First check for real device (non-emulator)
DEVICE=""
for i in $(seq 1 "$WAIT_FOR_REAL_DEVICE_SECONDS"); do
    DEVICE=$($ADB devices | awk 'NR>1 && $2=="device" && $1 !~ /^emulator-/ {print $1; exit}')
    if [ -n "$DEVICE" ]; then
        break
    fi
    sleep 1
done

if [ -n "$DEVICE" ]; then
    echo "  ✓ Real device connected: $DEVICE"
else
    if [ "$FORCE_REAL_DEVICE" = "true" ]; then
        echo "  ✗ No real device in 'device' state."
        echo "    - If you see 'unauthorized' on the phone: unlock + Accept the RSA prompt."
        echo "    - If you see 'offline': reconnect USB / toggle USB debugging."
        echo "    - Run '$ADB devices -l' to confirm status."
        exit 1
    fi

    # No real device, check for emulator
    echo "  No real device found, checking emulator..."
    DEVICE=$($ADB devices | awk 'NR>1 && $1 ~ /^emulator-/ {print $1; exit}')
    
    if [ -z "$DEVICE" ]; then
        if [ "$SKIP_EMULATOR_START" = "true" ]; then
            echo "  ✗ No emulator running and SKIP_EMULATOR_START=true."
            exit 1
        fi
        echo "  Starting emulator with GUI (--no-wipe to preserve apps)..."
        ./run-on-emulator.sh --avd Pixel_7_Pro --gui --memory 4096 --no-wipe --start-only
        sleep 5
        DEVICE=$($ADB devices | awk 'NR>1 && $1 ~ /^emulator-/ {print $1; exit}')
    else
        echo "  ✓ Emulator running: $DEVICE"
    fi
fi

# Optional hard reset (force-stop + clear data) before starting Appium / tests.
# Default: true (to avoid corrupted in-app state between runs).
APP_ID="com.my6.android"
RESET_APP="${RESET_APP:-true}"
if [ "$RESET_APP" = "true" ]; then
    echo "🧹 Resetting app state (force-stop + clear data): $APP_ID"
    $ADB -s "$DEVICE" shell am force-stop "$APP_ID" >/dev/null 2>&1 || true
    $ADB -s "$DEVICE" shell pm clear "$APP_ID" >/dev/null 2>&1 || true
    echo "  ✓ App reset done"
else
    echo "🧹 App reset skipped (RESET_APP=$RESET_APP)"
fi

# 2. Check/Start Appium
echo "🔧 Checking Appium..."

APPIUM_PORT="${APPIUM_PORT:-4725}"

# UiAutomator2 uses a local TCP port (systemPort) forwarded to the device.
# If UiAutomator2 crashes, the ADB port-forward may remain and make the next
# session fail with: "local port #XXXX is busy".
#
# We compute a default systemPort from APPIUM_PORT (same logic as wdio config)
# but also ensure it is actually free before running.
find_free_port() {
    local start_port="$1"
    local end_port="$2"
    local p
    for p in $(seq "$start_port" "$end_port"); do
        if ! lsof -nP -iTCP:"$p" -sTCP:LISTEN >/dev/null 2>&1; then
            echo "$p"
            return 0
        fi
    done
    return 1
}

DEFAULT_UIA2_SYSTEM_PORT=$((8200 + (APPIUM_PORT % 100)))
UIA2_SYSTEM_PORT="${UIA2_SYSTEM_PORT:-$DEFAULT_UIA2_SYSTEM_PORT}"

# If the requested system port is busy, pick the next free port in a small range.
if lsof -nP -iTCP:"$UIA2_SYSTEM_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
    FREE_PORT=$(find_free_port "$DEFAULT_UIA2_SYSTEM_PORT" $((DEFAULT_UIA2_SYSTEM_PORT + 50)) || true)
    if [ -n "$FREE_PORT" ]; then
        UIA2_SYSTEM_PORT="$FREE_PORT"
    fi
fi

export UIA2_SYSTEM_PORT

# Remove stale ADB forwards for the chosen local system port.
$ADB -s "$DEVICE" forward --remove tcp:"$UIA2_SYSTEM_PORT" >/dev/null 2>&1 || true

LOG_DIR="${LOG_DIR:-logs}"
APPIUM_LOG_FILE="$LOG_DIR/appium-$APPIUM_PORT.log"

export APPIUM_PORT

# Keep artifacts tidy by default so the repo doesn't accumulate junk.
# Disable via CLEAN_ARTIFACTS=false if you want to preserve previous runs.
CLEAN_ARTIFACTS="${CLEAN_ARTIFACTS:-true}"
if [ "$CLEAN_ARTIFACTS" = "true" ]; then
    mkdir -p test-artifacts
    # Prefer real deletion (does not use rm), but fall back to truncation if needed.
    find test-artifacts -type f -delete 2>/dev/null || true
    find test-artifacts -type f -print0 2>/dev/null | xargs -0 -I{} sh -c ': > "$1"' _ {} 2>/dev/null || true
fi

mkdir -p "$LOG_DIR"

if ! lsof -nP -iTCP:$APPIUM_PORT -sTCP:LISTEN >/dev/null 2>&1; then
    echo "  Starting Appium on port $APPIUM_PORT..."
    # Appium v3 requires the allow-insecure feature to be prefixed with either
    # a driver name (e.g. uiautomator2:...) or '*' to apply to all drivers.
    npx appium --port "$APPIUM_PORT" --allow-insecure "*:chromedriver_autodownload" > "$APPIUM_LOG_FILE" 2>&1 &
    APPIUM_PID=$!
    echo "  Waiting for Appium to start..."
    for i in $(seq 1 30); do
        if lsof -nP -iTCP:$APPIUM_PORT -sTCP:LISTEN >/dev/null 2>&1; then
            echo "  ✓ Appium ready on port $APPIUM_PORT"
            echo "  ↳ Log: $APPIUM_LOG_FILE"
            break
        fi
        sleep 1
    done

    if ! lsof -nP -iTCP:$APPIUM_PORT -sTCP:LISTEN >/dev/null 2>&1; then
        echo "  ✗ Appium failed to start on port $APPIUM_PORT"
        echo "  ↳ Check log: $APPIUM_LOG_FILE"
        tail -n 50 "$APPIUM_LOG_FILE" 2>/dev/null || true
        exit 1
    fi
else
        echo "  ✓ Appium already running on port $APPIUM_PORT"
        echo "  ↳ Log: $APPIUM_LOG_FILE"

    # Default: restart Appium to avoid stale sessions / stale drivers.
    RESTART_APPIUM="${RESTART_APPIUM:-true}"
    if [ "$RESTART_APPIUM" = "true" ]; then
        echo "  ↻ Restarting Appium (RESTART_APPIUM=true)"
        PIDS=$(lsof -tiTCP:$APPIUM_PORT -sTCP:LISTEN 2>/dev/null || true)
        if [[ -n "$PIDS" ]]; then
            echo "$PIDS" | xargs -I{} kill {} 2>/dev/null || true
            sleep 1
            echo "$PIDS" | xargs -I{} kill -9 {} 2>/dev/null || true
        fi
        echo "  Starting Appium on port $APPIUM_PORT..."
        npx appium --port "$APPIUM_PORT" --allow-insecure "*:chromedriver_autodownload" > "$APPIUM_LOG_FILE" 2>&1 &
        APPIUM_PID=$!
        echo "  Waiting for Appium to start..."
        for i in $(seq 1 30); do
            if lsof -nP -iTCP:$APPIUM_PORT -sTCP:LISTEN >/dev/null 2>&1; then
                echo "  ✓ Appium ready on port $APPIUM_PORT"
                echo "  ↳ Log: $APPIUM_LOG_FILE"
                break
            fi
            sleep 1
        done

        if ! lsof -nP -iTCP:$APPIUM_PORT -sTCP:LISTEN >/dev/null 2>&1; then
            echo "  ✗ Appium failed to start on port $APPIUM_PORT"
            echo "  ↳ Check log: $APPIUM_LOG_FILE"
            tail -n 50 "$APPIUM_LOG_FILE" 2>/dev/null || true
            exit 1
        fi
    fi

        # Make sure we are talking to the expected Appium major.
        # On Android 16 / API 36 we need Appium 3 + newer UiAutomator2.
        # Skip this check if we already restarted Appium above.
        if [ "${RESTART_APPIUM:-true}" != "true" ]; then
        EXISTING_VERSION=$(node - <<'NODE'
const http = require('http');
const port = Number(process.env.APPIUM_PORT || 4725);
const req = http.request({ hostname: '127.0.0.1', port, path: '/status', method: 'GET', timeout: 4000 }, (res) => {
    let body = '';
    res.setEncoding('utf8');
    res.on('data', (c) => (body += c));
    res.on('end', () => {
        try {
            const j = JSON.parse(body);
            const v = j?.value?.build?.version || '';
            process.stdout.write(String(v));
        } catch {
            process.stdout.write('');
        }
    });
});
req.on('timeout', () => req.destroy(new Error('timeout')));
req.on('error', () => process.stdout.write(''));
req.end();
NODE
)

    if [[ -n "$EXISTING_VERSION" && "$EXISTING_VERSION" != 3.* ]]; then
                echo "  ⚠️  Appium on port $APPIUM_PORT is v$EXISTING_VERSION (expected v3.x). Restarting..."
                PIDS=$(lsof -tiTCP:$APPIUM_PORT -sTCP:LISTEN 2>/dev/null || true)
                if [[ -n "$PIDS" ]]; then
                        echo "$PIDS" | xargs -I{} kill {} 2>/dev/null || true
                        sleep 1
                        echo "$PIDS" | xargs -I{} kill -9 {} 2>/dev/null || true
                fi

                echo "  Starting Appium on port $APPIUM_PORT..."
                npx appium --port "$APPIUM_PORT" --allow-insecure "*:chromedriver_autodownload" > "$APPIUM_LOG_FILE" 2>&1 &
                APPIUM_PID=$!
                echo "  Waiting for Appium to start..."
                for i in $(seq 1 30); do
                        if lsof -nP -iTCP:$APPIUM_PORT -sTCP:LISTEN >/dev/null 2>&1; then
                                echo "  ✓ Appium ready on port $APPIUM_PORT"
                                echo "  ↳ Log: $APPIUM_LOG_FILE"
                                break
                        fi
                        sleep 1
                done

                if ! lsof -nP -iTCP:$APPIUM_PORT -sTCP:LISTEN >/dev/null 2>&1; then
                        echo "  ✗ Appium failed to start on port $APPIUM_PORT"
                        echo "  ↳ Check log: $APPIUM_LOG_FILE"
                        tail -n 50 "$APPIUM_LOG_FILE" 2>/dev/null || true
                        exit 1
                fi
        fi
            fi
fi

# 3. Run Tests
echo "🧪 Running tests: $SPEC_FILE"
export ANDROID_HOME="$SDK"
export ANDROID_SDK_ROOT="$SDK"
export ANDROID_DEVICE="$DEVICE"

npx wdio wdio.motel6.android.conf.ts --spec "$SPEC_FILE" "$@"

echo ""
echo "========================================="
echo "✅ Test run complete!"
echo "========================================="
