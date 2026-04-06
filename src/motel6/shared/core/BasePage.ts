import type { Platform, PlatformSelectors, Selector } from './selectors';
import { findFirstExisting } from './selectors';

export abstract class BasePage {
  protected readonly platform: Platform;
  private cachedWindowSize?: { width: number; height: number };

  protected constructor(platform: Platform) {
    this.platform = platform;
  }

  protected withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string, fallback?: T): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    const timeoutError = new Error(`${label} timed out after ${timeoutMs}ms`);
    // Capture a useful stack at the callsite, not inside setTimeout().
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Error as any).captureStackTrace?.(timeoutError, this.withTimeout);
    return new Promise<T>((resolve, reject) => {
      timer = setTimeout(() => {
        if (fallback !== undefined) resolve(fallback);
        else reject(timeoutError);
      }, timeoutMs);
      promise
        .then((v) => resolve(v))
        .catch((e) => {
          if (fallback !== undefined) resolve(fallback);
          else reject(e);
        })
        .finally(() => {
          if (timer) clearTimeout(timer);
        });
    });
  }

  protected sels(map: PlatformSelectors): Selector[] {
    return this.platform === 'android' ? map.android : map.ios;
  }

  protected async el(map: PlatformSelectors, timeoutMs?: number) {
    return findFirstExisting(this.sels(map), timeoutMs);
  }

  protected async click(map: PlatformSelectors, label: string, timeoutMs?: number) {
    const element = await this.el(map, timeoutMs);
    const clickTimeout = Math.max(2000, Math.min(15000, timeoutMs ?? 8000));
    await this.withTimeout(element.click(), clickTimeout, `click(${label})`, undefined as any);
    console.log(`✓ Clicked: ${label}`);
  }

  protected async setValue(map: PlatformSelectors, value: string, label: string, timeoutMs?: number) {
    const element = await this.el(map, timeoutMs);
    const opTimeout = Math.max(3000, Math.min(20000, timeoutMs ?? 12000));
    await this.withTimeout(element.click(), opTimeout, `click(input:${label})`, undefined as any);
    try {
      // Some inputs keep previous value; clear makes retries deterministic.
      // clearValue can fail for certain custom views; fall back to setValue.
      // @ts-ignore
      if (typeof element.clearValue === 'function') {
        // @ts-ignore
        await this.withTimeout(element.clearValue(), opTimeout, `clearValue(${label})`, undefined as any);
      }
    } catch {
      // ignore
    }

    await this.withTimeout(element.setValue(value), opTimeout, `setValue(${label})`, undefined as any);

    try {
      // Hide keyboard only if it is shown; otherwise Android may treat this like Back.
      // @ts-ignore
      const canCheck = typeof driver.isKeyboardShown === 'function';
      // @ts-ignore
      const shown = canCheck ? await this.withTimeout(driver.isKeyboardShown(), 5000, 'isKeyboardShown', false) : false;
      // @ts-ignore
      if (shown && typeof driver.hideKeyboard === 'function') {
        // @ts-ignore
        await this.withTimeout(driver.hideKeyboard(), 7000, 'hideKeyboard', undefined as any);
      }
    } catch {
      // ignore
    }
    console.log(`✓ Set value for ${label}: ${value}`);
  }

  protected async getWindowSizeSafe(timeoutMs: number = 5000) {
    if (this.cachedWindowSize) return this.cachedWindowSize;
    const fallback = { width: 1080, height: 1920 };
    try {
      const size = await this.withTimeout(driver.getWindowSize(), timeoutMs, 'getWindowSize', fallback);
      this.cachedWindowSize = size;
      return size;
    } catch {
      this.cachedWindowSize = fallback;
      return fallback;
    }
  }

  protected async swipeByActions(opts: { direction: 'up' | 'down'; percent?: number }) {
    if (this.platform !== 'android') return;

    const percent = Math.max(0.2, Math.min(0.9, opts.percent ?? 0.7));
    const { width, height } = await this.getWindowSizeSafe(5000);

    const x = Math.round(width * 0.5);
    const yStart = Math.round(height * 0.75);
    const travel = Math.round(height * percent);
    const yEnd = opts.direction === 'up' ? yStart - travel : yStart + travel;

    try {
      await this.withTimeout(
        driver.performActions([
          {
            type: 'pointer',
            id: 'finger1',
            parameters: { pointerType: 'touch' },
            actions: [
              { type: 'pointerMove', duration: 0, x, y: yStart },
              { type: 'pointerDown', button: 0 },
              { type: 'pause', duration: 80 },
              { type: 'pointerMove', duration: 450, x, y: yEnd },
              { type: 'pointerUp', button: 0 },
            ],
          },
        ]),
        8000,
        `performActions(swipe ${opts.direction})`,
      );
    } catch {
      // ignore
    }

    try {
      await this.withTimeout(driver.releaseActions(), 5000, 'releaseActions', undefined as any);
    } catch {
      // ignore
    }
  }

  protected async tapByActions(x: number, y: number) {
    if (this.platform !== 'android') return;
    try {
      await this.withTimeout(
        driver.performActions([
          {
            type: 'pointer',
            id: 'finger1',
            parameters: { pointerType: 'touch' },
            actions: [
              { type: 'pointerMove', duration: 0, x, y },
              { type: 'pointerDown', button: 0 },
              { type: 'pause', duration: 60 },
              { type: 'pointerUp', button: 0 },
            ],
          },
        ]),
        8000,
        'performActions(tap)',
      );
    } catch {
      // ignore
    }

    try {
      await this.withTimeout(driver.releaseActions(), 5000, 'releaseActions', undefined as any);
    } catch {
      // ignore
    }
  }

  protected async tapAtRatio(xRatio: number, yRatio: number) {
    if (this.platform !== 'android') return;
    const { width, height } = await this.getWindowSizeSafe(5000);
    const x = Math.round(width * Math.max(0.05, Math.min(0.95, xRatio)));
    const y = Math.round(height * Math.max(0.05, Math.min(0.95, yRatio)));
    await this.tapByActions(x, y);
  }

  protected async swipeUp(percent: number = 0.75) {
    await this.swipeByActions({ direction: 'up', percent });
  }

  protected async swipeDown(percent: number = 0.75) {
    await this.swipeByActions({ direction: 'down', percent });
  }
}
