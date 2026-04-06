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
      { using: 'id', value: 'com.my6.android:id/home_search_bar' },
      { using: 'id', value: 'com.my6.android:id/search_bar' },
      { using: 'id', value: 'com.my6.android:id/searchBar' },
      { using: 'android uiautomator', value: 'new UiSelector().textContains("Find your motel")' },
      { using: 'android uiautomator', value: 'new UiSelector().textContains("Search")' },
      { using: 'android uiautomator', value: 'new UiSelector().descriptionContains("search")' },
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
    // Pass criteria: we can find a search surface; logo is a bonus.
    await this.el(this.searchBar, timeoutMs);
    try {
      await this.el(this.logo, 2500);
    } catch {
      // ignore
    }
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
