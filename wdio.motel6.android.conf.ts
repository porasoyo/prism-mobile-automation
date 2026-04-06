import type { Options } from '@wdio/types';
import path from 'path';

const USE_UNICODE_IME = String(process.env.USE_UNICODE_IME ?? '').toLowerCase() === 'true';
const APPIUM_PORT = Number(process.env.APPIUM_PORT ?? 4723);
const UIA2_SYSTEM_PORT = Number(process.env.UIA2_SYSTEM_PORT ?? (8200 + (APPIUM_PORT % 100)));

export const config: Options.Testrunner = {
  //
  // ====================
  // Runner Configuration
  // ====================
  runner: 'local',
  
  //
  // ==================
  // Specify Test Files
  // ==================
  specs: [
    './src/motel6/android/tests/regression/**/*.spec.ts'
  ],
  
  // Patterns to exclude.
  exclude: [
    // 'path/to/excluded/files'
  ],
  
  //
  // ============
  // Capabilities
  // ============
  maxInstances: 1,
  capabilities: [{
    platformName: 'Android' as const,
    'appium:deviceName': process.env.ANDROID_DEVICE || 'RZCY82GLERW',
    'appium:automationName': 'UiAutomator2' as const,
    
    // my6 app (production from Play Store)
    // Uncomment the line below if you have the APK file
    // 'appium:app': path.join(process.cwd(), 'apps/android/motel6.apk'),
    'appium:appPackage': 'com.my6.android',
    'appium:appActivity': 'com.oyo.consumer.social_login.views.AuthActivityV2',
    // Use wildcard pattern to allow focus to switch to permission controller during app launch
    'appium:appWaitActivity': '*',
    'appium:appWaitDuration': 30000,
    // Skip waiting for app launch to avoid timeout when permission dialogs appear
    'appium:appWaitForLaunch': false,
    
    // Performance + stability settings
    'appium:autoGrantPermissions': true,
    // Keep app state to avoid frequent pm clear/fastReset flakiness and speed up runs
    'appium:noReset': true,
    'appium:fullReset': false,
    'appium:dontStopAppOnReset': false,
    // Always relaunch the app on session start (important when we reset via adb in the runner)
    'appium:forceAppLaunch': true,
    'appium:newCommandTimeout': 300,
    'appium:androidInstallTimeout': 90000,
    'appium:adbExecTimeout': 120000,
    // Cleanup temp files/adb forwards between sessions (helps after UiAutomator2 crashes)
    'appium:clearSystemFiles': true,
    // Do not pin systemPort; fixed ports can get stuck after crashes (ECONNREFUSED).
    'appium:disableWindowAnimation': true,
    'appium:uiautomator2ServerLaunchTimeout': 120000,
    'appium:uiautomator2ServerInstallTimeout': 120000,

    // IMPORTANT: ensure each Appium server instance uses a unique systemPort.
    // This avoids UiAutomator2 port-forward collisions when multiple Appium servers are running.
    'appium:systemPort': UIA2_SYSTEM_PORT,
    
    // Additional settings
    // Unicode IME can occasionally destabilize sessions on some devices.
    // Keep it opt-in (enable via USE_UNICODE_IME=true) unless you need non-ASCII typing.
    'appium:unicodeKeyboard': USE_UNICODE_IME,
    'appium:resetKeyboard': USE_UNICODE_IME,

    // Workaround for occasional UiAutomator2 XPath2 engine crashes on some devices/OS builds
    'appium:enforceXPath1': true,
  }] as any,
  
  //
  // ===================
  // Test Configurations
  // ===================
  hostname: '127.0.0.1',
  port: APPIUM_PORT,
  path: '/',
  logLevel: (process.env.WDIO_LOG_LEVEL as any) || 'warn',
  bail: 0,
  baseUrl: 'http://localhost',
  waitforTimeout: 10000,
  connectionRetryTimeout: 60000,
  connectionRetryCount: 2,
  
  //
  // =====
  // Hooks
  // =====
  services: [],
  
  framework: 'mocha',
  reporters: ['spec'],
  
  autoCompileOpts: {
    autoCompile: true,
    tsNodeOpts: {
      transpileOnly: true,
      project: './tsconfig.json'
    }
  },
  
  mochaOpts: {
    ui: 'bdd',
    timeout: 180000
  },
  
  //
  // =====
  // Hooks
  // =====
  /**
   * Gets executed before test execution begins.
   */
  before: function (capabilities, specs) {
    // Use 0 implicit wait; all element finding uses our explicit polling.
    // This avoids implicit-wait multiplication (which can cause 60-90s hangs).
    driver.setTimeout({ implicit: 0 });
  },

  /**
   * Gets executed after a test (in Mocha/Jasmine).
   * Only captures artifacts on FAILURE to keep reporting lean.
   */
  afterTest: async function(test, context, { error, result, duration, passed, retries }) {
    if (!passed && error) {
      const testName = `${test.parent}_${test.title}`;
      console.log(`\n❌ Test Failed: ${testName}`);
      console.log(`   Error: ${error.message}`);
      
      // Capture failure artifacts (screenshot + page source)
      try {
        const { captureFailureArtifacts } = await import('./src/motel6/shared/core/Artifacts');
        await captureFailureArtifacts(testName);
        console.log(`   📸 Failure artifacts saved to test-artifacts/`);
      } catch (e) {
        console.log(`   ⚠️  Could not capture failure artifacts: ${String(e)}`);
      }
      
      // Log steps to reproduce
      console.log(`\n📋 Steps to Reproduce:`);
      console.log(`   1. Run test: npx wdio wdio.motel6.android.conf.ts --spec "${test.file}" --mochaOpts.grep "${test.title}"`);
      console.log(`   2. Check test-artifacts/ for screenshot and page source\n`);
    }
  },
  
  /**
   * Gets executed after all tests are done.
   */
  after: function (result, capabilities, specs) {
    // Cleanup
  },
  
  /**
   * Gets executed after all workers got shut down and the process is about to exit.
   */
  onComplete: function(exitCode, config, capabilities, results) {
    console.log('All tests completed!');
  },
};
