# React/Vite export — progress

## Uploaded so far
- Root configuration: `index.html`, `package.json`, `postcss.config.js`, `tailwind.config.js`, `vite.config.js`
- Top-level source files under `src/`: `App.jsx`, `main.jsx`, `index.css`, `registration.js`, `serviceShowcase.js`, `serviceTree.js`, `warranty.js`, `workflow.js`, `aiAdapter.js`, `assignment.js`, `constants.js`, `mutqanAi.js`, `notify.js`, `passkey.js`, `payment.js`, `pricing.js`
- 20 top-level page files under `src/pages/`, including `NewOrder.jsx`, `ClientOrderDetail.jsx`, `StaffGate.jsx`, `OperationsRoom.jsx`, technician pages, payment pages, AI settings and handoff detail.
- 11 customer-facing pages under `src/pages/client/`: `Home.jsx`, `More.jsx`, `MyOrders.jsx`, `MyWarranties.jsx`, `Offers.jsx`, `Services.jsx`, `Store.jsx`, `Account.jsx`, `AiChat.jsx`, `Calculator.jsx`, `Contact.jsx`.
- First `lib/` upload batch: 20 of 49 files, stored under `src/lib/`.

## Still missing
The following directories are still incomplete or pending:
- `src/components/` — not yet uploaded
- `src/hooks/` — not yet uploaded
- `src/lib/` — 20 of 49 files uploaded; 29 remain in the next two batches

The 11 uploaded client pages now live in `src/pages/client/`. Note that the first 20 `lib/` files are Whacka platform stubs; they resolve API names but deliberately throw when called, so the integration must be replaced or configured before independent runtime use.

This export is incomplete until those folders and their dependencies are uploaded. The original Whacka README is preserved at `reference/original-uploads/react-export-README-original.md`. It states that authentication, database, storage, AI, payments, push and platform bootstrap rely on Whacka services not included in the export; those integrations will need replacement or configuration for independent hosting.

The PHP + MySQL application currently lives at the repository root in `index.php` and `backend/`.
