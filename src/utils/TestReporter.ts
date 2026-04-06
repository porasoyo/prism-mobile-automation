/**
 * Test Reporter Utility
 * Provides comprehensive reporting for test execution with screenshots and reproducible steps
 */
import * as fs from 'fs';
import * as path from 'path';

export interface TestStep {
  step: number;
  action: string;
  status: 'success' | 'failed' | 'warning';
  screenshot?: string;
  timestamp: string;
  error?: string;
}

export interface TestResult {
  testId: string;
  testName: string;
  status: 'passed' | 'failed' | 'skipped' | 'warning';
  startTime: string;
  endTime: string;
  duration: number;
  steps: TestStep[];
  errorMessage?: string;
  stackTrace?: string;
  activity?: string;
  metadata?: Record<string, any>;
}

export interface TestSuiteReport {
  suiteName: string;
  environment: {
    platform: string;
    appVersion: string;
    device: string;
    osVersion: string;
  };
  executionTime: {
    startTime: string;
    endTime: string;
    totalDuration: number;
  };
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    warnings: number;
  };
  tests: TestResult[];
  screenshots: string[];
}

export class TestReporter {
  private suiteReport: TestSuiteReport;
  private currentTest: TestResult | null = null;
  private stepCounter: number = 0;
  private screenshotDir: string;
  private reportDir: string;

  constructor(suiteName: string, platform: string, appVersion: string) {
    this.reportDir = path.join(process.cwd(), 'test-reports');
    this.screenshotDir = path.join(this.reportDir, 'screenshots');

    // Ensure directories exist
    if (!fs.existsSync(this.reportDir)) {
      fs.mkdirSync(this.reportDir, { recursive: true });
    }
    if (!fs.existsSync(this.screenshotDir)) {
      fs.mkdirSync(this.screenshotDir, { recursive: true });
    }

    this.suiteReport = {
      suiteName,
      environment: {
        platform,
        appVersion,
        device: '',
        osVersion: ''
      },
      executionTime: {
        startTime: new Date().toISOString(),
        endTime: '',
        totalDuration: 0
      },
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        warnings: 0
      },
      tests: [],
      screenshots: []
    };
  }

  /**
   * Set device information
   */
  setDeviceInfo(device: string, osVersion: string) {
    this.suiteReport.environment.device = device;
    this.suiteReport.environment.osVersion = osVersion;
  }

  /**
   * Start tracking a new test
   */
  startTest(testId: string, testName: string) {
    this.currentTest = {
      testId,
      testName,
      status: 'passed',
      startTime: new Date().toISOString(),
      endTime: '',
      duration: 0,
      steps: []
    };
    this.stepCounter = 0;
    console.log(`\n📋 Test Started: ${testId} - ${testName}`);
  }

  /**
   * Add a step to the current test
   */
  addStep(action: string, status: 'success' | 'failed' | 'warning' = 'success', screenshot?: string, error?: string) {
    if (!this.currentTest) {
      console.warn('⚠️  No active test. Call startTest() first.');
      return;
    }

    this.stepCounter++;
    const step: TestStep = {
      step: this.stepCounter,
      action,
      status,
      timestamp: new Date().toISOString(),
      screenshot,
      error
    };

    this.currentTest.steps.push(step);

    const statusIcon = status === 'success' ? '✅' : status === 'failed' ? '❌' : '⚠️';
    console.log(`  ${statusIcon} Step ${this.stepCounter}: ${action}`);
    
    if (error) {
      console.log(`     Error: ${error}`);
    }
  }

  /**
   * End the current test
   */
  endTest(status: 'passed' | 'failed' | 'skipped' | 'warning', errorMessage?: string, stackTrace?: string, activity?: string, metadata?: Record<string, any>) {
    if (!this.currentTest) {
      console.warn('⚠️  No active test to end.');
      return;
    }

    this.currentTest.status = status;
    this.currentTest.endTime = new Date().toISOString();
    this.currentTest.duration = new Date(this.currentTest.endTime).getTime() - new Date(this.currentTest.startTime).getTime();
    this.currentTest.errorMessage = errorMessage;
    this.currentTest.stackTrace = stackTrace;
    this.currentTest.activity = activity;
    this.currentTest.metadata = metadata;

    this.suiteReport.tests.push(this.currentTest);
    this.suiteReport.summary.total++;
    
    if (status === 'passed') this.suiteReport.summary.passed++;
    else if (status === 'failed') this.suiteReport.summary.failed++;
    else if (status === 'skipped') this.suiteReport.summary.skipped++;
    else if (status === 'warning') this.suiteReport.summary.warnings++;

    const statusIcon = status === 'passed' ? '✅' : status === 'failed' ? '❌' : status === 'skipped' ? '⏭️' : '⚠️';
    console.log(`${statusIcon} Test Ended: ${this.currentTest.testId} - ${status.toUpperCase()} (${this.currentTest.duration}ms)\n`);

    this.currentTest = null;
    this.stepCounter = 0;
  }

  /**
   * Capture screenshot for current step
   */
  async captureScreenshot(driver: any, stepDescription: string): Promise<string> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const sanitizedDescription = stepDescription.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
      const filename = `${this.currentTest?.testId || 'test'}_${timestamp}_${sanitizedDescription}.png`;
      const filepath = path.join(this.screenshotDir, filename);
      
      await driver.saveScreenshot(filepath);
      this.suiteReport.screenshots.push(filename);
      
      return filename;
    } catch (error) {
      console.error(`Failed to capture screenshot: ${error}`);
      return '';
    }
  }

  /**
   * Generate HTML report
   */
  generateHTMLReport(): string {
    this.suiteReport.executionTime.endTime = new Date().toISOString();
    this.suiteReport.executionTime.totalDuration = new Date(this.suiteReport.executionTime.endTime).getTime() - 
                                                   new Date(this.suiteReport.executionTime.startTime).getTime();

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Test Report - ${this.suiteReport.suiteName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; background: #f5f5f5; padding: 20px; }
    .container { max-width: 1400px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; }
    .header h1 { font-size: 28px; margin-bottom: 10px; }
    .header .meta { opacity: 0.9; font-size: 14px; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; padding: 30px; background: #f9fafb; }
    .summary-card { background: white; padding: 20px; border-radius: 8px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .summary-card .value { font-size: 36px; font-weight: bold; margin: 10px 0; }
    .summary-card.passed .value { color: #10b981; }
    .summary-card.failed .value { color: #ef4444; }
    .summary-card.warning .value { color: #f59e0b; }
    .summary-card.skipped .value { color: #6b7280; }
    .summary-card .label { color: #6b7280; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; }
    .tests { padding: 30px; }
    .test-case { border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 20px; overflow: hidden; }
    .test-header { padding: 20px; background: #f9fafb; display: flex; justify-content: space-between; align-items: center; cursor: pointer; }
    .test-header:hover { background: #f3f4f6; }
    .test-header.passed { border-left: 4px solid #10b981; }
    .test-header.failed { border-left: 4px solid #ef4444; }
    .test-header.warning { border-left: 4px solid #f59e0b; }
    .test-header.skipped { border-left: 4px solid #6b7280; }
    .test-title { font-weight: 600; font-size: 16px; }
    .test-id { color: #6b7280; font-size: 14px; margin-left: 10px; }
    .test-status { padding: 6px 12px; border-radius: 4px; font-size: 12px; font-weight: 600; text-transform: uppercase; }
    .test-status.passed { background: #d1fae5; color: #065f46; }
    .test-status.failed { background: #fee2e2; color: #991b1b; }
    .test-status.warning { background: #fef3c7; color: #92400e; }
    .test-status.skipped { background: #f3f4f6; color: #374151; }
    .test-details { padding: 20px; background: white; display: none; }
    .test-details.show { display: block; }
    .steps { margin-top: 20px; }
    .step { padding: 15px; border-left: 3px solid #e5e7eb; margin-bottom: 10px; background: #f9fafb; position: relative; }
    .step.success { border-left-color: #10b981; }
    .step.failed { border-left-color: #ef4444; background: #fef2f2; }
    .step.warning { border-left-color: #f59e0b; background: #fffbeb; }
    .step-header { display: flex; justify-content: space-between; align-items: start; }
    .step-action { font-weight: 500; }
    .step-error { color: #dc2626; margin-top: 10px; padding: 10px; background: white; border-radius: 4px; font-size: 13px; font-family: monospace; }
    .screenshot { margin-top: 10px; }
    .screenshot img { max-width: 100%; border: 1px solid #e5e7eb; border-radius: 4px; cursor: pointer; }
    .error-section { margin-top: 20px; padding: 15px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 4px; }
    .error-section h4 { color: #dc2626; margin-bottom: 10px; }
    .error-message { color: #991b1b; margin-bottom: 10px; }
    .stack-trace { background: white; padding: 10px; border-radius: 4px; font-family: monospace; font-size: 12px; color: #374151; overflow-x: auto; }
    .repro-steps { margin-top: 20px; padding: 15px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 4px; }
    .repro-steps h4 { color: #1e40af; margin-bottom: 10px; }
    .repro-steps ol { margin-left: 20px; }
    .repro-steps li { margin-bottom: 8px; color: #1e3a8a; }
    .metadata { margin-top: 15px; padding: 15px; background: #f9fafb; border-radius: 4px; font-size: 13px; }
    .metadata-item { display: flex; margin-bottom: 5px; }
    .metadata-label { font-weight: 600; width: 120px; color: #6b7280; }
    .metadata-value { color: #374151; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🧪 ${this.suiteReport.suiteName}</h1>
      <div class="meta">
        <div>📱 ${this.suiteReport.environment.platform} • ${this.suiteReport.environment.device} • ${this.suiteReport.environment.osVersion}</div>
        <div>📅 ${new Date(this.suiteReport.executionTime.startTime).toLocaleString()}</div>
        <div>⏱️  Duration: ${(this.suiteReport.executionTime.totalDuration / 1000).toFixed(2)}s</div>
      </div>
    </div>

    <div class="summary">
      <div class="summary-card">
        <div class="label">Total Tests</div>
        <div class="value">${this.suiteReport.summary.total}</div>
      </div>
      <div class="summary-card passed">
        <div class="label">Passed</div>
        <div class="value">${this.suiteReport.summary.passed}</div>
      </div>
      <div class="summary-card failed">
        <div class="label">Failed</div>
        <div class="value">${this.suiteReport.summary.failed}</div>
      </div>
      <div class="summary-card warning">
        <div class="label">Warnings</div>
        <div class="value">${this.suiteReport.summary.warnings}</div>
      </div>
      <div class="summary-card skipped">
        <div class="label">Skipped</div>
        <div class="value">${this.suiteReport.summary.skipped}</div>
      </div>
    </div>

    <div class="tests">
      <h2 style="margin-bottom: 20px; color: #111827;">Test Cases</h2>
      ${this.suiteReport.tests.map((test, index) => this.generateTestHTML(test, index)).join('')}
    </div>
  </div>

  <script>
    function toggleTest(index) {
      const details = document.getElementById('test-details-' + index);
      details.classList.toggle('show');
    }

    function viewScreenshot(src) {
      window.open('./screenshots/' + src, '_blank');
    }
  </script>
</body>
</html>
    `;

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `test-report-${timestamp}.html`;
    const filepath = path.join(this.reportDir, filename);
    
    fs.writeFileSync(filepath, html);
    console.log(`\n📊 HTML Report generated: ${filepath}`);
    
    return filepath;
  }

  private generateTestHTML(test: TestResult, index: number): string {
    const reproSteps = test.steps.filter(s => s.status === 'success' || s.status === 'warning').map(s => s.action);
    
    return `
      <div class="test-case">
        <div class="test-header ${test.status}" onclick="toggleTest(${index})">
          <div>
            <span class="test-title">${test.testName}</span>
            <span class="test-id">${test.testId}</span>
          </div>
          <div class="test-status ${test.status}">${test.status}</div>
        </div>
        <div class="test-details" id="test-details-${index}">
          <div class="metadata">
            <div class="metadata-item"><span class="metadata-label">Duration:</span><span class="metadata-value">${test.duration}ms</span></div>
            <div class="metadata-item"><span class="metadata-label">Start Time:</span><span class="metadata-value">${new Date(test.startTime).toLocaleString()}</span></div>
            <div class="metadata-item"><span class="metadata-label">End Time:</span><span class="metadata-value">${new Date(test.endTime).toLocaleString()}</span></div>
            ${test.activity ? `<div class="metadata-item"><span class="metadata-label">Activity:</span><span class="metadata-value">${test.activity}</span></div>` : ''}
            ${test.metadata ? Object.entries(test.metadata).map(([key, value]) => 
              `<div class="metadata-item"><span class="metadata-label">${key}:</span><span class="metadata-value">${JSON.stringify(value)}</span></div>`
            ).join('') : ''}
          </div>

          ${test.status === 'failed' && test.errorMessage ? `
            <div class="error-section">
              <h4>❌ Error Details</h4>
              <div class="error-message">${test.errorMessage}</div>
              ${test.stackTrace ? `<div class="stack-trace">${test.stackTrace}</div>` : ''}
            </div>
          ` : ''}

          ${reproSteps.length > 0 ? `
            <div class="repro-steps">
              <h4>📝 Steps to Reproduce</h4>
              <ol>
                ${reproSteps.map(step => `<li>${step}</li>`).join('')}
              </ol>
            </div>
          ` : ''}

          <div class="steps">
            <h4 style="margin-bottom: 15px; color: #374151;">Execution Steps</h4>
            ${test.steps.map(step => `
              <div class="step ${step.status}">
                <div class="step-header">
                  <div class="step-action">
                    ${step.status === 'success' ? '✅' : step.status === 'failed' ? '❌' : '⚠️'} 
                    Step ${step.step}: ${step.action}
                  </div>
                  <div style="font-size: 12px; color: #6b7280;">${new Date(step.timestamp).toLocaleTimeString()}</div>
                </div>
                ${step.error ? `<div class="step-error">${step.error}</div>` : ''}
                ${step.screenshot ? `
                  <div class="screenshot">
                    <img src="./screenshots/${step.screenshot}" alt="Screenshot" onclick="viewScreenshot('${step.screenshot}')" width="300" />
                  </div>
                ` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Generate JSON report
   */
  generateJSONReport(): string {
    this.suiteReport.executionTime.endTime = new Date().toISOString();
    this.suiteReport.executionTime.totalDuration = new Date(this.suiteReport.executionTime.endTime).getTime() - 
                                                   new Date(this.suiteReport.executionTime.startTime).getTime();

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `test-report-${timestamp}.json`;
    const filepath = path.join(this.reportDir, filename);
    
    fs.writeFileSync(filepath, JSON.stringify(this.suiteReport, null, 2));
    console.log(`📄 JSON Report generated: ${filepath}`);
    
    return filepath;
  }

  /**
   * Print summary to console
   */
  printSummary() {
    console.log('\n' + '='.repeat(80));
    console.log('📊 TEST EXECUTION SUMMARY');
    console.log('='.repeat(80));
    console.log(`Suite: ${this.suiteReport.suiteName}`);
    console.log(`Platform: ${this.suiteReport.environment.platform}`);
    console.log(`Device: ${this.suiteReport.environment.device}`);
    console.log(`Duration: ${(this.suiteReport.executionTime.totalDuration / 1000).toFixed(2)}s`);
    console.log('-'.repeat(80));
    console.log(`Total Tests: ${this.suiteReport.summary.total}`);
    console.log(`✅ Passed: ${this.suiteReport.summary.passed}`);
    console.log(`❌ Failed: ${this.suiteReport.summary.failed}`);
    console.log(`⚠️  Warnings: ${this.suiteReport.summary.warnings}`);
    console.log(`⏭️  Skipped: ${this.suiteReport.summary.skipped}`);
    console.log('='.repeat(80) + '\n');
  }
}
