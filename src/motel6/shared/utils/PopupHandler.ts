/**
 * PopupHandler - Handles all system and app popups during test execution
 * Uses ONLY ID-based selectors to prevent UiAutomator2 crashes/hangs
 */

// ID-based selectors ONLY (fastest and most reliable)
const ID_SELECTORS = [
  // Permission dialogs
  'id=com.android.permissioncontroller:id/permission_allow_button',
  'id=com.android.permissioncontroller:id/permission_allow_foreground_only_button',
  'id=com.android.permissioncontroller:id/permission_deny_button',
  
  // Android system dialogs
  'id=android:id/button1',
  'id=android:id/button2',
  
  // WELCOME POPUP "Got it" button (appears after app clear/first launch)
  'id=com.my6.android:id/btn_got_it',
  'id=com.my6.android:id/gotItButton', 
  'id=com.my6.android:id/got_it',
  'id=com.my6.android:id/btn_understood',
  'id=com.my6.android:id/button_positive',
  
  // App-specific dismiss buttons (Motel6)
  'id=com.my6.android:id/btn_not_now',
  'id=com.my6.android:id/btn_skip',
  'id=com.my6.android:id/btn_close',
  'id=com.my6.android:id/closeButton',
  'id=com.my6.android:id/skipButton',
  'id=com.my6.android:id/notNowButton',
];

// Text-based selectors for fallback (catches "Got it", "OK" etc)
// Use 'android=new UiSelector()...' format for WebdriverIO
const TEXT_SELECTORS = [
  'android=new UiSelector().text("Got it")',
  'android=new UiSelector().text("GOT IT")',
  'android=new UiSelector().text("OK")',
  'android=new UiSelector().text("Allow")',
  'android=new UiSelector().text("ALLOW")',
];

/**
 * Try to dismiss any visible popup using ID selectors first, then text selectors
 * @returns true if a popup was dismissed
 */
export async function dismissPopupOnce(): Promise<boolean> {
  // First try ID selectors (fastest)
  for (const selector of ID_SELECTORS) {
    try {
      const el = await $(selector);
      const exists = await el.isExisting().catch(() => false);
      if (exists) {
        await el.click();
        console.log('✓ Dismissed popup (ID)');
        await driver.pause(300);
        return true;
      }
    } catch {
      // Continue
    }
  }
  
  // Then try text-based selectors (for "Got it", etc)
  for (const selector of TEXT_SELECTORS) {
    try {
      const el = await $(selector);
      const exists = await el.isExisting().catch(() => false);
      if (exists) {
        await el.click();
        console.log('✓ Dismissed popup (text)');
        await driver.pause(300);
        return true;
      }
    } catch {
      // Continue  
    }
  }
  
  return false;
}

/**
 * Keep dismissing popups until none are found (max attempts to prevent infinite loop)
 * @param maxAttempts Maximum number of dismiss attempts (default: 3)
 * @returns Number of popups dismissed
 */
export async function dismissAllPopups(maxAttempts: number = 3): Promise<number> {
  let dismissed = 0;
  
  for (let i = 0; i < maxAttempts; i++) {
    const result = await dismissPopupOnce();
    if (!result) break;
    dismissed++;
    await driver.pause(200);
  }
  
  if (dismissed > 0) {
    console.log(`✓ Dismissed ${dismissed} popup(s)`);
  }
  
  return dismissed;
}

/**
 * Handle common app startup popups (call after app launch)
 * Quick check - doesn't iterate all selectors
 */
export async function handleAppStartupPopups(): Promise<void> {
  // Quick pause for any popups to appear
  await driver.pause(800);
  
  // Try to dismiss up to 3 popups
  await dismissAllPopups(3);
}
