import { BasePage } from '../../shared/core/BasePage';
import type { PlatformSelectors } from '../../shared/core/selectors';

export class LoginPage extends BasePage {
  constructor() {
    super('ios');
  }

  private continueAsGuest: PlatformSelectors = {
    android: [],
    ios: [
      { using: 'accessibility id', value: 'Continue as guest' },
      { using: 'xpath', value: '//*[@name="Continue as guest"]' },
      { using: 'xpath', value: '//*[contains(@label,"guest") or contains(@name,"guest") or contains(@value,"guest")]' },
    ],
  };

  private signIn: PlatformSelectors = {
    android: [],
    ios: [
      { using: 'accessibility id', value: 'Sign in' },
      { using: 'xpath', value: '//*[@name="Sign in" or @label="Sign in" or contains(@label,"Login") or contains(@name,"Login")]' },
    ],
  };

  async enterAppAsGuestIfPresent() {
    try {
      await this.click(this.continueAsGuest, 'Continue as guest', 4000);
      await driver.pause(5000);
      return true;
    } catch {
      return false;
    }
  }

  async openSignInIfPresent() {
    try {
      await this.click(this.signIn, 'Sign in / Login', 4000);
      await driver.pause(3000);
      return true;
    } catch {
      return false;
    }
  }
}
