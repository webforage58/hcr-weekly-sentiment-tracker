# Repository Guidelines

## Project Structure & Module Organization
- `components/`: React UI (e.g., `DashboardSetup`, `ReportDashboard`). Keep new UI pieces as focused functional components.
- `services/`: Core logic (`episodeProcessor`, `gemini`, `reportComposer`, `episodeDB`, `episodeSearch`). Add new data/AI orchestration here.
- `utils/`: Shared helpers (date windows, migrations, aggregation glue).
- `types.ts`: Source-of-truth TypeScript types; update here first when schemas change.
- `test-*.ts`: Manual browser-driven test harnesses; load via dev server and call through `window.*` helpers.
- `dist/`: Build output (do not edit).

## Build, Test, and Development Commands
- `npm install`: Install dependencies.
- `npm run dev`: Start Vite dev server; use for manual tests and UI work.
- `npm run build`: Production build; use to catch TypeScript errors and bundling issues.
- `npm run preview`: Serve the production build locally for smoke checks.
- Manual tests: start dev server, open browser console, and run (examples):
  - `await window.testEpisodeProcessor.testBasicProcessing()`
  - `await window.testReportComposer.testBasicComposition()`
  - `await window.testAnalyzeEpisode.testSingleEpisode()`

## Coding Style & Naming Conventions
- Language: TypeScript + React (functional components with hooks).
- Indentation: 2 spaces; keep lines reasonably short.
- Naming: PascalCase for components, camelCase for functions/variables, UPPER_SNAKE for constants.
- Types: Prefer explicit return types on exported functions; keep shared interfaces in `types.ts`.
- Imports: Favor project-relative aliases (`@/types`) when available; group React/third-party first, local second.
- UI: Keep JSX lean; extract helpers instead of deeply nested JSX.

## Testing Guidelines
- No automated runner is wired; use the manual test files in `test-*.ts` via the browser console.
- When adding new logic, mirror the existing pattern: expose test functions on `window.<testSuite>` for ad-hoc runs.
- Aim to cover: caching behavior, concurrency limits, and aggregation correctness. Note any gaps in `todo.md` or `state.md`.

## Commit & Pull Request Guidelines
- Commits: Use short, imperative summaries (e.g., "Add episode progress UI", "Fix cache categorization").
- Scope commits to a logical unit (UI tweak, processor fix, type update).
- PRs: Include what changed, why, and how to test. For UI changes, add before/after screenshots or GIFs. Link relevant tasks from `todo.md`/`state.md` if applicable.

## Security & Configuration Tips
- API keys: Managed via the AI Studio key picker (`window.aistudio`). Never hardcode or commit keys.
- Data: IndexedDB caches episode insights; avoid storing secrets. Use `services/episodeDB` helpers rather than direct IndexedDB calls.
- Date handling: Use string dates (YYYY-MM-DD) to avoid timezone drift; leverage `utils/reportUtils.getWeekWindows`.
