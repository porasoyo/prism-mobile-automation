import { BasePage } from '../../shared/core/BasePage';
import type { PlatformSelectors } from '../../shared/core/selectors';

export class RegisterPage extends BasePage {
  constructor() {
    super('android');
  }

  // Registration form uses repeated resource-id com.my6.android:id/vhEditText.
  // We scope to the RecyclerView and use index ordering from the extracted XML.
  private inputAt(index1Based: number): PlatformSelectors {
    return {
      android: [
        {
          using: 'xpath',
          value:
            `(//*[@resource-id="com.my6.android:id/signUpFormRecyclerView"]` +
            `//*[@resource-id="com.my6.android:id/vhEditText"])[${index1Based}]`,
        },
      ],
      ios: [],
    };
  }

  private createAccountButton: PlatformSelectors = {
    android: [{ using: 'xpath', value: '//*[@resource-id="com.my6.android:id/signupCreateAccount"]' }],
    ios: [],
  };

  private termsCheckbox: PlatformSelectors = {
    android: [{ using: 'xpath', value: '//*[@resource-id="com.my6.android:id/signupTermsCondition"]' }],
    ios: [],
  };

  // Index mapping from extracted XML:
  // 1 First name, 2 Last name, 3 Mobile number, 4 Email address, 5 Create Password
  async setFirstName(value: string) {
    await this.setValue(this.inputAt(1), value, 'First name', 8000);
  }

  async setLastName(value: string) {
    await this.setValue(this.inputAt(2), value, 'Last name', 8000);
  }

  async setMobile(value: string) {
    await this.setValue(this.inputAt(3), value, 'Mobile number', 8000);
  }

  async setEmail(value: string) {
    await this.setValue(this.inputAt(4), value, 'Email address', 8000);
  }

  async setPassword(value: string) {
    await this.setValue(this.inputAt(5), value, 'Create password', 8000);
  }

  async acceptTermsIfPresent() {
    try {
      const el = await this.el(this.termsCheckbox, 1500);
      try {
        const checked = await el.getAttribute('checked');
        if (checked === 'true') return;
      } catch {
        // ignore
      }
      await el.click();
      console.log('✓ Accepted Terms & Conditions');
    } catch {
      // ignore - some builds might not require explicit acceptance
    }
  }

  private async isRegisterFormVisible(): Promise<boolean> {
    try {
      await this.el(this.inputAt(1), 750);
      await this.el(this.createAccountButton, 750);
      return true;
    } catch {
      return false;
    }
  }

  private async getVisibleErrorTexts(): Promise<string[]> {
    const messages: string[] = [];

    const push = (t?: string) => {
      const v = (t ?? '').trim();
      if (!v) return;
      if (!messages.includes(v)) messages.push(v);
    };

    // Common snackbar/toast/message containers
    const candidates = [
      '//*[@resource-id="com.my6.android:id/snackbar_text"]',
      '//*[@resource-id="android:id/message"]',
      '//*[contains(@resource-id,"error") and string-length(@text) > 0]',
      '//*[contains(@text,"required") or contains(@text,"Required") or contains(@text,"invalid") or contains(@text,"Invalid") or contains(@text,"must") or contains(@text,"Must") or contains(@text,"Please") or contains(@text,"please")]',
    ];

    for (const xp of candidates) {
      try {
        const els = await $$(xp);
        for (const el of els.slice(0, 10)) {
          push(await el.getText().catch(() => ''));
        }
      } catch {
        // ignore
      }
    }

    // Fallback: scrape page source for likely validation texts
    try {
      const xml = await driver.getPageSource();
      const texts = Array.from(xml.matchAll(/text="([^"]+)"/g))
        .map((m) => (m[1] ?? '').trim())
        .filter((t) => t.length > 0 && t.length < 120);

      const looksLikeError = (t: string) => {
        const s = t.toLowerCase();
        return (
          s.includes('required') ||
          s.includes('invalid') ||
          s.includes('must') ||
          s.includes('please') ||
          s.includes('already') ||
          s.includes('exists') ||
          s.includes('try again')
        );
      };

      for (const t of texts) {
        if (looksLikeError(t)) push(t);
      }
    } catch {
      // ignore
    }

    return messages;
  }

  /**
   * Tap Create Account, then wait for either:
   * - navigation away from the register form (success), OR
   * - validation error messages to appear (failure)
   */
  async submitAndWaitForResult(timeoutMs: number = 30000): Promise<{ success: boolean; errors?: string[] }> {
    await this.tapCreateAccount();

    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      // If we left the register form, treat as success
      if (!(await this.isRegisterFormVisible())) return { success: true };

      const errors = await this.getVisibleErrorTexts();
      if (errors.length > 0) return { success: false, errors };

      await driver.pause(500);
    }

    // Timed out; include whatever we can find.
    const errors = await this.getVisibleErrorTexts();
    return { success: false, errors: errors.length ? errors : ['Timed out waiting for registration result'] };
  }

  private async tapCreateAccountWithScroll() {
    try {
      await this.click(this.createAccountButton, 'Create account', 3000);
      return;
    } catch {
      // might be below fold
    }

    await this.swipeUp(0.8);
    await driver.pause(500);
    await this.click(this.createAccountButton, 'Create account', 8000);
  }

  async tapCreateAccount() {
    await this.tapCreateAccountWithScroll();
  }
}
