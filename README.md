# ENow

Public shopping app: https://br-cold-moon-b41vzeae-enow.compute.c-6.us-east-2.aws.neon.tech/

Android download: https://br-cold-moon-b41vzeae-enow.compute.c-6.us-east-2.aws.neon.tech/downloads/ENow.apk

ENow compares matching offers from discoverable stores using public seller pages, optional official retailer APIs, and dated ShopSavvy price records. Vireonix plans queries, interprets on-device photo evidence, and reviews product matches. No ENow account is required.

- Text and JPEG, PNG, WebP, GIF, AVIF, HEIC/HEIF photo search; photos stay on the device.
- Three lowest matching offers when available, with more results, condition/budget/destination filters, shipping information, source dates, and locally saved finds.
- Click any offer card or photo to open optional developer support, then continue to the seller.
- Cash App, Venmo, Chime, and PayPal; $3 or more suggested. Choosing a method starts a 60-second countdown, then a thank-you screen and seller redirect. No charge, payment verification, or purchase approval is performed by ENow.
- Signed Android 8+ app with photo picker, in-app seller browsing, return-to-ENow navigation, and verified-link configuration. The Android launcher opens ENow without a separate browser. Payment services open separately. Device settings control HTTPS app-link handling.
- Installable web app with an offline shell; live search requires internet.

## Development

Node.js 24: `npm ci`, `npm test`, `npm run dev`.

`npm run build` embeds public assets into `build/index.mjs` for the existing Neon Function. Zip that file at archive root and deploy to project `wandering-heart-26440274`, branch `br-cold-moon-b41vzeae`, function `enow`. The function inherits production settings and its database connection. Do not put database credentials in public files. GitHub Actions is not used.

`python scripts/build-android.py` builds and verifies the APK using Android SDK build tools, API 35 android.jar, Eclipse ECJ, and Java 17+. Set ENOW_ANDROID_SDK, ENOW_ECJ, and ENOW_SIGNING_DIR to the installed tools and existing private release-key directory. Preserve the existing release key for updates; never commit it. The build writes the matching public Android app-link certificate to `public/.well-known/assetlinks.json` and copies the APK into `public/downloads/`.

## Verification and limits

Automated checks cover price evidence, model/accessory mismatches, shipping, currency, budgets, source dates, duplicate offers, private-address blocking, input limits, and AI output restrictions. Browser checks cover text search, full-card clicks, donation methods, countdown, and seller handoff. APK signature verified. Physical Android-device execution has not been tested here.

Search coverage depends on available public sources; the app does not claim to search every seller or fabricate three results when fewer can be verified. Index observations retain their source timestamps and expire after seven days. Unknown shipping and condition are shown explicitly. Merchant checkout sets final price, shipping, tax, and delivery eligibility. Vireonix and discovery providers can be temporarily unavailable.
