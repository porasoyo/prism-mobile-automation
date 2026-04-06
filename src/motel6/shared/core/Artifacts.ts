import fs from 'node:fs';
import path from 'node:path';

function safeName(name: string) {
  return name.replace(/[^a-z0-9-_]+/gi, '_').slice(0, 120);
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeoutError = new Error(`${label} timed out after ${timeoutMs}ms`);
  // Capture a useful stack at the callsite, not inside setTimeout().
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Error as any).captureStackTrace?.(timeoutError, withTimeout);
  try {
    return (await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(timeoutError), timeoutMs);
      }),
    ])) as T;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function safeGetPageSource(timeoutMs: number = 25000): Promise<string | undefined> {
  try {
    return await withTimeout(driver.getPageSource(), timeoutMs, 'getPageSource');
  } catch (e) {
    // One retry helps when overlays/transitions briefly stall XML.
    try {
      await delay(800);
      return await withTimeout(driver.getPageSource(), timeoutMs, 'getPageSource(retry)');
    } catch {
      console.warn(`⚠️  getPageSource failed: ${String((e as any)?.message ?? e)}`);
      return undefined;
    }
  }
}

export async function captureFailureArtifacts(testName: string) {
  const outDir = path.join(process.cwd(), 'test-artifacts');
  fs.mkdirSync(outDir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const base = `${stamp}__${safeName(testName)}`;

  try {
    const pngPath = path.join(outDir, `${base}.png`);
    await driver.saveScreenshot(pngPath);
  } catch {
    // ignore
  }

  try {
    const xmlPath = path.join(outDir, `${base}.xml`);
    const source = await safeGetPageSource(25000);
    if (source) fs.writeFileSync(xmlPath, source, 'utf-8');
  } catch {
    // ignore
  }
}

export async function dumpCurrentScreenElements(tag: string) {
  const outDir = path.join(process.cwd(), 'element_extraction');
  fs.mkdirSync(outDir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const base = `${stamp}__${safeName(tag)}`;

  const xml = await safeGetPageSource(25000);
  if (xml) fs.writeFileSync(path.join(outDir, `${base}.xml`), xml, 'utf-8');

  const ids = Array.from((xml ?? '').matchAll(/resource-id="([^"]+)"/g)).map((m) => m[1]).filter(Boolean);
  const a11y = Array.from((xml ?? '').matchAll(/content-desc="([^"]+)"/g)).map((m) => m[1]).filter(Boolean);
  const texts = Array.from((xml ?? '').matchAll(/text="([^"]+)"/g)).map((m) => m[1]).filter((t) => t && t.trim().length > 0);

  const uniq = (arr: string[]) => Array.from(new Set(arr)).slice(0, 500);

  const safeActivity = async () => {
    try {
      return await withTimeout(driver.getCurrentActivity(), 8000, 'getCurrentActivity');
    } catch {
      return undefined;
    }
  };

  const safePackage = async () => {
    try {
      return await withTimeout(driver.getCurrentPackage(), 8000, 'getCurrentPackage');
    } catch {
      return undefined;
    }
  };

  const json = {
    tag,
    timestamp: stamp,
    activity: await safeActivity(),
    package: await safePackage(),
    resourceIds: uniq(ids),
    accessibilityIds: uniq(a11y),
    visibleTexts: uniq(texts),
    pageSourceCaptured: Boolean(xml),
  };

  fs.writeFileSync(path.join(outDir, `${base}.json`), JSON.stringify(json, null, 2), 'utf-8');
  return json;
}

type ExtractedNode = {
  tag: string;
  class?: string;
  resourceId?: string;
  contentDesc?: string;
  text?: string;
  hint?: string;
};

function parseXmlNodes(xml: string): ExtractedNode[] {
  const nodes: ExtractedNode[] = [];
  const tagRe = /<([a-zA-Z0-9._-]+)([^>]*)>/g;
  const attrRe = /([\w-]+)="([^"]*)"/g;

  for (const match of xml.matchAll(tagRe)) {
    const tag = match[1];
    const attrBlob = match[2] ?? '';
    const attrs: Record<string, string> = {};
    for (const a of attrBlob.matchAll(attrRe)) {
      attrs[a[1]] = a[2];
    }

    const resourceId = attrs['resource-id'];
    const contentDesc = attrs['content-desc'];
    const text = attrs['text'];
    const hint = attrs['hint'];

    if (!resourceId && !contentDesc && (!text || text.trim().length === 0)) continue;

    nodes.push({
      tag,
      class: attrs['class'] ?? tag,
      resourceId,
      contentDesc,
      text,
      hint,
    });
  }

  return nodes;
}

function pickBestLocator(node?: ExtractedNode) {
  if (!node) return undefined;
  if (node.resourceId) return { using: 'xpath', value: `//*[@resource-id="${node.resourceId}"]` } as const;
  if (node.contentDesc) return { using: 'accessibility id', value: node.contentDesc } as const;
  if (node.text) return { using: 'xpath', value: `//*[@text="${node.text}"]` } as const;
  return undefined;
}

function first(nodes: ExtractedNode[], predicate: (n: ExtractedNode) => boolean): ExtractedNode | undefined {
  return nodes.find(predicate);
}

function includesAny(haystack: string | undefined, needles: string[]) {
  if (!haystack) return false;
  const h = haystack.toLowerCase();
  return needles.some((n) => h.includes(n));
}

/**
 * Creates a small, stable locator map for login-related elements from the CURRENT screen.
 * Prefers `resource-id`, then `content-desc`, then falls back to exact `text`.
 */
export async function extractLoginLocatorMap(tag: string) {
  const outDir = path.join(process.cwd(), 'element_extraction');
  fs.mkdirSync(outDir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const base = `${stamp}__${safeName(tag)}__login_locators`;

  const xml = await driver.getPageSource();
  const nodes = parseXmlNodes(xml);

  // Prefer stable, container-based locators when known IDs exist
  const has = (s: string) => xml.includes(`resource-id="${s}"`);
  const stable = {
    username:
      has('com.my6.android:id/edit_user_id') && has('com.my6.android:id/text_input')
        ? { using: 'xpath', value: '//*[@resource-id="com.my6.android:id/edit_user_id"]//*[@resource-id="com.my6.android:id/text_input"]' }
        : undefined,
    password:
      has('com.my6.android:id/edit_password') && has('com.my6.android:id/text_input')
        ? { using: 'xpath', value: '//*[@resource-id="com.my6.android:id/edit_password"]//*[@resource-id="com.my6.android:id/text_input"]' }
        : undefined,
    signIn: has('com.my6.android:id/verify_button')
      ? { using: 'xpath', value: '//*[@resource-id="com.my6.android:id/verify_button"]' }
      : undefined,
    forgotPassword: has('com.my6.android:id/forgot_password')
      ? { using: 'xpath', value: '//*[@resource-id="com.my6.android:id/forgot_password"]' }
      : undefined,
    register: has('com.my6.android:id/register_button')
      ? { using: 'xpath', value: '//*[@resource-id="com.my6.android:id/register_button"]' }
      : undefined,
  };

  const editTexts = nodes.filter((n) => (n.class ?? '').toLowerCase().includes('edittext'));
  const username =
    first(editTexts, (n) => includesAny(n.resourceId, ['email', 'user', 'username', 'phone', 'mobile'])) ??
    first(editTexts, (n) => includesAny(n.hint, ['email', 'member', 'user', 'phone', 'mobile'])) ??
    first(editTexts, (n) => includesAny(n.text, ['email', 'phone', 'mobile', 'user'])) ??
    editTexts[0];

  const password =
    first(editTexts, (n) => includesAny(n.resourceId, ['pass'])) ??
    first(editTexts, (n) => includesAny(n.hint, ['password', 'pass'])) ??
    first(editTexts, (n) => includesAny(n.text, ['password', 'pass'])) ??
    editTexts[1];

  const buttons = nodes.filter((n) => includesAny(n.class, ['button']) || includesAny(n.tag, ['button']));
  const signInBtn =
    first(nodes, (n) => n.resourceId === 'com.my6.android:id/verify_button') ??
    first(buttons, (n) => includesAny(n.text, ['sign in', 'login', 'log in', 'continue'])) ??
    first(nodes, (n) => includesAny(n.text, ['sign in', 'login', 'log in']));

  const forgot =
    first(nodes, (n) => n.resourceId === 'com.my6.android:id/forgot_password') ??
    first(nodes, (n) => includesAny(n.text, ['forgot'])) ??
    first(nodes, (n) => includesAny(n.resourceId, ['forgot']));
  const register =
    first(nodes, (n) => n.resourceId === 'com.my6.android:id/register_button') ??
    first(nodes, (n) => includesAny(n.text, ['register', 'sign up', 'signup', 'create account'])) ??
    first(nodes, (n) => includesAny(n.resourceId, ['register', 'signup', 'sign_up']));

  const map = {
    screenTag: tag,
    timestamp: stamp,
    activity: await driver.getCurrentActivity().catch(() => undefined),
    candidates: {
      username: { node: username, locator: stable.username ?? pickBestLocator(username) },
      password: { node: password, locator: stable.password ?? pickBestLocator(password) },
      signIn: { node: signInBtn, locator: stable.signIn ?? pickBestLocator(signInBtn) },
      forgotPassword: { node: forgot, locator: stable.forgotPassword ?? pickBestLocator(forgot) },
      register: { node: register, locator: stable.register ?? pickBestLocator(register) },
    },
  };

  fs.writeFileSync(path.join(outDir, `${base}.json`), JSON.stringify(map, null, 2), 'utf-8');
  return map;
}

/**
 * Creates a locator map for Forgot Password / Reset Password screen from the CURRENT screen.
 */
export async function extractForgotPasswordLocatorMap(tag: string) {
  const outDir = path.join(process.cwd(), 'element_extraction');
  fs.mkdirSync(outDir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const base = `${stamp}__${safeName(tag)}__forgot_locators`;

  const xml = await driver.getPageSource();
  const nodes = parseXmlNodes(xml);
  const has = (s: string) => xml.includes(`resource-id="${s}"`);
  const stable = {
    emailOrPhone:
      has('com.my6.android:id/user_id_input') && has('com.my6.android:id/text_input')
        ? { using: 'xpath', value: '//*[@resource-id="com.my6.android:id/user_id_input"]//*[@resource-id="com.my6.android:id/text_input"]' }
        : undefined,
    submit: has('com.my6.android:id/continue_button')
      ? { using: 'xpath', value: '//*[@resource-id="com.my6.android:id/continue_button"]' }
      : undefined,
  };
  const editTexts = nodes.filter((n) => (n.class ?? '').toLowerCase().includes('edittext'));

  const emailOrPhone =
    first(editTexts, (n) => includesAny(n.resourceId, ['email', 'user', 'username', 'phone', 'mobile'])) ??
    first(editTexts, (n) => includesAny(n.hint, ['email', 'phone', 'mobile'])) ??
    first(editTexts, (n) => includesAny(n.text, ['email', 'phone', 'mobile'])) ??
    editTexts[0];

  const buttons = nodes.filter((n) => includesAny(n.class, ['button']) || includesAny(n.tag, ['button']));
  const submit =
    first(nodes, (n) => n.resourceId === 'com.my6.android:id/continue_button') ??
    first(buttons, (n) => includesAny(n.text, ['send', 'reset', 'continue', 'submit', 'next'])) ??
    first(nodes, (n) => includesAny(n.text, ['send', 'reset', 'continue', 'submit']));

  const back =
    first(nodes, (n) => includesAny(n.contentDesc, ['navigate up', 'back'])) ??
    first(nodes, (n) => includesAny(n.resourceId, ['back'])) ??
    first(nodes, (n) => includesAny(n.text, ['back']));

  const map = {
    screenTag: tag,
    timestamp: stamp,
    activity: await driver.getCurrentActivity().catch(() => undefined),
    candidates: {
      emailOrPhone: { node: emailOrPhone, locator: stable.emailOrPhone ?? pickBestLocator(emailOrPhone) },
      submit: { node: submit, locator: stable.submit ?? pickBestLocator(submit) },
      back: { node: back, locator: pickBestLocator(back) },
    },
  };

  fs.writeFileSync(path.join(outDir, `${base}.json`), JSON.stringify(map, null, 2), 'utf-8');
  return map;
}

/**
 * Creates a locator map for Registration / Sign up screen from the CURRENT screen.
 */
export async function extractRegisterLocatorMap(tag: string) {
  const outDir = path.join(process.cwd(), 'element_extraction');
  fs.mkdirSync(outDir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const base = `${stamp}__${safeName(tag)}__register_locators`;

  const xml = await driver.getPageSource();
  const nodes = parseXmlNodes(xml);
  const has = (s: string) => xml.includes(`resource-id="${s}"`);
  const stable = {
    // Indexed inputs in the RecyclerView
    firstName: has('com.my6.android:id/signUpFormRecyclerView')
      ? { using: 'xpath', value: '(//*[@resource-id="com.my6.android:id/signUpFormRecyclerView"]//*[@resource-id="com.my6.android:id/vhEditText"])[1]' }
      : undefined,
    lastName: has('com.my6.android:id/signUpFormRecyclerView')
      ? { using: 'xpath', value: '(//*[@resource-id="com.my6.android:id/signUpFormRecyclerView"]//*[@resource-id="com.my6.android:id/vhEditText"])[2]' }
      : undefined,
    mobile: has('com.my6.android:id/signUpFormRecyclerView')
      ? { using: 'xpath', value: '(//*[@resource-id="com.my6.android:id/signUpFormRecyclerView"]//*[@resource-id="com.my6.android:id/vhEditText"])[3]' }
      : undefined,
    email: has('com.my6.android:id/signUpFormRecyclerView')
      ? { using: 'xpath', value: '(//*[@resource-id="com.my6.android:id/signUpFormRecyclerView"]//*[@resource-id="com.my6.android:id/vhEditText"])[4]' }
      : undefined,
    password: has('com.my6.android:id/signUpFormRecyclerView')
      ? { using: 'xpath', value: '(//*[@resource-id="com.my6.android:id/signUpFormRecyclerView"]//*[@resource-id="com.my6.android:id/vhEditText"])[5]' }
      : undefined,
    createAccount: has('com.my6.android:id/signupCreateAccount')
      ? { using: 'xpath', value: '//*[@resource-id="com.my6.android:id/signupCreateAccount"]' }
      : undefined,
    terms: has('com.my6.android:id/signupTermsCondition')
      ? { using: 'xpath', value: '//*[@resource-id="com.my6.android:id/signupTermsCondition"]' }
      : undefined,
    promotions: has('com.my6.android:id/signupPromotions')
      ? { using: 'xpath', value: '//*[@resource-id="com.my6.android:id/signupPromotions"]' }
      : undefined,
  };
  const editTexts = nodes.filter((n) => (n.class ?? '').toLowerCase().includes('edittext'));

  const firstName =
    first(editTexts, (n) => includesAny(n.resourceId, ['first', 'fname'])) ??
    first(editTexts, (n) => includesAny(n.text, ['first name', 'firstname']));
  const lastName =
    first(editTexts, (n) => includesAny(n.resourceId, ['last', 'lname'])) ??
    first(editTexts, (n) => includesAny(n.text, ['last name', 'lastname']));
  const email =
    first(editTexts, (n) => includesAny(n.resourceId, ['email'])) ??
    first(editTexts, (n) => includesAny(n.text, ['email']));
  const phone =
    first(editTexts, (n) => includesAny(n.resourceId, ['phone', 'mobile'])) ??
    first(editTexts, (n) => includesAny(n.text, ['phone', 'mobile']));
  const password =
    first(editTexts, (n) => includesAny(n.resourceId, ['pass'])) ??
    first(editTexts, (n) => includesAny(n.text, ['password', 'pass']));
  const confirmPassword =
    first(editTexts, (n) => includesAny(n.resourceId, ['confirm'])) ??
    first(editTexts, (n) => includesAny(n.text, ['confirm']));

  const buttons = nodes.filter((n) => includesAny(n.class, ['button']) || includesAny(n.tag, ['button']));
  const registerBtn =
    first(buttons, (n) => includesAny(n.text, ['register', 'sign up', 'create account', 'continue'])) ??
    first(nodes, (n) => includesAny(n.text, ['register', 'sign up', 'create account']));

  const map = {
    screenTag: tag,
    timestamp: stamp,
    activity: await driver.getCurrentActivity().catch(() => undefined),
    candidates: {
      firstName: { node: firstName, locator: stable.firstName ?? pickBestLocator(firstName) },
      lastName: { node: lastName, locator: stable.lastName ?? pickBestLocator(lastName) },
      email: { node: email, locator: stable.email ?? pickBestLocator(email) },
      phone: { node: phone, locator: stable.mobile ?? pickBestLocator(phone) },
      password: { node: password, locator: stable.password ?? pickBestLocator(password) },
      confirmPassword: { node: confirmPassword, locator: pickBestLocator(confirmPassword) },
      register: { node: registerBtn, locator: stable.createAccount ?? pickBestLocator(registerBtn) },
      terms: { node: first(nodes, (n) => n.resourceId === 'com.my6.android:id/signupTermsCondition'), locator: stable.terms },
      promotions: { node: first(nodes, (n) => n.resourceId === 'com.my6.android:id/signupPromotions'), locator: stable.promotions },
    },
  };

  fs.writeFileSync(path.join(outDir, `${base}.json`), JSON.stringify(map, null, 2), 'utf-8');
  return map;
}
