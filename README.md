# Motel 6 Mobile Test Automation

Professional mobile test automation with comprehensive reporting.

## 📁 Clean Structure

```
prism-mobile-automation/
├── apps/                           # App binaries
├── src/
│   ├── motel6/android/
│   │   ├── pages/                  # Page Object Models
│   │   └── tests/                  # Test Specs (homepageTest.spec.ts)
│   ├── utils/                      # TestReporter.ts, logger.ts
│   └── types/                      # Type definitions
├── test-reports/                   # ALL test outputs here
│   ├── screenshots/                # Test screenshots
│   ├── *.html                      # Interactive reports
│   └── *.json                      # JSON reports
├── run-test.sh                     # Main test runner
├── run-on-emulator.sh              # Emulator management
├── setup-android-sdk.sh            # SDK setup
├── start-emulator-gui.sh           # Start emulator
└── README.md                       # This file
```

## 🚀 Quick Start

```bash
# 1. Setup (first time)
./setup-android-sdk.sh
./start-emulator-gui.sh

# 2. Run tests (Terminal 1: Appium)
npx appium --allow-insecure chromedriver_autodownload

# 3. Run tests (Terminal 2: Tests)
./run-test.sh src/motel6/android/tests/homepageTest.spec.ts

# 4. View reports
open test-reports/test-report-*.html
```

## 📊 Test Reporting

**TestReporter** provides:
- ✅ Step-by-step logging with timestamps
- 📸 Automatic screenshots on every step
- ❌ Full error capture with stack traces  
- 📋 Auto-generated reproduction steps
- 🎨 Interactive HTML reports
- 📄 JSON reports for CI/CD
- 📈 Metadata tracking (success rates, device info)

**All outputs in**: `test-reports/` (screenshots, HTML, JSON)

## 🧪 Test Cases

- **TC001**: Search 5 USA cities (Dallas, Houston, LA, Phoenix, San Antonio)
- **TC002**: Advanced search (2 guests + AAA rate code + Dallas)

## 📝 Writing Tests

```typescript
import { TestReporter } from '../../../utils/TestReporter';

describe('Test Suite', () => {
  let reporter: TestReporter;
  
  before(async function() {
    reporter = new TestReporter('Suite Name', 'Android', 'Production');
    const caps: any = driver.capabilities;
    reporter.setDeviceInfo(caps.deviceName || 'Unknown', caps.platformVersion || 'Unknown');
  });

  it('TC001 - Test', async function() {
    reporter.startTest('TC001', 'Description');
    
    const screenshot = await reporter.captureScreenshot(driver, 'Action');
    reporter.addStep('Action', 'success', screenshot);
    
    reporter.endTest('passed', undefined, undefined, activity, metadata);
  });

  after(async function() {
    reporter.printSummary();
    reporter.generateHTMLReport();
    reporter.generateJSONReport();
  });
});
```

## 🛠 Scripts

- `run-test.sh` - Main test runner
- `run-on-emulator.sh` - Emulator with 4GB RAM
- `setup-android-sdk.sh` - SDK installation
- `start-emulator-gui.sh` - Emulator with GUI

## 🧹 Maintenance

```bash
# Clean old test artifacts
find test-reports -name "*.png" -delete
find test-reports -name "*.html" -delete  
find test-reports -name "*.json" -delete
```

## 🎯 Best Practices

1. **Page Object Model** - Selectors in page objects
2. **TestReporter** - Use for all tests
3. **Atomic Tests** - One test = one feature
4. **Clear Naming** - TC001, TC002...
5. **Screenshots** - Capture at critical steps
6. **Error Handling** - Try-catch with reporter
7. **Metadata** - Track context in reports

## 🔧 Troubleshooting

```bash
# Emulator issues
adb devices
adb kill-server && adb start-server

# Test failures
# Check: test-reports/*.html for detailed steps
# Check: test-reports/screenshots/ for visual evidence
```

## 📦 Tech Stack

WebDriverIO + Appium 2.x + TypeScript + Mocha + TestReporter

---

**Version**: 2.0 | **Updated**: March 2026 | Clean & Professional ✨
