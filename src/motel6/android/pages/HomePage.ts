import { BasePage } from '../../shared/core/BasePage';
import type { PlatformSelectors } from '../../shared/core/selectors';

export class HomePage extends BasePage {
  constructor() {
    super('android');
  }

  // ID-based selectors to avoid UiAutomator2 crashes on Android 16
  private logo: PlatformSelectors = {
    android: [
      { using: 'id', value: 'com.my6.android:id/logoImageView' },
      { using: 'android uiautomator', value: 'new UiSelector().textContains("Motel")' },
    ],
    ios: [],
  };

  private searchBar: PlatformSelectors = {
    android: [
      // ONLY app-specific selectors - generic "Search" matches device home screen Google bar!
      { using: 'id', value: 'com.my6.android:id/home_search_bar' },
      { using: 'id', value: 'com.my6.android:id/search_bar' },
      { using: 'id', value: 'com.my6.android:id/searchBar' },
      { using: 'id', value: 'com.my6.android:id/search_container' },
      { using: 'android uiautomator', value: 'new UiSelector().resourceIdMatches(".*my6.*search.*")' },
      { using: 'android uiautomator', value: 'new UiSelector().textContains("Find your motel")' },
    ],
    ios: [],
  };

  // Bottom nav is unique to the app - use to verify app is actually running
  private bottomNav: PlatformSelectors = {
    android: [
      { using: 'id', value: 'com.my6.android:id/bottom_navigation' },
      { using: 'id', value: 'com.my6.android:id/navigation_home' },
      { using: 'id', value: 'com.my6.android:id/navigation_account' },
    ],
    ios: [],
  };

  private accountsTab: PlatformSelectors = {
    android: [
      { using: 'id', value: 'com.my6.android:id/navigation_account' },
      { using: 'id', value: 'com.my6.android:id/accountTab' },
      { using: 'android uiautomator', value: 'new UiSelector().text("Account")' },
      { using: 'android uiautomator', value: 'new UiSelector().descriptionContains("Account")' },
    ],
    ios: [],
  };

  async waitForLoaded(timeoutMs: number = 30000) {
    // FIRST verify we're in the Motel6 app (not device home screen)
    // Check for bottom nav OR logo - these are unique to the app
    let inApp = false;
    try {
      await this.el(this.bottomNav, 5000);
      inApp = true;
    } catch {
      try {
        await this.el(this.logo, 3000);
        inApp = true;
      } catch {
        // Not in app yet
      }
    }
    
    if (!inApp) {
      // App might be crashed or not launched - try to activate it
      console.log('⚠️ App not visible, attempting to activate...');
      try {
        // @ts-ignore
        if (typeof driver.activateApp === 'function') {
          // @ts-ignore
          await driver.activateApp('com.my6.android');
        } else {
          await driver.execute('mobile: activateApp', { appId: 'com.my6.android' });
        }
        await driver.pause(2000);
      } catch (e) {
        console.log('⚠️ Failed to activate app:', e);
      }
    }
    
    // Now wait for search bar with remaining timeout
    await this.el(this.searchBar, timeoutMs);
    console.log('✓ Home page looks loaded');
  }

  async openAccountsTab() {
    await this.click(this.accountsTab, 'Accounts tab', 12000);
    await driver.pause(800);
  }

  async openSearch() {
    await this.click(this.searchBar, 'Search bar', 12000);
    // No fixed pause - caller should wait for search page to load
  }

  async verifyCanScroll() {
    // Simple up/down scroll check. If scrolling triggers crashes, this will typically throw.
    await this.swipeUp(0.85);
    await driver.pause(300);
    await this.swipeDown(0.85);
    await driver.pause(300);
    console.log('✓ Scrolled up and down on home page');
  }
}
