# React/Vite export — progress

## Uploaded so far
- Root configuration: `index.html`, `package.json`, `postcss.config.js`, `tailwind.config.js`, `vite.config.js`
- Top-level source files under `src/`: `App.jsx`, `main.jsx`, `index.css`, `registration.js`, `serviceShowcase.js`, `serviceTree.js`, `warranty.js`, `workflow.js`, `aiAdapter.js`, `assignment.js`, `constants.js`, `mutqanAi.js`, `notify.js`, `passkey.js`, `payment.js`, `pricing.js`

## Still missing
The following directories are referenced by `App.jsx` and the top-level modules but have not been uploaded yet:
- `src/components/`
- `src/hooks/`
- `src/lib/`
- `src/pages/`

This export is incomplete until those folders and their dependencies are uploaded. The original Whacka README is preserved at `reference/original-uploads/react-export-README-original.md`. It states that authentication, database, storage, AI, payments, push and platform bootstrap rely on Whacka services not included in the export; those integrations will need replacement or configuration for independent hosting.

The PHP + MySQL application currently lives at the repository root in `index.php` and `backend/`.
