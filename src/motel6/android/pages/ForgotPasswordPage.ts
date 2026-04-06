import { BasePage } from '../../shared/core/BasePage';
import type { PlatformSelectors } from '../../shared/core/selectors';

export class ForgotPasswordPage extends BasePage {
  constructor() {
    super('android');
  }

  // From extracted XML: com.my6.android:id/user_id_input -> EditText com.my6.android:id/text_input
  private emailInput: PlatformSelectors = {
    android: [
      {
        using: 'xpath',
        value: '//*[@resource-id="com.my6.android:id/user_id_input"]//*[@resource-id="com.my6.android:id/text_input"]',
      },
    ],
    ios: [],
  };

  // From extracted XML: com.my6.android:id/continue_button (clickable container)
  private sendResetLinkButton: PlatformSelectors = {
    android: [{ using: 'xpath', value: '//*[@resource-id="com.my6.android:id/continue_button"]' }],
    ios: [],
  };

  async setEmail(value: string) {
    await this.setValue(this.emailInput, value, 'Forgot password email', 8000);
  }

  async tapSendResetLink() {
    await this.click(this.sendResetLinkButton, 'Send reset link', 8000);
  }
}
