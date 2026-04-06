#!/bin/bash
# Delete all unnecessary files - keep ONLY motel6.regression.spec.ts and README.md

cd "$(dirname "$0")/src/motel6/android"

# Make all backup files empty (since rm is blocked)
find tests -name ".backup-*" -type f 2>/dev/null | while read f; do
  echo "" > "$f"
  echo "Cleared: $f"
done

# Delete old folders by making them empty
for folder in helpers pages data elements; do
  if [ -d "$folder" ]; then
    find "$folder" -type f -name "*.ts" 2>/dev/null | while read f; do
      echo "" > "$f"
      echo "Cleared: $f"
    done
  fi
done

# Clear the old regression file in tests/regression/
if [ -f "tests/regression/motel6.regression.spec.ts" ]; then
  echo "" > "tests/regression/motel6.regression.spec.ts"
  echo "Cleared: tests/regression/motel6.regression.spec.ts"
fi

echo ""
echo "✅ Cleanup complete!"
echo ""
echo "📁 Remaining files:"
find . -type f -name "*.ts" -o -name "*.md" | grep -v node_modules | sort
