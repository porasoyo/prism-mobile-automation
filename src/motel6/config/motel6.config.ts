export const Motel6Config = {
  app: {
    name: 'Motel6',
    bundleId: {
      ios: 'com.motel6.app',
      android: 'com.motel6.android'
    }
  },
  
  timeouts: {
    implicit: 10000,
    explicit: 30000,
    pageLoad: 60000
  },
  
  credentials: {
    validUser: {
      email: process.env.MOTEL6_TEST_EMAIL || 'test@motel6.com',
      password: process.env.MOTEL6_TEST_PASSWORD || 'Test@123'
    },
    invalidUser: {
      email: 'invalid@test.com',
      password: 'WrongPassword123'
    }
  },
  
  testData: {
    searchLocation: 'Los Angeles, CA',
    checkInDate: '2026-04-01',
    checkOutDate: '2026-04-05',
    guests: 2,
    rooms: 1
  },
  
  urls: {
    api: process.env.MOTEL6_API_URL || 'https://api.motel6.com',
    web: 'https://www.motel6.com'
  }
};
