export type Platform = 'android' | 'ios';

export type Selector =
  | { using: 'id'; value: string }
  | { using: 'accessibility id'; value: string }
  | { using: 'android uiautomator'; value: string }
  | { using: 'xpath'; value: string };

export type PlatformSelectors = {
  android: Selector[];
  ios: Selector[];
};

async function dismissAndroidBlockingPopups(maxClicks: number = 2): Promise<boolean> {
  // Best-effort; never throw from here.
  try {
    // @ts-ignore
    const isAndroid = Boolean((driver as any).isAndroid) || String((driver as any).capabilities?.platformName ?? '').toLowerCase().includes('android');
    if (!isAndroid) return false;
  } catch {
    // ignore
  }

  // Keep candidates small + mostly id-based.
  // On some Android 16 devices, missing-element checks can be very slow; also avoid XPath here.
  const candidates: Array<{ label: string; sel: Selector }> = [
    // Common dialog buttons
    { label: 'Dialog positive button', sel: { using: 'id', value: 'android:id/button1' } },
    { label: 'Dialog negative button', sel: { using: 'id', value: 'android:id/button2' } },

    // Google Play Services dialogs
    { label: 'GMS positive button', sel: { using: 'id', value: 'com.google.android.gms:id/positive_button' } },
    { label: 'GMS negative button', sel: { using: 'id', value: 'com.google.android.gms:id/negative_button' } },
    { label: 'GMS cancel', sel: { using: 'id', value: 'com.google.android.gms:id/cancel' } },
  ];

  let clicked = false;
  for (let i = 0; i < maxClicks; i++) {
    let didClickThisRound = false;

    for (const c of candidates) {
      try {
        // Use findElements to avoid slow exception paths from findElement on missing elements.
        const els = await $$(toWdioSelector(c.sel));
        if (!els.length) continue;
        const el = els[0];
        if (typeof (el as any).isDisplayed === 'function') {
          const shown = await (el as any).isDisplayed().catch(() => true);
          if (!shown) continue;
        }
        await el.click();
        clicked = true;
        didClickThisRound = true;
        console.log(`✓ Dismissed popup: ${c.label}`);
        await driver.pause(600);
        break;
      } catch {
        // ignore
      }
    }

    if (!didClickThisRound) break;
  }

  return clicked;
}

export async function findFirstExisting(selectors: Selector[], timeoutMs = 8000) {
  const isFatalSessionError = (e: unknown) => {
    const msg = String((e as any)?.message ?? e);
    return (
      msg.includes('instrumentation process is not running') ||
      msg.includes('cannot be proxied to UiAutomator2 server') ||
      msg.includes('socket hang up') ||
      msg.includes('invalid session id') ||
      msg.includes('A session is either terminated or not started') ||
      msg.includes('NoSuchDriver')
    );
  };

  const start = Date.now();
  let lastError: unknown;
  let lastPopupDismissAt = 0;
  lastPopupDismissAt = start;

  while (Date.now() - start < timeoutMs) {
    // Throttle popup dismissal: on some devices (Android 16) even simple lookups can be slow.
    // Calling popup dismissal every poll cycle can make runs look stuck.
    // Only start attempting popup dismissal after we have actually tried selectors for a bit.
    if (Date.now() - start > 1500 && Date.now() - lastPopupDismissAt > 2500) {
      try {
        await dismissAndroidBlockingPopups(1);
        lastPopupDismissAt = Date.now();
      } catch {
        // ignore
      }
    }
    for (const sel of selectors) {
      try {
        // Use findElements to avoid the slow exception path of findElement on missing elements.
        const els = await $$(toWdioSelector(sel));
        if (els.length) return els[0];
      } catch (e) {
        if (isFatalSessionError(e)) throw e;
        lastError = e;
      }
    }
    await driver.pause(250);
  }

  const pretty = selectors.map((s) => `${s.using}:${s.value}`).join(' | ');
  throw new Error(`Element not found within ${timeoutMs}ms. Tried: ${pretty}. Last error: ${String(lastError)}`);
}

export function toWdioSelector(sel: Selector): string {
  if (sel.using === 'id') return `id=${sel.value}`;
  if (sel.using === 'accessibility id') return `~${sel.value}`;
  if (sel.using === 'android uiautomator') return `android=${sel.value}`;
  return sel.value;
}
