# MUTQAN pricing catalog — implementation notes

## Scope delivered in this branch

This is an additive backend foundation for the service/installation/spare-parts pricing workflow. Existing request, customer, technician, and finance tables are not dropped or rewritten.

- `database/migrations/20261125_service_pricing_catalog_vat.sql`
  - Central coded item catalogue for spare parts, service labor, installation and other billable lines.
  - Service/issue price ranges (min/max).
  - Configurable VAT rate and VAT display controls.
  - Versioned request quotations and immutable line snapshots.
- `backend/api/pricing.php`
  - Role-checked catalogue and service-range reads.
  - Owner/operations-only settings and catalogue maintenance.
  - Owner/operations-only service price range maintenance.
  - Assigned-technician or operations/owner quotation creation.
  - Client/owner/operations quotation decision endpoint.
  - Server-side VAT calculations for inclusive and exclusive price modes.
  - CSRF checks, audit events, customer in-app notification, transaction handling.

## API actions

All POST actions require the logged-in MUTQAN session and `X-CSRF-Token`.

- `GET backend/api/pricing.php?action=catalog&service_key=...`
- `GET backend/api/pricing.php?action=ranges&service_key=...`
- `GET backend/api/pricing.php?action=quote&request_id=123`
- `POST ...?action=settings`
- `POST ...?action=save_item`
- `POST ...?action=save_range`
- `POST ...?action=create_quote`
- `POST ...?action=decide_quote`

## Database rollout

1. Take a verified Hostinger MySQL backup.
2. Confirm the existing role-based portal migration is already installed.
3. Apply `20261125_service_pricing_catalog_vat.sql` once to the existing MUTQAN database.
4. Deploy this branch to a staging copy first.
5. Verify VAT mode, catalogue visibility, request access checks, quotation versioning and client decisions.

The seeded VAT rate is 15% as the initial Saudi-market default; the owner/operations setting is editable. Confirm the legally applicable rate and item tax treatment with the business accountant before production use.

## Important integration boundary

The existing repository README states that the current React preview stores data in browser-local storage and is not a production shared backend. This branch adds the PHP API and database schema only. The technician, customer, operations and owner screens still need to be wired to these endpoints, including catalogue drawers on maintenance/installation/washing request screens, admin catalogue editor, quote approval UI, and the expense/receipt upload workflow described separately. No production database migration or live Hostinger deployment has been performed by this branch.

## Acceptance checks still required before release

- Apply migration against a disposable copy of the real schema.
- PHP syntax check on the Hostinger PHP version.
- Verify all role combinations and cross-request denial.
- Verify inclusive/exclusive VAT calculations and exempt lines.
- Verify quote version superseding and concurrent quote creation.
- Confirm customer notifications render and open the correct request.
- Wire upload handling for technician-supplied invoice and part photos using the repository's local upload/hash binding approach.
- Connect request creation and existing request detail screens without changing historical request prices.

## Front-end work added on this branch

- `react-export/src/hooks/usePricingCatalog.js`: catalogue, service-range and visibility settings data access.
- `react-export/src/pages/PricingCatalog.jsx`: owner/operations catalogue editor, coded parts, VAT settings, price-range editor and independent customer/technician visibility switches.
- `react-export/src/components/RequestQuotePanel.jsx`: technician quote builder (catalogued or custom line items), VAT breakdown, and customer approve/reject UI.
- `react-export/src/pages/NewOrder.jsx`: AC equipment type selection (18/24/30/36 split, pressure, concealed, package, central, chiller) and indicative ranges.
- Request detail screens show device type and quote approval; operations room has a direct catalogue link.
- React build workflow now runs on feature branches and pull requests.

## Critical production limitation — do not skip

The repository's React export currently uses `runtimeData.js`, which explicitly stores data in browser `localStorage` only. The UI additions above use that existing adapter for the React preview; they do **not** synchronize records between the customer, technician, operations and owner devices. The PHP pricing API and MySQL migration are the production backend foundation, but the React UI has not yet been connected to the PHP session/CSRF API. Therefore:
- Do not publish the React preview as a live multi-user pricing workflow.
- Do not apply the migration to the production database until a verified backup and staging test.
- Do not merge/deploy as production-ready until the shared PHP auth/session adapter is wired to these screens and end-to-end tests pass.
- Technician receipt/part-photo and expense-photo uploads remain a separate unfinished integration.
