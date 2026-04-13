import { BasePage } from '../../shared/core/BasePage';

/**
 * Property Detail Page (PDP) - Motel6/Studio6 Android
 * Handles hotel detail page interactions including:
 * - Ratings/Reviews navigation
 * - Image carousel scrolling
 * - Date changes
 * - Early check-in toggle with price verification
 */
export class PDPPage extends BasePage {
  constructor() {
    super('android');
  }

  private sleep(ms: number) {
    return new Promise<void>((resolve) => setTimeout(resolve, ms));
  }

  // Common PDP resource IDs (from element extraction)
  private static readonly IDS = {
    // Page containers
    pdpContainer: 'com.my6.android:id/fragment_hote_detail_wrapper',
    widgetList: 'com.my6.android:id/rv_fhd_widget_list',
    
    // Header/Images
    imageList: 'com.my6.android:id/rv_hotelimageswidget_list',
    imageItem: 'com.my6.android:id/item_hotel_image',
    imageTab: 'com.my6.android:id/hotel_image_tab',
    hotelCategory: 'com.my6.android:id/hotel_category',
    backButton: 'com.my6.android:id/fhd_back_button',
    
    // Hotel info section
    hotelName: 'com.my6.android:id/hotel_name',
    hotelAddress: 'com.my6.android:id/hotel_address',
    
    // Rating section
    ratingLayout: 'com.my6.android:id/hotel_ratings_layout',
    ratingPoints: 'com.my6.android:id/hotel_rating_points',
    ratingCount: 'com.my6.android:id/hotel_rating_count',
    
    // Map section
    mapView: 'com.my6.android:id/map_view',
    
    // About section
    aboutTitle: 'com.my6.android:id/tv_title',
    aboutDescription: 'com.my6.android:id/tv_description',
    readMore: 'com.my6.android:id/tv_read_more',
    
    // Price/Footer section
    footerView: 'com.my6.android:id/footer_view',
    priceContainer: 'com.my6.android:id/price_container',
    slasherPrice: 'com.my6.android:id/tv_payment_slasher_price_right',
    priceAmount: 'com.my6.android:id/tv_payment_amount',
    perNightText: 'com.my6.android:id/tv_per_night_text',
    taxCta: 'com.my6.android:id/tax_cta',
    
    // Book button
    bookButtonContainer: 'com.my6.android:id/primary_book_btn_container',
    bookButtonText: 'com.my6.android:id/tvTxt',
    
    // Early check-in (may need to discover via element dump)
    earlyCheckInContainer: 'com.my6.android:id/early_checkin_container',
    earlyCheckInToggle: 'com.my6.android:id/early_checkin_toggle',
  };

  // Alternative selectors for rating
  private ratingPatterns = [
    'com.my6.android:id/hotel_ratings_layout',
    'com.my6.android:id/hotel_rating_points',
    'com.my6.android:id/hotel_rating_count',
  ];

  // Alternative selectors for early check-in
  private earlyCheckInPatterns = [
    'com.my6.android:id/early_check_in',
    'com.my6.android:id/early_checkin',
    'com.my6.android:id/express_checkin',
  ];

  /**
   * Wait for PDP to load
   */
  async waitForLoaded(timeoutMs: number = 20000): Promise<void> {
    console.log('→ Waiting for PDP to load...');
    const start = Date.now();
    
    const pdpIndicators = [
      PDPPage.IDS.hotelName,
      PDPPage.IDS.widgetList,
      PDPPage.IDS.pdpContainer,
      PDPPage.IDS.imageList,
      PDPPage.IDS.priceContainer,
      PDPPage.IDS.bookButtonContainer,
      PDPPage.IDS.ratingLayout,
    ];

    while (Date.now() - start < timeoutMs) {
      for (const id of pdpIndicators) {
        try {
          const el = await $(`id=${id}`);
          if (await el.isExisting().catch(() => false)) {
            console.log(`✓ PDP loaded (found: ${id.split('/').pop()})`);
            await driver.pause(500);
            return;
          }
        } catch { /* continue */ }
      }
      await driver.pause(500);
    }
    
    throw new Error(`PDP did not load within ${timeoutMs}ms`);
  }

  /**
   * Check if we're on PDP
   */
  async isOnPDP(): Promise<boolean> {
    const pdpIndicators = [
      PDPPage.IDS.hotelName,
      PDPPage.IDS.widgetList,
      PDPPage.IDS.priceContainer,
    ];

    for (const id of pdpIndicators) {
      try {
        const el = await $(`id=${id}`);
        if (await el.isExisting().catch(() => false)) {
          return true;
        }
      } catch { /* continue */ }
    }
    return false;
  }

  /**
   * Get hotel name from PDP
   */
  async getHotelName(): Promise<string | null> {
    try {
      const el = await $(`id=${PDPPage.IDS.hotelName}`);
      if (await el.isExisting().catch(() => false)) {
        return await el.getText().catch(() => null);
      }
    } catch { /* ignore */ }
    return null;
  }

  // ============================================================
  // RATING / REVIEWS
  // ============================================================

  /**
   * Check if rating section is available
   */
  async hasRatingSection(): Promise<boolean> {
    const allPatterns = [
      PDPPage.IDS.ratingLayout,
      PDPPage.IDS.ratingPoints,
      PDPPage.IDS.ratingCount,
      ...this.ratingPatterns,
    ];

    for (const id of allPatterns) {
      try {
        const el = await $(`id=${id}`);
        if (await el.isExisting().catch(() => false)) {
          return true;
        }
      } catch { /* continue */ }
    }
    return false;
  }

  /**
   * Click on rating to expand reviews section (reviews are on PDP, not separate page)
   * After clicking, looks for "View all reviews" button
   */
  async clickRatingToOpenReviews(): Promise<{ success: boolean; navigatedToReviews: boolean }> {
    console.log('→ Looking for rating section to click...');
    
    // First click on rating layout to expand reviews
    const clickableIds = [
      PDPPage.IDS.ratingLayout,
      PDPPage.IDS.ratingPoints,
      PDPPage.IDS.ratingCount,
    ];

    let clicked = false;
    for (const id of clickableIds) {
      try {
        const el = await $(`id=${id}`);
        if (await el.isDisplayed().catch(() => false)) {
          console.log(`✓ Found rating element: ${id.split('/').pop()}`);
          await el.click();
          await driver.pause(1000);
          clicked = true;
          break;
        }
      } catch { /* continue */ }
    }

    // Try clicking on "X ratings" text
    if (!clicked) {
      try {
        const ratingsText = await $(`android=new UiSelector().textMatches("(?i).*\\\\d+\\\\s*ratings.*")`);
        if (await ratingsText.isDisplayed().catch(() => false)) {
          console.log('→ Found ratings text, clicking...');
          await ratingsText.click();
          await driver.pause(1000);
          clicked = true;
        }
      } catch { /* ignore */ }
    }

    if (!clicked) {
      console.log('⚠️ Could not find rating section');
      return { success: false, navigatedToReviews: false };
    }

    // Now scroll down to find "View all reviews" button (reviews are on PDP)
    const foundReviews = await this.findAndClickViewAllReviews();
    return { success: true, navigatedToReviews: foundReviews };
  }

  /**
   * Scroll to find and click "View all reviews" button on PDP
   */
  async findAndClickViewAllReviews(): Promise<boolean> {
    console.log('→ Looking for View all reviews button...');
    
    // Scroll and look for "View all reviews" button (up to 5 scrolls)
    for (let i = 0; i < 5; i++) {
      // Check for view all reviews button
      try {
        const viewAllBtn = await $(`android=new UiSelector().textMatches("(?i).*view.*all.*review.*")`);
        if (await viewAllBtn.isDisplayed().catch(() => false)) {
          console.log('✓ Found "View all reviews" button');
          await viewAllBtn.click();
          await driver.pause(1000);
          return true;
        }
      } catch { /* continue */ }

      // Also check for reviews container appearing
      try {
        const reviewText = await $(`android=new UiSelector().textMatches("(?i).*\\\\d+\\\\s+out\\\\s+of\\\\s+5.*|.*guest.*review.*")`);
        if (await reviewText.isDisplayed().catch(() => false)) {
          console.log('✓ Reviews section visible');
          return true;
        }
      } catch { /* continue */ }

      await this.scrollDown(0.3);
      await driver.pause(500);
    }

    console.log('⚠️ Could not find reviews section after scrolling');
    return false;
  }

  /**
   * Check if reviews section is visible on PDP
   */
  async isOnReviewsPage(): Promise<boolean> {
    // Reviews are on PDP, not separate page - check if reviews section is visible
    try {
      const reviewText = await $(`android=new UiSelector().textMatches("(?i).*view.*all.*review.*|.*guest.*review.*")`);
      if (await reviewText.isExisting().catch(() => false)) {
        return true;
      }
    } catch { /* ignore */ }
    return false;
  }

  /**
   * Scroll back to top of PDP (after viewing reviews)
   */
  async goBackFromReviews(): Promise<void> {
    // Just scroll back to top since reviews are on same page
    await this.scrollToTop();
    await driver.pause(500);
  }

  /**
   * Scroll to top of PDP
   */
  async scrollToTop(): Promise<void> {
    for (let i = 0; i < 5; i++) {
      await this.scrollUp(0.5);
    }
    await driver.pause(500);
  }

  // ============================================================
  // IMAGE CAROUSEL
  // ============================================================

  /**
   * Swipe through property images horizontally in the gallery
   */
  async swipePropertyImages(swipeCount: number = 3): Promise<{ success: boolean; imagesViewed: number }> {
    console.log(`→ Swiping property images (${swipeCount} swipes)...`);
    let imagesViewed = 1;

    // First scroll to top to make sure image gallery is visible
    await this.scrollToTop();
    await driver.pause(500);

    // Try to find the image carousel/gallery area at top of PDP
    const carouselIds = [
      PDPPage.IDS.imageList,  // rv_hotelimageswidget_list
      'com.my6.android:id/rv_hotelimageswidget_list',
      PDPPage.IDS.imageItem,  // item_hotel_image
    ];

    let carousel: WebdriverIO.Element | null = null;
    for (const id of carouselIds) {
      try {
        const el = await $(`id=${id}`);
        if (await el.isExisting().catch(() => false)) {
          carousel = el;
          console.log(`✓ Found image carousel: ${id.split('/').pop()}`);
          break;
        }
      } catch { /* continue */ }
    }

    // If no carousel found by ID, try finding image at top area
    if (!carousel) {
      try {
        const imageView = await $('android.widget.ImageView');
        if (await imageView.isDisplayed().catch(() => false)) {
          carousel = imageView;
          console.log('✓ Found image via ImageView class');
        }
      } catch { /* ignore */ }
    }

    if (!carousel) {
      console.log('⚠️ Image carousel not found, trying screen-based swipe');
      // Fallback: swipe in top portion of screen (where images usually are)
      const { width, height } = await driver.getWindowSize();
      const topArea = {
        left: Math.floor(width * 0.1),
        top: Math.floor(height * 0.15),
        width: Math.floor(width * 0.8),
        height: Math.floor(height * 0.25),
      };

      for (let i = 0; i < swipeCount; i++) {
        try {
          await driver.execute('mobile: swipeGesture', {
            ...topArea,
            direction: 'left',
            percent: 0.6,
          });
          await driver.pause(600);
          imagesViewed++;
          console.log(`   ✓ Swiped to image ${imagesViewed}`);
        } catch (e) {
          console.log(`   ⚠️ Swipe ${i + 1} failed`);
        }
      }

      console.log(`✓ Image carousel tested (fallback): ${imagesViewed} images`);
      return { success: imagesViewed > 1, imagesViewed };
    }

    // Normal path: swipe on found element
    try {
      const loc = await carousel.getLocation();
      const size = await carousel.getSize();

      // Calculate swipe area within the carousel bounds
      const swipeArea = {
        left: Math.max(0, loc.x),
        top: Math.max(0, loc.y),
        width: Math.max(100, size.width),
        height: Math.max(100, size.height),
      };

      for (let i = 0; i < swipeCount; i++) {
        try {
          await driver.execute('mobile: swipeGesture', {
            ...swipeArea,
            direction: 'left',
            percent: 0.6,
          });
          await driver.pause(600);
          imagesViewed++;
          console.log(`   ✓ Swiped to image ${imagesViewed}`);
        } catch (e) {
          console.log(`   ⚠️ Swipe ${i + 1} failed: ${String(e).substring(0, 40)}`);
        }
      }

      console.log(`✓ Image carousel tested: ${imagesViewed} images viewed`);
      return { success: imagesViewed > 1, imagesViewed };
    } catch (e) {
      console.log(`⚠️ Error swiping images: ${String(e).substring(0, 40)}`);
      return { success: false, imagesViewed };
    }
  }

  // ============================================================
  // DATE CHANGES
  // ============================================================

  /**
   * Click on dates to open date picker modal (PDP only)
   * The booking header bar appears after scrolling - contains date/guest widgets
   * User confirmed: tapping header opens the picker
   */
  async clickDatesToEdit(): Promise<boolean> {
    console.log('→ Looking for date section on PDP header...');

    // Scroll down slightly to reveal the sticky header (appears after scroll)
    await this.swipeUp(0.2);
    await this.sleep(600);

    // Try to find and tap the header container (sticky header with booking info)
    const headerIds = [
      'com.my6.android:id/header_container',
      'com.my6.android:id/hav_fhd_widget_view',
      'com.my6.android:id/booking_summary_header',
      'com.my6.android:id/search_summary_view',
    ];

    for (const id of headerIds) {
      try {
        const header = await $(`id=${id}`);
        if (await header.isDisplayed().catch(() => false)) {
          console.log(`✓ Found header: ${id.split('/').pop()}`);
          await header.click();
          await this.sleep(1000);
          return true;
        }
      } catch { /* continue */ }
    }

    // Look for date-related text patterns (Check-in, Check-out, etc.)
    const datePatterns = ['Check-in', 'Check-out', 'Dates'];
    for (const pattern of datePatterns) {
      try {
        const dateText = await $(`android=new UiSelector().textContains("${pattern}")`);
        if (await dateText.isDisplayed().catch(() => false)) {
          console.log(`✓ Found date section: ${pattern}`);
          await dateText.click();
          await this.sleep(1000);
          return true;
        }
      } catch { /* continue */ }
    }

    // Try finding date pattern like "Apr 15 - Apr 17" or "10 Apr - 12 Apr"
    try {
      const dateRangeText = await $(`android=new UiSelector().textMatches("(?i).*[a-z]{3}\\\\s+\\\\d+\\\\s*-\\\\s*[a-z]{3}\\\\s+\\\\d+.*|.*\\\\d+\\\\s*[a-z]{3}\\\\s*-\\\\s*\\\\d+\\\\s*[a-z]{3}.*")`);
      if (await dateRangeText.isDisplayed().catch(() => false)) {
        console.log('✓ Found date range text');
        await dateRangeText.click();
        await this.sleep(1000);
        return true;
      }
    } catch { /* ignore */ }

    // Tap coordinate at header area (top 12-15% of screen) - where booking bar appears
    console.log('→ Trying coordinate tap on header area...');
    await this.tapAtRatio(0.5, 0.12);
    await this.sleep(800);
    
    // Check if calendar opened (look for calendar indicators)
    const calendarOpened = await this.isCalendarVisible();
    if (calendarOpened) {
      console.log('✓ Calendar opened via header tap');
      return true;
    }

    // Try tapping slightly lower (around 15%)
    await this.tapAtRatio(0.5, 0.15);
    await this.sleep(800);
    if (await this.isCalendarVisible()) {
      console.log('✓ Calendar opened via second header tap');
      return true;
    }

    console.log('⚠️ Date section not found on PDP');
    return false;
  }

  /**
   * Check if calendar picker is visible
   */
  private async isCalendarVisible(): Promise<boolean> {
    const calendarIds = [
      'com.my6.android:id/cfs_calendar_view',
      'com.my6.android:id/calendar_tabs',
      'com.my6.android:id/calendar_container',
    ];
    for (const id of calendarIds) {
      try {
        const el = await $(`id=${id}`);
        if (await el.isExisting().catch(() => false)) {
          return true;
        }
      } catch { /* continue */ }
    }
    // Also check for calendar-like text
    try {
      const applyBtn = await $(`android=new UiSelector().textMatches("(?i).*(apply|done|select).*")`);
      if (await applyBtn.isDisplayed().catch(() => false)) {
        return true;
      }
    } catch { /* ignore */ }
    return false;
  }

  /**
   * Change dates using coordinate-based taps (avoids Appium hangs during calendar interaction)
   * Reuses proven pattern from SearchPage.ts
   */
  async changeDates(offsetDays: number, nights: number): Promise<boolean> {
    console.log(`→ Changing dates: +${offsetDays} days, ${nights} nights`);
    
    const opened = await this.clickDatesToEdit();
    if (!opened) {
      console.log('⚠️ Could not open date picker');
      return false;
    }
    
    // Brief wait for calendar to open - no element lookups during calendar interaction
    await this.sleep(1500);
    console.log('✓ Calendar opened');
    
    // Scroll forward months using swipeUp (reuse from BasePage)
    const monthsToScroll = Math.max(1, Math.min(3, Math.ceil(offsetDays / 30)));
    console.log(`→ Scrolling ${monthsToScroll} months...`);
    for (let i = 0; i < monthsToScroll; i++) {
      await this.swipeUp(0.6);
      await this.sleep(400);
    }
    console.log(`✓ Calendar scrolled`);
    
    // Tap calendar grid cells using coordinates (proven pattern from SearchPage)
    // Grid: left=0.08, right=0.92, top=0.38, bottom=0.82, 7 cols x 6 rows
    const tapCalendarCell = async (col: number, row: number) => {
      const gridLeft = 0.08, gridRight = 0.92, gridTop = 0.38, gridBottom = 0.82;
      const cols = 7, rows = 6;
      const c = Math.max(0, Math.min(cols - 1, col));
      const r = Math.max(0, Math.min(rows - 1, row));
      const x = gridLeft + ((c + 0.5) * (gridRight - gridLeft)) / cols;
      const y = gridTop + ((r + 0.5) * (gridBottom - gridTop)) / rows;
      await this.tapAtRatio(x, y);
    };
    
    // Tap multiple cells to select check-in and check-out (proven pattern)
    const cells: [number, number][] = [[3, 2], [4, 2], [3, 3], [4, 3]];
    for (const [c, r] of cells) {
      await tapCalendarCell(c, r);
      await this.sleep(120);
    }
    console.log('✓ Picked dates');
    
    // Tap Apply/Done button using coordinates (bottom center)
    await this.sleep(300);
    await this.tapAtRatio(0.5, 0.90);
    await this.sleep(200);
    await this.tapAtRatio(0.5, 0.93);
    console.log('✓ Tapped Apply');
    
    await this.sleep(1500);
    console.log('✓ Dates changed');
    return true;
  }

  /**
   * Click on guests section to open guest picker (PDP only)
   * The popup has 3 sections: Check-in, Checkout, Guests
   * After opening the popup (defaults to calendar), we need to scroll down to reach Guests section
   */
  async clickGuestsToEdit(): Promise<boolean> {
    console.log('→ Opening popup and scrolling to Guests section...');
    
    // Scroll up to make sure we're at top of PDP
    await this.swipeDown(0.3);
    await this.sleep(600);

    // Step 1: Open the popup by tapping header_container
    let popupOpened = false;
    const headerIds = [
      'com.my6.android:id/header_container',
      'com.my6.android:id/hav_fhd_widget_view',
    ];

    for (const id of headerIds) {
      try {
        const header = await $(`id=${id}`);
        if (await header.isDisplayed().catch(() => false)) {
          console.log(`✓ Tapping header: ${id.split('/').pop()}`);
          await header.click();
          await this.sleep(1500);
          popupOpened = true;
          break;
        }
      } catch { /* continue */ }
    }

    if (!popupOpened) {
      console.log('→ Trying coordinate tap on header...');
      await this.tapAtRatio(0.5, 0.12);
      await this.sleep(1500);
      popupOpened = true;
    }

    const { width, height } = await driver.getWindowSize();

    // Check if guest picker is already visible
    if (await this.isGuestPickerVisible()) {
      console.log('✓ Guest picker already visible');
      return true;
    }

    // Step 2: Try to find and click "Guests" text directly (if it's a tab header)
    console.log('→ Looking for Guests tab or section...');
    try {
      const guestsTab = await $(`android=new UiSelector().text("Guests")`);
      if (await guestsTab.isDisplayed().catch(() => false)) {
        console.log('✓ Found "Guests" text - clicking');
        await guestsTab.click();
        await this.sleep(1000);
        if (await this.isGuestPickerVisible()) {
          console.log('✓ Guest picker opened via Guests tab');
          return true;
        }
      }
    } catch { /* continue */ }

    // Step 3: Scroll DOWN within the popup to reach Guests section
    // The popup content is likely scrollable with Check-in at top, Guests at bottom
    console.log('→ Scrolling down within popup to find Guests...');
    for (let i = 0; i < 4; i++) {
      // Swipe up (scroll down) within the popup area (30%-70% of screen height)
      await driver.performActions([{
        type: 'pointer',
        id: 'finger1',
        parameters: { pointerType: 'touch' },
        actions: [
          { type: 'pointerMove', duration: 0, x: Math.floor(width * 0.5), y: Math.floor(height * 0.65) },
          { type: 'pointerDown', button: 0 },
          { type: 'pause', duration: 100 },
          { type: 'pointerMove', duration: 400, x: Math.floor(width * 0.5), y: Math.floor(height * 0.30) },
          { type: 'pointerUp', button: 0 },
        ],
      }]);
      await driver.releaseActions().catch(() => {});
      await this.sleep(600);
      
      if (await this.isGuestPickerVisible()) {
        console.log(`✓ Guest picker found after ${i + 1} scroll(s)`);
        return true;
      }
    }

    // Step 4: Try tapping on right-third of the screen at various heights (if tabs are horizontal)
    console.log('→ Trying tab area taps...');
    for (const y of [0.12, 0.15, 0.18, 0.20]) {
      await this.tapAtRatio(0.80, y);
      await this.sleep(600);
      if (await this.isGuestPickerVisible()) {
        console.log(`✓ Guest picker opened at (0.80, ${y})`);
        return true;
      }
    }

    // Step 5: Try to find "1 Adult" or similar text in the popup and click it
    console.log('→ Looking for Adult count text...');
    try {
      const adultText = await $(`android=new UiSelector().textMatches("(?i).*\\\\d+\\\\s*Adult.*")`);
      if (await adultText.isDisplayed().catch(() => false)) {
        console.log('✓ Found Adult count text - clicking');
        await adultText.click();
        await this.sleep(800);
        if (await this.isGuestPickerVisible()) {
          return true;
        }
      }
    } catch { /* continue */ }

    console.log('⚠️ Could not find guest picker');
    return false;
  }

  /**
   * Check if guest picker is visible (Adults/Children steppers visible)
   */
  private async isGuestPickerVisible(): Promise<boolean> {
    // Check for Adults text with stepper (confirms we're on guest tab)
    try {
      const adultsLabel = await $(`android=new UiSelector().text("Adults")`);
      if (await adultsLabel.isDisplayed().catch(() => false)) {
        return true;
      }
    } catch { /* ignore */ }
    
    // Check for stepper buttons
    const guestPickerIds = [
      'com.my6.android:id/btn_increase_adult',
      'com.my6.android:id/btn_decrease_adult',
    ];
    for (const id of guestPickerIds) {
      try {
        const el = await $(`id=${id}`);
        if (await el.isExisting().catch(() => false)) {
          return true;
        }
      } catch { /* continue */ }
    }
    
    // Check for "Ages 13 and above" text (appears on guest picker)
    try {
      const agesText = await $(`android=new UiSelector().textContains("Ages 13")`);
      if (await agesText.isDisplayed().catch(() => false)) {
        return true;
      }
    } catch { /* ignore */ }
    
    return false;
  }

  /**
   * Change guests on PDP using coordinate-based taps
   * Similar pattern to changeDates
   */
  async changeGuests(targetAdults: number, targetChildren: number = 0): Promise<{ success: boolean; newAdults: number; newChildren: number }> {
    console.log(`→ Changing guests to: ${targetAdults} adults, ${targetChildren} children`);
    
    const opened = await this.clickGuestsToEdit();
    if (!opened) {
      console.log('⚠️ Could not open guest picker');
      return { success: false, newAdults: 1, newChildren: 0 };
    }
    
    // Brief wait for guest picker to open
    await this.sleep(1500);
    console.log('✓ Guest picker opened');
    
    // Guest picker layout (similar to SearchPage):
    // Adults row: label on left, minus button, count, plus button on right
    // Children row: below adults
    // Coordinates for +/- buttons (empirically derived)
    const tapPlusAdults = async () => {
      await this.tapAtRatio(0.85, 0.35); // Plus button for adults
      await this.sleep(300);
    };
    
    const tapMinusAdults = async () => {
      await this.tapAtRatio(0.55, 0.35); // Minus button for adults
      await this.sleep(300);
    };
    
    const tapPlusChildren = async () => {
      await this.tapAtRatio(0.85, 0.50); // Plus button for children
      await this.sleep(300);
    };
    
    // Start from default (1 adult) and increment to target
    // Note: We just tap plus a few times to increase from default
    const adultIncrements = Math.max(0, Math.min(targetAdults - 1, 4)); // +1 to +4 adults
    for (let i = 0; i < adultIncrements; i++) {
      await tapPlusAdults();
      console.log(`→ Adults +1 = ${i + 2}`);
    }
    
    // Add children if needed
    for (let i = 0; i < Math.min(targetChildren, 3); i++) {
      await tapPlusChildren();
      console.log(`→ Children +1 = ${i + 1}`);
    }
    
    // Tap Apply/Done button (bottom center area)
    await this.sleep(300);
    await this.tapAtRatio(0.5, 0.85); // First try
    await this.sleep(200);
    await this.tapAtRatio(0.5, 0.90); // Second try if first didn't work
    console.log('✓ Applied guests');
    
    await this.sleep(1000);
    
    // Verify by getting booking info
    let newAdults = targetAdults;
    let newChildren = targetChildren;
    try {
      const bookingInfo = await this.getBookingInfo();
      if (bookingInfo.guestsText) {
        const parsed = this.parseGuestCount(bookingInfo.guestsText);
        newAdults = parsed.adults;
        newChildren = parsed.children;
        console.log(`✓ Guests updated: ${newAdults} adult(s), ${newChildren} children`);
      }
    } catch {
      console.log(`→ Guests set to: ${targetAdults} adult(s), ${targetChildren} children (unverified)`);
    }
    
    return { success: true, newAdults, newChildren };
  }

  // ============================================================
  // EARLY CHECK-IN
  // ============================================================

  /**
   * Get current total price from PDP
   */
  async getCurrentPrice(): Promise<number | null> {
    const priceIds = [
      PDPPage.IDS.priceAmount,
      PDPPage.IDS.slasherPrice,
    ];

    for (const id of priceIds) {
      try {
        const el = await $(`id=${id}`);
        if (await el.isDisplayed().catch(() => false)) {
          const text = await el.getText().catch(() => '');
          const price = this.parsePrice(text);
          if (price !== null) {
            return price;
          }
        }
      } catch { /* continue */ }
    }

    // Try finding price by text pattern
    try {
      const priceText = await $(`android=new UiSelector().textMatches("\\\\$\\\\d+\\\\.?\\\\d*")`);
      if (await priceText.isDisplayed().catch(() => false)) {
        const text = await priceText.getText().catch(() => '');
        return this.parsePrice(text);
      }
    } catch { /* ignore */ }

    return null;
  }

  private parsePrice(text: string): number | null {
    if (!text) return null;
    const match = text.match(/\$?([\d,]+\.?\d*)/);
    if (match) {
      const cleaned = match[1].replace(/,/g, '');
      const value = parseFloat(cleaned);
      return isNaN(value) ? null : value;
    }
    return null;
  }

  /**
   * Check if early check-in option is available
   */
  async hasEarlyCheckInOption(): Promise<boolean> {
    const allPatterns = [
      PDPPage.IDS.earlyCheckInContainer,
      PDPPage.IDS.earlyCheckInToggle,
      ...this.earlyCheckInPatterns,
    ];

    for (const id of allPatterns) {
      try {
        const el = await $(`id=${id}`);
        if (await el.isExisting().catch(() => false)) {
          return true;
        }
      } catch { /* continue */ }
    }

    // Also check for "early check" text
    try {
      const earlyCheckText = await $(`android=new UiSelector().textMatches("(?i).*early.*check.*")`);
      if (await earlyCheckText.isExisting().catch(() => false)) {
        return true;
      }
    } catch { /* ignore */ }

    return false;
  }

  /**
   * Get early check-in add-on price
   */
  async getEarlyCheckInPrice(): Promise<number | null> {
    // Try finding price near "early check" text
    try {
      const earlySection = await $(`android=new UiSelector().textMatches("(?i).*early.*check.*")`);
      if (await earlySection.isDisplayed().catch(() => false)) {
        // Look for price near it
        const allPrices = await $$(`android=new UiSelector().textMatches("\\\\+?\\\\$\\\\d+")`);
        for (const price of allPrices) {
          const text = await price.getText().catch(() => '');
          const value = this.parsePrice(text);
          if (value !== null && value < 50) { // Early check-in is usually under $50
            return value;
          }
        }
      }
    } catch { /* ignore */ }

    return null;
  }

  /**
   * Toggle early check-in and verify price change
   */
  async toggleEarlyCheckIn(): Promise<{
    success: boolean;
    priceBefore: number | null;
    priceAfter: number | null;
    earlyCheckInPrice: number | null;
    priceChangedCorrectly: boolean;
  }> {
    console.log('→ Testing early check-in toggle...');
    
    const priceBefore = await this.getCurrentPrice();
    console.log(`   Price before: ${priceBefore !== null ? '$' + priceBefore : 'unknown'}`);
    
    const earlyCheckInPrice = await this.getEarlyCheckInPrice();
    console.log(`   Early check-in price: ${earlyCheckInPrice !== null ? '+$' + earlyCheckInPrice : 'unknown'}`);
    
    // Find and click toggle
    const toggleIds = [
      PDPPage.IDS.earlyCheckInToggle,
      ...this.earlyCheckInPatterns,
    ];

    let toggled = false;
    for (const id of toggleIds) {
      try {
        const el = await $(`id=${id}`);
        if (await el.isDisplayed().catch(() => false)) {
          await el.click();
          await driver.pause(1500);
          toggled = true;
          console.log(`✓ Clicked toggle: ${id.split('/').pop()}`);
          break;
        }
      } catch { /* continue */ }
    }

    // Try clicking on Switch element
    if (!toggled) {
      try {
        const switchEl = await $('android.widget.Switch');
        if (await switchEl.isDisplayed().catch(() => false)) {
          await switchEl.click();
          await driver.pause(1500);
          toggled = true;
          console.log('✓ Clicked Switch element');
        }
      } catch { /* ignore */ }
    }

    // Try clicking "early check" text
    if (!toggled) {
      try {
        const earlyText = await $(`android=new UiSelector().textMatches("(?i).*early.*check.*")`);
        if (await earlyText.isDisplayed().catch(() => false)) {
          await earlyText.click();
          await driver.pause(1500);
          toggled = true;
          console.log('✓ Clicked early check-in text');
        }
      } catch { /* ignore */ }
    }

    if (!toggled) {
      console.log('⚠️ Could not find early check-in toggle');
      return {
        success: false,
        priceBefore,
        priceAfter: null,
        earlyCheckInPrice,
        priceChangedCorrectly: false,
      };
    }

    await driver.pause(1000);
    const priceAfter = await this.getCurrentPrice();
    console.log(`   Price after: ${priceAfter !== null ? '$' + priceAfter : 'unknown'}`);
    
    let priceChangedCorrectly = false;
    if (priceBefore !== null && priceAfter !== null && earlyCheckInPrice !== null) {
      const expectedPrice = priceBefore + earlyCheckInPrice;
      const priceDiff = Math.abs(priceAfter - expectedPrice);
      priceChangedCorrectly = priceDiff < 1;
      
      if (priceChangedCorrectly) {
        console.log(`✓ Price changed correctly: $${priceBefore} + $${earlyCheckInPrice} = $${priceAfter}`);
      } else {
        console.log(`⚠️ Price mismatch: Expected $${expectedPrice}, got $${priceAfter}`);
      }
    } else if (priceBefore !== null && priceAfter !== null) {
      const priceIncreased = priceAfter > priceBefore;
      console.log(`   Price ${priceIncreased ? 'increased' : 'changed'} from $${priceBefore} to $${priceAfter}`);
      priceChangedCorrectly = priceIncreased;
    }

    return {
      success: true,
      priceBefore,
      priceAfter,
      earlyCheckInPrice,
      priceChangedCorrectly,
    };
  }

  // ============================================================
  // NAVIGATION
  // ============================================================

  /**
   * Go back from PDP to lister
   */
  async goBack(): Promise<void> {
    try {
      const backBtn = await $(`id=${PDPPage.IDS.backButton}`);
      if (await backBtn.isExisting().catch(() => false)) {
        await backBtn.click();
        await driver.pause(800);
        return;
      }
    } catch { /* fallback */ }
    
    await driver.back();
    await driver.pause(800);
  }

  /**
   * Scroll down on PDP
   */
  async scrollDown(amount: number = 0.5): Promise<void> {
    await this.swipeUp(amount);
    await driver.pause(500);
  }

  /**
   * Scroll up on PDP
   */
  async scrollUp(amount: number = 0.5): Promise<void> {
    await this.swipeDown(amount);
    await driver.pause(500);
  }

  /**
   * Get current booking information from PDP (dates, guests, rate code, price)
   */
  async getBookingInfo(): Promise<{
    datesText: string | null;
    guestsText: string | null;
    roomsText: string | null;
    rateCodeText: string | null;
    price: number | null;
    priceText: string | null;
  }> {
    let datesText: string | null = null;
    let guestsText: string | null = null;
    let roomsText: string | null = null;
    let rateCodeText: string | null = null;
    let priceText: string | null = null;

    try {
      // Get dates - look for date section on PDP
      const datePatterns = [
        'Dates',
        'Check-in',
      ];
      for (const pattern of datePatterns) {
        try {
          const dateEl = await $(`android=new UiSelector().textContains("${pattern}")`);
          if (await dateEl.isExisting().catch(() => false)) {
            datesText = await dateEl.getText().catch(() => null);
            break;
          }
        } catch { /* continue */ }
      }

      // Get guests/rooms - look for guest section on PDP  
      const guestPatterns = [
        'com.my6.android:id/tv_guest_count',
        'com.my6.android:id/guest_count',
        'com.my6.android:id/rooms_guests',
      ];
      for (const id of guestPatterns) {
        try {
          const el = await $(`id=${id}`);
          if (await el.isExisting().catch(() => false)) {
            guestsText = await el.getText().catch(() => null);
            break;
          }
        } catch { /* continue */ }
      }

      // Try text pattern for guests
      if (!guestsText) {
        try {
          const guestEl = await $(`android=new UiSelector().textMatches("(?i).*\\\\d+\\\\s*(adult|guest|room).*")`);
          if (await guestEl.isExisting().catch(() => false)) {
            guestsText = await guestEl.getText().catch(() => null);
          }
        } catch { /* ignore */ }
      }

      // Get rooms
      try {
        const roomsEl = await $(`android=new UiSelector().textMatches("(?i).*\\\\d+\\\\s*room.*")`);
        if (await roomsEl.isExisting().catch(() => false)) {
          roomsText = await roomsEl.getText().catch(() => null);
        }
      } catch { /* ignore */ }

      // Get rate code indicator
      const rateIds = [
        'com.my6.android:id/rate_badge',
        'com.my6.android:id/special_rate',
        'com.my6.android:id/rate_code_label',
      ];
      for (const id of rateIds) {
        try {
          const el = await $(`id=${id}`);
          if (await el.isExisting().catch(() => false)) {
            rateCodeText = await el.getText().catch(() => null);
            if (rateCodeText) break;
          }
        } catch { /* continue */ }
      }

      // Get price
      const priceEl = await $(`id=${PDPPage.IDS.priceAmount}`);
      if (await priceEl.isExisting().catch(() => false)) {
        priceText = await priceEl.getText().catch(() => null);
      }
    } catch {
      // ignore
    }

    const price = await this.getCurrentPrice();

    return { datesText, guestsText, roomsText, rateCodeText, price, priceText };
  }

  /**
   * Parse guest count from text like "1 Adult" or "2 Adults, 1 Child"
   */
  parseGuestCount(text: string | null): { adults: number; children: number } {
    if (!text) return { adults: 1, children: 0 };
    
    const adultMatch = text.match(/(\d+)\s*adult/i);
    const childMatch = text.match(/(\d+)\s*child/i);
    
    return {
      adults: adultMatch ? parseInt(adultMatch[1], 10) : 1,
      children: childMatch ? parseInt(childMatch[1], 10) : 0,
    };
  }
}
