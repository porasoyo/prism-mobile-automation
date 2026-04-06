import type { Options } from '@wdio/types';
import path from 'path';

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
    './src/motel6/ios/tests/regression/**/*.spec.ts'
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
    platformName: 'iOS',
    'appium:platformVersion': '17.0',
    'appium:deviceName': 'iPhone',
    'appium:automationName': 'XCUITest',
    
    // Real device configuration - using your connected iPhone
    'appium:bundleId': 'com.g6hospitality.motel6',
    'appium:udid': 'auto',  // Auto-detect connected iPhone
    
    // Settings
    'appium:autoAcceptAlerts': true,
    'appium:autoDismissAlerts': false,
    'appium:noReset': true,
    'appium:fullReset': false,
    'appium:newCommandTimeout': 300,
    'appium:wdaLaunchTimeout': 180000,
    'appium:useNewWDA': false,
    'appium:showXcodeLog': true,
  }],
  
  //
  // ===================
  // Test Configurations
  // ===================
    logLevel: (process.env.WDIO_LOG_LEVEL as any) || 'warn',
  port: 4723,
  path: '/',
  logLevel: 'info',
  bail: 0,
  baseUrl: 'http://localhost',
  waitforTimeout: 30000,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 3,
  
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
    timeout: 60000
  },
  
  //
  // =====
  // Hooks
  // =====
  /**
   * Gets executed before test execution begins.
   */
  before: function (capabilities, specs) {
    // Set implicit wait
    driver.setTimeout({ 'implicit': 10000 });
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
