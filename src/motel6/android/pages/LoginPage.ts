import { BasePage } from '../../shared/core/BasePage';
import type { PlatformSelectors } from '../../shared/core/selectors';

export class LoginPage extends BasePage {
  constructor() {
    super('android');
  }

  // Landing/Auth screen entry points (tests should prefer GUEST unless explicitly testing auth)
  private signInToContinue: PlatformSelectors = {
    android: [
      // Prefer clickable ancestors to avoid matching non-clickable title text.
      { using: 'xpath', value: '//*[@text="Sign in"]/ancestor-or-self::*[@clickable="true"][1]' },
      { using: 'xpath', value: '//*[@text="Sign In"]/ancestor-or-self::*[@clickable="true"][1]' },
      { using: 'xpath', value: '//*[@text="SIGN IN"]/ancestor-or-self::*[@clickable="true"][1]' },
      { using: 'xpath', value: '//*[contains(@text,"Sign in") or contains(@text,"Sign In") or contains(@text,"sign in")]/ancestor-or-self::*[@clickable="true"][1]' },
      { using: 'xpath', value: '//*[contains(@text,"Sign in to continue") or contains(@text,"Sign In to Continue") or contains(@text,"SIGN IN TO CONTINUE")]/ancestor-or-self::*[@clickable="true"][1]' },
      { using: 'xpath', value: '//*[contains(@text,"Login") or contains(@text,"Log in") or contains(@text,"log in")]/ancestor-or-self::*[@clickable="true"][1]' },
    ],
    ios: [],
  };

  // Stable locators from extracted XML (AuthActivityV2)
  private emailInput: PlatformSelectors = {
    android: [
      {
        using: 'xpath',
        value: '//*[@resource-id="com.my6.android:id/edit_user_id"]//*[@resource-id="com.my6.android:id/text_input"]',
      },
    ],
    ios: [],
  };

  private passwordInput: PlatformSelectors = {
    android: [
      {
        using: 'xpath',
        value: '//*[@resource-id="com.my6.android:id/edit_password"]//*[@resource-id="com.my6.android:id/text_input"]',
      },
    ],
    ios: [],
  };

  // Clickable container that submits the login
  private signInButton: PlatformSelectors = {
    android: [{ using: 'xpath', value: '//*[@resource-id="com.my6.android:id/verify_button"]' }],
    ios: [],
  };

  private forgotPassword: PlatformSelectors = {
    android: [
      { using: 'xpath', value: '//*[@resource-id="com.my6.android:id/forgot_password"]' },
      { using: 'xpath', value: '//*[@text="Forgot password"]' },
      { using: 'xpath', value: '//*[@text="Forgot Password"]' },
      { using: 'xpath', value: '//*[contains(@text,"Forgot") or contains(@text,"forgot")]' },
    ],
    ios: [],
  };

  private register: PlatformSelectors = {
    android: [
      // Prefer stable id and clickable constraint.
      { using: 'xpath', value: '//*[@resource-id="com.my6.android:id/register_button" and @clickable="true"]' },
      { using: 'xpath', value: '//*[@resource-id="com.my6.android:id/register_button"]' },
      // Text-based fallbacks MUST be clickable (or click a clickable ancestor) to avoid matching titles.
      { using: 'xpath', value: '//*[@text="Register"]/ancestor-or-self::*[@clickable="true"][1]' },
      { using: 'xpath', value: '//*[@text="REGISTER"]/ancestor-or-self::*[@clickable="true"][1]' },
      { using: 'xpath', value: '//*[@text="Sign up"]/ancestor-or-self::*[@clickable="true"][1]' },
      { using: 'xpath', value: '//*[@text="Sign Up"]/ancestor-or-self::*[@clickable="true"][1]' },
    ],
    ios: [],
  };

  private registerFormRoot: PlatformSelectors = {
    android: [
      { using: 'xpath', value: '//*[@resource-id="com.my6.android:id/signUpFormRecyclerView"]' },
      { using: 'xpath', value: '//*[@resource-id="com.my6.android:id/signupCreateAccount"]' },
    ],
    ios: [],
  };

  private continueAsGuest: PlatformSelectors = {
    android: [
      // Use android uiautomator (UiSelector) instead of XPath to avoid hangs
      { using: 'android uiautomator', value: 'new UiSelector().text("Continue as guest")' },
      { using: 'android uiautomator', value: 'new UiSelector().text("Continue as Guest")' },
      { using: 'android uiautomator', value: 'new UiSelector().text("CONTINUE AS GUEST")' },
      { using: 'android uiautomator', value: 'new UiSelector().textContains("guest")' },
      { using: 'android uiautomator', value: 'new UiSelector().descriptionContains("guest")' },
    ],
    ios: [],
  };

  // Some devices/accounts can drop into an incomplete registration screen
  // ("Finish creating account"). Guest flows must back out of this.
  private finishCreatingAccountRoot: PlatformSelectors = {
    android: [
      // ID selectors first (faster and more stable)
      { using: 'id', value: 'com.my6.android:id/signUpFormRecyclerView' },
      { using: 'id', value: 'com.my6.android:id/signupCreateAccount' },
    ],
    ios: [],
  };

  private finishCreatingAccountBack: PlatformSelectors = {
    android: [
      // Toolbar navigation - ID-based
      { using: 'id', value: 'com.my6.android:id/toolbar' },
    ],
    ios: [],
  };

  async escapeRegistrationIfPresent(maxSteps: number = 4): Promise<boolean> {
    for (let i = 0; i < maxSteps; i++) {
      let onRegister = false;
      try {
        await this.el(this.finishCreatingAccountRoot, 900);
        onRegister = true;
      } catch {
        onRegister = false;
      }

      if (!onRegister) return i > 0;

      console.warn('⚠️  Detected registration screen. Backing out...');

      // Use Android back button (most reliable)
      try {
        await driver.back();
      } catch {
        // ignore
      }

      await driver.pause(800);
      await this.dismissBlockingPopupsOnce();
    }

    return true;
  }

  private async dismissBlockingPopupsOnce(): Promise<boolean> {
    // Use only ID-based selectors to prevent UiAutomator2 crashes
    const selectors = [
      // Android dialog buttons
      'id=android:id/button1',
      'id=android:id/button2',
      // Permissions
      'id=com.android.permissioncontroller:id/permission_allow_button',
      'id=com.android.permissioncontroller:id/permission_allow_foreground_only_button',
      'id=com.android.permissioncontroller:id/permission_deny_button',
      // Play services
      'id=com.google.android.gms:id/positive_button',
      'id=com.google.android.gms:id/negative_button',
      'id=com.google.android.gms:id/cancel',
    ];

    for (const sel of selectors) {
      try {
        const el = await $(sel);
        if (await el.isExisting().catch(() => false)) {
          await el.click();
          console.log('✓ Dismissed blocking popup');
          await driver.pause(500);
          return true;
        }
      } catch {
        // Continue
      }
    }
    return false;
  }

  private async isSignInFormLikelyVisible(): Promise<boolean> {
    // Strong signal: stable resource-id inputs exist
    try {
      await this.el(this.emailInput, 750);
      await this.el(this.passwordInput, 750);
      return true;
    } catch {
      // ignore
    }

    // Heuristic: login screen normally has at least 1-2 EditTexts and some auth-related text.
    try {
      const inputs = await $$('//android.widget.EditText');
      if (inputs.length >= 2) return true;
    } catch {
      // ignore
    }

    try {
      const authTexts = await $$('//*[contains(@text,"Password") or contains(@text,"password") or contains(@text,"Email") or contains(@text,"email") or contains(@text,"Sign in") or contains(@text,"Sign In")]');
      return authTexts.length > 0;
    } catch {
      return false;
    }
  }

  private async waitFor(predicate: () => Promise<boolean>, timeoutMs: number, label: string) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (await predicate()) return;
      await driver.pause(250);
    }
    throw new Error(`Timeout waiting for: ${label}`);
  }

  /**
   * Ensures we are on the Sign-in screen.
   * Flow:
   * - If sign-in form is already visible -> return
   * - Else try clicking Sign-in CTA on landing/auth screen
   */
  async ensureOnSignInScreen(): Promise<void> {
    // If the session ends up on the launcher/home screen, bring the app to foreground first.
    try {
      const pkg = await driver.getCurrentPackage().catch(() => '');
      if (pkg && pkg !== 'com.my6.android') {
        try {
          // @ts-ignore
          if (typeof driver.activateApp === 'function') {
            // @ts-ignore
            await driver.activateApp('com.my6.android');
          } else {
            await driver.execute('mobile: activateApp', { appId: 'com.my6.android' });
          }
          await driver.pause(4000);
        } catch {
          // ignore
        }

        // Still not in app? Best-effort start activity.
        const pkg2 = await driver.getCurrentPackage().catch(() => '');
        if (pkg2 && pkg2 !== 'com.my6.android') {
          try {
            // @ts-ignore
            if (typeof driver.startActivity === 'function') {
              // @ts-ignore
              await driver.startActivity('com.my6.android', 'com.oyo.consumer.social_login.views.AuthActivityV2');
              await driver.pause(4000);
            }
          } catch {
            // ignore
          }
        }
      }
    } catch {
      // ignore
    }

    // Give ourselves a chance to dismiss first-run popups immediately
    await this.dismissBlockingPopupsOnce();

    // Wait briefly for initial render
    await this.waitFor(async () => {
      await this.dismissBlockingPopupsOnce();
      if (await this.isSignInFormLikelyVisible()) return true;
      try {
        await this.el(this.signInToContinue, 500);
        return true;
      } catch {
        try {
          await this.el(this.continueAsGuest, 500);
          return true;
        } catch {
          // ignore
        }
        return false;
      }
    }, 25000, 'Auth screen to render (form or sign-in CTA)');

    if (await this.isSignInFormLikelyVisible()) {
      console.log('✓ Already on Sign-in screen');
      return;
    }

    // Landing CTA -> Sign-in form
    await this.click(this.signInToContinue, 'Sign in / Login', 12000);
    await this.waitFor(() => this.isSignInFormLikelyVisible(), 15000, 'Sign-in form to be visible');
  }

  async setEmail(value: string) {
    await this.setValue(this.emailInput, value, 'Email', 8000);
  }

  async setPassword(value: string) {
    await this.setValue(this.passwordInput, value, 'Password', 8000);
  }

  async tapSignIn() {
    await this.click(this.signInButton, 'Sign in', 8000);
  }

  private loginErrorText: PlatformSelectors = {
    android: [
      { using: 'xpath', value: '//*[@resource-id="com.my6.android:id/snackbar_text"]' },
      { using: 'xpath', value: '//*[@resource-id="android:id/message"]' },
      {
        using: 'xpath',
        value:
          '//*[contains(@text,"incorrect") or contains(@text,"Incorrect") or contains(@text,"invalid") or contains(@text,"Invalid") or contains(@text,"wrong") or contains(@text,"Wrong") or contains(@text,"try again") or contains(@text,"Try again")]',
      },
    ],
    ios: [],
  };

  async waitForLoginErrorText(timeoutMs: number = 8000): Promise<string> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        const el = await this.el(this.loginErrorText, 750);
        const text = (await el.getText().catch(() => '')) ?? '';
        if (text.trim().length > 0) return text;
        // Sometimes toast/snackbar is empty, but element exists briefly.
        return text;
      } catch {
        // ignore
      }
      await driver.pause(250);
    }
    throw new Error('Expected login error message, but none appeared');
  }

  async waitForLoginSuccess(timeoutMs: number = 25000): Promise<void> {
    // Success heuristic: we leave AuthActivityV2 or the sign-in form is no longer visible.
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const activity = await driver.getCurrentActivity().catch(() => '');
      if (activity && !activity.includes('AuthActivityV2')) return;
      if (!(await this.isSignInFormLikelyVisible())) return;
      await driver.pause(500);
    }
    throw new Error('Login did not succeed within timeout (still on auth screen)');
  }

  async openForgotPasswordIfPresent() {
    try {
      await this.click(this.forgotPassword, 'Forgot password', 6000);
      await driver.pause(1500);
      return true;
    } catch {
      return false;
    }
  }

  async openRegisterIfPresent() {
    // Retry with a couple scroll attempts in case the landing/auth content shifts.
    for (let attempt = 0; attempt < 4; attempt++) {
      await this.dismissBlockingPopupsOnce();

      try {
        await this.click(this.register, 'Register / Sign up', 5000);
        // Verify we actually navigated to register.
        try {
          await this.el(this.registerFormRoot, 10000);
          await driver.pause(800);
          return true;
        } catch {
          // click might have hit non-actionable element; keep trying
        }
      } catch {
        // ignore
      }

      // If we are still on auth/landing, scroll a bit and retry.
      await this.swipeUp(0.7);
      await driver.pause(600);
    }

    return false;
  }

  async continueAsGuestIfPresent() {
    for (let attempt = 0; attempt < 3; attempt++) {
      await this.escapeRegistrationIfPresent();
      await this.dismissBlockingPopupsOnce();
      
      try {
        await this.click(this.continueAsGuest, 'Continue as guest', 4000);
        await driver.pause(1500);
        return true;
      } catch {
        // Google/Gmail account chooser can steal focus; back out and retry.
        try {
          await this.withTimeout(driver.back(), 2500, 'back(dismiss auth provider)', undefined as any);
          await driver.pause(700);
        } catch {
          // ignore
        }
      }
    }

    return false;
  }
}
