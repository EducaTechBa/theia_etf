#!/bin/bash

echo "Cleaning project for upload..."

# Remove all node_modules
echo "Removing node_modules..."
find . -name "node_modules" -type d -prune -exec rm -rf {} +

# Remove all lib directories (compiled TypeScript)
echo "Removing lib directories..."
find . -name "lib" -type d -prune -exec rm -rf {} +

# Remove yarn.lock
echo "Removing yarn.lock..."
rm -f yarn.lock

# Remove app build artifacts
echo "Removing app build artifacts..."
rm -rf app/lib
rm -rf app/src-gen
rm -rf app/plugins

echo "Clean complete! Source is ready for upload."
echo ""
echo "To rebuild on server, run:"
echo "  yarn"
echo "  yarn prepare"
