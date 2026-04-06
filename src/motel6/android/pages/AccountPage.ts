import { BasePage } from '../../shared/core/BasePage';
import type { PlatformSelectors } from '../../shared/core/selectors';

export class AccountPage extends BasePage {
  constructor() {
    super('android');
  }

  private logoutButton: PlatformSelectors = {
    android: [
      { using: 'xpath', value: '//*[@text="Logout" or @text="Log out" or @text="Sign out" or @text="SIGN OUT" or @text="LOG OUT"]' },
      { using: 'xpath', value: '//*[contains(@text,"Logout") or contains(@text,"Log out") or contains(@text,"Sign out") or contains(@text,"Sign Out")]' },
      { using: 'xpath', value: '//*[contains(@resource-id,"logout") or contains(@resource-id,"signout") or contains(@resource-id,"sign_out")]' },
    ],
    ios: [],
  };

  private confirmYes: PlatformSelectors = {
    android: [
      { using: 'xpath', value: '//*[@resource-id="android:id/button1"]' },
      { using: 'xpath', value: '//*[@text="Yes" or @text="YES" or @text="Ok" or @text="OK"]' },
    ],
    ios: [],
  };

  private headerNameLike(name: string): PlatformSelectors {
    const safe = name.replace(/\"/g, '');
    return {
      android: [
        { using: 'xpath', value: `//*[contains(@text,\"${safe}\")]` },
        { using: 'xpath', value: `//*[contains(@content-desc,\"${safe}\")]` },
      ],
      ios: [],
    };
  }

  async openUserHeader(details: { firstName?: string; lastName?: string; email?: string }) {
    const candidates = [details.firstName, details.lastName, details.email].filter(Boolean) as string[];
    for (const value of candidates) {
      try {
        await this.click(this.headerNameLike(value), `User header (${value})`, 4000);
        await driver.pause(1200);
        return;
      } catch {
        // try next
      }
    }

    // Fallback: try a generic profile/header area
    const fallback: PlatformSelectors = {
      android: [
        { using: 'xpath', value: '//*[contains(@resource-id,"profile") or contains(@resource-id,"header") or contains(@resource-id,"user")]' },
        { using: 'xpath', value: '//*[contains(@text,"Account") or contains(@text,"Profile") or contains(@text,"Settings")]' },
      ],
      ios: [],
    };
    await this.click(fallback, 'User header (fallback)', 8000);
    await driver.pause(1200);
  }

  async logout() {
    await this.click(this.logoutButton, 'Logout', 12000);
    await driver.pause(800);
    await this.click(this.confirmYes, 'Confirm logout (Yes)', 12000);
    await driver.pause(2000);
    console.log('✓ Logged out');
  }
}
