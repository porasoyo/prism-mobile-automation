/**
 * Test Data Utilities
 * Provides reusable functions for generating random test data
 * NO hardcoded values - everything should be randomized or parameterized
 */

// US Cities/Locations with good Motel 6/Studio 6 inventory
export const US_LOCATIONS = [
  'Dallas, TX',
  'Houston, TX',
  'San Antonio, TX',
  'Austin, TX',
  'Los Angeles, CA',
  'San Diego, CA',
  'Phoenix, AZ',
  'Denver, CO',
  'Las Vegas, NV',
  'Atlanta, GA',
  'Orlando, FL',
  'Tampa, FL',
  'Miami, FL',
  'Nashville, TN',
  'Charlotte, NC',
  'Albuquerque, NM',
  'Oklahoma City, OK',
  'Tulsa, OK',
  'Indianapolis, IN',
  'Columbus, OH',
  'Salt Lake City, UT',
  'Sacramento, CA',
  'Fresno, CA',
  'Bakersfield, CA',
  'El Paso, TX',
  'Fort Worth, TX',
  'Arlington, TX',
  'Corpus Christi, TX',
  'Lubbock, TX',
  'Amarillo, TX',
  'Tucson, AZ',
  'Mesa, AZ',
  'Tempe, AZ',
  'San Jose, CA',
  'Oakland, CA',
  'Anaheim, CA',
  'Riverside, CA',
  'Ontario, CA',
  'Portland, OR',
  'Seattle, WA',
];

/**
 * Get a random US location from the inventory
 * @returns Random city/state string
 */
export function getRandomUSLocation(): string {
  return US_LOCATIONS[Math.floor(Math.random() * US_LOCATIONS.length)];
}

/**
 * Get multiple unique random US locations
 * @param count Number of unique locations to return
 * @returns Array of unique city/state strings
 */
export function getRandomUSLocations(count: number): string[] {
  const shuffled = [...US_LOCATIONS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

/**
 * Generate random date offset (days from today)
 * Minimum 60 days ahead to ensure inventory availability
 * @param minDaysAhead Minimum days from today (default: 60)
 * @param maxDaysAhead Maximum days from today (default: 120)
 * @returns Number of days to offset from today
 */
export function getRandomDateOffset(minDaysAhead: number = 60, maxDaysAhead: number = 120): number {
  return minDaysAhead + Math.floor(Math.random() * (maxDaysAhead - minDaysAhead));
}

/**
 * Generate random number of nights for stay
 * @param minNights Minimum nights (default: 1)
 * @param maxNights Maximum nights (default: 3)
 * @returns Number of nights
 */
export function getRandomNights(minNights: number = 1, maxNights: number = 3): number {
  return minNights + Math.floor(Math.random() * (maxNights - minNights + 1));
}

/**
 * Generate random guest count
 * MAX 2 adults to avoid inventory issues
 * @param minAdults Minimum adults (default: 1)
 * @param maxAdults Maximum adults (default: 2, do NOT exceed 2)
 * @returns Number of adults
 */
export function getRandomAdultCount(minAdults: number = 1, maxAdults: number = 2): number {
  // Cap at 2 adults max to ensure availability
  const safeMax = Math.min(maxAdults, 2);
  return minAdults + Math.floor(Math.random() * (safeMax - minAdults + 1));
}

/**
 * Generate random children count
 * MAX 1 child to avoid inventory issues
 * @param minChildren Minimum children (default: 0)
 * @param maxChildren Maximum children (default: 1, do NOT exceed 1)
 * @returns Number of children
 */
export function getRandomChildrenCount(minChildren: number = 0, maxChildren: number = 1): number {
  // Cap at 1 child max to ensure availability
  const safeMax = Math.min(maxChildren, 1);
  return minChildren + Math.floor(Math.random() * (safeMax - minChildren + 1));
}

/**
 * Generate random digits string (for test data)
 * @param count Number of digits
 * @returns String of random digits
 */
export function getRandomDigits(count: number): string {
  let out = '';
  for (let i = 0; i < count; i++) {
    out += Math.floor(Math.random() * 10).toString();
  }
  return out;
}

/**
 * Generate random letters string (for test data)
 * @param count Number of letters
 * @returns String of random lowercase letters
 */
export function getRandomLetters(count: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  let out = '';
  for (let i = 0; i < count; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

/**
 * Generate a test password meeting all requirements
 * At least: 1 upper, 1 lower, 1 number, 1 special, min 8, no spaces
 * @returns Valid password string
 */
export function generateTestPassword(): string {
  return `Aa1!${getRandomLetters(4)}`;
}

/**
 * Generate a test email
 * @returns Unique test email
 */
export function generateTestEmail(): string {
  return `t${getRandomDigits(6)}@gmail.com`;
}

/**
 * Search configuration for tests
 * Combines all random values into a single config object
 */
export interface SearchConfig {
  destination: string;
  offsetDays: number;
  nights: number;
  adults: number;
  children: number;
}

/**
 * Generate a complete random search configuration
 * @param opts Optional overrides for specific values
 * @returns SearchConfig with all required search parameters
 */
export function generateRandomSearchConfig(opts?: Partial<SearchConfig>): SearchConfig {
  return {
    destination: opts?.destination ?? getRandomUSLocation(),
    offsetDays: opts?.offsetDays ?? getRandomDateOffset(60, 120), // 2-4 months ahead
    nights: opts?.nights ?? getRandomNights(1, 3),
    adults: opts?.adults ?? getRandomAdultCount(1, 2), // Max 2 adults
    children: opts?.children ?? getRandomChildrenCount(0, 1), // Max 1 child
  };
}

// Rate code types available in the app
export type RateCodeType = 
  | 'best_rate'      // Default - Best rate
  | 'my6_member'     // My6 member rate
  | 'flexible'       // Flexible rate
  | 'government'     // Government rate
  | 'aarp'           // AARP rate
  | 'commercial'     // Commercial driver rate
  | 'military'       // Military rate
  | 'senior'         // Senior citizen rate
  | 'cp_code';       // Corporate plus (CP) - requires code input

// All available rate codes (excluding best_rate which is default)
export const AVAILABLE_RATE_CODES: RateCodeType[] = [
  'my6_member',
  'flexible',
  'government',
  'aarp',
  'commercial',
  'military',
  'senior',
  'cp_code',
];

/**
 * Get random rate codes for testing
 * @param count Number of rate codes to return (default: 3-4 random)
 * @param includeCP Whether to always include CP code (default: true)
 * @returns Array of rate code types
 */
export function getRandomRateCodes(count?: number, includeCP: boolean = true): RateCodeType[] {
  const targetCount = count ?? (3 + Math.floor(Math.random() * 2)); // 3-4 random
  const available: RateCodeType[] = [...AVAILABLE_RATE_CODES].filter(c => c !== 'cp_code');
  
  // Shuffle and take random codes
  const shuffled = available.sort(() => Math.random() - 0.5);
  const selected: RateCodeType[] = shuffled.slice(0, Math.min(targetCount - (includeCP ? 1 : 0), available.length));
  
  // Always include CP code if requested
  if (includeCP) {
    selected.push('cp_code');
  }
  
  // Shuffle again to randomize CP position
  return selected.sort(() => Math.random() - 0.5);
}

// Rate codes for special offers
export const RATE_CODES = {
  CP_CODE: 'CP8PPQBU', // Corporate Partner code
};
