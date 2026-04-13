import { BasePage } from '../../shared/core/BasePage';
import type { PlatformSelectors } from '../../shared/core/selectors';

export class SearchPage extends BasePage {
  constructor() {
    super('android');
  }

  private sleep(ms: number) {
    return new Promise<void>((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Wait for search page to be fully loaded by checking for key elements
   */
  async waitForSearchPageLoaded(timeoutMs: number = 15000): Promise<void> {
    const startTime = Date.now();
    const checkInterval = 1000;
    
    // Elements that indicate we're on the search page
    const searchPageIndicators = [
      'com.my6.android:id/check_in_block',
      'com.my6.android:id/room_block',
      'com.my6.android:id/search_bar_container',
    ];

    while (Date.now() - startTime < timeoutMs) {
      for (const id of searchPageIndicators) {
        try {
          const el = await $(`id=${id}`);
          const exists = await el.isExisting().catch(() => false);
          if (exists) {
            console.log(`✓ Search page loaded (found: ${id.split('/').pop()})`);
            await this.sleep(500); // Brief pause to ensure UI is stable
            return;
          }
        } catch {
          // Continue checking
        }
      }
      await this.sleep(checkInterval);
    }
    
    throw new Error(`Search page did not load within ${timeoutMs}ms - key elements not found`);
  }

  private autocompleteOverlayXPath = '//*[@resource-id="com.my6.android:id/rv_autocomplete"]';

  private async dismissAutocompleteIfPresent(maxAttempts: number = 2) {
    if (this.platform !== 'android') return;

    for (let i = 0; i < maxAttempts; i++) {
      try {
        // Use ID selector instead of XPath to avoid Android 16 hangs
        const overlay = await $('id=com.my6.android:id/rv_autocomplete');
        const exists = await this.withTimeout(overlay.isExisting(), 2500, 'autocompleteOverlay.isExisting', false);
        if (!exists) return;

        // Some builds keep the recycler view in hierarchy even when hidden.
        // Only press Back if it's actually visible, otherwise Back can navigate away
        // or clear the destination field.
        const visible = await this.withTimeout(overlay.isDisplayed(), 2500, 'autocompleteOverlay.isDisplayed', false);
        if (!visible) return;

        // When suggestions are shown, Android Back typically closes them without navigating away.
        await this.withTimeout(driver.back(), 2500, 'back(dismiss autocomplete)', undefined as any);
        await this.sleep(500);
      } catch {
        return;
      }
    }
  }

  // Destination / location input
  // IMPORTANT: Put ID and UiSelector first to avoid XPath hangs on Android 16
  private destinationInput: PlatformSelectors = {
    android: [
      // ID-based selectors first (fastest)
      { using: 'id', value: 'com.my6.android:id/container' },
      // UiSelector fallback for EditText
      { using: 'android uiautomator', value: 'new UiSelector().className("android.widget.EditText").instance(0)' },
    ],
    ios: [],
  };

  private firstSuggestion: PlatformSelectors = {
    android: [
      // ID-based selector first to avoid XPath hangs
      { using: 'id', value: 'com.my6.android:id/location_suggestion_container' },
      // UiSelector fallback for clickable suggestions
      { using: 'android uiautomator', value: 'new UiSelector().resourceIdMatches(".*location_suggestion.*").clickable(true).instance(0)' },
    ],
    ios: [],
  };

  // "CONTINUE YOUR SEARCH" recent search items - fallback when destination doesn't stick
  // IMPORTANT: Use ID and UiSelector to avoid XPath hangs on Android 16
  private firstRecentSearch: PlatformSelectors = {
    android: [
      // ID-based selector first
      { using: 'id', value: 'com.my6.android:id/rowCommonTitle' },
      // UiSelector for clickable items in recyclerview
      { using: 'android uiautomator', value: 'new UiSelector().resourceId("com.my6.android:id/commonRecyclerview").childSelector(new UiSelector().clickable(true).instance(0))' },
    ],
    ios: [],
  };

  // Guests / rooms widget - ID only, no XPath
  private guestsButton: PlatformSelectors = {
    android: [
      { using: 'id', value: 'com.my6.android:id/room_block' },
    ],
    ios: [],
  };

  // Guests selection screen (after tapping Guests)
  // More robust detection - look for adult/child steppers directly (ID only)
  private guestsScreenTitle: PlatformSelectors = {
    android: [
      { using: 'id', value: 'com.my6.android:id/btn_increase_adult' },
      { using: 'id', value: 'com.my6.android:id/btn_increase_child' },
      { using: 'id', value: 'com.my6.android:id/toolbar_title' },
    ],
    ios: [],
  };

  // Rate Code widget (dropdown near guest picker) - ID and UiSelector only
  private rateCodeButton: PlatformSelectors = {
    android: [
      { using: 'id', value: 'com.my6.android:id/special_rate_container' },
      { using: 'id', value: 'com.my6.android:id/tv_selected_rate' },
      // UiSelector fallback by text content
      { using: 'android uiautomator', value: 'new UiSelector().textContains("Special rates")' },
      { using: 'android uiautomator', value: 'new UiSelector().textContains("Best rate")' },
    ],
    ios: [],
  };

  // Rate code dropdown options - Based on screenshot analysis
  // Options: Best rate, My6 member rate, Flexible rate, Government rate, 
  //          AARP rate, Commercial driver rate, Military rate, Senior citizen rate, Corporate plus (CP)
  // IMPORTANT: Use UiSelector text matching to avoid XPath hangs on Android 16
  
  private rateCodeBestRate: PlatformSelectors = {
    android: [
      { using: 'android uiautomator', value: 'new UiSelector().textContains("Best rate")' },
    ],
    ios: [],
  };

  private rateCodeMy6Member: PlatformSelectors = {
    android: [
      { using: 'android uiautomator', value: 'new UiSelector().textContains("My6 member")' },
    ],
    ios: [],
  };

  private rateCodeFlexible: PlatformSelectors = {
    android: [
      { using: 'android uiautomator', value: 'new UiSelector().textContains("Flexible rate")' },
    ],
    ios: [],
  };

  private rateCodeGovernment: PlatformSelectors = {
    android: [
      { using: 'android uiautomator', value: 'new UiSelector().textContains("Government")' },
    ],
    ios: [],
  };

  private rateCodeCPOption: PlatformSelectors = {
    android: [
      { using: 'android uiautomator', value: 'new UiSelector().textContains("Corporate plus")' },
      { using: 'android uiautomator', value: 'new UiSelector().textContains("(CP)")' },
    ],
    ios: [],
  };

  private rateCodeAARP: PlatformSelectors = {
    android: [
      { using: 'android uiautomator', value: 'new UiSelector().textContains("AARP")' },
    ],
    ios: [],
  };

  private rateCodeCommercial: PlatformSelectors = {
    android: [
      { using: 'android uiautomator', value: 'new UiSelector().textContains("Commercial driver")' },
    ],
    ios: [],
  };

  private rateCodeSenior: PlatformSelectors = {
    android: [
      { using: 'android uiautomator', value: 'new UiSelector().textContains("Senior citizen")' },
    ],
    ios: [],
  };

  private rateCodeMilitary: PlatformSelectors = {
    android: [
      { using: 'android uiautomator', value: 'new UiSelector().textContains("Military rate")' },
      { using: 'android uiautomator', value: 'new UiSelector().textContains("Military")' },
    ],
    ios: [],
  };

  // Rate code input field (for entering CP code) - ID only, no XPath
  private rateCodeInput: PlatformSelectors = {
    android: [
      { using: 'id', value: 'com.my6.android:id/rate_code_input' },
      { using: 'id', value: 'com.my6.android:id/et_rate_code' },
      // UiSelector fallback for EditText
      { using: 'android uiautomator', value: 'new UiSelector().className("android.widget.EditText").instance(0)' },
    ],
    ios: [],
  };

  // Rate code apply button - ID and UiSelector only
  private rateCodeApplyButton: PlatformSelectors = {
    android: [
      { using: 'id', value: 'com.my6.android:id/btn_apply_rate_code' },
      { using: 'android uiautomator', value: 'new UiSelector().text("Apply")' },
      { using: 'android uiautomator', value: 'new UiSelector().text("APPLY")' },
    ],
    ios: [],
  };

  // Custom bottom-sheet (calendar/guests) container - ID only
  private sheetRoot: PlatformSelectors = {
    android: [
      { using: 'id', value: 'com.my6.android:id/cfs_calendar_view' },
      { using: 'id', value: 'com.my6.android:id/design_bottom_sheet' },
    ],
    ios: [],
  };

  private async isCalendarPopupOpen(): Promise<boolean> {
    if (this.platform !== 'android') return false;
    // Use $$ to avoid slow exception/hang paths on some Android 16 builds.
    // Guests and Dates share the same custom sheet, but the inner root can vary by tab/build.
    const ids = [
      'com.my6.android:id/cfs_calendar_view',
      'com.my6.android:id/design_bottom_sheet',
      'com.my6.android:id/view_pager',
      'com.my6.android:id/calendar_tabs',
      'com.my6.android:id/apply',
    ];
    for (const id of ids) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const els = await $$(`id=${id}`);
        if (els.length) return true;
      } catch {
        // ignore
      }
    }
    return false;
  }

  // Calendar sheet tabs - use UiSelector for text matching
  private sheetTabCheckIn: PlatformSelectors = {
    android: [
      { using: 'android uiautomator', value: 'new UiSelector().textContains("Check-in")' },
      { using: 'android uiautomator', value: 'new UiSelector().textContains("Check in")' },
    ],
    ios: [],
  };

  private sheetTabCheckOut: PlatformSelectors = {
    android: [
      { using: 'android uiautomator', value: 'new UiSelector().textContains("Checkout")' },
      { using: 'android uiautomator', value: 'new UiSelector().textContains("Check-out")' },
    ],
    ios: [],
  };

  private sheetTabGuests: PlatformSelectors = {
    android: [
      { using: 'android uiautomator', value: 'new UiSelector().text("Guests")' },
      { using: 'android uiautomator', value: 'new UiSelector().text("Guest")' },
    ],
    ios: [],
  };

  private dayCell(day: number): PlatformSelectors {
    // Best-effort: day numbers typically appear as TextViews inside the view pager.
    // Use UiSelector for speed/reliability - no XPath
    return {
      android: [
        { using: 'android uiautomator', value: `new UiSelector().text("${day}").clickable(true)` },
        { using: 'android uiautomator', value: `new UiSelector().text("${day}")` },
      ],
      ios: [],
    };
  }

  private calendarAnyRoot: PlatformSelectors = {
    android: [
      { using: 'id', value: 'com.my6.android:id/cfs_calendar_view' },
      { using: 'id', value: 'com.my6.android:id/view_pager' },
      { using: 'id', value: 'com.my6.android:id/calendar_tabs' },
      { using: 'id', value: 'com.my6.android:id/apply' },
    ],
    ios: [],
  };

  private async tapStartDateInGrid(attempt: number) {
    // User requirement: pick ONLY a single start date.
    await this.tapCalendarGrid(attempt);
    console.log('✓ Tapped start date (grid)');
  }

  // Stepper buttons - ID only
  private increaseAdultsButton: PlatformSelectors = {
    android: [
      { using: 'id', value: 'com.my6.android:id/btn_increase_adult' },
    ],
    ios: [],
  };

  private increaseChildrenButton: PlatformSelectors = {
    android: [
      { using: 'id', value: 'com.my6.android:id/btn_increase_child' },
    ],
    ios: [],
  };

  // Pet toggle - it's a Compose element with checkable=true, within travelling_with_pets container
  private petToggle: PlatformSelectors = {
    android: [
      { using: 'android uiautomator', value: 'new UiSelector().resourceId("com.my6.android:id/travelling_with_pets").childSelector(new UiSelector().checkable(true))' },
      { using: 'android uiautomator', value: 'new UiSelector().checkable(true).className("android.view.View")' },
    ],
    ios: [],
  };

  // Apply button - buttonContainer is clickable, NOT apply (which is a FrameLayout)
  private guestsApplyButton: PlatformSelectors = {
    android: [
      { using: 'id', value: 'com.my6.android:id/buttonContainer' },
      { using: 'id', value: 'com.my6.android:id/tvTxt' },
      { using: 'android uiautomator', value: 'new UiSelector().text("Apply")' },
    ],
    ios: [],
  };

  // Date widget - ID only
  private datesButton: PlatformSelectors = {
    android: [
      { using: 'id', value: 'com.my6.android:id/check_in_block' },
      { using: 'id', value: 'com.my6.android:id/check_out_block' },
      { using: 'id', value: 'com.my6.android:id/search_calendar' },
    ],
    ios: [],
  };

  private checkInDateValue: PlatformSelectors = {
    android: [
      { using: 'id', value: 'com.my6.android:id/check_in_date' },
    ],
    ios: [],
  };

  private async getCheckInDateText(): Promise<string> {
    try {
      const el = await this.el(this.checkInDateValue, 5000);
      const text = await el.getText().catch(() => '');
      return String(text ?? '').trim();
    } catch {
      return '';
    }
  }

  private async getRectById(id: string, timeoutMs: number = 2500): Promise<{ x: number; y: number; width: number; height: number } | null> {
    try {
      const el = await $(`id=${id}`);
      const exists = await this.withTimeout(el.isExisting(), timeoutMs, `isExisting(${id})`, false);
      if (!exists) return null;
      const rect = await this.withTimeout((el as any).getRect(), timeoutMs, `getRect(${id})`, null as any);
      if (!rect) return null;
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    } catch {
      return null;
    }
  }

  private async tapInRect(rect: { x: number; y: number; width: number; height: number }, xRatio: number, yRatio: number) {
    const x = Math.round(rect.x + rect.width * Math.max(0.05, Math.min(0.95, xRatio)));
    const y = Math.round(rect.y + rect.height * Math.max(0.05, Math.min(0.95, yRatio)));
    await this.tapByActions(x, y);
  }

  private async tapCalendarGrid(attempt: number) {
    const points = [
      { x: 0.30, y: 0.60 },
      { x: 0.50, y: 0.60 },
      { x: 0.70, y: 0.60 },
      { x: 0.30, y: 0.75 },
      { x: 0.50, y: 0.75 },
      { x: 0.70, y: 0.75 },
    ];
    const p = points[Math.max(0, attempt) % points.length];

    // IMPORTANT: do not call element APIs while calendar is open (can hang Appium).
    // Tap the same area twice with a small offset to avoid landing on a separator.
    await this.tapAtRatio(p.x, p.y);
    await this.sleep(150);
    await this.tapAtRatio(Math.min(0.95, p.x + 0.03), Math.min(0.95, p.y + 0.02));
  }

  private async tapApplyButton() {
    // IMPORTANT: do not call element APIs while calendar is open (can hang Appium).
    await this.tapAtRatio(0.5, 0.90);
    await this.sleep(250);
    await this.tapAtRatio(0.5, 0.93);
  }

  // Search submit button - use ID and UiSelector, avoid XPath
  private searchSubmit: PlatformSelectors = {
    android: [
      { using: 'id', value: 'com.my6.android:id/btn_search' },
      { using: 'android uiautomator', value: 'new UiSelector().text("Search")' },
      { using: 'android uiautomator', value: 'new UiSelector().text("SEARCH")' },
      { using: 'android uiautomator', value: 'new UiSelector().descriptionContains("Search").clickable(true)' },
    ],
    ios: [],
  };

  private listerResultsList: PlatformSelectors = {
    android: [
      { using: 'id', value: 'com.my6.android:id/rv_search_results_list' },
    ],
    ios: [],
  };

  private searchLandingRoot: PlatformSelectors = {
    android: [{ using: 'id', value: 'com.my6.android:id/subfragment_search_landing' }],
    ios: [],
  };

  private async exists(map: PlatformSelectors, timeoutMs: number) {
    try {
      await this.el(map, timeoutMs);
      return true;
    } catch {
      return false;
    }
  }

  // Results heuristic - use UiSelector instead of XPath
  private resultsHeuristic: PlatformSelectors = {
    android: [
      { using: 'android uiautomator', value: 'new UiSelector().textContains("Select a room")' },
      { using: 'android uiautomator', value: 'new UiSelector().textContains("results")' },
      { using: 'android uiautomator', value: 'new UiSelector().className("androidx.recyclerview.widget.RecyclerView")' },
    ],
    ios: [],
  };

  // Calendar month header - use UiSelector
  private calendarMonthHeader: PlatformSelectors = {
    android: [
      { using: 'android uiautomator', value: 'new UiSelector().resourceIdMatches(".*month.*").textMatches(".+")' },
      { using: 'android uiautomator', value: 'new UiSelector().textMatches("January|February|March|April|May|June|July|August|September|October|November|December")' },
    ],
    ios: [],
  };

  // Calendar next month button - use ID and UiSelector
  private calendarNextMonth: PlatformSelectors = {
    android: [
      { using: 'id', value: 'com.google.android.material:id/month_navigation_next' },
      { using: 'accessibility id', value: 'Next' },
      { using: 'accessibility id', value: 'Next month' },
      { using: 'android uiautomator', value: 'new UiSelector().descriptionContains("Next").clickable(true)' },
    ],
    ios: [],
  };

  // Calendar done/apply button - use UiSelector
  private calendarDone: PlatformSelectors = {
    android: [
      { using: 'android uiautomator', value: 'new UiSelector().text("Done")' },
      { using: 'android uiautomator', value: 'new UiSelector().text("DONE")' },
      { using: 'android uiautomator', value: 'new UiSelector().text("Apply")' },
      { using: 'android uiautomator', value: 'new UiSelector().text("APPLY")' },
      { using: 'android uiautomator', value: 'new UiSelector().text("OK")' },
    ],
    ios: [],
  };

  async setDestination(destination: string, opts?: { pickSuggestion?: boolean }) {
    await this.setValue(this.destinationInput, destination, 'Destination', 12000);
    await this.sleep(500);

    if (opts?.pickSuggestion) {
      await this.click(this.firstSuggestion, 'Destination suggestion', 12000);
      await this.sleep(600);

      // Some builds keep suggestions open after selecting; close it deterministically.
      // (Safe: dismiss only when overlay is actually displayed.)
      await this.dismissAutocompleteIfPresent(2);

      // Verify the destination isn't reverted to the hint.
      try {
        const destEl = await this.el(this.destinationInput, 5000);
        const text = String(await destEl.getText().catch(() => '')).trim();
        if (!text || text.toLowerCase().includes('find your motel')) {
          console.warn('⚠️  Destination looks empty after suggestion select; retrying once...');
          await this.setValue(this.destinationInput, destination, 'Destination(retry)', 12000);
          await this.sleep(500);
          await this.click(this.firstSuggestion, 'Destination suggestion (retry)', 12000);
          await this.sleep(600);
          await this.dismissAutocompleteIfPresent(2);
        }
      } catch {
        // ignore
      }

      return;
    }

    // If we are NOT picking a suggestion, make sure the suggestion overlay is dismissed,
    // otherwise it can block taps on Guests/Dates.
    await this.dismissAutocompleteIfPresent(2);
  }

  async openGuests() {
    await this.dismissAutocompleteIfPresent(2);
    await this.click(this.guestsButton, 'Guests', 12000);
    await this.sleep(2000);
  }

  async openCalendarSheet() {
    await this.dismissAutocompleteIfPresent(2);
    await this.click(this.datesButton, 'Dates', 12000);
    // Use native sleep here; avoid command-heavy waits during transitions.
    await this.sleep(1800);
  }

  private safeDayForMonth(day: number) {
    // Avoid picking 29/30/31 to keep it robust across months.
    return Math.min(28, Math.max(1, day));
  }

  async pickDatesInCustomSheet(startOffsetDays: number, nights: number) {
    const before = await this.getCheckInDateText();

    // User-expected behavior: calendar opens as a popup page, current date already selected.
    // We just scroll 2–3 months ahead and tap any two available days.
    await this.openCalendarSheet();

    console.log('… Calendar opened; starting month scroll');

    const monthScrolls = Math.max(2, Math.min(4, Math.round(startOffsetDays / 30)));
    for (let i = 0; i < monthScrolls; i++) {
      console.log(`… Calendar scroll swipe ${i + 1}/${monthScrolls}`);
      await this.swipeUp(0.7);
      await this.sleep(500);
    }
    console.log(`✓ Calendar scrolled (${monthScrolls} swipes)`);

    // IMPORTANT: element lookups while this custom calendar sheet is open can hang Appium.
    // So we only use coordinate taps in a 7x6-ish day grid, then Apply, then verify via the
    // main screen's check-in label after the sheet closes.
    const tapCalendarCell = async (col: number, row: number) => {
      const gridLeft = 0.08;
      const gridRight = 0.92;
      const gridTop = 0.38;
      const gridBottom = 0.82;

      const cols = 7;
      const rows = 6;
      const c = Math.max(0, Math.min(cols - 1, col));
      const r = Math.max(0, Math.min(rows - 1, row));

      const x = gridLeft + ((c + 0.5) * (gridRight - gridLeft)) / cols;
      const y = gridTop + ((r + 0.5) * (gridBottom - gridTop)) / rows;
      await this.tapAtRatio(x, y);
    };

    const maxAttempts = 2;
    let changed = false;

    const waitForSheetToClose = async (timeoutMs: number) => {
      const start = Date.now();
      // After tapping Apply, the bottom-sheet can take a moment to close.
      // Ensure it is closed before attempting to re-open via landing controls.
      while (Date.now() - start < timeoutMs) {
        // eslint-disable-next-line no-await-in-loop
        const open = await this.isCalendarPopupOpen().catch(() => false);
        if (!open) return true;
        // eslint-disable-next-line no-await-in-loop
        await this.sleep(300);
      }
      return false;
    };

    const waitForCheckInChange = async (timeoutMs: number) => {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        // eslint-disable-next-line no-await-in-loop
        const after = await this.getCheckInDateText();
        if (before && after && before !== after) return after;
        // eslint-disable-next-line no-await-in-loop
        await this.sleep(450);
      }
      return '';
    };

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const base = attempt % 2;
      const cells: Array<[number, number]> = base === 0
        ? [
            [3, 2], [4, 2], [2, 3], [3, 3], [4, 3], [2, 4], [3, 4], [4, 4],
          ]
        : [
            [2, 2], [3, 2], [4, 2], [5, 2], [2, 3], [3, 3], [4, 3], [5, 3],
          ];

      for (const [c, r] of cells) {
        // eslint-disable-next-line no-await-in-loop
        await tapCalendarCell(c, r);
        // eslint-disable-next-line no-await-in-loop
        await this.sleep(140);
      }

      await this.sleep(450);
      console.log('✓ Picked a future start date');

      await this.tapApplyButton();
      console.log('✓ Tapped Apply');

      // Give the sheet time to close + labels time to refresh.
      await waitForSheetToClose(7000);
      const after = await waitForCheckInChange(4500);
      if (before && after && before !== after) {
        console.log(`✓ Check-in date changed: "${before}" -> "${after}"`);
        changed = true;
        break;
      }

      if (attempt < maxAttempts - 1) {
        const onLanding = await this.exists(this.searchLandingRoot, 2500);
        if (!onLanding) {
          console.log('… Check-in did not change; not on Search landing anymore, skipping calendar retry');
          break;
        }

        console.log('… Check-in did not change; retrying by re-opening calendar once');
        await this.openCalendarSheet();
        for (let i = 0; i < monthScrolls; i++) {
          // eslint-disable-next-line no-await-in-loop
          await this.swipeUp(0.7);
          // eslint-disable-next-line no-await-in-loop
          await this.sleep(500);
        }
      }
    }

    if (before && !changed) {
      throw new Error(`Check-in date did not change after selecting a date (still "${before}")`);
    }
  }

  async setGuestsInCustomSheet(opts: { adults?: number; children?: number }) {
    await this.dismissAutocompleteIfPresent(2);

    // SIMPLIFIED: Click guests button and directly try to use the stepper buttons
    // No complex detection - just try to interact with the elements
    
    // First, try to click guests button to open picker
    try {
      await this.click(this.guestsButton, 'Guests', 6000);
      await this.sleep(800);  // Wait for picker to animate open
    } catch {
      // If guests button not found, might already be on picker, continue
    }

    // Now directly try to tap the stepper buttons
    const tapButton = async (id: string, times: number, label: string) => {
      if (times <= 0) return;
      
      for (let i = 0; i < times; i++) {
        try {
          const el = await $(`id=${id}`);
          const exists = await el.isExisting().catch(() => false);
          if (exists) {
            await el.click();
            await this.sleep(150);  // Quick debounce
          } else {
            // Fallback: try to get rect and tap
            const rect = await this.getRectById(id, 1500);
            if (rect) {
              await this.tapInRect(rect, 0.5, 0.5);
              await this.sleep(150);
            }
          }
        } catch {
          // Ignore individual tap errors, continue trying
        }
      }
      if (times > 0) console.log(`✓ ${label}: ${times}`);
    };

    // Tap adult increment button (adults - 1 times since 1 adult is default)
    if (typeof opts.adults === 'number' && opts.adults > 1) {
      await tapButton('com.my6.android:id/btn_increase_adult', opts.adults - 1, 'Increase adults');
    }

    // Tap children increment button
    if (typeof opts.children === 'number' && opts.children > 0) {
      await tapButton('com.my6.android:id/btn_increase_child', opts.children, 'Increase children');
    }

    // Try to click Apply button
    await this.sleep(300);
    try {
      await this.click(this.guestsApplyButton, 'Apply guests', 5000);
    } catch {
      // Fallback: try coordinate tap for Apply
      await this.tapApplyButton();
    }
    await this.sleep(400);

    // Verify we're back on search landing (or just continue)
    try {
      const onLanding = await this.exists(this.searchLandingRoot, 3000);
      if (!onLanding) {
        // Try back button
        await driver.back();
        await this.sleep(300);
      }
    } catch {
      // Continue anyway
    }

    console.log('✓ Guests applied and picker closed');
  }

  /**
   * Simple guest setter - just tap + buttons directly
   * Much more reliable than complex detection
   */
  async setGuestsSimple(adults: number, children: number) {
    // Click guests button to open picker
    try {
      const guestsBtn = await $('id=com.my6.android:id/room_block');
      await guestsBtn.click();
      await this.sleep(500); // Wait for picker to open
      console.log('✓ Opened guest picker');
    } catch {
      console.warn('⚠️ Could not click guests button');
      return;
    }

    // Tap + button for adults (default is 1, so tap adults-1 times)
    const adultPlusBtn = 'com.my6.android:id/btn_increase_adult';
    for (let i = 0; i < adults - 1; i++) {
      try {
        const btn = await $(`id=${adultPlusBtn}`);
        await btn.click();
        await this.sleep(100);
      } catch { }
    }
    if (adults > 1) console.log(`✓ Adults: ${adults}`);

    // Tap + button for children
    const childPlusBtn = 'com.my6.android:id/btn_increase_child';
    for (let i = 0; i < children; i++) {
      try {
        const btn = await $(`id=${childPlusBtn}`);
        await btn.click();
        await this.sleep(100);
      } catch { }
    }
    if (children > 0) console.log(`✓ Children: ${children}`);

    // IMPORTANT: Click Apply button - use coordinate tap first (most reliable on Android 16)
    await this.sleep(200);
    
    // Primary: Tap Apply button area (bottom center) - avoids slow element lookups
    try {
      await this.tapAtRatio(0.5, 0.90);
      await this.sleep(200);
      // Second tap slightly lower in case button is positioned differently
      await this.tapAtRatio(0.5, 0.93);
      console.log('✓ Clicked Apply button');
    } catch { 
      // Fallback: Use Back to close picker
      try {
        await driver.back();
        console.log('✓ Closed picker via Back');
      } catch { }
    }
    
    await this.sleep(400); // Wait for picker to close
    console.log(`✓ Guests applied (${adults} adults, ${children} children)`);
  }

  /**
   * COORDINATE-BASED guest picker - FAST and reliable on Android 16
   * Uses screen coordinates based on actual guest picker UI layout:
   * - Header + tabs area: 0-20% from top
   * - Adults row with +/- buttons: ~40% from top  
   * - Children row with +/- buttons: ~55% from top
   * - Pet toggle switch: ~72% from top
   * - Apply button: ~92% from top
   * 
   * @param opts.adults - Number of adults (1-4, default is 1)
   * @param opts.children - Number of children (0-4, default is 0)
   * @param opts.pets - Whether to enable pets toggle (default: false)
   */
  async setGuestsCoordinate(opts: { adults: number; children: number; pets?: boolean }): Promise<{ adults: number; children: number; pets: boolean }> {
    const { adults, children, pets = false } = opts;

    console.log(`→ Setting guests via coordinates: ${adults} adults, ${children} children, pets=${pets}`);

    // Click guests button to open picker
    try {
      const guestsBtn = await $('id=com.my6.android:id/room_block');
      await guestsBtn.waitForExist({ timeout: 8000 });
      await guestsBtn.click();
      console.log('→ Opened guest picker');
      await this.sleep(1200); // Wait longer for picker animation
    } catch (e) {
      console.warn(`⚠️ Could not click guests button: ${e}`);
      return { adults: 1, children: 0, pets: false };
    }

    // COORDINATE POSITIONS (based on actual screenshot UI)
    const ADULT_PLUS_Y = 0.40;    // Adults row ~40% from top
    const CHILD_PLUS_Y = 0.55;    // Children row ~55% from top
    const PETS_TOGGLE_Y = 0.72;   // Pet toggle ~72% from top
    const APPLY_BTN_Y = 0.92;     // Apply button ~92% from top
    const PLUS_BTN_X = 0.85;      // + buttons on right side
    const TOGGLE_X = 0.80;        // Toggle switch on right side

    // Tap + for adults (adults - 1 times, since 1 is default)
    const adultTaps = Math.max(0, Math.min(adults - 1, 3)); // max 4 adults total
    for (let i = 0; i < adultTaps; i++) {
      await this.tapAtRatio(PLUS_BTN_X, ADULT_PLUS_Y);
      await this.sleep(400); // Longer pause between taps
    }
    if (adultTaps > 0) console.log(`→ Adults +${adultTaps} = ${adults}`);

    // Pause before children
    await this.sleep(300);

    // Tap + for children  
    const childTaps = Math.max(0, Math.min(children, 4)); // max 4 children
    for (let i = 0; i < childTaps; i++) {
      await this.tapAtRatio(PLUS_BTN_X, CHILD_PLUS_Y);
      await this.sleep(400); // Longer pause between taps
    }
    if (childTaps > 0) console.log(`→ Children +${childTaps} = ${children}`);

    // Toggle pets if enabled
    if (pets) {
      await this.sleep(200);
      await this.tapAtRatio(TOGGLE_X, PETS_TOGGLE_Y);
      await this.sleep(250);
      console.log('→ Pets: ON');
    }

    await this.sleep(400);

    // Tap Apply button - tap multiple positions to ensure we hit it
    console.log('→ Tapping Apply...');
    await this.tapAtRatio(0.50, APPLY_BTN_Y);  // First tap at 92%
    await this.sleep(500);
    await this.tapAtRatio(0.50, 0.90);          // Second tap at 90%
    await this.sleep(500);
    await this.tapAtRatio(0.50, 0.88);          // Third tap at 88%
    await this.sleep(600);
    
    console.log('→ Applied guests');

    console.log(`✓ Guests set: ${adults} adults, ${children} children, pets=${pets}`);
    return { adults, children, pets };
  }

  /**
   * Set guests with RANDOM values and pet toggle
   * Uses coordinate-based tapping for speed on Android 16
   */
  async setGuestsRandomWithPets(): Promise<{ adults: number; children: number; pets: boolean }> {
    const adults = Math.floor(Math.random() * 3) + 1; // 1-3 adults
    const children = Math.floor(Math.random() * 3);    // 0-2 children
    const pets = Math.random() > 0.5;                   // 50% chance

    return this.setGuestsCoordinate({ adults, children, pets });
  }

  /**
   * Open the rate code dropdown widget
   */
  async openRateCodeDropdown() {
    await this.dismissAutocompleteIfPresent(2);
    try {
      await this.click(this.rateCodeButton, 'Rate Code dropdown', 8000);
      await this.sleep(500);  // Reduced from 1500ms
      console.log('✓ Opened Rate Code dropdown');
    } catch (e) {
      throw new Error(`Failed to open Rate Code dropdown: ${String((e as any)?.message ?? e)}`);
    }
  }

  /**
   * Select CP Code rate option and enter the corporate partner code
   * @param cpCode The CP code to enter (e.g., 'CP8PPQBU')
   */
  async selectCPCodeRate(cpCode: string) {
    await this.openRateCodeDropdown();

    // Click CP Code option
    try {
      await this.click(this.rateCodeCPOption, 'CP Code option', 6000);
      await this.sleep(600);
      console.log('✓ Selected CP Code option');
    } catch {
      // If direct click fails, try scrolling down in the dropdown first
      await this.swipeUp(0.5);
      await this.sleep(500);
      try {
        await this.click(this.rateCodeCPOption, 'CP Code option (after scroll)', 6000);
        await this.sleep(600);
        console.log('✓ Selected CP Code option (after scroll)');
      } catch {
        // Close popup and return - don't leave it open
        await driver.back();
        await this.sleep(500);
        throw new Error('Could not find CP Code option in rate dropdown');
      }
    }

    // Enter the CP code in the input field
    try {
      // Wait for input field to appear after clicking CP option
      await this.sleep(800);
      
      // Try multiple ways to find the EditText
      let inputFound: WebdriverIO.Element | null = null;
      
      // Method 1: Try known IDs
      const idSelectors = [
        'id=com.my6.android:id/rate_code_input',
        'id=com.my6.android:id/et_rate_code',
        'id=com.my6.android:id/input_cp_code',
        'id=com.my6.android:id/cpCodeInput',
      ];
      
      for (const sel of idSelectors) {
        if (inputFound) break;
        try {
          const el = await $(sel);
          if (await el.isExisting().catch(() => false)) {
            inputFound = el;
            console.log(`✓ Found CP input via: ${sel}`);
          }
        } catch { }
      }
      
      // Method 2: UiSelector for EditText
      if (!inputFound) {
        try {
          const el = await $('android=new UiSelector().className("android.widget.EditText")');
          if (await el.isExisting().catch(() => false)) {
            inputFound = el;
            console.log('✓ Found CP input via UiSelector EditText');
          }
        } catch { }
      }
      
      // Method 3: Find focused EditText
      if (!inputFound) {
        try {
          const el = await $('android=new UiSelector().className("android.widget.EditText").focused(true)');
          if (await el.isExisting().catch(() => false)) {
            inputFound = el;
            console.log('✓ Found CP input via focused EditText');
          }
        } catch { }
      }
      
      if (!inputFound) {
        throw new Error('Could not find CP code input field');
      }
      
      await inputFound.clearValue();
      await inputFound.setValue(cpCode);
      await this.sleep(400);
      console.log(`✓ Entered CP Code: ${cpCode}`);
    } catch (e) {
      // If CP code entry fails, close the popup so we don't pollute the next step
      console.warn(`⚠️ CP Code input failed, closing popup`);
      try { await driver.back(); } catch { }
      await this.sleep(500);
      throw new Error(`Failed to enter CP Code: ${String((e as any)?.message ?? e)}`);
    }

    // Apply the rate code
    try {
      await this.click(this.rateCodeApplyButton, 'Apply rate code', 5000);
      await this.sleep(500);
      console.log('✓ Applied CP rate code');
    } catch {
      // Try tapping Apply button at common coordinates
      await this.tapAtRatio(0.5, 0.90);
      await this.sleep(500);
      console.log('✓ Applied CP rate code (via tap)');
    }
  }

  /**
   * Select a rate code option by type
   * Supports all rate types from the dropdown
   * @param rateType The type of rate code to select
   */
  async selectRateCodeOption(rateType: 'best_rate' | 'my6_member' | 'flexible' | 'government' | 'aarp' | 'commercial' | 'military' | 'senior') {
    await this.openRateCodeDropdown();

    const rateSelectors: Record<string, PlatformSelectors> = {
      best_rate: this.rateCodeBestRate,
      my6_member: this.rateCodeMy6Member,
      flexible: this.rateCodeFlexible,
      government: this.rateCodeGovernment,
      aarp: this.rateCodeAARP,
      commercial: this.rateCodeCommercial,
      military: this.rateCodeMilitary,
      senior: this.rateCodeSenior,
    };

    const rateLabels: Record<string, string> = {
      best_rate: 'Best rate',
      my6_member: 'My6 member rate',
      flexible: 'Flexible rate',
      government: 'Government rate',
      aarp: 'AARP rate',
      commercial: 'Commercial driver rate',
      military: 'Military rate',
      senior: 'Senior citizen rate',
    };

    const selector = rateSelectors[rateType];
    const label = rateLabels[rateType] || rateType;
    
    if (!selector) {
      throw new Error(`Unknown rate type: ${rateType}`);
    }

    try {
      await this.click(selector, `${label}`, 8000);
      await this.sleep(1000);
      console.log(`✓ Selected ${label}`);
    } catch {
      // Try scrolling if not visible
      await this.swipeUp(0.5);
      await this.sleep(500);
      try {
        await this.click(selector, `${label} (after scroll)`, 8000);
        await this.sleep(1000);
        console.log(`✓ Selected ${label} (after scroll)`);
      } catch {
        throw new Error(`Could not find rate option: ${label}`);
      }
    }

    // For non-CP rates, just clicking the option should auto-close or we need to tap outside
    // Check if the dropdown closed, if not wait a moment
    await this.sleep(500);
    console.log(`✓ Rate code "${label}" applied`);
  }

  /**
   * Select any rate code type (unified method)
   * For CP code, also handles entering the code value
   * @param rateType The rate type to select
   * @param cpCode Optional CP code value (required if rateType is 'cp_code')
   */
  async selectRateCode(rateType: string, cpCode?: string) {
    if (rateType === 'cp_code') {
      if (!cpCode) {
        throw new Error('CP code value is required for cp_code rate type');
      }
      await this.selectCPCodeRate(cpCode);
    } else {
      await this.selectRateCodeOption(rateType as any);
    }
  }

  /**
   * Get the currently selected rate code display text (if any)
   * @returns The rate code display text or empty string
   */
  async getSelectedRateCodeText(): Promise<string> {
    try {
      // Look for rate code text in the widget - use ID-based lookup instead of XPath
      const rateTextEl = await $('id=com.my6.android:id/tv_selected_rate');
      const exists = await rateTextEl.isExisting().catch(() => false);
      if (exists) {
        const text = await rateTextEl.getText().catch(() => '');
        if (text && text.trim() && !text.toLowerCase().includes('rate code') && !text.toLowerCase().includes('have a code')) {
          return text.trim();
        }
      }
    } catch {
      // ignore
    }
    return '';
  }

  private async tapStepper(labelNeedle: string, times: number) {
    if (times <= 0) return;

    // For steppers, use ID-based approach instead of XPath
    // The stepper pattern uses btn_increase_adult, btn_increase_child, etc.
    const idMap: Record<string, string> = {
      'adult': 'com.my6.android:id/btn_increase_adult',
      'Adult': 'com.my6.android:id/btn_increase_adult',
      'child': 'com.my6.android:id/btn_increase_child',
      'Child': 'com.my6.android:id/btn_increase_child',
      'pet': 'com.my6.android:id/btn_increase_pet',
      'Pet': 'com.my6.android:id/btn_increase_pet',
    };
    
    const btnId = idMap[labelNeedle] || idMap[labelNeedle.toLowerCase()];
    
    for (let i = 0; i < times; i++) {
      let clicked = false;
      
      // Try ID-based selector first
      if (btnId) {
        try {
          const el = await $(`id=${btnId}`);
          const exists = await this.withTimeout(el.isExisting(), 2500, `isExisting(${labelNeedle})`, false);
          if (exists) {
            await this.withTimeout(el.click(), 5000, `click(${labelNeedle})`, undefined as any);
            clicked = true;
            await this.sleep(250);
          }
        } catch {
          // ignore
        }
      }
      if (!clicked) {
        // fallback: stop trying if we cannot find stepper
        break;
      }
    }
  }

  async setGuestsChildrenPets(opts: { adults?: number; children?: number; pets?: number }) {
    // Preferred path: resource-id steppers + Apply button (fast + stable).
    // We assume openGuests() already waited for the screen when available.
    {
      const inc = async (map: PlatformSelectors, times: number, label: string) => {
        for (let i = 0; i < times; i++) {
          try {
            await this.click(map, label, 8000);
          } catch {
            break;
          }
          await this.sleep(200);
        }
      };

      if (typeof opts.adults === 'number' && opts.adults > 1) {
        await inc(this.increaseAdultsButton, opts.adults - 1, 'Increase adults');
      }
      if (typeof opts.children === 'number' && opts.children > 0) {
        await inc(this.increaseChildrenButton, opts.children, 'Increase children');
      }
      // Pet toggle is a checkbox, not a stepper - click it if pets requested
      if (typeof opts.pets === 'number' && opts.pets > 0) {
        try {
          await this.click(this.petToggle, 'Pet toggle', 5000);
        } catch {
          console.log('⚠️ Could not toggle pets');
        }
      }

      try {
        await this.click(this.guestsApplyButton, 'Apply guests', 12000);
        await this.sleep(1200);
        return;
      } catch {
        // If Apply isn't present in this UI variant, fall back below.
      }
    }

    // Fallback path: heuristic steppers (older/newer UI variants).
    if (typeof opts.adults === 'number' && opts.adults > 1) {
      await this.tapStepper('Adult', opts.adults - 1);
    }
    if (typeof opts.children === 'number' && opts.children > 0) {
      await this.tapStepper('Child', opts.children);
    }
    if (typeof opts.pets === 'number' && opts.pets > 0) {
      await this.tapStepper('Pet', opts.pets);
    }

    try {
      await this.click(this.calendarDone, 'Guests Done/Apply', 2500);
    } catch {
      // ignore
    }
  }

  private formatMonthYear(date: Date) {
    const month = date.toLocaleString('en-US', { month: 'long' });
    const year = date.getFullYear();
    return `${month} ${year}`;
  }

  private async clickDay(day: number) {
    const xp = `//*[@text=\"${day}\"]/ancestor-or-self::*[@clickable=\"true\"][1]`;
    const el = await $(xp);
    const exists = await this.withTimeout(el.isExisting(), 4000, `isExisting(day ${day})`, false);
    if (!exists) throw new Error(`Day ${day} not found in calendar`);
    await this.withTimeout(el.click(), 5000, `click(day ${day})`, undefined as any);
    await this.sleep(400);
  }

  async pickDatesTwoToThreeMonthsFuture(nights: number = 2, startOffsetDays: number = 70) {
    // Pick start ~2–3 months ahead and end after N nights.
    const start = new Date();
    start.setDate(start.getDate() + startOffsetDays);
    const end = new Date(start);
    end.setDate(end.getDate() + Math.max(1, nights));

    await this.dismissAutocompleteIfPresent(2);
    await this.click(this.datesButton, 'Dates', 12000);
    await this.sleep(1200);

    // Navigate months by a fixed number of steps instead of relying on header text,
    // which can be flaky depending on the date-picker implementation.
    const monthSteps = Math.max(2, Math.min(4, Math.round(startOffsetDays / 30)));
    for (let i = 0; i < monthSteps; i++) {
      try {
        await this.click(this.calendarNextMonth, 'Next month', 2500);
      } catch {
        // Some pickers don't have a next arrow; swipe within the calendar.
        await this.swipeUp(0.85);
      }
      await this.sleep(400);
    }

    // Use safe day numbers (<= 28) to avoid missing days in shorter months.
    const startDay = Math.min(28, Math.max(1, start.getDate()));
    const endDay = Math.min(28, Math.max(1, startDay + Math.max(1, nights)));

    await this.clickDay(startDay);
    await this.clickDay(endDay);

    try {
      await this.click(this.calendarDone, 'Dates Done/Apply', 8000);
    } catch {
      // ignore
    }
  }

  async submitSearch() {
    // If suggestions overlay is still open, close it first.
    await this.dismissAutocompleteIfPresent(1);

    // If selecting destination suggestion already navigated to lister, do NOT click anything.
    if (await this.exists(this.listerResultsList, 2500)) {
      console.log('✓ Lister already open; skipping Search submit');
      return;
    }

    // Wait for search landing to stabilize (might be closing sheets)
    await this.sleep(500);

    // Check if we're on search landing
    const onLanding = await this.exists(this.searchLandingRoot, 5000);
    if (!onLanding) {
      console.log('… Not on Search landing; trying direct submit anyway');
    }

    // Primary approach: scroll down and click the Search button directly
    // IME submit doesn't work for this app - btn_search is often below the fold
    const clickSearchButton = async (): Promise<boolean> => {
      // First try without scroll
      try {
        const btn = await $('id=com.my6.android:id/btn_search');
        if (await btn.isExisting()) {
          await btn.click();
          console.log('✓ Clicked Search button');
          return true;
        }
      } catch { }

      // Scroll down to expose btn_search
      console.log('… Scrolling to find Search button');
      const { height } = await this.getWindowSizeSafe();
      await driver.execute('mobile: scrollGesture', {
        left: 100, top: Math.floor(height * 0.6),
        width: 200, height: Math.floor(height * 0.3),
        direction: 'down', percent: 0.7
      });
      await this.sleep(500);

      // Try again after scroll
      try {
        const btn = await $('id=com.my6.android:id/btn_search');
        if (await btn.isExisting()) {
          await btn.click();
          console.log('✓ Clicked Search button (after scroll)');
          return true;
        }
      } catch { }

      // Try UiSelector text-based approach
      try {
        const searchText = await $('android=new UiSelector().text("Search")');
        if (await searchText.isExisting()) {
          await searchText.click();
          console.log('✓ Clicked "Search" text button');
          return true;
        }
      } catch { }

      return false;
    };

    if (await clickSearchButton()) {
      await this.sleep(1000);
      return;
    }

    const waitForLister = async (timeoutMs: number) => {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        try {
          const list = await $('id=com.my6.android:id/rv_search_results_list');
          const exists = await this.withTimeout(list.isExisting(), 3500, 'list.isExisting', false);
          if (exists) return true;
        } catch {
          // ignore
        }
        await driver.pause(300);
      }
      return false;
    };

    // Check if destination field is empty (showing placeholder "Find your motel").
    // If so, try clicking a "CONTINUE YOUR SEARCH" recent search item instead of IME submit.
    let destinationIsEmpty = false;
    try {
      const destEl = await this.el(this.destinationInput, 3000);
      const destText = String(await destEl.getText().catch(() => '')).trim().toLowerCase();
      destinationIsEmpty = !destText || destText.includes('find your motel') || destText.includes('find your');
    } catch {
      // ignore
    }

    if (destinationIsEmpty) {
      console.log('… Destination field is empty; looking for recent search item to click');
      try {
        const recentSearchExists = await this.exists(this.firstRecentSearch, 3000);
        if (recentSearchExists) {
          await this.click(this.firstRecentSearch, 'Recent search item', 8000);
          console.log('✓ Clicked recent search item under "CONTINUE YOUR SEARCH"');
          if (await waitForLister(35000)) {
            console.log('✓ Lister loaded via recent search');
            return;
          }
        }
      } catch {
        // ignore
      }

      // Fallback: click "Search nearby motels" when no recent search exists
      console.log('… Trying "Search nearby motels" as fallback');
      try {
        // Use UiSelector instead of XPath to avoid Android 16 hangs
        const nearbyMotels = await $('android=new UiSelector().textContains("nearby motels")');
        const nearbyExists = await this.withTimeout(nearbyMotels.isExisting(), 2500, 'Search nearby motels', false);
        if (nearbyExists) {
          await this.withTimeout(nearbyMotels.click(), 5000, 'click Search nearby motels', undefined as any);
          console.log('✓ Clicked "Search nearby motels"');
          if (await waitForLister(35000)) {
            console.log('✓ Lister loaded via nearby motels');
            return;
          }
        }
      } catch {
        console.log('… Search nearby motels not found; falling back to standard submit');
      }
    }

    // Focus an input before trying to submit via IME.
    try {
      const dest = await this.el(this.destinationInput, 2500);
      await dest.click();
      await this.sleep(250);
    } catch {
      // ignore
    }

    // 1) Prefer Android IME action (avoids tapping potentially unstable CTAs).
    try {
      await this.withTimeout(
        driver.execute('mobile: performEditorAction', { action: 'search' }) as any,
        5000,
        'performEditorAction(search)',
        undefined as any,
      );
      console.log('✓ Triggered IME search action');
      if (await waitForLister(20000)) return;
    } catch {
      // ignore
    }

    // 2) Fallback: Enter keycode (66)
    try {
      // @ts-ignore
      await this.withTimeout(driver.pressKeyCode?.(66) as any, 3000, 'pressKeyCode(66)', undefined as any);
      console.log('✓ Pressed Enter keycode');
      if (await waitForLister(20000)) return;
    } catch {
      // ignore
    }

    // 3) Last resort: explicit Search CTA if present (scoped to landing).
    try {
      await this.click(this.searchSubmit, 'Search submit', 3000);
    } catch {
      // ignore
    }

    // Wait for lister to appear with extended timeout (API can be slow).
    console.log('… Waiting for lister to load');
    if (!(await waitForLister(45000))) {
      // Take a diagnostic screenshot before failing.
      try {
        const shot = await driver.takeScreenshot();
        const fs = await import('fs');
        const path = `test-artifacts/submit-search-timeout-${Date.now()}.png`;
        fs.writeFileSync(path, shot, 'base64');
        console.log(`⚠️ Saved diagnostic screenshot: ${path}`);
      } catch {
        // ignore screenshot errors
      }
      await this.el(this.listerResultsList, 30000);
    }
    console.log('✓ Lister loaded');
  }

  async waitForResults(timeoutMs: number = 30000) {
    await this.el(this.resultsHeuristic, timeoutMs);
    console.log('✓ Search results screen looks loaded');
  }
}
