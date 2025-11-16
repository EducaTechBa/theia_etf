#!/bin/bash

# Simple script to create a new Theia extension by copying an existing one

echo "=== Theia Extension Creator ==="
echo ""

printf "Extension name (e.g., my-extension): "
read -r extension_name

printf "Extension display label (e.g., My Extension): "
read -r extension_label

printf "Author name: "
read -r author

printf "Description: "
read -r description

# Validate extension name
if [ -z "$extension_name" ]; then
    echo "Error: Extension name cannot be empty"
    exit 1
fi

# Check if extension already exists
if [ -d "$extension_name" ]; then
    echo "Error: Extension '$extension_name' already exists"
    exit 1
fi

# Convert extension-name to ExtensionName for class names
# e.g., my-extension -> MyExtension
class_name=$(echo "$extension_name" | sed 's/-/ /g' | awk '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) tolower(substr($i,2));}1' | sed 's/ //g')

echo ""
echo "Creating extension '$extension_name'..."
echo "  Display label: $extension_label"
echo "  Class prefix: $class_name"
echo "  Author: $author"
echo ""

# Copy autotest-view as template
cp -r autotest-view "$extension_name"

# Clean out node_modules and lib if they exist
rm -rf "$extension_name/node_modules"
rm -rf "$extension_name/lib"

# Update package.json
cat > "$extension_name/package.json" <<EOF
{
  "name": "$extension_name",
  "keywords": [
    "theia-extension"
  ],
  "version": "0.0.0",
  "description": "$description",
  "author": "$author",
  "files": [
    "lib",
    "src"
  ],
  "dependencies": {
    "@theia/core": "1.6.0",
    "@theia/workspace": "1.6.0",
    "@theia/filesystem": "1.6.0"
  },
  "devDependencies": {
    "rimraf": "latest",
    "typescript": "latest"
  },
  "scripts": {
    "prepare": "yarn run clean && yarn run build",
    "clean": "rimraf lib",
    "build": "tsc",
    "watch": "tsc -w"
  },
  "theiaExtensions": [
    {
      "frontend": "lib/browser/${extension_name}-frontend-module"
    }
  ]
}
EOF

# Rename source files
cd "$extension_name/src/browser" || exit 1

# Rename files from top-bar-* to extension-name-*
for file in top-bar-*; do
    if [ -f "$file" ]; then
        new_file=$(echo "$file" | sed "s/top-bar/$extension_name/g")
        mv "$file" "$new_file"
    fi
done

# Update content in TypeScript files
for file in *.ts *.tsx; do
    if [ -f "$file" ]; then
        # Replace TopBar with new class name
        sed -i "s/TopBar/$class_name/g" "$file"
        sed -i "s/top-bar/$extension_name/g" "$file"
        sed -i "s/'Top Bar'/'$extension_label'/g" "$file"
        sed -i "s/\"Top Bar\"/\"$extension_label\"/g" "$file"
    fi
done

cd ../../..

echo ""
echo "✓ Extension created successfully!"
echo ""
echo "Next steps:"
echo "  1. Add '$extension_name' to the 'workspaces' array in ./package.json"
echo "  2. Add '$extension_name': '0.0.0' to 'dependencies' in ./app/package.json"
echo "  3. Customize the extension in ./$extension_name/src/browser/"
echo "  4. Run 'yarn' from the root to install dependencies"
echo "  5. Run 'yarn prepare' to build"
echo ""