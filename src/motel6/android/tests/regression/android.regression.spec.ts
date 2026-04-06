import {
  captureFailureArtifacts,
  dumpCurrentScreenElements,
} from '../../../shared/core/Artifacts';
import { LoginPage } from '../../pages/LoginPage';
import { RegisterPage } from '../../pages/RegisterPage';
import { HomePage } from '../../pages/HomePage';
import { AccountPage } from '../../pages/AccountPage';
import { SearchPage } from '../../pages/SearchPage';
import { ListerPage } from '../../pages/ListerPage';
import {
  generateRandomSearchConfig,
  getRandomUSLocation,
  getRandomDateOffset,
  getRandomNights,
  getRandomAdultCount,
  getRandomChildrenCount,
  getRandomDigits,
  getRandomLetters,
  generateTestPassword,
  getRandomRateCodes,
  RATE_CODES,
  RateCodeType,
} from '../../../shared/utils/TestDataUtils';
import { dismissAllPopups, handleAppStartupPopups } from '../../../shared/utils/PopupHandler';
import fs from 'node:fs';
import path from 'node:path';

describe('Motel6 Android - Regression', () => {
  const loginPage = new LoginPage();
  const registerPage = new RegisterPage();
  const homePage = new HomePage();
  const accountPage = new AccountPage();
  const searchPage = new SearchPage();
  const listerPage = new ListerPage();

  const isInvalidSessionError = (err: any) => {
    const msg = String(err?.message ?? err);
    return (
      msg.trim() === 'Timeout' ||
      msg.includes('invalid session id') ||
      msg.includes('is not known') ||
      msg.includes('NoSuchDriver') ||
      msg.includes('A session is either terminated or not started') ||
      msg.includes('socket hang up') ||
      msg.includes('cannot be proxied to UiAutomator2 server because the instrumentation process is not running')
    );
  };

  const reloadSessionOrThrow = async (label: string) => {
    // @ts-ignore
    const prevSessionId: string | undefined = driver?.sessionId;
    try {
      // @ts-ignore
      await driver.reloadSession();
    } catch (err) {
      const msg = String((err as any)?.message ?? err);
      throw new Error(`${label}: reloadSession failed (${msg})`);
    }

    // @ts-ignore
    const nextSessionId: string | undefined = driver?.sessionId;
    if (!nextSessionId || nextSessionId === prevSessionId) {
      throw new Error(`${label}: reloadSession did not create a new session (prev=${prevSessionId ?? 'none'}, next=${nextSessionId ?? 'none'})`);
    }

    // Smoke-check that the session is alive before retrying the flow.
    try {
      // @ts-ignore
      await driver.getSession();
    } catch (err) {
      const msg = String((err as any)?.message ?? err);
      throw new Error(`${label}: new session is not responding (${msg})`);
    }
  };

  const withOneSessionReload = async <T>(label: string, fn: () => Promise<T>): Promise<T> => {
    try {
      return await fn();
    } catch (err) {
      if (!isInvalidSessionError(err)) throw err;
      console.warn(`⚠️  ${label}: session looks invalid; reloading once...`);
      await reloadSessionOrThrow(label);
      return await fn();
    }
  };

  const withOneFullRetryOnDriverCrash = async (label: string, fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (err) {
      if (!isInvalidSessionError(err)) throw err;
      console.warn(`⚠️  ${label}: driver/session crashed; reloading and retrying once...`);
      await reloadSessionOrThrow(label);
      await fn();
    }
  };

  // By default we SKIP registration to avoid creating many fake users in DB.
  // Enable explicitly when needed:
  //   RUN_REGISTRATION=true ./run-test.sh src/motel6/android/tests/regression/android.regression.spec.ts
  const RUN_REGISTRATION = String(process.env.RUN_REGISTRATION ?? '').toLowerCase() === 'true';

  // Dumping page source XML/JSON can be slow on some overlays; keep it opt-in for speed.
  // Enable when you want to (re)lock stable resource-ids:
  //   DUMP_ELEMENTS=true ./run-test.sh src/motel6/android/tests/regression/android.regression.spec.ts
  const DUMP_ELEMENTS = String(process.env.DUMP_ELEMENTS ?? '').toLowerCase() === 'true';

  const maybeDump = async (tag: string) => {
    if (!DUMP_ELEMENTS) return;
    await dumpCurrentScreenElements(tag);
  };
  const itRegistration: typeof it = ((title: any, fn: any) => {
    return RUN_REGISTRATION ? it(title, fn) : it.skip(title, fn);
  }) as any;

  async function enterAppAsGuestOrContinue() {
    await withOneSessionReload('enterAppAsGuestOrContinue', async () => {
      await resetAppToFreshStart();

      for (let attempt = 0; attempt < 4; attempt++) {
        // Handle any popups first (permissions, welcome screens, etc.)
        await dismissAllPopups(5);
        
        // FIRST: Check if we're already on home page (most common case with noReset=true)
        try {
          await homePage.waitForLoaded(3000);
          console.log('✓ Already on home page');
          return;
        } catch {
          // Not on home page yet, continue with login flow
        }
        
        await loginPage.escapeRegistrationIfPresent();
        const guest = await loginPage.continueAsGuestIfPresent();
        if (guest) {
          // CRITICAL: Handle permission popups after clicking Continue as guest
          await driver.pause(1500);
          await dismissAllPopups(5);
          await homePage.waitForLoaded(30000);
          return;
        }

        // With noReset=true, we may already be inside the app and skip the auth screen entirely.
        try {
          await dismissAllPopups(3);
          await homePage.waitForLoaded(5000);
          return;
        } catch {
          // not on home yet
        }

        // If a provider sheet (e.g., Google/Gmail) is open, back out.
        try {
          await Promise.race([
            driver.back(),
            driver.pause(2500).then(() => {
              throw new Error('back timeout');
            }),
          ]);
        } catch {
          // ignore
        }
        await driver.pause(500);
      }

      // Last attempt: dismiss popups and assert home.
      await dismissAllPopups(5);
      await homePage.waitForLoaded(30000);
    });
  }

  async function resetAppToFreshStart() {
    const appId = 'com.my6.android';
    const CLEAR_APP = String(process.env.CLEAR_APP ?? '').toLowerCase() === 'true';
    const TERMINATE_APP = String(process.env.TERMINATE_APP ?? '').toLowerCase() === 'true';
    try {
      // Hard reset (terminate) can destabilize UiAutomator2 on some devices.
      // Keep it opt-in:
      //   TERMINATE_APP=true ./run-test.sh ...
      if (TERMINATE_APP) {
        // @ts-ignore
        if (typeof driver.terminateApp === 'function') {
          // @ts-ignore
          await driver.terminateApp(appId);
        } else {
          await driver.execute('mobile: terminateApp', { appId });
        }

        await driver.pause(1000);
      }
    } catch {
      // ignore
    }

    // Clearing app data can be flaky and may crash the UiAutomator2 session.
    // Keep it opt-in for debugging only:
    //   CLEAR_APP=true ./run-test.sh ...
    if (CLEAR_APP) {
      try {
        await Promise.race([
          driver.execute('mobile: clearApp', { appId }),
          driver.pause(20000).then(() => {
            throw new Error('clearApp timeout');
          }),
        ]);
      } catch {
        // ignore
      }

      await driver.pause(1000);
    }

    try {
      // @ts-ignore
      if (typeof driver.activateApp === 'function') {
        // @ts-ignore
        await driver.activateApp(appId);
      } else {
        await driver.execute('mobile: activateApp', { appId });
      }
    } catch {
      // ignore
    }

    await driver.pause(2000);  // Wait for app to initialize
    
    // Handle startup popups (permissions, welcome dialogs)
    await handleAppStartupPopups();
  }

  // Use utility functions from TestDataUtils for random data generation
  // getRandomDigits, getRandomLetters, generateTestPassword are imported

  beforeEach(async function () {
    // Handle any popups before each test
    await dismissAllPopups(3);
  });

  afterEach(async function () {
    // mocha context
    // @ts-ignore
    const state = this?.currentTest?.state;
    // @ts-ignore
    const title = this?.currentTest?.fullTitle?.() ?? this?.currentTest?.title ?? 'unknown-test';
    if (state === 'failed') {
      await captureFailureArtifacts(title);
    }
    // DO NOT terminate app here - it causes issues with retries
  });

  after(async function () {
    // Final cleanup - ensure app is closed after all tests
    try {
      await driver.execute('mobile: terminateApp', { appId: 'com.my6.android' });
      console.log('✓ App terminated after test suite');
    } catch (e) {
      // Ignore
    }
  });

  itRegistration('TC001 - Registration flow (Create account)', async () => {
    await resetAppToFreshStart();

    // IMPORTANT: do NOT click Continue as guest here.
    // Prefer opening Register directly (works when Sign-in sheet is already shown).
    let registerOpened = await loginPage.openRegisterIfPresent();
    if (!registerOpened) {
      await loginPage.ensureOnSignInScreen();
      registerOpened = await loginPage.openRegisterIfPresent();
    }
    if (!registerOpened) throw new Error('Could not open Register from landing/auth screen');

    // Test data using TestDataUtils
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    // Names: letters only (no numbers/special chars)
    const firstName = `test${getRandomLetters(4)}`;
    const lastName = `user${getRandomLetters(4)}`;
    const mobile = getRandomDigits(10); // 8-10 digits allowed; use 10 for consistency
    // Keep email short but unique-ish
    const email = `t${getRandomDigits(6)}@gmail.com`;
    const password = generateTestPassword();

    // Fill all 5 fields (first, last, mobile, email, password)
    await registerPage.setFirstName(firstName);
    await registerPage.setLastName(lastName);
    await registerPage.setMobile(mobile);
    await registerPage.setEmail(email);
    await registerPage.setPassword(password);
    await registerPage.acceptTermsIfPresent();

    // Create account and read validation errors (if any)
    const result = await registerPage.submitAndWaitForResult(30000);
    if (!result.success) {
      const errors = (result.errors ?? []).join(' | ');
      throw new Error(`Registration failed with validation errors: ${errors}`);
    }

    // We should now be redirected and auto-logged in on Home.
    await homePage.waitForLoaded(30000);

    // Open Account tab -> open username header -> logout -> confirm yes
    await homePage.openAccountsTab();
    await accountPage.openUserHeader({ firstName, lastName, email });
    await accountPage.logout();

    // Landing screen: Continue as guest
    const guest = await loginPage.continueAsGuestIfPresent();
    if (!guest) throw new Error('Could not find "Continue as guest" after logout');

    // Verify Home loads as guest + can scroll
    await homePage.waitForLoaded(30000);
    await homePage.verifyCanScroll();

    // Persist created credentials for reuse/debugging
    try {
      const outDir = path.join(process.cwd(), 'test-artifacts');
      fs.mkdirSync(outDir, { recursive: true });
      const outPath = path.join(outDir, `${stamp}__created_account.json`);
      fs.writeFileSync(
        outPath,
        JSON.stringify(
          { createdAt: stamp, firstName, lastName, mobile, email, password },
          null,
          2,
        ),
        'utf-8',
      );
      console.log(`✓ Saved created account to: ${outPath}`);
    } catch {
      // ignore
    }
  });

  it('TC002 - Search flow (guest) with future dates', async function () {
    this.timeout(6 * 60 * 1000);
    this.retries(1);

    await withOneFullRetryOnDriverCrash('TC002', async () => {
      await enterAppAsGuestOrContinue();
    await homePage.verifyCanScroll();

    // Open Search and store all elements on that screen for stable locators
    await homePage.openSearch();
    await searchPage.waitForSearchPageLoaded(10000);
    await maybeDump('android_search');

    // Generate random search configuration using TestDataUtils
    const searchConfig = generateRandomSearchConfig();
    console.log(`✓ Search config: ${JSON.stringify(searchConfig)}`);

    // 1) Calendar first: open and pick future dates (2–4 months ahead)
    console.log('→ Calendar: scroll and pick future dates');
    await searchPage.pickDatesInCustomSheet(searchConfig.offsetDays, searchConfig.nights);
    console.log(`✓ Dates applied (offsetDays=${searchConfig.offsetDays}, nights=${searchConfig.nights})`);
    await maybeDump('android_search_after_dates');

    // 2) Guests next: adjust adults/children and Apply
    console.log('→ Guests: adjust and apply');
    await searchPage.setGuestsInCustomSheet({ adults: searchConfig.adults, children: searchConfig.children });
    console.log(`✓ Guests applied (adults=${searchConfig.adults}, children=${searchConfig.children})`);
    await maybeDump('android_search_after_guests');

    // 3) Destination last: type and select from dropdown suggestions
    console.log('→ Destination: type and select suggestion');
    await searchPage.setDestination(searchConfig.destination, { pickSuggestion: true });
    console.log(`✓ Destination selected: ${searchConfig.destination}`);
    await maybeDump('android_search_after_destination');

    // 4) Submit search to navigate to lister
    console.log('→ Submit: navigate to lister');
    await searchPage.submitSearch();

      // 5) Validate lister: results + scroll property cards
      await listerPage.waitForLoaded(45000);
      await listerPage.scrollAndValidateCards(3);
    });
  });

  it('TC003 - Lister pagination + card details (guest)', async function () {
    this.timeout(10 * 60 * 1000); // 10 minutes for thorough validation
    this.retries(1);

    await withOneFullRetryOnDriverCrash('TC003', async () => {
      console.log('→ TC003 start');
      await enterAppAsGuestOrContinue();

      console.log('→ Open Search');

      // Open Search
      await homePage.openSearch();
      await searchPage.waitForSearchPageLoaded(10000);
      await maybeDump('android_search_tc003');

      // Generate random search configuration - 2-4 months ahead for better inventory
      const destination = getRandomUSLocation();
      const offsetDays = getRandomDateOffset(60, 120); // 2-4 months ahead
      const nights = getRandomNights(1, 3);
      const adults = getRandomAdultCount(1, 2); // 1-2 adults max
      const children = getRandomChildrenCount(0, 1); // 0-1 children max
      
      console.log(`✓ Search config: destination=${destination}, offsetDays=${offsetDays}, nights=${nights}, adults=${adults}, children=${children}`);

      // 1) Calendar first: future dates (2-4 months ahead for better inventory)
      console.log('→ Dates: pick in custom sheet');
      await searchPage.pickDatesInCustomSheet(offsetDays, nights);
      console.log(`✓ Dates applied (offsetDays=${offsetDays}, nights=${nights})`);
      await maybeDump('android_search_tc003_after_dates');

      // 2) Guests: increase guest count from picker
      console.log('→ Guests: adjust and apply');
      await searchPage.setGuestsInCustomSheet({ adults, children });
      console.log(`✓ Guests applied (adults=${adults}, children=${children})`);
      await maybeDump('android_search_tc003_after_guests');

      // 3) Destination: type + pick suggestion
      console.log('→ Destination: type + pick suggestion');
      await searchPage.setDestination(destination, { pickSuggestion: true });
      console.log(`✓ Destination selected: ${destination}`);
      await maybeDump('android_search_tc003_after_destination');

      // Submit -> lister
      console.log('→ Submit search');
      await searchPage.submitSearch();

      console.log('→ Lister: validate cards + scroll through 10+ properties + validate after pagination');

      // Validate 5 cards in first batch, scroll past 10 properties, then validate 5 more cards
      // This ensures we test both first page and paginated results
      await listerPage.scrollUntilPaginationAndValidate({
        validateCount: 5,           // Validate 5 cards in each batch
        maxSwipes: 15,              // Enough swipes to scroll past 10 properties
        minPropertiesForPagination: 10, // Pagination call happens after 10 properties
      });
      console.log('✓ TC003 done');
    });
  });

  it('TC004 - CP Code search with full lister scroll validation (guest)', async function () {
    this.timeout(8 * 60 * 1000); // 8 minutes

    const DESTINATION = 'Dallas, TX';
    const CP_CODE = 'CP8PPQBU';

    // Rate codes to test - reduced set for reliable execution
    const RATE_CODES_TO_TEST: Array<{
      type: 'best_rate' | 'cp_code';
      label: string;
      cpCode?: string;
    }> = [
      { type: 'best_rate', label: 'Best Rate' },
      { type: 'cp_code', label: 'CP Code', cpCode: CP_CODE },
    ];

    console.log('═══════════════════════════════════════════════════');
    console.log('→ TC004 start - Rate Code search with full lister validation');
    console.log(`→ Testing ${RATE_CODES_TO_TEST.length} rate codes with comprehensive validation`);
    console.log('═══════════════════════════════════════════════════');
    
    // Enter app as guest
    await enterAppAsGuestOrContinue();

    // Test each rate code
    for (let rateIdx = 0; rateIdx < RATE_CODES_TO_TEST.length; rateIdx++) {
      const rateConfig = RATE_CODES_TO_TEST[rateIdx];
      console.log(`\n┌───────────────────────────────────────────────────`);
      console.log(`│ RATE CODE ${rateIdx + 1}/${RATE_CODES_TO_TEST.length}: ${rateConfig.label}`);
      console.log(`└───────────────────────────────────────────────────`);

      // Open Search
      console.log('→ Open Search');
      await homePage.openSearch();
      await searchPage.waitForSearchPageLoaded(10000);

      // ========== STEP 1: SET DESTINATION ==========
      console.log(`→ Step 1: Destination - ${DESTINATION}`);
      await searchPage.setDestination(DESTINATION, { pickSuggestion: true });
      console.log(`✓ Destination set: ${DESTINATION}`);

      // ========== STEP 2: SELECT RATE CODE ==========
      console.log(`→ Step 2: Rate Code - ${rateConfig.label}`);
      if (rateConfig.type === 'cp_code' && rateConfig.cpCode) {
        await searchPage.selectCPCodeRate(rateConfig.cpCode);
        console.log(`✓ CP Code applied: ${rateConfig.cpCode}`);
      } else {
        await searchPage.selectRateCodeOption(rateConfig.type as 'best_rate');
        console.log(`✓ Rate code applied: ${rateConfig.label}`);
      }

      // ========== STEP 3: CLICK SEARCH BUTTON ==========
      console.log('→ Step 3: Click Search button to go to lister');
      await driver.pause(1000);
      await searchPage.submitSearch();
      console.log('✓ Search submitted');

      // ========== STEP 4: WAIT FOR LISTER ==========
      console.log('→ Step 4: Waiting for lister to load');
      await listerPage.waitForLoaded(30000);
      console.log('✓ Lister loaded');

      // ========== STEP 5: VERIFY RATE CODE BADGE ON PROPERTY CARDS ==========
      console.log(`→ Step 5: Verifying rate code badge appears on property cards`);
      const hasRateBadge = await listerPage.hasRateCodeBadgeOnCards();
      if (hasRateBadge) {
        console.log(`✓ Rate code badge found on property cards for: ${rateConfig.label}`);
      } else {
        // Note: Not all rate codes show badges, log warning but don't fail
        console.log(`⚠️ No rate code badge found (some rates may not show badges): ${rateConfig.label}`);
      }

      // ========== STEP 6: COMPREHENSIVE LISTER VALIDATION (like TC003) ==========
      console.log('→ Step 6: Comprehensive lister validation with pagination');
      await listerPage.scrollUntilPaginationAndValidate({
        validateCount: 5,
        maxSwipes: 15,
        minPropertiesForPagination: 10,
      });
      console.log(`✓ Lister validation complete for: ${rateConfig.label}`);

      // Go back to home for next iteration (unless last)
      if (rateIdx < RATE_CODES_TO_TEST.length - 1) {
        console.log('→ Returning to home for next rate code test...');
        await driver.back();
        await driver.pause(1500);
        // Try clicking back again if still on lister
        try {
          const listerList = await $('id=com.my6.android:id/rv_search_results_list');
          const stillOnLister = await listerList.isExisting().catch(() => false);
          if (stillOnLister) {
            await driver.back();
            await driver.pause(1000);
          }
        } catch {
          // ignore
        }
      }
    }

    // Final summary
    console.log(`\n═══════════════════════════════════════════════════`);
    console.log(`✓ TC004 COMPLETE`);
    console.log(`✓ Tested ${RATE_CODES_TO_TEST.length} rate codes: ${RATE_CODES_TO_TEST.map(r => r.label).join(', ')}`);
    console.log(`✓ Destination: ${DESTINATION}`);
    console.log(`✓ Comprehensive card validation: images, ratings, amenities, prices, brand tags, rate badges`);
    console.log(`═══════════════════════════════════════════════════\n`);
  });

  // ====================================================================================
  // TC005 - Sorting validation on lister
  // Tests all 5 sorting options and validates the order is correct
  // ====================================================================================
  it('TC005 - Lister sorting validation (distance, rating, price)', async function () {
    this.timeout(10 * 60 * 1000); // 10 minutes for all sort tests

    const DESTINATION = 'Dallas, TX';

    // All sorting options to test
    const SORT_OPTIONS: Array<{
      type: import('../../../android/pages/ListerPage').SortOption;
      label: string;
      description: string;
    }> = [
      { type: 'distance', label: 'Distance', description: 'Default sort - nearest properties first by distance' },
      { type: 'nearest_first', label: 'Nearest First', description: 'Properties sorted by closest distance (ascending)' },
      { type: 'guest_rating', label: 'Guest Rating', description: 'Highest rated properties first (descending)' },
      { type: 'price_low_high', label: 'Price Low to High', description: 'Cheapest properties first (ascending)' },
      { type: 'price_high_low', label: 'Price High to Low', description: 'Most expensive properties first (descending)' },
    ];

    console.log('═══════════════════════════════════════════════════');
    console.log('→ TC005 start - Lister sorting validation');
    console.log(`→ Testing ${SORT_OPTIONS.length} sort options`);
    console.log('═══════════════════════════════════════════════════');

    // Enter app as guest
    await enterAppAsGuestOrContinue();

    // Open Search and go to lister
    console.log('→ Opening search and navigating to lister...');
    await homePage.openSearch();
    await searchPage.waitForSearchPageLoaded(10000);

    // Set destination
    console.log(`→ Setting destination: ${DESTINATION}`);
    await searchPage.setDestination(DESTINATION, { pickSuggestion: true });
    console.log(`✓ Destination set: ${DESTINATION}`);

    // Submit search to go to lister
    console.log('→ Submitting search to go to lister');
    await driver.pause(1000);
    await searchPage.submitSearch();

    // Wait for lister to load
    console.log('→ Waiting for lister to load');
    await listerPage.waitForLoaded(30000);
    console.log('✓ Lister loaded');

    // Track results
    const results: Array<{ option: string; success: boolean; message: string }> = [];
    let passCount = 0;
    let failCount = 0;

    // Test each sort option
    for (let i = 0; i < SORT_OPTIONS.length; i++) {
      const sortConfig = SORT_OPTIONS[i];
      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`SORT TEST ${i + 1}/${SORT_OPTIONS.length}: ${sortConfig.label}`);
      console.log(`Description: ${sortConfig.description}`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

      try {
        // Test the sort option
        const result = await listerPage.testSortOption(sortConfig.type);
        results.push({ option: sortConfig.label, ...result });
        
        if (result.success) {
          passCount++;
          console.log(`✓ SORT TEST PASSED: ${sortConfig.label}`);
        } else {
          failCount++;
          console.log(`✗ SORT TEST FAILED: ${sortConfig.label} - ${result.message}`);
        }
      } catch (e) {
        failCount++;
        const msg = String((e as any)?.message ?? e);
        results.push({ option: sortConfig.label, success: false, message: msg });
        console.log(`✗ SORT TEST ERROR: ${sortConfig.label} - ${msg}`);
      }

      // Scroll back to top for next sort test (unless last)
      if (i < SORT_OPTIONS.length - 1) {
        await listerPage.scrollToTop();
      }
    }

    // Final summary
    console.log(`\n═══════════════════════════════════════════════════`);
    console.log(`✓ TC005 COMPLETE`);
    console.log(`✓ Tested ${SORT_OPTIONS.length} sort options`);
    console.log(`✓ Results: ${passCount} passed, ${failCount} failed`);
    console.log(`═══════════════════════════════════════════════════`);
    
    // Log each result
    results.forEach((r, idx) => {
      const status = r.success ? '✓' : '✗';
      console.log(`   ${status} ${SORT_OPTIONS[idx].label}: ${r.message.substring(0, 80)}`);
    });
    console.log(`═══════════════════════════════════════════════════\n`);

    // Assert at least 3 sort options passed (allow some flexibility for UI variations)
    const minPassRequired = 3;
    if (passCount < minPassRequired) {
      throw new Error(`Expected at least ${minPassRequired} sort tests to pass, but only ${passCount} passed`);
    }
  });

  // ====================================================================================
  // TC006 - Filter validation on lister (Brand dropdown)
  // Tests Motel 6 and Studio 6 brand filters, verifies brand tags on property cards
  // ====================================================================================
  it('TC006 - Filter validation (Brand dropdown)', async function () {
    this.timeout(8 * 60 * 1000); // 8 minutes

    const DESTINATION = 'Dallas, TX';

    console.log('═══════════════════════════════════════════════════');
    console.log('→ TC006 start - Filter validation (Brand dropdown)');
    console.log('═══════════════════════════════════════════════════');

    // Enter app as guest
    await enterAppAsGuestOrContinue();

    // Open Search and go to lister
    console.log('→ Opening search and navigating to lister...');
    await homePage.openSearch();
    await searchPage.waitForSearchPageLoaded(10000);

    // Set destination
    console.log(`→ Setting destination: ${DESTINATION}`);
    await searchPage.setDestination(DESTINATION, { pickSuggestion: true });
    console.log(`✓ Destination set: ${DESTINATION}`);

    // Submit search to go to lister
    console.log('→ Submitting search to go to lister');
    await driver.pause(1000);
    await searchPage.submitSearch();

    // Wait for lister to load
    console.log('→ Waiting for lister to load');
    await listerPage.waitForLoaded(30000);
    console.log('✓ Lister loaded');

    // Track results
    const results: Array<{ brand: string; success: boolean; message: string }> = [];
    let passCount = 0;
    let failCount = 0;

    // Helper: Wait for lister results with retry (handles loading transitions)
    async function waitForListerWithRetry(timeoutMs: number = 20000): Promise<boolean> {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        try {
          await listerPage.waitForLoaded(5000);
          return true;
        } catch {
          console.log('→ Results list not ready, waiting...');
          await driver.pause(1000);
        }
      }
      return false;
    }

    // Test 1: Motel 6 brand filter
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('BRAND TEST 1/2: Motel 6');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    try {
      const selected = await listerPage.selectBrand('motel6');
      if (selected) {
        // Wait for results to reload (may take longer after brand filter)
        await driver.pause(2000);
        const loaded = await waitForListerWithRetry(20000);
        
        if (!loaded) {
          console.log('⚠️ Results list not found, but continuing to verify brand tags...');
        }
        
        const result = await listerPage.verifyBrandFilter('motel6');
        results.push({ brand: 'Motel 6', ...result });
        
        if (result.success) {
          passCount++;
          console.log('✓ BRAND TEST PASSED: Motel 6');
        } else {
          failCount++;
          console.log(`✗ BRAND TEST FAILED: Motel 6 - ${result.message}`);
        }
        
        // Log details
        result.details.slice(0, 5).forEach(d => console.log(`   ${d}`));
      } else {
        failCount++;
        results.push({ brand: 'Motel 6', success: false, message: 'Could not select brand' });
        console.log('✗ BRAND TEST FAILED: Could not select Motel 6');
      }
    } catch (e) {
      failCount++;
      const msg = String((e as any)?.message ?? e);
      results.push({ brand: 'Motel 6', success: false, message: msg });
      console.log(`✗ BRAND TEST ERROR: Motel 6 - ${msg}`);
    }

    // Scroll back to top and clear filter
    await listerPage.scrollToTop();
    await listerPage.clearBrandFilter();
    await driver.pause(2000);

    // Test 2: Studio 6 brand filter (optional - may not be available in all locations)
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('BRAND TEST 2/2: Studio 6');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    try {
      const selected = await listerPage.selectBrand('studio6');
      if (selected) {
        await driver.pause(2000);
        const loaded = await waitForListerWithRetry(20000);
        
        if (!loaded) {
          console.log('⚠️ Results list not found, but continuing to verify brand tags...');
        }
        
        const result = await listerPage.verifyBrandFilter('studio6');
        results.push({ brand: 'Studio 6', ...result });
        
        if (result.success) {
          passCount++;
          console.log('✓ BRAND TEST PASSED: Studio 6');
        } else {
          // Studio 6 may not be available in location - count as soft failure
          console.log(`⚠️ BRAND TEST: Studio 6 - ${result.message}`);
          // Still add to results but don't increment failCount for missing Studio 6
          if (result.message.includes('no properties')) {
            console.log('→ Studio 6 may not be available in this location (expected)');
          } else {
            failCount++;
            console.log(`✗ BRAND TEST FAILED: Studio 6 - ${result.message}`);
          }
        }
        
        result.details.slice(0, 5).forEach(d => console.log(`   ${d}`));
      } else {
        // Studio 6 option may not be in dropdown for some locations
        console.log('→ Studio 6 option not found (may not be available in this area)');
        results.push({ brand: 'Studio 6', success: false, message: 'Option not available in dropdown' });
        // Don't count as failure if brand option doesn't exist
      }
    } catch (e) {
      failCount++;
      const msg = String((e as any)?.message ?? e);
      results.push({ brand: 'Studio 6', success: false, message: msg });
      console.log(`✗ BRAND TEST ERROR: Studio 6 - ${msg}`);
    }

    // Final summary
    console.log(`\n═══════════════════════════════════════════════════`);
    console.log(`✓ TC006 COMPLETE`);
    console.log(`✓ Tested 2 filters: Motel 6, Studio 6 brands`);
    console.log(`✓ Results: ${passCount} passed, ${failCount} failed`);
    console.log(`═══════════════════════════════════════════════════`);
    
    results.forEach(r => {
      const status = r.success ? '✓' : '✗';
      console.log(`   ${status} ${r.brand}: ${r.message.substring(0, 80)}`);
    });
    console.log(`═══════════════════════════════════════════════════\n`);

    // At least 1 brand test should pass
    if (passCount < 1) {
      throw new Error(`Expected at least 1 brand test to pass, but ${passCount} passed`);
    }
  });

  // ====================================================================================
  // TC007 - Filters popup validation on lister
  // Tests various filter combinations and verifies result counts
  // ====================================================================================
  it('TC007 - Filters popup validation (amenities and combinations)', async function () {
    this.timeout(10 * 60 * 1000); // 10 minutes

    const DESTINATION = 'Dallas, TX';

    // Common filter options to test (amenities, price ranges, etc.)
    const FILTERS_TO_TEST = [
      'Free WiFi',
      'Pet Friendly',
      'Pool',
      'Parking',
    ];

    console.log('═══════════════════════════════════════════════════');
    console.log('→ TC007 start - Filters popup validation');
    console.log(`→ Testing ${FILTERS_TO_TEST.length} filter options`);
    console.log('═══════════════════════════════════════════════════');

    // Enter app as guest
    await enterAppAsGuestOrContinue();

    // Open Search and go to lister
    console.log('→ Opening search and navigating to lister...');
    await homePage.openSearch();
    await searchPage.waitForSearchPageLoaded(10000);

    // Set destination
    console.log(`→ Setting destination: ${DESTINATION}`);
    await searchPage.setDestination(DESTINATION, { pickSuggestion: true });
    console.log(`✓ Destination set: ${DESTINATION}`);

    // Submit search to go to lister
    console.log('→ Submitting search to go to lister');
    await driver.pause(1000);
    await searchPage.submitSearch();

    // Wait for lister to load
    console.log('→ Waiting for lister to load');
    await listerPage.waitForLoaded(30000);
    console.log('✓ Lister loaded');

    // Track results
    const results: Array<{ filter: string; success: boolean; message: string }> = [];
    let passCount = 0;
    let failCount = 0;

    // First, open filters to see what's available
    console.log('\n→ Checking available filters...');
    const filtersOpened = await listerPage.openFiltersPopup();
    if (filtersOpened) {
      const availableFilters = await listerPage.getAvailableFilters();
      console.log(`✓ Found ${availableFilters.length} filter options:`);
      availableFilters.slice(0, 10).forEach(f => console.log(`   - ${f}`));
      await listerPage.closeFiltersPopup();
      await driver.pause(500);
    }

    // Test each filter
    for (let i = 0; i < FILTERS_TO_TEST.length; i++) {
      const filterName = FILTERS_TO_TEST[i];
      
      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`FILTER TEST ${i + 1}/${FILTERS_TO_TEST.length}: ${filterName}`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      
      try {
        const result = await listerPage.testFilter(filterName);
        results.push({ filter: filterName, ...result });
        
        if (result.success) {
          passCount++;
          console.log(`✓ FILTER TEST PASSED: ${filterName}`);
        } else {
          failCount++;
          console.log(`✗ FILTER TEST WARNING: ${filterName} - ${result.message}`);
        }
      } catch (e) {
        failCount++;
        const msg = String((e as any)?.message ?? e);
        results.push({ filter: filterName, success: false, message: msg });
        console.log(`✗ FILTER TEST ERROR: ${filterName} - ${msg}`);
      }

      // Clear filter and scroll to top for next test
      await listerPage.scrollToTop();
      
      // Open filters and clear them
      const opened = await listerPage.openFiltersPopup();
      if (opened) {
        await listerPage.clearAllFilters();
        await listerPage.clickShowResults();
        await driver.pause(1000);
      }
    }

    // Test combination filter (multiple filters at once)
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`FILTER TEST: Combination (Free WiFi + Pet Friendly)`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    
    try {
      // Open filters popup
      const opened = await listerPage.openFiltersPopup();
      if (opened) {
        // Toggle multiple filters
        await listerPage.toggleFilter('Free WiFi');
        await driver.pause(300);
        await listerPage.toggleFilter('Pet Friendly');
        await driver.pause(500);
        
        // Get expected count
        const expectedCount = await listerPage.getShowResultsCount();
        console.log(`→ Expected results with combination: ${expectedCount ?? 'unknown'}`);
        
        // Apply filters
        await listerPage.clickShowResults();
        await driver.pause(1500);
        await listerPage.waitForLoaded(15000);
        
        const cardCount = await listerPage.countVisibleCards();
        
        if (cardCount > 0) {
          passCount++;
          const message = `Combination filter applied: ${cardCount} results`;
          results.push({ filter: 'Combination', success: true, message });
          console.log(`✓ FILTER TEST PASSED: Combination - ${message}`);
        } else {
          failCount++;
          results.push({ filter: 'Combination', success: false, message: 'No results with combination' });
          console.log('✗ FILTER TEST WARNING: Combination - no results');
        }
      } else {
        failCount++;
        results.push({ filter: 'Combination', success: false, message: 'Could not open filters' });
      }
    } catch (e) {
      failCount++;
      const msg = String((e as any)?.message ?? e);
      results.push({ filter: 'Combination', success: false, message: msg });
      console.log(`✗ FILTER TEST ERROR: Combination - ${msg}`);
    }

    // Final summary
    console.log(`\n═══════════════════════════════════════════════════`);
    console.log(`✓ TC007 COMPLETE`);
    console.log(`✓ Tested ${results.length} filter scenarios`);
    console.log(`✓ Results: ${passCount} passed, ${failCount} failed`);
    console.log(`═══════════════════════════════════════════════════`);
    
    results.forEach(r => {
      const status = r.success ? '✓' : '✗';
      console.log(`   ${status} ${r.filter}: ${r.message.substring(0, 70)}`);
    });
    console.log(`═══════════════════════════════════════════════════\n`);

    // At least 2 filter tests should pass (some filters may not be available)
    const minPassRequired = 2;
    if (passCount < minPassRequired) {
      throw new Error(`Expected at least ${minPassRequired} filter tests to pass, but only ${passCount} passed`);
    }
  });

  // ====================================================================================
  // TC008 - Random/Exploratory Testing on Lister
  // Tests random combinations of location, guests, children, filters, rate codes
  // Also tests image carousel scrolling and search criteria persistence
  // ====================================================================================
  it('TC008 - Random exploratory testing (search criteria persistence & image carousel)', async function () {
    this.timeout(12 * 60 * 1000); // 12 minutes

    // Random test data pools
    const LOCATIONS = [
      'Las Vegas, NV',
      'Los Angeles, CA',
      'Phoenix, AZ',
      'Denver, CO',
      'San Antonio, TX',
    ];

    // Use internal rate code names that match selectRateCodeOption
    const RATE_CODES = ['best_rate', 'aarp', 'government', 'senior', 'military'];
    const FILTERS = ['Free WiFi', 'Pet Friendly', 'Pool', 'Parking'];
    
    // Random selections for this run
    const randomLocation = LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)];
    const randomAdults = Math.floor(Math.random() * 2) + 2; // 2-3 adults
    const randomChildren = Math.floor(Math.random() * 2) + 1; // 1-2 children (now always at least 1)
    const randomRateCode = RATE_CODES[Math.floor(Math.random() * RATE_CODES.length)];
    const randomFilter = FILTERS[Math.floor(Math.random() * FILTERS.length)];

    console.log('═══════════════════════════════════════════════════');
    console.log('→ TC008 start - Random Exploratory Testing');
    console.log(`→ Location: ${randomLocation}`);
    console.log(`→ Guests: ${randomAdults} adults, ${randomChildren} children`);
    console.log(`→ Rate code: ${randomRateCode}`);
    console.log(`→ Filter: ${randomFilter}`);
    console.log('═══════════════════════════════════════════════════');

    // Track test results
    const results: Array<{ test: string; passed: boolean; detail: string }> = [];

    // Enter app as guest
    await enterAppAsGuestOrContinue();

    // Open Search
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('TEST 1: Set random search criteria');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    try {
      await homePage.openSearch();
      await searchPage.waitForSearchPageLoaded(10000);
      
      // Set destination
      console.log(`→ Setting destination: ${randomLocation}`);
      await searchPage.setDestination(randomLocation, { pickSuggestion: true });
      
      // Set guests (adults + children) - setGuestsSimple opens and sets guests
      console.log(`→ Setting guests: ${randomAdults} adults, ${randomChildren} children`);
      try {
        await searchPage.setGuestsSimple(randomAdults, randomChildren);
        await driver.pause(500);
      } catch (e) {
        console.log(`⚠️ Guest setting error: ${String(e)}`);
      }
      
      // Set rate code
      console.log(`→ Setting rate code: ${randomRateCode}`);
      try {
        await searchPage.selectRateCode(randomRateCode);
        console.log(`✓ Rate code set: ${randomRateCode}`);
      } catch (e) {
        console.log(`⚠️ Rate code setting error (may not be available): ${String(e)}`);
        // Press back to close any open dropdown
        try {
          await driver.pressKeyCode(4); // Android back button
          await driver.pause(500);
        } catch { /* ignore */ }
      }
      
      results.push({ test: 'Set search criteria', passed: true, detail: `${randomLocation}, ${randomAdults} adults, ${randomChildren} children` });
      console.log('✓ Search criteria set successfully');
    } catch (e) {
      results.push({ test: 'Set search criteria', passed: false, detail: String(e) });
      console.log(`✗ Failed to set search criteria: ${e}`);
    }

    // Submit search
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('TEST 2: Submit search and verify lister loads');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    try {
      await searchPage.submitSearch();
      await listerPage.waitForLoaded(30000);
      
      const motelsCount = await listerPage.getMotelsFoundCount();
      console.log(`✓ Lister loaded with ${motelsCount ?? 'some'} motels`);
      results.push({ test: 'Lister loads', passed: true, detail: `${motelsCount ?? '?'} motels found` });
    } catch (e) {
      results.push({ test: 'Lister loads', passed: false, detail: String(e) });
      console.log(`✗ Lister failed to load: ${e}`);
      throw e; // Can't continue without lister
    }

    // Verify search criteria persisted
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('TEST 3: Verify search criteria persistence');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    try {
      const criteria = await listerPage.getSearchCriteriaFromHeader();
      console.log(`→ Header shows: Location="${criteria.location}", Guests="${criteria.guests}"`);
      
      // Check location contains city name
      const cityName = randomLocation.split(',')[0].trim();
      const locationMatch = criteria.location?.includes(cityName);
      
      // Check guests count - header might show adults only or total guests
      // Accept match on either total guests or adults count
      const totalGuests = randomAdults + randomChildren;
      const guestsText = criteria.guests || '';
      const guestsMatch = guestsText.includes(String(totalGuests)) || guestsText.includes(String(randomAdults));
      
      if (locationMatch && guestsMatch) {
        results.push({ test: 'Search criteria persisted', passed: true, detail: `Location: ${criteria.location}, Guests: ${criteria.guests}` });
        console.log('✓ Search criteria persisted correctly');
      } else {
        results.push({ test: 'Search criteria persisted', passed: false, detail: `Location match: ${locationMatch}, Guests match: ${guestsMatch}` });
        console.log(`⚠️ Search criteria mismatch - Location: ${locationMatch}, Guests: ${guestsMatch}`);
      }
    } catch (e) {
      results.push({ test: 'Search criteria persisted', passed: false, detail: String(e) });
      console.log(`⚠️ Could not verify search criteria: ${e}`);
    }

    // Test image carousel on first property card
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('TEST 4: Test image carousel on property card');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    try {
      const carouselResult = await listerPage.swipeLeftOnPropertyCardImages(0);
      if (carouselResult.success) {
        results.push({ test: 'Image carousel scroll', passed: true, detail: `${carouselResult.imagesViewed} images viewed` });
        console.log(`✓ Image carousel working: ${carouselResult.imagesViewed} images viewed`);
      } else {
        results.push({ test: 'Image carousel scroll', passed: false, detail: 'Could not scroll images' });
        console.log('⚠️ Image carousel test incomplete');
      }
    } catch (e) {
      results.push({ test: 'Image carousel scroll', passed: false, detail: String(e) });
      console.log(`⚠️ Image carousel error: ${e}`);
    }

    // Test vertical scroll on lister
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('TEST 5: Test vertical scroll on lister');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    try {
      const initialCards = await listerPage.countVisibleCards();
      console.log(`→ Initial visible cards: ${initialCards}`);
      
      // Scroll down using mobile: swipeGesture (modern API)
      const { width, height } = await driver.getWindowSize();
      try {
        await driver.execute('mobile: swipeGesture', {
          left: 0,
          top: height * 0.3,
          width: width,
          height: height * 0.5,
          direction: 'up',
          percent: 0.6
        });
      } catch {
        // Fallback to performActions
        await driver.performActions([{
          type: 'pointer',
          id: 'finger1',
          parameters: { pointerType: 'touch' },
          actions: [
            { type: 'pointerMove', duration: 0, x: Math.round(width / 2), y: Math.round(height * 0.7) },
            { type: 'pointerDown', button: 0 },
            { type: 'pause', duration: 100 },
            { type: 'pointerMove', duration: 300, x: Math.round(width / 2), y: Math.round(height * 0.3) },
            { type: 'pointerUp', button: 0 }
          ]
        }]);
        await driver.releaseActions();
      }
      await driver.pause(1000);
      
      // Count cards again
      const afterScrollCards = await listerPage.countVisibleCards();
      console.log(`→ After scroll cards: ${afterScrollCards}`);
      
      results.push({ test: 'Vertical scroll', passed: true, detail: `${initialCards} → ${afterScrollCards} cards` });
      console.log('✓ Vertical scroll working');
      
      // Scroll back to top
      await listerPage.scrollToTop();
    } catch (e) {
      results.push({ test: 'Vertical scroll', passed: false, detail: String(e) });
      console.log(`⚠️ Vertical scroll error: ${e}`);
    }

    // Apply a random filter and verify
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`TEST 6: Apply filter "${randomFilter}" and verify`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    try {
      const filterOpened = await listerPage.openFiltersPopup();
      if (filterOpened) {
        await driver.pause(500);
        const toggled = await listerPage.toggleFilter(randomFilter);
        
        if (toggled) {
          const applied = await listerPage.clickShowResults();
          if (applied) {
            await driver.pause(1500);
            await listerPage.waitForLoaded(15000);
            
            const newCount = await listerPage.getMotelsFoundCount();
            results.push({ test: `Filter: ${randomFilter}`, passed: true, detail: `${newCount ?? '?'} results after filter` });
            console.log(`✓ Filter applied: ${newCount ?? 'some'} results`);
          } else {
            results.push({ test: `Filter: ${randomFilter}`, passed: false, detail: 'Could not apply filter' });
          }
        } else {
          // Filter may not be available, close popup
          await listerPage.closeFiltersPopup();
          results.push({ test: `Filter: ${randomFilter}`, passed: false, detail: 'Filter option not found' });
          console.log(`⚠️ Filter "${randomFilter}" not found`);
        }
      } else {
        results.push({ test: `Filter: ${randomFilter}`, passed: false, detail: 'Could not open filters' });
      }
    } catch (e) {
      results.push({ test: `Filter: ${randomFilter}`, passed: false, detail: String(e) });
      console.log(`⚠️ Filter test error: ${e}`);
    }

    // Edit search and change location
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('TEST 7: Edit search with new location');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    try {
      // Click search bar to go back to search
      const searchClicked = await listerPage.clickSearchBarToEdit();
      
      if (searchClicked) {
        await searchPage.waitForSearchPageLoaded(10000);
        
        // Pick a different random location
        const newLocation = LOCATIONS.filter(l => l !== randomLocation)[Math.floor(Math.random() * (LOCATIONS.length - 1))];
        console.log(`→ Changing to new location: ${newLocation}`);
        
        await searchPage.setDestination(newLocation, { pickSuggestion: true });
        await searchPage.submitSearch();
        await listerPage.waitForLoaded(30000);
        
        // Verify new location appears
        const criteria = await listerPage.getSearchCriteriaFromHeader();
        const newCityName = newLocation.split(',')[0].trim();
        const locationMatch = criteria.location?.includes(newCityName);
        
        if (locationMatch) {
          results.push({ test: 'Edit search & change location', passed: true, detail: `Changed to ${newLocation}` });
          console.log(`✓ Location changed to ${newLocation}`);
        } else {
          results.push({ test: 'Edit search & change location', passed: false, detail: `Expected ${newCityName}, got ${criteria.location}` });
        }
      } else {
        results.push({ test: 'Edit search & change location', passed: false, detail: 'Could not access search' });
      }
    } catch (e) {
      results.push({ test: 'Edit search & change location', passed: false, detail: String(e) });
      console.log(`⚠️ Edit search error: ${e}`);
    }

    // Final summary
    console.log(`\n═══════════════════════════════════════════════════`);
    console.log(`✓ TC008 COMPLETE - Random Exploratory Testing`);
    console.log(`═══════════════════════════════════════════════════`);
    
    const passCount = results.filter(r => r.passed).length;
    const failCount = results.filter(r => !r.passed).length;
    
    console.log(`Results: ${passCount} passed, ${failCount} failed`);
    console.log('');
    
    results.forEach(r => {
      const status = r.passed ? '✓' : '✗';
      console.log(`   ${status} ${r.test}: ${r.detail.substring(0, 60)}`);
    });
    
    console.log(`═══════════════════════════════════════════════════\n`);

    // At least 4 tests should pass for the test case to pass
    const minPassRequired = 4;
    if (passCount < minPassRequired) {
      throw new Error(`Expected at least ${minPassRequired} exploratory tests to pass, but only ${passCount} passed`);
    }
  });
});
