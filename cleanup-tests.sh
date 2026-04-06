#!/bin/bash
# Clean up old/debugging test files

cd "$(dirname "$0")/src/motel6/android/tests"

# Remove debugging files
[ -f "simple-test.spec.ts" ] && mv simple-test.spec.ts .backup-simple-test.spec.ts
[ -f "test-dallas.spec.ts" ] && mv test-dallas.spec.ts .backup-test-dallas.spec.ts
[ -f "test-houston.spec.ts" ] && mv test-houston.spec.ts .backup-test-houston.spec.ts
[ -f "test-san-antonio.spec.ts" ] && mv test-san-antonio.spec.ts .backup-test-san-antonio.spec.ts
[ -f "homepageTest.spec.ts" ] && mv homepageTest.spec.ts .backup-homepageTest.spec.ts

# Remove the non-working regression file
[ -f "regression/motel6.regression.spec.ts" ] && mv regression/motel6.regression.spec.ts regression/.backup-motel6.regression.spec.ts

# Rename the working one to standard name
[ -f "regression/motel6-simple.regression.spec.ts" ] && mv regression/motel6-simple.regression.spec.ts regression/motel6.regression.spec.ts

echo "✅ Cleanup complete!"
echo "Working regression file: src/motel6/android/tests/regression/motel6.regression.spec.ts"
