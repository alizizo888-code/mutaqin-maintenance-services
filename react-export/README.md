# React/Vite export — progress

## Uploaded so far
- Root configuration: `index.html`, `package.json`, `postcss.config.js`, `tailwind.config.js`, `vite.config.js`
- Top-level source files under `src/`: `App.jsx`, `main.jsx`, `index.css`, `registration.js`, `serviceShowcase.js`, `serviceTree.js`, `warranty.js`, `workflow.js`, `aiAdapter.js`, `assignment.js`, `constants.js`, `mutqanAi.js`, `notify.js`, `passkey.js`, `payment.js`, `pricing.js`
- 20 top-level page files under `src/pages/`, including `NewOrder.jsx`, `ClientOrderDetail.jsx`, `StaffGate.jsx`, `OperationsRoom.jsx`, technician pages, payment pages, AI settings and handoff detail.
- 11 customer-facing pages under `src/pages/client/`: `Home.jsx`, `More.jsx`, `MyOrders.jsx`, `MyWarranties.jsx`, `Offers.jsx`, `Services.jsx`, `Store.jsx`, `Account.jsx`, `AiChat.jsx`, `Calculator.jsx`, `Contact.jsx`.
- `lib/` complete: 49 of 49 uploaded files stored under `src/lib/` in three batches (20 + 20 + 9). The duplicate-upload suffix `(1)` was removed from filenames such as `useLive(1).js` to preserve expected import names.

## Source directories verified
- `src/components/` — 21 files in place; the manually uploaded originals in the repository-root `components/` directory were preserved.
- `src/hooks/` — 11 files in place.
- `src/lib/` — 49 files in place.
- `src/pages/` — 20 operational pages and 11 client-facing pages.

Routes `/notifications` and `/staff/notify-settings` are now wired in `App.jsx`.

The 11 client pages and all 49 `lib/` files are in place. Several original `lib/` files whose names begin with an underscore remain internal Whacka stubs. Core client-facing modules now use explicitly local-demo adapters, while remote authentication, team permissions, real-time cross-device data, AI, push notifications, online payments, file uploads, and server triggers remain unavailable.

This export is incomplete until those folders and their dependencies are uploaded. The original Whacka README is preserved at `reference/original-uploads/react-export-README-original.md`. It states that authentication, database, storage, AI, payments, push and platform bootstrap rely on Whacka services not included in the export; those integrations will need replacement or configuration for independent hosting.

The PHP + MySQL application currently lives at the repository root in `index.php` and `backend/`.


## Standalone runtime status
A local demo adapter now lets the client UI mount and persist demo records in browser storage. It is not a replacement for Whacka's hosted runtime: local data does not sync across devices, staff roles are denied by default, and authentication, AI, push notifications, online payments, file uploads, and server triggers are deliberately disabled until their trusted backend integrations are implemented. Do not use this mode for real customer or payment data.


Production smoke test now opens the entry UI and visits all 30 registered customer/staff routes in Chromium, checks for page render timeouts and uncaught runtime errors, and confirms the local-demo warning and notifications navigation.
