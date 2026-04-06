#!/bin/bash

# Run Tests on Android Emulator (macOS)
# - Robust SDK/emulator/adb discovery
# - Safe cleanup (no broad pkill)
# - Supports launching emulator only (for Desktop shortcut)

set -euo pipefail

usage() {
  cat <<'EOF'
Usage: ./run-on-emulator.sh [options]

Options:
  --avd <name>           AVD name (default: Pixel_7_Pro)
  --start-only           Start emulator + wait for boot, then exit (no Appium/tests)
  --gui                  Show emulator window
  --headless             Start emulator without window (default)
  --gpu <mode>           GPU mode: swiftshader_indirect|host|auto (default: swiftshader_indirect)
  --memory <mb>          RAM in MB (default: 4096)
  --wipe-data            Wipe emulator userdata (default)
  --no-wipe              Do not wipe userdata
  --doctor               Print resolved SDK/emulator/adb paths and list AVDs, then exit
  --kill-appium          Kill process bound to port 4723 before starting (default)
  --no-kill-appium       Do not kill anything on port 4723
  -h, --help             Show help
EOF
}

AVD_NAME="Pixel_7_Pro"
START_ONLY=0
HEADLESS=1
GPU_MODE="swiftshader_indirect"
MEMORY=4096
WIPE_DATA=0
DOCTOR=0
KILL_APPIUM=1

while [[ $# -gt 0 ]]; do
  case "$1" in
    --avd)
      AVD_NAME="${2:-}"
      shift 2
      ;;
    --start-only)
      START_ONLY=1
      shift
      ;;
    --gui)
      HEADLESS=0
      shift
      ;;
    --headless)
      HEADLESS=1
      shift
      ;;
    --gpu)
      GPU_MODE="${2:-}"
      shift 2
      ;;
    --memory)
      MEMORY="${2:-}"
      shift 2
      ;;
    --wipe-data)
      WIPE_DATA=1
      shift
      ;;
    --no-wipe|--no-wipe-data)
      WIPE_DATA=0
      shift
      ;;
    --doctor)
      DOCTOR=1
      shift
      ;;
    --kill-appium)
      KILL_APPIUM=1
      shift
      ;;
    --no-kill-appium)
      KILL_APPIUM=0
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1"
      usage
      exit 2
      ;;
  esac
done

resolve_sdk_root() {
  if [[ -n "${ANDROID_SDK_ROOT:-}" && -d "${ANDROID_SDK_ROOT:-}" ]]; then
    echo "$ANDROID_SDK_ROOT"
    return 0
  fi
  if [[ -n "${ANDROID_HOME:-}" && -d "${ANDROID_HOME:-}" ]]; then
    echo "$ANDROID_HOME"
    return 0
  fi
  if [[ -d "$HOME/Library/Android/sdk" ]]; then
    echo "$HOME/Library/Android/sdk"
    return 0
  fi
  return 1
}

find_emulator_bin() {
  local sdk_root="$1"
  if [[ -x "$sdk_root/emulator/emulator" ]]; then
    echo "$sdk_root/emulator/emulator"
    return 0
  fi
  if command -v emulator >/dev/null 2>&1; then
    command -v emulator
    return 0
  fi
  return 1
}

find_adb_bin() {
  local sdk_root="$1"
  if [[ -x "$sdk_root/platform-tools/adb" ]]; then
    echo "$sdk_root/platform-tools/adb"
    return 0
  fi
  if command -v adb >/dev/null 2>&1; then
    command -v adb
    return 0
  fi
  return 1
}

SDK_ROOT="$(resolve_sdk_root)" || {
  echo "ERROR: Android SDK not found. Set ANDROID_SDK_ROOT or ANDROID_HOME."
  exit 1
}

export ANDROID_HOME="$SDK_ROOT"
export ANDROID_SDK_ROOT="$SDK_ROOT"
export PATH="$SDK_ROOT/emulator:$SDK_ROOT/platform-tools:$SDK_ROOT/cmdline-tools/latest/bin:$PATH"

EMULATOR_BIN="$(find_emulator_bin "$SDK_ROOT")" || {
  echo "ERROR: Emulator binary not found. Expected at: $SDK_ROOT/emulator/emulator"
  exit 1
}

ADB_BIN="$(find_adb_bin "$SDK_ROOT")" || {
  echo "ERROR: adb not found. Expected at: $SDK_ROOT/platform-tools/adb"
  exit 1
}

echo "========================================="
echo "Starting Test Execution on Emulator"
echo "========================================="

if (( DOCTOR )); then
  echo "SDK_ROOT:      $SDK_ROOT"
  echo "EMULATOR_BIN:  $EMULATOR_BIN"
  echo "ADB_BIN:       $ADB_BIN"
  echo "Available AVDs:"
  "$EMULATOR_BIN" -list-avds || true
  exit 0
fi

safe_cleanup() {
  echo "Step 1: Cleaning up existing processes..."

  # Stop running Android emulators via adb (safe, no name-based killing).
  if "$ADB_BIN" devices >/dev/null 2>&1; then
    while IFS= read -r serial; do
      [[ -z "$serial" ]] && continue
      echo "  Stopping running emulator: $serial"
      "$ADB_BIN" -s "$serial" emu kill >/dev/null 2>&1 || true
    done < <("$ADB_BIN" devices | awk 'NR>1 && $1 ~ /^emulator-/ {print $1}')
  fi

  # Stop Appium only if something is bound to port 4723 (more precise than pkill).
  if (( KILL_APPIUM )); then
    if command -v lsof >/dev/null 2>&1; then
      local pids
      pids="$(lsof -ti:4723 2>/dev/null || true)"
      if [[ -n "$pids" ]]; then
        echo "  Stopping process(es) on port 4723 (Appium): $(echo "$pids" | tr '\n' ' ')"
        while IFS= read -r pid; do
          [[ -n "$pid" ]] && kill "$pid" 2>/dev/null || true
        done <<< "$pids"
      fi
    fi
  fi

  sleep 2
}

start_emulator() {
  echo "Step 2: Starting emulator ($AVD_NAME)..."

  if ! "$EMULATOR_BIN" -list-avds | grep -Fxq "$AVD_NAME"; then
    echo "ERROR: AVD '$AVD_NAME' not found. Available AVDs:"
    "$EMULATOR_BIN" -list-avds || true
    exit 1
  fi

  local -a flags
  flags=( -avd "$AVD_NAME" )

  case "$GPU_MODE" in
    swiftshader_indirect|host|auto) ;;
    *)
      echo "ERROR: Invalid --gpu value: $GPU_MODE (expected: swiftshader_indirect|host|auto)"
      exit 2
      ;;
  esac

  if (( HEADLESS )); then
    flags+=( -no-window -no-audio -no-boot-anim )
  else
    flags+=( -no-audio )
  fi

  flags+=( -gpu "$GPU_MODE" )
  flags+=( -memory "$MEMORY" )

  if (( WIPE_DATA )); then
    flags+=( -wipe-data )
  fi

  "$EMULATOR_BIN" "${flags[@]}" &
  EMULATOR_PID=$!
  echo "  Emulator PID: $EMULATOR_PID"
  sleep 2
}

wait_for_boot() {
  echo "Step 3: Waiting for emulator to boot..."

  # adb can transiently disconnect while the emulator is coming up; retry until a device is listed.
  "$ADB_BIN" start-server >/dev/null 2>&1 || true

  local tries=0
  while true; do
    if "$ADB_BIN" devices | awk 'NR>1 && $1 != "" {found=1} END {exit(found?0:1)}'; then
      break
    fi
    tries=$((tries+1))
    if (( tries > 120 )); then
      echo "ERROR: No device detected via adb after waiting."
      "$ADB_BIN" devices -l || true
      return 1
    fi
    sleep 2
  done

  echo "  Device detected, waiting for boot complete..."
  local boot_tries=0
  while true; do
    boot_tries=$((boot_tries+1))
    local boot
    boot=$("$ADB_BIN" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r' || true)
    if [[ "$boot" == "1" ]]; then
      break
    fi
    if (( boot_tries > 300 )); then
      echo "ERROR: Emulator boot did not complete in time."
      return 1
    fi
    sleep 2
  done

  echo "  Boot complete!"
  sleep 2
}

safe_cleanup
start_emulator
wait_for_boot

# Ensure WDIO targets the running emulator (wdio config uses ANDROID_DEVICE)
ANDROID_DEVICE_SERIAL=$("$ADB_BIN" devices | awk 'NR>1 && $1 ~ /^emulator-/ {print $1; exit}')
if [[ -n "${ANDROID_DEVICE_SERIAL:-}" ]]; then
  export ANDROID_DEVICE="$ANDROID_DEVICE_SERIAL"
  echo "Using ANDROID_DEVICE=$ANDROID_DEVICE"
fi

if (( START_ONLY )); then
  echo "Emulator is up. Exiting due to --start-only."
  exit 0
fi

# Check if app is installed
echo "Step 4: Checking if my6 app is installed..."
APP_INSTALLED=$("$ADB_BIN" shell pm list packages | grep "com.my6.android" || echo "NOT_FOUND")

if [[ "$APP_INSTALLED" == "NOT_FOUND" ]]; then
  echo "  WARNING: App 'com.my6.android' not installed on emulator!"
  echo "  Please install the app manually or provide APK in apps/android/"
  echo "  You can download from Play Store on emulator or use: adb install path/to/app.apk"
else
  echo "  App installed: $APP_INSTALLED"
fi

# Start Appium
echo "Step 5: Starting Appium server..."
npx appium --allow-insecure chromedriver_autodownload > appium.log 2>&1 &
APPIUM_PID=$!
echo "  Appium PID: $APPIUM_PID"
sleep 5

# Check Appium is running
if command -v lsof >/dev/null 2>&1 && lsof -ti:4723 >/dev/null 2>&1; then
  echo "  Appium server ready on port 4723"
else
  echo "  ERROR: Appium failed to start (port 4723 not listening)."
  echo "  --- appium.log (tail) ---"
  tail -200 appium.log || true
  exit 1
fi

# Run tests
echo "Step 6: Running homepage tests..."
npx wdio wdio.motel6.android.conf.ts --spec src/motel6/android/tests/homepageTest.spec.ts

# Cleanup
echo ""
echo "========================================="
echo "Cleaning up..."
echo "========================================="
kill "$APPIUM_PID" 2>/dev/null || true
kill "$EMULATOR_PID" 2>/dev/null || true
echo "Done!"
