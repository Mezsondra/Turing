#!/usr/bin/env bash
# Regenerate app icons + splash screens from resources/logo.svg.
# @capacitor/assets does the bulk; the steps after it undo three things it
# gets wrong for this project.
set -euo pipefail
cd "$(dirname "$0")/.."

cp resources/logo.svg public/logo.svg

npx capacitor-assets generate \
  --assetPath resources \
  --iconBackgroundColor '#0f172a' --iconBackgroundColorDark '#0f172a' \
  --splashBackgroundColor '#0f172a' --splashBackgroundColorDark '#0f172a' \
  --logoSplashScale 0.22

# 1. It reformats the manifest for no reason.
git checkout android/app/src/main/AndroidManifest.xml

# 2. It insets the adaptive-icon background, which leaves a transparent ring
#    under launcher masks. Background must bleed; only foreground is inset.
for f in ic_launcher ic_launcher_round; do
  cat > "android/app/src/main/res/mipmap-anydpi-v26/$f.xml" <<'XML'
<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background" />
    <foreground>
        <inset android:drawable="@mipmap/ic_launcher_foreground" android:inset="16.7%" />
    </foreground>
</adaptive-icon>
XML
done

# 3. It drops a half-wired PWA manifest + a stray repo-root icons/ dir. This
#    app ships native (Capacitor) and a plain Vite web build - no PWA.
rm -f public/manifest.webmanifest
rm -rf icons

echo "Assets regenerated. Run 'npm run sync' to push them into the native projects."
