# e-verse

Public shopping app: https://e-verse.eager-guppy-9296.chatgpt.site/

Use the prominent **Install app** button for browser-managed installation on supported iPhone, iPad, Android, Windows, and Mac browsers. It opens the browser's installer when available, or shows device-specific Home Screen, Dock, or browser-menu instructions. It does not download an APK or executable. In-app browsers such as Facebook are directed to the device browser first.

Search normalizes singular/plural names, recognizes concealed-storage wording, and retains exact model identifiers. Broad FLEX tool searches match the FLEX brand and its tool categories. Related query wording runs even when the AI planner is unavailable. Matching catalog and discovered listings remain visible with an explicit price-check label when no current price can be confirmed. Catalog responses are cached for five minutes and price-detail calls are limited to respect the free provider quota.

Every search targets Facebook Marketplace, Temu, Alibaba, eBay, Amazon, Google Shopping, Walmart, Target, Home Depot, Lowe’s, AliExpress, and Wayfair through the available public discovery index. Each marketplace receives reserved checking slots, a per-marketplace status, and a direct search link. Restricted pages stay unverified; search snippets never become offer prices. Seller microdata is supported alongside JSON-LD and OpenGraph. Samples, swatches, price ranges, installment text, and explicit bulk minimums are excluded from single-item comparisons. Fresh seller evidence supersedes older index observations.

e-verse compares matching offers from discoverable stores using public seller pages, optional official retailer APIs, and dated ShopSavvy price records. Vireonix plans queries, interprets on-device photo evidence, and reviews product matches. No e-verse account is required.

- Text and JPEG, PNG, WebP, GIF, AVIF, HEIC/HEIF photo search; photos stay on the device.
- Three lowest matching offers when available, with more results, condition/budget/destination filters, shipping information, source dates, and locally saved finds.
- Click any offer card or photo to open optional developer support, then continue to the seller.
- Cash App, Venmo, Chime, and PayPal; $3 or more suggested. The method card and recipient handle open the payment provider directly. Venmo and PayPal include $3 in their forms; Cash App may omit it when using its web QR, and Chime requires entering it in Pay Anyone. Copy controls and provider instructions cover manual amounts. Choosing a method starts a 60-second countdown, then a thank-you screen and seller redirect. No charge, payment verification, or purchase approval is performed by e-verse.
- Signed Android 8+ app with photo picker, in-app seller browsing, return-to-e-verse navigation, and verified-link configuration. The Android launcher opens e-verse without a separate browser. Payment services open separately. Device settings control HTTPS app-link handling.
- Installable web app with an offline shell; live search requires internet.

## Development

Node.js 24: `npm ci`, `npm test`, `npm run dev`.

`npm run build` embeds public assets into `build/index.mjs` for the existing Neon Function. Zip that file at archive root and deploy to project `wandering-heart-26440274`, branch `br-cold-moon-b41vzeae`, function `enow`. The function inherits production settings and its database connection. Do not put database credentials in public files. GitHub Actions is not used.

`python scripts/build-android.py` builds and verifies the APK using Android SDK build tools, API 35 android.jar, Eclipse ECJ, and Java 17+. Set ENOW_ANDROID_SDK, ENOW_ECJ, and ENOW_SIGNING_DIR to the installed tools and existing private release-key directory. Preserve the existing release key for updates; never commit it. The build writes the matching public Android app-link certificate to `public/.well-known/assetlinks.json` and copies the APK into `public/downloads/`.

## Verification and limits

Automated checks cover price evidence, model/accessory mismatches, shipping, currency, budgets, source dates, duplicate offers, private-address blocking, input limits, AI output restrictions, and installation guidance for each supported platform. Browser checks cover text search, full-card clicks, donation methods, countdown, seller handoff, and the installation dialog. Venmo and PayPal public payment pages displayed the intended recipient and $3; no payment was submitted. APK signature verified. Physical-device installations across all operating systems have not been tested here. Browser and operating-system installation prompts remain under the device's control.

Search coverage depends on available public sources; the app does not claim to search every seller or fabricate three results when fewer can be verified. Index observations retain their source timestamps and expire after seven days. Unknown shipping and condition are shown explicitly. Merchant checkout sets final price, shipping, tax, and delivery eligibility. Vireonix and discovery providers can be temporarily unavailable.

The public brand is e-verse. The existing repository, Neon function slug, Android package/signing identity, and browser storage keys remain stable for compatibility with existing deployments and installs. The current Android artifact is `public/downloads/e-verse.apk`; the prior download URL remains an alias.

