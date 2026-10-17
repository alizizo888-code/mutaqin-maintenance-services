# React/Vite export — progress

## Uploaded so far
- Root configuration: `index.html`, `package.json`, `postcss.config.js`, `tailwind.config.js`, `vite.config.js`
- Top-level source files under `src/`: `App.jsx`, `main.jsx`, `index.css`, `registration.js`, `serviceShowcase.js`, `serviceTree.js`, `warranty.js`, `workflow.js`, `aiAdapter.js`, `assignment.js`, `constants.js`, `mutqanAi.js`, `notify.js`, `passkey.js`, `payment.js`, `pricing.js`
- 20 top-level page files under `src/pages/`, including `NewOrder.jsx`, `ClientOrderDetail.jsx`, `StaffGate.jsx`, `OperationsRoom.jsx`, technician pages, payment pages, AI settings and handoff detail.
- 11 customer-facing pages under `src/pages/client/`: `Home.jsx`, `More.jsx`, `MyOrders.jsx`, `MyWarranties.jsx`, `Offers.jsx`, `Services.jsx`, `Store.jsx`, `Account.jsx`, `AiChat.jsx`, `Calculator.jsx`, `Contact.jsx`.
- `lib/` complete: 49 of 49 uploaded files stored under `src/lib/` in three batches (20 + 20 + 9). The duplicate-upload suffix `(1)` was removed from filenames such as `useLive(1).js` to preserve expected import names.

## Still missing
The following directories are still incomplete or pending:
- `src/components/` — 21 files copied from the manually uploaded root `components/` directory into the correct React source path. Original root-level files preserved.
- `src/hooks/` — 11 uploaded: `useAiSettings.js`, `useAssignment.js`, `useLocator.js`, `useNotifySettings.js`, `usePaymentMethods.js`, `usePricing.js`, `useSession.js`, `useTeamRole.js`, `useTechProfiles.js`, `useWaNumbers.js`, `useWarranty.js`

The 11 uploaded client pages live in `src/pages/client/`. All 49 supplied `lib/` files are now uploaded. Important: the supplied files explicitly describe themselves as Whacka platform stubs; they document API names but deliberately throw when called. Replace or implement these platform services before independent runtime use.

This export is incomplete until those folders and their dependencies are uploaded. The original Whacka README is preserved at `reference/original-uploads/react-export-README-original.md`. It states that authentication, database, storage, AI, payments, push and platform bootstrap rely on Whacka services not included in the export; those integrations will need replacement or configuration for independent hosting.

The PHP + MySQL application currently lives at the repository root in `index.php` and `backend/`.


## Standalone runtime status
A local demo adapter now lets the client UI mount and persist demo records in browser storage. It is not a replacement for Whacka's hosted runtime: local data does not sync across devices, staff roles are denied by default, and authentication, AI, push notifications, online payments, file uploads, and server triggers are deliberately disabled until their trusted backend integrations are implemented. Do not use this mode for real customer or payment data.
