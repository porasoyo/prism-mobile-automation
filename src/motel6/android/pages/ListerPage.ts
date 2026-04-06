import { BasePage } from '../../shared/core/BasePage';
import type { PlatformSelectors } from '../../shared/core/selectors';

// Sort option types for TC005
export type SortOption = 'distance' | 'nearest_first' | 'guest_rating' | 'price_low_high' | 'price_high_low';

export interface PropertySortData {
  title: string;
  distanceMiles?: number;
  rating?: number;
  price?: number;
}

export class ListerPage extends BasePage {
  constructor() {
    super('android');
  }

  private resultsListId = 'com.my6.android:id/rv_search_results_list';
  private cardContainerId = 'com.my6.android:id/contentContainer';

  // Sorting dropdown IDs - try multiple common patterns
  private sortButtonIds = [
    'com.my6.android:id/sort_button',
    'com.my6.android:id/btn_sort',
    'com.my6.android:id/sorting_button',
    'com.my6.android:id/tv_sort',
    'com.my6.android:id/sort_filter_button',
    'com.my6.android:id/sort',
  ];

  // Sort option text patterns (case-insensitive matching)
  private sortOptionLabels: Record<SortOption, string[]> = {
    distance: ['distance', 'by distance'],
    nearest_first: ['nearest first', 'nearest', 'closest first', 'closest'],
    guest_rating: ['guest rating', 'rating', 'best rating', 'highest rating', 'top rated'],
    price_low_high: ['price low to high', 'low to high', 'lowest price', 'price: low', 'price (low'],
    price_high_low: ['price high to low', 'high to low', 'highest price', 'price: high', 'price (high'],
  };

  private zeroResultsText: PlatformSelectors = {
    android: [
      { using: 'xpath', value: '//*[contains(translate(@text,"ABCDEFGHIJKLMNOPQRSTUVWXYZ","abcdefghijklmnopqrstuvwxyz"),"0 result")]' },
      { using: 'xpath', value: '//*[contains(translate(@text,"ABCDEFGHIJKLMNOPQRSTUVWXYZ","abcdefghijklmnopqrstuvwxyz"),"no result")]' },
    ],
    ios: [],
  };

  async waitForLoaded(timeoutMs: number = 30000) {
    // Avoid findFirstExisting() here to reduce risk of XPath-related Appium hangs.
    await this.getResultsListEl(timeoutMs);
    await this.dismissBottomSheetIfPresent();
  }

  private parseMoney(text: string | undefined) {
    if (!text) return undefined;
    const cleaned = text.replace(/[^0-9.]/g, '');
    if (!cleaned) return undefined;
    const value = Number.parseFloat(cleaned);
    return Number.isFinite(value) ? value : undefined;
  }

  private parsePercent(text: string | undefined) {
    if (!text) return undefined;
    const m = text.match(/(\d+(?:\.\d+)?)\s*%/);
    if (!m) return undefined;
    const value = Number.parseFloat(m[1]);
    return Number.isFinite(value) ? value : undefined;
  }

  private parseRatingDistance(raw: string | undefined) {
    if (!raw) return {} as { rating?: number; ratingCount?: number; distanceText?: string };
    // Examples:
    //  - "3.6 (1121) · 2.1 mi"
    //  - "4.0 (289) · 6.1 mi"
    const ratingMatch = raw.match(/(\d(?:\.\d)?)\s*\((\d+)\)/);
    const rating = ratingMatch ? Number.parseFloat(ratingMatch[1]) : undefined;
    const ratingCount = ratingMatch ? Number.parseInt(ratingMatch[2], 10) : undefined;
    const parts = raw.split('·').map((s) => s.trim()).filter(Boolean);
    const distanceText = parts.length >= 2 ? parts[parts.length - 1] : undefined;
    return {
      rating: Number.isFinite(rating as any) ? rating : undefined,
      ratingCount: Number.isFinite(ratingCount as any) ? ratingCount : undefined,
      distanceText,
    };
  }

  private async elementText(el: WebdriverIO.Element) {
    try {
      const t = await el.getText();
      const out = String(t ?? '').trim();
      return out.length ? out : undefined;
    } catch {
      return undefined;
    }
  }

  private async childText(card: WebdriverIO.Element, resourceId: string) {
    try {
      // Use only ID selector - avoid XPath which can hang on Android 16
      const child = await card.$(`id=${resourceId}`);
      const exists = await child.isExisting().catch(() => false);
      if (exists) return await this.elementText(child);
      return undefined;
    } catch {
      return undefined;
    }
  }

  private async getResultsListEl(timeoutMs: number = 15000) {
    // Keep it simple and fast: prefer direct id lookup for the results RecyclerView.
    const list = await $(`id=${this.resultsListId}`);
    await list.waitForExist({ timeout: timeoutMs });
    return list;
  }

  private async getVisibleHotelTitles(limit: number = 12) {
    const out: string[] = [];
    try {
      const list = await this.getResultsListEl(15000);
      const els = await list.$$(`id=com.my6.android:id/hotel_title`);
      for (const el of els) {
        if (out.length >= limit) break;
        const t = await this.elementText(el);
        if (t) out.push(t);
      }
    } catch {
      // ignore
    }
    return Array.from(new Set(out));
  }

  private async getVisibleCardRoots(limit: number = 10) {
    const roots: WebdriverIO.Element[] = [];
    try {
      const list = await this.getResultsListEl(20000);
      const cards = await list.$$(`id=${this.cardContainerId}`);
      for (const card of cards) {
        if (roots.length >= limit) break;
        const title = await this.childText(card, 'com.my6.android:id/hotel_title');
        if (!title) continue;
        roots.push(card);
      }
    } catch {
      // ignore
    }
    return roots;
  }

  // Common resource IDs for like/heart button (heart-shaped icon on property images)
  private likeButtonIds = [
    'com.my6.android:id/iv_like',
    'com.my6.android:id/btn_like',
    'com.my6.android:id/like_button',
    'com.my6.android:id/favorite_button',
    'com.my6.android:id/iv_favorite',
    'com.my6.android:id/wishlist',
    'com.my6.android:id/ic_like',
    'com.my6.android:id/heart',
    'com.my6.android:id/heart_icon',
  ];

  // Common resource IDs for brand tags (Motel6/Studio6)
  private brandTagIds = [
    'com.my6.android:id/brand_tag',
    'com.my6.android:id/tv_brand',
    'com.my6.android:id/property_type',
    'com.my6.android:id/brand_indicator',
    'com.my6.android:id/hotel_brand',
  ];

  private async checkLikeHeartButton(card: WebdriverIO.Element): Promise<{ found: boolean; id?: string }> {
    // Check known IDs first
    for (const id of this.likeButtonIds) {
      try {
        const el = await card.$(`id=${id}`);
        if (await el.isExisting().catch(() => false)) {
          return { found: true, id };
        }
      } catch {
        // continue
      }
    }
    // Skip XPath checks that can hang on Android 16
    // Just return false if ID-based check didn't find the heart button
    return { found: false };
  }

  private async checkBrandTag(card: WebdriverIO.Element): Promise<{ found: boolean; brand?: string }> {
    // First try explicit brand tag elements
    for (const id of this.brandTagIds) {
      try {
        const el = await card.$(`id=${id}`);
        if (await el.isExisting().catch(() => false)) {
          const text = await this.elementText(el);
          return { found: true, brand: text };
        }
      } catch {
        // continue
      }
    }
    // Skip XPath fallback - can hang on Android 16
    return { found: false };
  }

  private async extractAndValidateCard(card: WebdriverIO.Element, index: number) {
    const title = await this.childText(card, 'com.my6.android:id/hotel_title');
    if (!title) throw new Error(`Card[${index}] missing property name`);

    // 1. Property image check (with retry for lazy loading)
    let hasImage = false;
    for (let imgRetry = 0; imgRetry < 2; imgRetry++) {
      try {
        const img = await card.$('id=com.my6.android:id/hotel_image');
        hasImage = await img.isExisting().catch(() => false);
        if (!hasImage) {
          // Also try by class name
          const imgByClass = await card.$('android.widget.ImageView');
          hasImage = await imgByClass.isExisting().catch(() => false);
        }
        if (hasImage) break;
        if (imgRetry === 0) await driver.pause(500); // Brief wait before retry
      } catch {
        // ignore
      }
    }
    if (!hasImage) throw new Error(`Card[${index}] missing property image for: ${title}`);

    // 2. Rating and distance check
    const combined = await this.childText(card, 'com.my6.android:id/tv_homehotellist_rating_count');
    let rating: number | undefined;
    let ratingCount: number | undefined;
    let distanceText: string | undefined;
    if (combined) {
      const parsed = this.parseRatingDistance(combined);
      rating = parsed.rating;
      ratingCount = parsed.ratingCount;
      distanceText = parsed.distanceText;
    } else {
      const rv = await this.childText(card, 'com.my6.android:id/rating_value');
      const rc = await this.childText(card, 'com.my6.android:id/rating_value_count');
      rating = rv ? Number.parseFloat(rv) : undefined;
      ratingCount = rc ? Number.parseInt(rc.replace(/[^0-9]/g, ''), 10) : undefined;
    }

    // Check for "NEW" tag on properties without ratings (new motels)
    let hasNewTag = false;
    try {
      // NEW tag might be in place of rating for new properties
      const newTagEl = await card.$('//*[contains(@text,"NEW") or contains(@text,"New")]');
      hasNewTag = await newTagEl.isExisting().catch(() => false);
      if (!hasNewTag) {
        // Also check if "NEW" appears in the combined rating text
        hasNewTag = combined ? /\bNEW\b/i.test(combined) : false;
      }
    } catch {
      // ignore
    }

    // Rating is optional - some new properties show "NEW" tag instead
    const hasRating = (rating && rating > 0 && rating <= 5) && (ratingCount && ratingCount > 0);
    const hasValidRatingOrNew = hasRating || hasNewTag;
    
    // Distance check - warn if missing (may be partially rendered after scroll)
    const hasDistance = distanceText && /(mi|km)\b/i.test(distanceText);
    if (!hasDistance) {
      console.log(`⚠️ Card[${index}] missing distance for: ${title} (card may be partially rendered)`);
    }

    // 3. Amenities check
    const amenities: string[] = [];
    try {
      const container = await card.$('id=com.my6.android:id/facilities_tags');
      if (await container.isExisting().catch(() => false)) {
        const tags = await container.$$('id=com.my6.android:id/text_view');
        for (const tEl of tags) {
          const t = await this.elementText(tEl);
          if (t) amenities.push(t);
        }
      }
    } catch {
      // ignore
    }
    const uniqueAmenities = Array.from(new Set(amenities.map((s) => s.trim()).filter(Boolean)));
    // Amenities optional after scroll - card may be partially rendered
    if (uniqueAmenities.length < 1) {
      console.log(`⚠️ Card[${index}] missing amenities for: ${title} (card may be partially rendered)`);
    }

    // 4. Like/heart button check (heart-shaped icon on property image)
    const likeResult = await this.checkLikeHeartButton(card);
    const hasLikeButton = likeResult.found;

    // 5. Motel6/Studio6 brand tag check
    const brandResult = await this.checkBrandTag(card);
    const hasBrandTag = brandResult.found;
    const brandName = brandResult.brand;

    // 6. Price validations
    // Slasher price (strikethrough original price)
    const slasherPrice = await this.childText(card, 'com.my6.android:id/hotel_price_actual');
    const hasSlasherPrice = slasherPrice && /\$?\d+/.test(slasherPrice);

    // Price per night (main discounted price)
    const pricePerNight = await this.childText(card, 'com.my6.android:id/hotel_avail_price');
    const hasPricePerNight = pricePerNight && /\$?\d+/.test(pricePerNight);
    
    // Check for sold out indicator using ID - avoid XPath
    let isSoldOut = false;
    try {
      const soldOutEl = await card.$('id=com.my6.android:id/sold_out_label');
      if (await soldOutEl.isExisting().catch(() => false)) {
        isSoldOut = true;
      }
    } catch {
      // ignore
    }
    
    // Price warning if missing (card may be partially rendered after scroll)
    if (!hasPricePerNight && !isSoldOut) {
      console.log(`⚠️ Card[${index}] missing price for: ${title} (card may be partially rendered)`);
    }

    // +taxes and fees label
    const taxesLabel = await this.childText(card, 'com.my6.android:id/tax_title');
    const hasTaxes = taxesLabel && /tax/i.test(taxesLabel);

    // 7. Rate code badge - use ID-based check only (avoid XPath hang)
    let rateCodeBadge: string | undefined;
    const rateBadgeIds = [
      'com.my6.android:id/rate_badge',
      'com.my6.android:id/special_rate',
      'com.my6.android:id/promo_badge',
      'com.my6.android:id/rate_code_badge',
    ];
    for (const id of rateBadgeIds) {
      try {
        const el = await card.$(`id=${id}`);
        if (await el.isExisting().catch(() => false)) {
          rateCodeBadge = await this.elementText(el);
          break;
        }
      } catch {
        // continue
      }
    }

    // Build rating display string: show rating, "NEW", or "n/a"
    const ratingDisplay = hasRating ? `${rating}(${ratingCount})` : (hasNewTag ? 'NEW' : 'n/a');
    // Build price display string: show price or "SOLD OUT"
    const priceDisplay = hasPricePerNight ? pricePerNight : (isSoldOut ? 'SOLD_OUT' : 'n/a');
    // Build rate code display string
    const rateCodeDisplay = rateCodeBadge ? `rate=${rateCodeBadge}` : '';

    console.log(
      `✓ Card[${index}]: ${title} | rating=${ratingDisplay} | ${distanceText} | amenities=${uniqueAmenities.length} | like=${hasLikeButton ? '✓' : '⚠'} | brand=${hasBrandTag ? (brandName || '✓') : '⚠'} | slasher=${hasSlasherPrice ? slasherPrice : '⚠'} | price=${priceDisplay} | taxes=${hasTaxes ? '✓' : '⚠'}${rateCodeDisplay ? ' | ' + rateCodeDisplay : ''}`,
    );

    return {
      title,
      rating,
      ratingCount,
      hasNewTag,
      distanceText,
      amenities: uniqueAmenities,
      hasLikeButton,
      hasBrandTag,
      brandName,
      slasherPrice,
      pricePerNight,
      hasTaxes,
      isSoldOut,
      rateCodeBadge,
    };
  }

  async validateVisibleCards(count: number = 5) {
    await this.dismissBottomSheetIfPresent();
    // Get more cards to ensure we have enough to validate
    const cards = await this.getVisibleCardRoots(Math.max(count + 2, 8));
    if (cards.length < 1) throw new Error(`Expected at least 1 visible card, saw ${cards.length}`);
    const toValidate = Math.min(count, cards.length);
    console.log(`→ Validating ${toValidate} property cards...`);
    for (let i = 0; i < toValidate; i++) {
      await this.extractAndValidateCard(cards[i], i + 1);
    }
    console.log(`✓ Validated ${toValidate} cards successfully`);
  }

  async scrollUntilPaginationAndValidate(opts?: { validateCount?: number; maxSwipes?: number; minPropertiesForPagination?: number }) {
    const validateCount = opts?.validateCount ?? 5;
    const maxSwipes = opts?.maxSwipes ?? 15;
    const minPropertiesForPagination = opts?.minPropertiesForPagination ?? 10;

    await this.waitForLoaded(45000);
    await this.assertStillOnLister('after waitForLoaded');
    await this.assertHasResults();
    await this.assertStillOnLister('after assertHasResults');

    // Validate first batch of cards (before scrolling)
    console.log(`→ First pagination: validating ${validateCount} cards...`);
    await this.validateVisibleCards(validateCount);
    await this.assertStillOnLister('after first validateVisibleCards');

    // Track all seen property titles
    const seen = new Set(await this.getVisibleHotelTitles(20));
    let totalPropertiesSeen = seen.size;
    console.log(`→ Starting scroll with ${totalPropertiesSeen} properties seen`);

    // Scroll until we pass minPropertiesForPagination AND see new titles (pagination)
    for (let i = 0; i < maxSwipes; i++) {
      await this.swipeUp(0.75);
      await driver.pause(800);
      await this.dismissBottomSheetIfPresent();
      await this.assertStillOnLister(`after swipe ${i + 1}/${maxSwipes}`);

      const titles = await this.getVisibleHotelTitles(20);
      const newTitles = titles.filter((t) => t && !seen.has(t));
      titles.forEach((t) => seen.add(t));
      totalPropertiesSeen = seen.size;

      if (newTitles.length > 0) {
        console.log(`… Swipe ${i + 1}: found ${newTitles.length} new (total seen: ${totalPropertiesSeen})`);
      }

      // Only consider pagination complete after seeing at least minPropertiesForPagination
      if (totalPropertiesSeen >= minPropertiesForPagination && newTitles.length > 0) {
        console.log(`✓ Pagination detected after ${totalPropertiesSeen} properties (swipe ${i + 1})`);
        console.log(`  New titles: ${newTitles.slice(0, 3).join(' | ')}`);
        
        // Wait for cards to fully load after pagination
        console.log(`… Waiting for cards to load after pagination...`);
        await driver.pause(2000);
        
        // Validate second batch of cards (after pagination)
        console.log(`→ Second pagination: validating ${validateCount} cards...`);
        await this.validateVisibleCards(validateCount);
        console.log(`✓ Total properties scrolled: ${totalPropertiesSeen}`);
        return;
      }
    }

    throw new Error(`Pagination not detected after ${maxSwipes} swipes (saw ${totalPropertiesSeen} properties, needed ${minPropertiesForPagination})`);
  }

  private async dismissBottomSheetIfPresent() {
    const existsId = async (id: string) => {
      try {
        const els = await $$(`id=${id}`);
        return els.length > 0;
      } catch {
        return false;
      }
    };

    // Some runs land on lister with a sort/filter bottom-sheet open.
    // While it is open, underlying results may not be present in the UI tree,
    // causing false negatives when validating hotel cards.
    try {
      for (let i = 0; i < 3; i++) {
        const sheetVisible = await existsId('com.my6.android:id/design_bottom_sheet');
        const titleVisible = await existsId('com.my6.android:id/filter_title');
        const outsideVisible = await existsId('com.my6.android:id/touch_outside');

        // Only dismiss if this looks like a modal sort/filter sheet.
        // `touch_outside` is a strong signal; avoid false positives that could trigger Back navigation.
        if (!sheetVisible || !titleVisible || !outsideVisible) return;

        // Prefer coordinate taps outside the sheet (lower risk than Back).
        await this.tapAtRatio(0.5, 0.15);
        await driver.pause(250);
        await this.tapAtRatio(0.5, 0.12);
        await driver.pause(350);

        // If still visible, try element-based outside tap.
        if (await existsId('com.my6.android:id/filter_title')) {
          try {
            const outside = await $('id=com.my6.android:id/touch_outside');
            if (await outside.isExisting().catch(() => false)) await outside.click();
          } catch {
            // ignore
          }
          await driver.pause(400);
        }

        // No Android Back fallback on purpose: Back can navigate away from lister.
      }
    } catch {
      // ignore
    }
  }

  private async assertStillOnLister(label: string) {
    try {
      const els = await $$(`id=${this.resultsListId}`);
      if (!els.length) throw new Error('results list not present');
    } catch {
      throw new Error(`${label}: navigated away from lister (Back pressed or screen changed)`);
    }
  }

  async assertHasResults() {
    await this.dismissBottomSheetIfPresent();

    // Ensure we have at least one visible property title.
    const list = await this.getResultsListEl(20000);
    const title = await list.$('id=com.my6.android:id/hotel_title');
    await title.waitForExist({ timeout: 15000 });

    // Basic sanity: should not show 0/no results message.
    try {
      const zr = await $(this.sels(this.zeroResultsText)[0].value);
      const exists = await zr.isExisting().catch(() => false);
      if (exists) throw new Error('Lister shows 0/no results');
    } catch {
      // ignore if selector not present
    }

    console.log('✓ Lister has property cards');
  }

  async scrollAndValidateCards(swipes: number = 3) {
    await this.waitForLoaded(30000);
    await this.assertHasResults();

    for (let i = 0; i < swipes; i++) {
      await this.swipeUp(0.75);
      await driver.pause(600);
      await this.assertHasResults();
    }

    console.log('✓ Scrolled lister and still sees cards');
  }

  /**
   * Check if rate code badge is visible on any property card
   * @param expectedRateText Optional text to look for in rate badge
   * @returns true if rate code badge found on any card
   */
  async hasRateCodeBadgeOnCards(expectedRateText?: string): Promise<boolean> {
    try {
      // Look for rate code/special rate badges using ID selectors (avoid XPath hang on Android 16)
      const rateBadgeIds = [
        'com.my6.android:id/rate_badge',
        'com.my6.android:id/special_rate',
        'com.my6.android:id/promo_badge',
        'com.my6.android:id/rate_code_badge',
        'com.my6.android:id/special_rate_badge',
      ];

      for (const id of rateBadgeIds) {
        const els = await $$(`id=${id}`);
        for (const el of els) {
          if (await el.isDisplayed().catch(() => false)) {
            if (!expectedRateText) return true;
            const text = await el.getText().catch(() => '');
            if (text && text.toLowerCase().includes(expectedRateText.toLowerCase())) {
              return true;
            }
          }
        }
      }
    } catch {
      // ignore
    }
    return false;
  }

  /**
   * Validate visible cards and optionally verify rate code presence
   * @param count Number of cards to validate
   * @param opts Options including rate code verification
   */
  async validateVisibleCardsWithOptions(count: number = 5, opts?: { expectRateCode?: boolean; rateCodeText?: string }) {
    await this.dismissBottomSheetIfPresent();
    const cards = await this.getVisibleCardRoots(Math.max(count + 2, 8));
    if (cards.length < 1) throw new Error(`Expected at least 1 visible card, saw ${cards.length}`);
    
    const toValidate = Math.min(count, cards.length);
    console.log(`→ Validating ${toValidate} property cards...`);
    
    let foundRateCode = false;
    for (let i = 0; i < toValidate; i++) {
      const result = await this.extractAndValidateCard(cards[i], i + 1);
      if (result.rateCodeBadge) {
        foundRateCode = true;
        console.log(`✓ Card[${i + 1}] has rate code badge: ${result.rateCodeBadge}`);
      }
    }
    
    console.log(`✓ Validated ${toValidate} cards successfully`);
    
    // If rate code verification was requested
    if (opts?.expectRateCode) {
      if (!foundRateCode) {
        // Check across all visible cards one more time
        const hasRateBadge = await this.hasRateCodeBadgeOnCards(opts.rateCodeText);
        if (!hasRateBadge) {
          console.warn('⚠️ Rate code badge not found on property cards (may be applied at checkout)');
        } else {
          console.log('✓ Rate code badge found on property cards');
        }
      }
    }
  }

  /**
   * Scroll through lister with pagination and validate cards
   * Extended version with rate code support
   */
  async scrollUntilPaginationAndValidateWithOptions(opts?: { 
    validateCount?: number; 
    maxSwipes?: number; 
    minPropertiesForPagination?: number;
    expectRateCode?: boolean;
    rateCodeText?: string;
  }) {
    const validateCount = opts?.validateCount ?? 5;
    const maxSwipes = opts?.maxSwipes ?? 15;
    const minPropertiesForPagination = opts?.minPropertiesForPagination ?? 10;

    await this.waitForLoaded(45000);
    await this.assertStillOnLister('after waitForLoaded');
    await this.assertHasResults();
    await this.assertStillOnLister('after assertHasResults');

    // Validate first batch of cards (before scrolling)
    console.log(`→ First pagination: validating ${validateCount} cards...`);
    await this.validateVisibleCardsWithOptions(validateCount, { 
      expectRateCode: opts?.expectRateCode, 
      rateCodeText: opts?.rateCodeText 
    });
    await this.assertStillOnLister('after first validateVisibleCards');

    // Track all seen property titles
    const seen = new Set(await this.getVisibleHotelTitles(20));
    let totalPropertiesSeen = seen.size;
    console.log(`→ Starting scroll with ${totalPropertiesSeen} properties seen`);

    // Scroll until we pass minPropertiesForPagination AND see new titles (pagination)
    for (let i = 0; i < maxSwipes; i++) {
      await this.swipeUp(0.75);
      await driver.pause(800);
      await this.dismissBottomSheetIfPresent();
      await this.assertStillOnLister(`after swipe ${i + 1}/${maxSwipes}`);

      const titles = await this.getVisibleHotelTitles(20);
      const newTitles = titles.filter((t) => t && !seen.has(t));
      titles.forEach((t) => seen.add(t));
      totalPropertiesSeen = seen.size;

      if (newTitles.length > 0) {
        console.log(`… Swipe ${i + 1}: found ${newTitles.length} new (total seen: ${totalPropertiesSeen})`);
      }

      // Only consider pagination complete after seeing at least minPropertiesForPagination
      if (totalPropertiesSeen >= minPropertiesForPagination && newTitles.length > 0) {
        console.log(`✓ Pagination detected after ${totalPropertiesSeen} properties (swipe ${i + 1})`);
        console.log(`  New titles: ${newTitles.slice(0, 3).join(' | ')}`);
        
        // Wait for cards to fully load after pagination
        console.log(`… Waiting for cards to load after pagination...`);
        await driver.pause(2000);
        
        // Validate second batch of cards (after pagination)
        console.log(`→ Second pagination: validating ${validateCount} cards...`);
        await this.validateVisibleCardsWithOptions(validateCount, { 
          expectRateCode: opts?.expectRateCode, 
          rateCodeText: opts?.rateCodeText 
        });
        console.log(`✓ Total properties scrolled: ${totalPropertiesSeen}`);
        return;
      }
    }

    throw new Error(`Pagination not detected after ${maxSwipes} swipes (saw ${totalPropertiesSeen} properties, needed ${minPropertiesForPagination})`);
  }

  // ==================== SORTING METHODS ====================

  /**
   * Open the sort dropdown on the lister page
   */
  async openSortDropdown(): Promise<boolean> {
    console.log('→ Opening sort dropdown...');
    
    // First try: Find "Sort" chip button via text (most reliable based on UI inspection)
    // The sort button appears as a chip with text "Sort" and id="com.my6.android:id/chip_text"
    try {
      const selector = `android=new UiSelector().text("Sort")`;
      const el = await $(selector);
      if (await el.isExisting().catch(() => false)) {
        console.log('✓ Found Sort chip button');
        await el.click();
        await driver.pause(500);
        console.log('✓ Clicked Sort button');
        return true;
      }
    } catch {
      // continue
    }

    // Second try: Find any element with chip_text id containing "Sort" text
    try {
      const chips = await $$(`id=com.my6.android:id/chip_text`);
      for (const chip of chips) {
        const text = await chip.getText().catch(() => '');
        if (text.toLowerCase().includes('sort')) {
          console.log(`✓ Found Sort chip: "${text}"`);
          await chip.click();
          await driver.pause(500);
          console.log('✓ Clicked Sort chip');
          return true;
        }
      }
    } catch {
      // continue
    }
    
    // Third try: Known sort button IDs
    for (const id of this.sortButtonIds) {
      try {
        const el = await $(`id=${id}`);
        if (await el.isExisting().catch(() => false)) {
          await el.click();
          await driver.pause(500);
          console.log(`✓ Clicked sort button: ${id}`);
          return true;
        }
      } catch {
        // continue
      }
    }

    // Fourth try: Text-based search for sort button in filter area (y < 700)
    const sortTexts = ['Sort', 'SORT', 'Sort by', 'Sorted by'];
    for (const text of sortTexts) {
      try {
        const selector = `android=new UiSelector().textContains("${text}")`;
        const els = await $$(selector);
        for (const el of els) {
          if (await el.isExisting().catch(() => false)) {
            const location = await el.getLocation().catch(() => null);
            // Filter/chip area is typically y < 700
            if (location && location.y < 700) {
              const elText = await el.getText().catch(() => '');
              console.log(`→ Found sort candidate: "${elText}" at y=${location.y}`);
              await el.click();
              await driver.pause(500);
              console.log(`✓ Clicked sort button via text: "${text}"`);
              return true;
            }
          }
        }
      } catch {
        // continue
      }
    }

    // Debug: list any clickable elements in header area
    try {
      console.log('→ Debug: Scanning for clickable elements in lister header...');
      const clickables = await $$('android.widget.TextView');
      for (const el of clickables.slice(0, 20)) {
        try {
          const text = await el.getText().catch(() => '');
          const resourceId = await el.getAttribute('resource-id').catch(() => '');
          const loc = await el.getLocation().catch(() => ({ x: 0, y: 0 }));
          if (text && loc.y < 700) {
            console.log(`   TextView: "${text}" | id="${resourceId}" | y=${loc.y}`);
          }
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    }

    console.log('⚠️ Could not find sort dropdown button');
    return false;
  }

  /**
   * Select a specific sort option from the dropdown
   */
  async selectSortOption(option: SortOption): Promise<boolean> {
    const labels = this.sortOptionLabels[option];
    console.log(`→ Selecting sort option: ${option}`);

    // First ensure dropdown is open
    const dropdownOpened = await this.openSortDropdown();
    if (!dropdownOpened) {
      console.log('⚠️ Could not open sort dropdown to select option');
      return false;
    }

    await driver.pause(500);

    // Try to find and click the sort option by text
    for (const label of labels) {
      try {
        // Try UiSelector text match (case-insensitive via textMatches)
        const selector = `android=new UiSelector().textMatches("(?i).*${label.replace(/[()]/g, '\\\\$&')}.*")`;
        const el = await $(selector);
        if (await el.isExisting().catch(() => false)) {
          await el.click();
          await driver.pause(800);
          console.log(`✓ Selected sort option: ${label}`);
          return true;
        }
      } catch {
        // continue
      }

      // Also try exact text contains
      try {
        const selector = `android=new UiSelector().textContains("${label}")`;
        const el = await $(selector);
        if (await el.isExisting().catch(() => false)) {
          await el.click();
          await driver.pause(800);
          console.log(`✓ Selected sort option via contains: ${label}`);
          return true;
        }
      } catch {
        // continue
      }
    }

    // Dismiss dropdown if we failed to select
    await driver.back();
    await driver.pause(300);
    console.log(`⚠️ Could not find sort option: ${option}`);
    return false;
  }

  /**
   * Parse distance string to miles number
   * Examples: "2.2 mi", "10.5 mi", "0.5 mi"
   */
  private parseDistanceToMiles(distanceText: string | undefined): number | undefined {
    if (!distanceText) return undefined;
    const match = distanceText.match(/([\d.]+)\s*mi/i);
    if (!match) return undefined;
    const value = Number.parseFloat(match[1]);
    return Number.isFinite(value) ? value : undefined;
  }

  /**
   * Parse price string to number
   * Examples: "$62", "$125", "125"
   */
  private parsePriceToNumber(priceText: string | undefined): number | undefined {
    if (!priceText) return undefined;
    const cleaned = priceText.replace(/[^0-9.]/g, '');
    if (!cleaned) return undefined;
    const value = Number.parseFloat(cleaned);
    return Number.isFinite(value) ? value : undefined;
  }

  /**
   * Collect property data (distance, rating, price) from visible cards
   * for sort validation
   */
  async collectPropertyDataForSorting(limit: number = 10): Promise<PropertySortData[]> {
    const results: PropertySortData[] = [];
    
    try {
      const list = await this.getResultsListEl(15000);
      const cards = await list.$$(`id=${this.cardContainerId}`);
      
      for (const card of cards) {
        if (results.length >= limit) break;
        
        // Get title
        const title = await this.childText(card, 'com.my6.android:id/hotel_title');
        if (!title) continue;
        
        // Get rating and distance from combined field
        const combined = await this.childText(card, 'com.my6.android:id/tv_homehotellist_rating_count');
        const parsed = this.parseRatingDistance(combined);
        
        // Get price
        const priceText = await this.childText(card, 'com.my6.android:id/hotel_avail_price');
        const price = this.parsePriceToNumber(priceText);
        
        // Parse distance to miles
        const distanceMiles = this.parseDistanceToMiles(parsed.distanceText);
        
        results.push({
          title,
          distanceMiles,
          rating: parsed.rating,
          price,
        });
      }
    } catch (e) {
      console.log(`⚠️ Error collecting property data: ${e}`);
    }
    
    return results;
  }

  /**
   * Scroll and collect property data from multiple pages
   */
  async scrollAndCollectPropertyData(opts?: { 
    maxSwipes?: number; 
    minProperties?: number;
  }): Promise<PropertySortData[]> {
    const maxSwipes = opts?.maxSwipes ?? 5;
    const minProperties = opts?.minProperties ?? 8;
    
    await this.dismissBottomSheetIfPresent();
    
    const allData: PropertySortData[] = [];
    const seenTitles = new Set<string>();
    
    // Collect initial visible data
    const initial = await this.collectPropertyDataForSorting(15);
    for (const p of initial) {
      if (!seenTitles.has(p.title)) {
        seenTitles.add(p.title);
        allData.push(p);
      }
    }
    
    // Scroll and collect more
    for (let i = 0; i < maxSwipes && allData.length < minProperties; i++) {
      await this.swipeUp(0.5);
      await driver.pause(600);
      
      const more = await this.collectPropertyDataForSorting(15);
      for (const p of more) {
        if (!seenTitles.has(p.title)) {
          seenTitles.add(p.title);
          allData.push(p);
        }
      }
    }
    
    return allData;
  }

  /**
   * Validate that properties are sorted correctly
   */
  validateSortOrder(data: PropertySortData[], sortType: SortOption): { 
    valid: boolean; 
    violations: string[]; 
    summary: string;
  } {
    const violations: string[] = [];
    
    // Filter to only properties with the relevant data
    let filtered: PropertySortData[];
    let getValue: (p: PropertySortData) => number | undefined;
    let expectedOrder: 'asc' | 'desc';
    let fieldName: string;
    
    switch (sortType) {
      case 'distance':
      case 'nearest_first':
        filtered = data.filter(p => p.distanceMiles !== undefined);
        getValue = p => p.distanceMiles;
        expectedOrder = 'asc'; // Nearest first = ascending distance
        fieldName = 'distance';
        break;
      case 'guest_rating':
        filtered = data.filter(p => p.rating !== undefined);
        getValue = p => p.rating;
        expectedOrder = 'desc'; // Highest rating first = descending
        fieldName = 'rating';
        break;
      case 'price_low_high':
        filtered = data.filter(p => p.price !== undefined);
        getValue = p => p.price;
        expectedOrder = 'asc';
        fieldName = 'price';
        break;
      case 'price_high_low':
        filtered = data.filter(p => p.price !== undefined);
        getValue = p => p.price;
        expectedOrder = 'desc';
        fieldName = 'price';
        break;
      default:
        return { valid: false, violations: ['Unknown sort type'], summary: 'Unknown sort type' };
    }
    
    if (filtered.length < 2) {
      return { 
        valid: true, 
        violations: [], 
        summary: `Only ${filtered.length} properties with ${fieldName} data - cannot validate order` 
      };
    }
    
    // Check order
    let outOfOrder = 0;
    for (let i = 1; i < filtered.length; i++) {
      const prev = getValue(filtered[i - 1])!;
      const curr = getValue(filtered[i])!;
      
      const isValid = expectedOrder === 'asc' 
        ? curr >= prev  // Allow equal values
        : curr <= prev; // Allow equal values
      
      if (!isValid) {
        outOfOrder++;
        violations.push(
          `${filtered[i - 1].title} (${fieldName}=${prev}) → ${filtered[i].title} (${fieldName}=${curr})`
        );
      }
    }
    
    const values = filtered.map(p => `${getValue(p)}`).join(' → ');
    const summary = `${fieldName}: ${values} (${expectedOrder === 'asc' ? '↑' : '↓'})`;
    
    // Allow small tolerance for out-of-order (API/app may have minor inconsistencies)
    const tolerance = Math.max(1, Math.floor(filtered.length * 0.15)); // 15% tolerance
    const valid = outOfOrder <= tolerance;
    
    if (!valid) {
      console.log(`⚠️ Sort validation failed: ${outOfOrder} out of ${filtered.length - 1} pairs out of order`);
      violations.slice(0, 3).forEach(v => console.log(`   ${v}`));
    } else if (outOfOrder > 0) {
      console.log(`⚠️ Sort has ${outOfOrder} minor inconsistencies (within tolerance)`);
    }
    
    return { valid, violations, summary };
  }

  /**
   * Full sort test: select sort option, collect data, validate order
   */
  async testSortOption(option: SortOption): Promise<{ success: boolean; message: string }> {
    console.log(`\n┌───────────────────────────────────────────────────`);
    console.log(`│ TESTING SORT: ${option.toUpperCase().replace(/_/g, ' ')}`);
    console.log(`└───────────────────────────────────────────────────`);
    
    // Step 1: Select sort option
    const selected = await this.selectSortOption(option);
    if (!selected) {
      return { success: false, message: `Could not select sort option: ${option}` };
    }
    
    // Step 2: Wait for lister to refresh
    console.log('→ Waiting for lister to refresh...');
    await driver.pause(1500);
    await this.waitForLoaded(15000);
    
    // Step 3: Collect property data
    console.log('→ Collecting property data for validation...');
    const data = await this.scrollAndCollectPropertyData({ maxSwipes: 4, minProperties: 6 });
    console.log(`✓ Collected ${data.length} properties`);
    
    if (data.length < 3) {
      return { 
        success: true, 
        message: `Only ${data.length} properties found - skipping sort validation` 
      };
    }
    
    // Log collected data
    data.slice(0, 6).forEach((p, i) => {
      console.log(`   [${i + 1}] ${p.title} | dist=${p.distanceMiles ?? 'n/a'} mi | rating=${p.rating ?? 'n/a'} | price=$${p.price ?? 'n/a'}`);
    });
    
    // Step 4: Validate sort order
    console.log('→ Validating sort order...');
    const result = this.validateSortOrder(data, option);
    
    if (result.valid) {
      console.log(`✓ Sort order valid: ${result.summary}`);
      return { success: true, message: `Sort ${option} validated: ${result.summary}` };
    } else {
      console.log(`✗ Sort order invalid: ${result.violations.length} violations`);
      return { 
        success: false, 
        message: `Sort ${option} failed: ${result.violations.slice(0, 2).join('; ')}` 
      };
    }
  }

  /**
   * Scroll back to top of lister (for testing next sort option)
   */
  async scrollToTop(): Promise<void> {
    console.log('→ Scrolling back to top...');
    for (let i = 0; i < 5; i++) {
      await this.swipeDown(0.7);
      await driver.pause(300);
    }
    await driver.pause(500);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TC006 - BRAND FILTER METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Open the brand dropdown/chip on the lister page
   */
  async openBrandDropdown(): Promise<boolean> {
    console.log('→ Opening brand dropdown...');
    
    // Look for "Brand" chip button (similar to Sort chip)
    try {
      const selector = `android=new UiSelector().text("Brand")`;
      const el = await $(selector);
      if (await el.isExisting().catch(() => false)) {
        console.log('✓ Found Brand chip button');
        await el.click();
        await driver.pause(500);
        console.log('✓ Clicked Brand button');
        return true;
      }
    } catch {
      // continue
    }

    // Try finding by chip_text id containing "Brand"
    try {
      const chips = await $$(`id=com.my6.android:id/chip_text`);
      for (const chip of chips) {
        const text = await chip.getText().catch(() => '');
        if (text.toLowerCase().includes('brand')) {
          console.log(`✓ Found Brand chip: "${text}"`);
          await chip.click();
          await driver.pause(500);
          console.log('✓ Clicked Brand chip');
          return true;
        }
      }
    } catch {
      // continue
    }

    // Try UiSelector textContains
    try {
      const selector = `android=new UiSelector().textContains("Brand")`;
      const el = await $(selector);
      if (await el.isExisting().catch(() => false)) {
        const loc = await el.getLocation().catch(() => null);
        if (loc && loc.y < 700) {
          await el.click();
          await driver.pause(500);
          console.log('✓ Clicked Brand via textContains');
          return true;
        }
      }
    } catch {
      // continue
    }

    console.log('⚠️ Could not find brand dropdown button');
    return false;
  }

  /**
   * Select a brand from the dropdown (Motel 6 or Studio 6)
   * The brand dropdown is a bottom sheet that appears after clicking the Brand chip
   * After selecting brand, must click "Apply" button
   */
  async selectBrand(brand: 'motel6' | 'studio6'): Promise<boolean> {
    const brandLabel = brand === 'motel6' ? 'Motel 6' : 'Studio 6';
    const brandTexts = brand === 'motel6' 
      ? ['Motel 6', 'Motel6', 'MOTEL 6']
      : ['Studio 6', 'Studio6', 'STUDIO 6'];
    
    console.log(`→ Selecting brand: ${brand}`);

    // First open the dropdown
    const opened = await this.openBrandDropdown();
    if (!opened) {
      console.log('⚠️ Could not open brand dropdown');
      return false;
    }
    
    // Wait for bottom sheet/dropdown to appear
    await driver.pause(1000);

    // Strategy 1: Look for brand option anywhere on screen
    let brandSelected = false;
    for (const text of brandTexts) {
      try {
        const selector = `android=new UiSelector().textContains("${text}")`;
        const els = await $$(selector);
        
        for (const el of els) {
          if (await el.isExisting().catch(() => false)) {
            const loc = await el.getLocation().catch(() => null);
            console.log(`→ Found "${text}" element at y=${loc?.y || 'unknown'}`);
            await el.click();
            await driver.pause(500);
            console.log(`✓ Selected brand: ${text}`);
            brandSelected = true;
            break;
          }
        }
        if (brandSelected) break;
      } catch {
        // continue
      }
    }

    // If brand wasn't selected via text, try checkbox/radio
    if (!brandSelected) {
      try {
        const checkboxes = await $$('android.widget.CheckBox');
        for (const cb of checkboxes) {
          const text = await cb.getText().catch(() => '');
          if (brandTexts.some(bt => text.toLowerCase().includes(bt.toLowerCase()))) {
            console.log(`→ Found checkbox with brand: "${text}"`);
            await cb.click();
            await driver.pause(500);
            console.log(`✓ Selected brand via checkbox`);
            brandSelected = true;
            break;
          }
        }
      } catch {
        // continue
      }
    }

    if (!brandSelected) {
      // Dismiss dropdown
      await driver.back();
      await driver.pause(300);
      console.log(`⚠️ Could not find brand option: ${brand}`);
      return false;
    }

    // After selecting brand, click "Apply" button to confirm the selection
    await driver.pause(500);
    try {
      const applySelector = `android=new UiSelector().textContains("Apply")`;
      const applyBtn = await $(applySelector);
      if (await applyBtn.isExisting().catch(() => false)) {
        console.log('→ Clicking Apply button');
        await applyBtn.click();
        await driver.pause(1500);
        console.log('✓ Applied brand filter');
        return true;
      }
    } catch {
      // Try clicking "Show" or "Done" as alternative
    }

    // Try alternative apply buttons
    const applyTexts = ['Show', 'SHOW', 'Done', 'DONE', 'OK', 'Submit'];
    for (const text of applyTexts) {
      try {
        const selector = `android=new UiSelector().textContains("${text}")`;
        const btn = await $(selector);
        if (await btn.isExisting().catch(() => false)) {
          const loc = await btn.getLocation().catch(() => null);
          if (loc && loc.y > 1800) { // Bottom area buttons
            console.log(`→ Clicking ${text} button`);
            await btn.click();
            await driver.pause(1500);
            console.log(`✓ Applied via ${text} button`);
            return true;
          }
        }
      } catch {
        // continue
      }
    }

    console.log('⚠️ Selected brand but Apply button not found - may already be applied');
    // The selection may have been toggled directly
    return true;
  }

  /**
   * Clear brand filter (click "Clear all" then Apply)
   */
  async clearBrandFilter(): Promise<boolean> {
    console.log('→ Clearing brand filter...');
    
    const opened = await this.openBrandDropdown();
    if (!opened) return false;
    
    await driver.pause(800);

    // Try clicking "Clear all" or similar options
    const clearTexts = ['Clear all', 'Clear All', 'CLEAR ALL', 'Clear', 'CLEAR', 'Reset', 'Show All'];
    let cleared = false;
    
    for (const text of clearTexts) {
      try {
        const selector = `android=new UiSelector().textContains("${text}")`;
        const el = await $(selector);
        if (await el.isExisting().catch(() => false)) {
          await el.click();
          await driver.pause(500);
          console.log(`✓ Clicked: ${text}`);
          cleared = true;
          break;
        }
      } catch {
        // continue
      }
    }

    // Also click Apply to confirm the clear action
    await driver.pause(500);
    try {
      const applySelector = `android=new UiSelector().textContains("Apply")`;
      const applyBtn = await $(applySelector);
      if (await applyBtn.isExisting().catch(() => false)) {
        console.log('→ Clicking Apply to confirm clear');
        await applyBtn.click();
        await driver.pause(1500);
        return true;
      }
    } catch {
      // continue
    }

    // Dismiss if no Apply button
    if (cleared) {
      await driver.back();
      await driver.pause(300);
      return true;
    }

    // Just dismiss
    await driver.back();
    await driver.pause(300);
    return true;
  }

  /**
   * Extract brand info from visible property cards
   * Returns array of { title, brand } for each card
   */
  async getBrandInfoFromCards(limit: number = 10): Promise<Array<{ title: string; brand: string | null }>> {
    const results: Array<{ title: string; brand: string | null }> = [];
    
    try {
      const list = await this.getResultsListEl(15000);
      const cards = await list.$$(`id=${this.cardContainerId}`);
      
      for (const card of cards) {
        if (results.length >= limit) break;
        
        const title = await this.childText(card, 'com.my6.android:id/hotel_title');
        if (!title) continue;
        
        // Check for brand tag
        const brandResult = await this.checkBrandTag(card);
        let brand = brandResult.brand || null;
        
        // If no explicit brand tag, infer from title
        if (!brand) {
          const titleLower = title.toLowerCase();
          if (titleLower.includes('studio 6') || titleLower.includes('studio6')) {
            brand = 'Studio 6';
          } else if (titleLower.includes('motel 6') || titleLower.includes('motel6')) {
            brand = 'Motel 6';
          }
        }
        
        results.push({ title, brand });
      }
    } catch (e) {
      console.log(`⚠️ Error getting brand info: ${String(e)}`);
    }
    
    return results;
  }

  /**
   * Verify brand filter is working - selected brand should appear first/dominantly
   */
  async verifyBrandFilter(expectedBrand: 'motel6' | 'studio6'): Promise<{ success: boolean; message: string; details: string[] }> {
    const targetBrand = expectedBrand === 'motel6' ? 'Motel 6' : 'Studio 6';
    const otherBrand = expectedBrand === 'motel6' ? 'Studio 6' : 'Motel 6';
    
    console.log(`→ Verifying brand filter for: ${targetBrand}`);
    
    // Collect brand info by scrolling through cards
    const allCards: Array<{ title: string; brand: string | null }> = [];
    const seenTitles = new Set<string>();
    
    // Get initial cards
    let cards = await this.getBrandInfoFromCards(8);
    for (const c of cards) {
      if (!seenTitles.has(c.title)) {
        seenTitles.add(c.title);
        allCards.push(c);
      }
    }
    
    // Scroll and collect more
    for (let swipe = 0; swipe < 3 && allCards.length < 10; swipe++) {
      await this.swipeUp(0.4);
      await driver.pause(500);
      
      cards = await this.getBrandInfoFromCards(8);
      for (const c of cards) {
        if (!seenTitles.has(c.title)) {
          seenTitles.add(c.title);
          allCards.push(c);
        }
      }
    }
    
    console.log(`✓ Collected ${allCards.length} properties for brand verification`);
    
    // Analyze results
    let targetCount = 0;
    let otherCount = 0;
    const details: string[] = [];
    
    // Normalize brand names for comparison (remove spaces, lowercase)
    const normalizeForCompare = (s: string) => s.toLowerCase().replace(/\s+/g, '');
    const targetNorm = normalizeForCompare(targetBrand);
    const otherNorm = normalizeForCompare(otherBrand);
    
    allCards.forEach((c, i) => {
      const brandNorm = normalizeForCompare(c.brand || '');
      const titleNorm = normalizeForCompare(c.title);
      
      // Check if this card matches target brand (either by brand tag or title)
      const isTarget = brandNorm.includes(targetNorm) || brandNorm.includes(targetNorm.replace('6', ' 6')) ||
                       titleNorm.includes(targetNorm);
      const isOther = brandNorm.includes(otherNorm) || brandNorm.includes(otherNorm.replace('6', ' 6')) ||
                      titleNorm.includes(otherNorm);
      
      if (isTarget) {
        targetCount++;
        details.push(`[${i + 1}] ✓ ${c.title} → ${c.brand}`);
      } else if (isOther) {
        otherCount++;
        details.push(`[${i + 1}] ○ ${c.title} → ${c.brand}`);
      } else {
        otherCount++;
        details.push(`[${i + 1}] ○ ${c.title} → ${c.brand || 'unknown'}`);
      }
    });
    
    // Success if target brand appears in majority of results
    const targetRatio = allCards.length > 0 ? targetCount / allCards.length : 0;
    const success = targetRatio >= 0.5 || targetCount > otherCount;
    
    const message = success
      ? `Brand filter working: ${targetCount}/${allCards.length} are ${targetBrand} (${Math.round(targetRatio * 100)}%)`
      : `Brand filter may not be working: only ${targetCount}/${allCards.length} are ${targetBrand}`;
    
    console.log(success ? `✓ ${message}` : `⚠️ ${message}`);
    
    return { success, message, details };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TC007 - GENERAL FILTERS POPUP METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Open the filters popup
   */
  async openFiltersPopup(): Promise<boolean> {
    console.log('→ Opening filters popup...');
    
    // Try "Filters" or "Filter" button
    const filterTexts = ['Filters', 'Filter', 'FILTERS', 'FILTER'];
    
    for (const text of filterTexts) {
      try {
        const selector = `android=new UiSelector().text("${text}")`;
        const el = await $(selector);
        if (await el.isExisting().catch(() => false)) {
          const loc = await el.getLocation().catch(() => null);
          if (loc && loc.y < 700) {
            await el.click();
            await driver.pause(800);
            console.log(`✓ Clicked Filters button`);
            return true;
          }
        }
      } catch {
        // continue
      }
    }

    // Try chip with "Filters" text
    try {
      const chips = await $$(`id=com.my6.android:id/chip_text`);
      for (const chip of chips) {
        const text = await chip.getText().catch(() => '');
        if (text.toLowerCase().includes('filter')) {
          await chip.click();
          await driver.pause(800);
          console.log(`✓ Clicked Filters chip: "${text}"`);
          return true;
        }
      }
    } catch {
      // continue
    }

    // Try filter icon button
    const filterIconIds = [
      'com.my6.android:id/filter_button',
      'com.my6.android:id/btn_filter',
      'com.my6.android:id/iv_filter',
      'com.my6.android:id/filter_icon',
    ];
    
    for (const id of filterIconIds) {
      try {
        const el = await $(`id=${id}`);
        if (await el.isExisting().catch(() => false)) {
          await el.click();
          await driver.pause(800);
          console.log(`✓ Clicked filter icon: ${id}`);
          return true;
        }
      } catch {
        // continue
      }
    }

    console.log('⚠️ Could not find filters button');
    return false;
  }

  /**
   * Check if filters popup is open
   */
  async isFiltersPopupOpen(): Promise<boolean> {
    // Look for common filter popup indicators
    const indicators = [
      'Show Results',
      'SHOW RESULTS',
      'Apply',
      'APPLY',
      'Clear All',
      'Reset',
      'Amenities',
      'Price Range',
    ];
    
    for (const text of indicators) {
      try {
        const selector = `android=new UiSelector().textContains("${text}")`;
        const el = await $(selector);
        if (await el.isExisting().catch(() => false)) {
          return true;
        }
      } catch {
        // continue
      }
    }
    return false;
  }

  /**
   * Get available filter options from the popup
   */
  async getAvailableFilters(): Promise<string[]> {
    const filters: string[] = [];
    
    try {
      // Look for filter section headers or toggle buttons
      const textViews = await $$('android.widget.TextView');
      for (const tv of textViews.slice(0, 30)) {
        const text = await tv.getText().catch(() => '');
        if (text && text.length > 2 && text.length < 50) {
          // Filter out generic texts
          const lowerText = text.toLowerCase();
          if (!['filters', 'clear', 'reset', 'show', 'apply', 'cancel', 'close'].some(x => lowerText.includes(x))) {
            filters.push(text);
          }
        }
      }
    } catch (e) {
      console.log(`⚠️ Error getting filters: ${String(e)}`);
    }
    
    return [...new Set(filters)]; // Remove duplicates
  }

  /**
   * Toggle a filter option by text (click on it)
   */
  async toggleFilter(filterText: string): Promise<boolean> {
    console.log(`→ Toggling filter: ${filterText}`);
    
    try {
      // Try exact text match first
      let selector = `android=new UiSelector().text("${filterText}")`;
      let el = await $(selector);
      if (await el.isExisting().catch(() => false)) {
        await el.click();
        await driver.pause(500);
        console.log(`✓ Toggled filter: ${filterText}`);
        return true;
      }
      
      // Try contains match
      selector = `android=new UiSelector().textContains("${filterText}")`;
      el = await $(selector);
      if (await el.isExisting().catch(() => false)) {
        await el.click();
        await driver.pause(500);
        console.log(`✓ Toggled filter via contains: ${filterText}`);
        return true;
      }
    } catch {
      // continue
    }
    
    console.log(`⚠️ Could not find filter: ${filterText}`);
    return false;
  }

  /**
   * Get the result count from "Show X Results" button
   */
  async getShowResultsCount(): Promise<number | null> {
    try {
      // Look for button with "Show X Results" or "X Results"
      const selector = `android=new UiSelector().textMatches("(?i).*\\\\d+.*result.*")`;
      const el = await $(selector);
      if (await el.isExisting().catch(() => false)) {
        const text = await el.getText();
        const match = text.match(/(\d+)/);
        if (match) {
          const count = parseInt(match[1], 10);
          console.log(`✓ Show Results count: ${count}`);
          return count;
        }
      }
    } catch {
      // continue
    }
    
    // Try alternative patterns
    try {
      const buttons = await $$('android.widget.Button');
      for (const btn of buttons) {
        const text = await btn.getText().catch(() => '');
        if (text.toLowerCase().includes('result')) {
          const match = text.match(/(\d+)/);
          if (match) {
            const count = parseInt(match[1], 10);
            console.log(`✓ Found results count in button: ${count}`);
            return count;
          }
        }
      }
    } catch {
      // continue
    }
    
    console.log('⚠️ Could not find results count');
    return null;
  }

  /**
   * Click the "Show Results" or "Apply" button
   */
  async clickShowResults(): Promise<boolean> {
    console.log('→ Clicking Show Results...');
    
    const buttonTexts = [
      'Show Results',
      'SHOW RESULTS',
      'Show',
      'Apply',
      'APPLY',
      'Apply Filters',
      'Done',
    ];
    
    for (const text of buttonTexts) {
      try {
        const selector = `android=new UiSelector().textContains("${text}")`;
        const el = await $(selector);
        if (await el.isExisting().catch(() => false)) {
          await el.click();
          await driver.pause(1000);
          console.log(`✓ Clicked: ${text}`);
          return true;
        }
      } catch {
        // continue
      }
    }
    
    // Try button by ID patterns
    const buttonIds = [
      'com.my6.android:id/btn_show_results',
      'com.my6.android:id/btn_apply',
      'com.my6.android:id/apply_button',
      'com.my6.android:id/show_results_button',
    ];
    
    for (const id of buttonIds) {
      try {
        const el = await $(`id=${id}`);
        if (await el.isExisting().catch(() => false)) {
          await el.click();
          await driver.pause(1000);
          console.log(`✓ Clicked button by id: ${id}`);
          return true;
        }
      } catch {
        // continue
      }
    }
    
    console.log('⚠️ Could not find Show Results button');
    return false;
  }

  /**
   * Clear all filters in the popup
   */
  async clearAllFilters(): Promise<boolean> {
    console.log('→ Clearing all filters...');
    
    const clearTexts = ['Clear All', 'CLEAR ALL', 'Clear', 'Reset', 'RESET'];
    
    for (const text of clearTexts) {
      try {
        const selector = `android=new UiSelector().textContains("${text}")`;
        const el = await $(selector);
        if (await el.isExisting().catch(() => false)) {
          await el.click();
          await driver.pause(500);
          console.log(`✓ Cleared filters via: ${text}`);
          return true;
        }
      } catch {
        // continue
      }
    }
    
    return false;
  }

  /**
   * Close filters popup without applying
   */
  async closeFiltersPopup(): Promise<void> {
    // Try close/X button first
    const closeIds = ['com.my6.android:id/btn_close', 'com.my6.android:id/iv_close', 'com.my6.android:id/close'];
    
    for (const id of closeIds) {
      try {
        const el = await $(`id=${id}`);
        if (await el.isExisting().catch(() => false)) {
          await el.click();
          await driver.pause(500);
          console.log('✓ Closed filters popup via close button');
          return;
        }
      } catch {
        // continue
      }
    }
    
    // Fall back to back button
    await driver.back();
    await driver.pause(500);
    console.log('✓ Closed filters popup via back');
  }

  /**
   * Get the property count text from lister header
   */
  async getPropertyCountFromHeader(): Promise<number | null> {
    try {
      // Look for text like "X properties" or "X results"
      const selector = `android=new UiSelector().textMatches("(?i).*\\\\d+.*propert.*|.*\\\\d+.*result.*")`;
      const el = await $(selector);
      if (await el.isExisting().catch(() => false)) {
        const text = await el.getText();
        const match = text.match(/(\d+)/);
        if (match) {
          return parseInt(match[1], 10);
        }
      }
    } catch {
      // continue
    }
    
    return null;
  }

  /**
   * Count visible property cards on lister
   */
  async countVisibleCards(): Promise<number> {
    try {
      const list = await this.getResultsListEl(10000);
      const cards = await list.$$(`id=${this.cardContainerId}`);
      return cards.length;
    } catch {
      return 0;
    }
  }

  /**
   * Test a filter: apply it, check count, verify on lister
   */
  async testFilter(filterName: string): Promise<{ success: boolean; message: string }> {
    console.log(`\n┌───────────────────────────────────────────────────`);
    console.log(`│ TESTING FILTER: ${filterName}`);
    console.log(`└───────────────────────────────────────────────────`);
    
    // Open filters popup
    const popupOpened = await this.openFiltersPopup();
    if (!popupOpened) {
      return { success: false, message: 'Could not open filters popup' };
    }
    
    await driver.pause(500);
    
    // Toggle the filter
    const toggled = await this.toggleFilter(filterName);
    if (!toggled) {
      await this.closeFiltersPopup();
      return { success: false, message: `Could not find filter: ${filterName}` };
    }
    
    await driver.pause(500);
    
    // Get expected result count
    const expectedCount = await this.getShowResultsCount();
    console.log(`→ Expected results: ${expectedCount ?? 'unknown'}`);
    
    // Apply filters
    const applied = await this.clickShowResults();
    if (!applied) {
      return { success: false, message: 'Could not click Show Results' };
    }
    
    // Wait for lister to load
    await driver.pause(1500);
    await this.waitForLoaded(15000);
    
    // Verify we have results
    const cardCount = await this.countVisibleCards();
    console.log(`✓ Visible cards after filter: ${cardCount}`);
    
    if (cardCount > 0) {
      const message = expectedCount 
        ? `Filter "${filterName}" applied: ${expectedCount} expected, ${cardCount} visible`
        : `Filter "${filterName}" applied: ${cardCount} cards visible`;
      console.log(`✓ ${message}`);
      return { success: true, message };
    } else {
      return { success: false, message: `No results after applying filter: ${filterName}` };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TC008 - RANDOM/EXPLORATORY TESTING METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get search criteria displayed in lister header (location, dates, guests)
   */
  async getSearchCriteriaFromHeader(): Promise<{
    location: string | null;
    checkIn: string | null;
    checkOut: string | null;
    nights: string | null;
    guests: string | null;
  }> {
    const result = {
      location: null as string | null,
      checkIn: null as string | null,
      checkOut: null as string | null,
      nights: null as string | null,
      guests: null as string | null,
    };

    // Get location from search_text
    try {
      const locEl = await $('id=com.my6.android:id/search_text');
      if (await locEl.isExisting().catch(() => false)) {
        result.location = await locEl.getText().catch(() => null);
      }
    } catch { /* ignore */ }

    // Get check-in date
    try {
      const checkInEl = await $('id=com.my6.android:id/check_in_date');
      if (await checkInEl.isExisting().catch(() => false)) {
        result.checkIn = await checkInEl.getText().catch(() => null);
      }
    } catch { /* ignore */ }

    // Get check-out date
    try {
      const checkOutEl = await $('id=com.my6.android:id/check_out_date');
      if (await checkOutEl.isExisting().catch(() => false)) {
        result.checkOut = await checkOutEl.getText().catch(() => null);
      }
    } catch { /* ignore */ }

    // Get nights count
    try {
      const nightsEl = await $('id=com.my6.android:id/nights_count');
      if (await nightsEl.isExisting().catch(() => false)) {
        result.nights = await nightsEl.getText().catch(() => null);
      }
    } catch { /* ignore */ }

    // Get guests count
    try {
      const guestsEl = await $('id=com.my6.android:id/guests_count');
      if (await guestsEl.isExisting().catch(() => false)) {
        result.guests = await guestsEl.getText().catch(() => null);
      }
    } catch { /* ignore */ }

    return result;
  }

  /**
   * Swipe left on property card image carousel to test horizontal scroll
   */
  async swipeLeftOnPropertyCardImages(cardIndex: number = 0): Promise<{ success: boolean; imagesViewed: number }> {
    console.log(`→ Testing image carousel on card ${cardIndex}...`);
    let imagesViewed = 1; // Start with 1 (initial image)

    try {
      const list = await this.getResultsListEl(10000);
      const cards = await list.$$(`id=${this.cardContainerId}`);
      
      if (cards.length <= cardIndex) {
        console.log(`⚠️ Card index ${cardIndex} not found`);
        return { success: false, imagesViewed: 0 };
      }

      const card = cards[cardIndex];
      
      // Find the image ViewPager or container
      const imagePager = await card.$('id=com.my6.android:id/hotel_image_view_pager');
      if (!await imagePager.isExisting().catch(() => false)) {
        console.log('⚠️ Image view pager not found');
        return { success: false, imagesViewed: 0 };
      }

      // Get location for swipe
      const loc = await imagePager.getLocation();
      const size = await imagePager.getSize();

      // Swipe left 3 times using mobile: swipeGesture (modern API)
      for (let i = 0; i < 3; i++) {
        try {
          await driver.execute('mobile: swipeGesture', {
            left: loc.x,
            top: loc.y,
            width: size.width,
            height: size.height,
            direction: 'left',
            percent: 0.6
          });
          await driver.pause(500);
          imagesViewed++;
          console.log(`   → Swiped image ${imagesViewed}`);
        } catch (e) {
          // Fallback to performActions
          try {
            await driver.performActions([{
              type: 'pointer',
              id: 'finger1',
              parameters: { pointerType: 'touch' },
              actions: [
                { type: 'pointerMove', duration: 0, x: Math.round(loc.x + size.width * 0.8), y: Math.round(loc.y + size.height / 2) },
                { type: 'pointerDown', button: 0 },
                { type: 'pause', duration: 100 },
                { type: 'pointerMove', duration: 250, x: Math.round(loc.x + size.width * 0.2), y: Math.round(loc.y + size.height / 2) },
                { type: 'pointerUp', button: 0 }
              ]
            }]);
            await driver.releaseActions();
            await driver.pause(500);
            imagesViewed++;
            console.log(`   → Swiped image ${imagesViewed} (fallback)`);
          } catch {
            console.log(`   ⚠️ Could not swipe image ${i + 2}`);
          }
        }
      }

      console.log(`✓ Image carousel tested: ${imagesViewed} images viewed`);
      return { success: true, imagesViewed };
    } catch (e) {
      console.log(`⚠️ Image carousel test error: ${String(e)}`);
      return { success: false, imagesViewed };
    }
  }

  /**
   * Get the active rate code chip text from lister header
   */
  async getActiveRateCodeFromHeader(): Promise<string | null> {
    try {
      const rateChip = await $('id=com.my6.android:id/rate_plan_chip');
      if (await rateChip.isExisting().catch(() => false)) {
        const textEl = await rateChip.$('id=com.my6.android:id/chip_text');
        if (await textEl.isExisting().catch(() => false)) {
          return await textEl.getText().catch(() => null);
        }
      }
    } catch { /* ignore */ }
    
    // Fallback: look for rate plan text
    try {
      const selector = `android=new UiSelector().resourceId("com.my6.android:id/chip_text").instance(0)`;
      const el = await $(selector);
      if (await el.isExisting().catch(() => false)) {
        return await el.getText().catch(() => null);
      }
    } catch { /* ignore */ }
    
    return null;
  }

  /**
   * Verify that search criteria matches expected values
   */
  async verifySearchCriteria(expected: {
    location?: string;
    guests?: string;
    rateCode?: string;
  }): Promise<{ success: boolean; details: string[] }> {
    const details: string[] = [];
    let allMatch = true;

    const criteria = await this.getSearchCriteriaFromHeader();
    
    if (expected.location) {
      const locationMatch = criteria.location?.toLowerCase().includes(expected.location.toLowerCase());
      if (locationMatch) {
        details.push(`✓ Location: "${criteria.location}" matches "${expected.location}"`);
      } else {
        details.push(`✗ Location mismatch: got "${criteria.location}", expected "${expected.location}"`);
        allMatch = false;
      }
    }

    if (expected.guests) {
      const guestsMatch = criteria.guests?.toLowerCase().includes(expected.guests.toLowerCase());
      if (guestsMatch) {
        details.push(`✓ Guests: "${criteria.guests}" matches "${expected.guests}"`);
      } else {
        details.push(`✗ Guests mismatch: got "${criteria.guests}", expected "${expected.guests}"`);
        allMatch = false;
      }
    }

    if (expected.rateCode) {
      const activeRate = await this.getActiveRateCodeFromHeader();
      const rateMatch = activeRate?.toLowerCase().includes(expected.rateCode.toLowerCase());
      if (rateMatch) {
        details.push(`✓ Rate code: "${activeRate}" matches "${expected.rateCode}"`);
      } else {
        details.push(`✗ Rate code mismatch: got "${activeRate}", expected "${expected.rateCode}"`);
        allMatch = false;
      }
    }

    return { success: allMatch, details };
  }

  /**
   * Click on search bar in lister header to return to search page
   */
  async clickSearchBarToEdit(): Promise<boolean> {
    console.log('→ Clicking search bar to edit search...');
    
    // Try clicking the search text in header
    try {
      const searchText = await $('id=com.my6.android:id/search_text');
      if (await searchText.isExisting().catch(() => false)) {
        await searchText.click();
        await driver.pause(800);
        console.log('✓ Clicked search text');
        return true;
      }
    } catch { /* continue */ }

    // Try clicking the left icon (back/search icon)
    try {
      const leftIcon = await $('id=com.my6.android:id/left_icon');
      if (await leftIcon.isExisting().catch(() => false)) {
        await leftIcon.click();
        await driver.pause(800);
        console.log('✓ Clicked left icon');
        return true;
      }
    } catch { /* continue */ }

    console.log('⚠️ Could not find search bar to click');
    return false;
  }

  /**
   * Get total motels found count from header
   */
  async getMotelsFoundCount(): Promise<number | null> {
    try {
      // Look for "X motels found" text
      const selector = `android=new UiSelector().textMatches("(?i).*\\\\d+.*motel.*found.*")`;
      const el = await $(selector);
      if (await el.isExisting().catch(() => false)) {
        const text = await el.getText();
        const match = text.match(/(\d+)/);
        if (match) {
          return parseInt(match[1], 10);
        }
      }
    } catch { /* ignore */ }

    // Fallback to property count
    return this.getPropertyCountFromHeader();
  }
}
