# Repository Guidance

- Follow the self-contained widget / encapsulated component approach when adding UI features. Each widget should manage its own markup, styles, and logic without leaking globals. Use widgets folder: widgets/widget-name/widget-name.ts.
- Prefer creating reusable TypeScript classes or factory functions for widgets and instantiate them from entry points.
- Narrative/gameplay datasets (cards, rules, scenario chapters, etc.) must live in dedicated JSON files (e.g. inside `src/data`) and should not be hardcoded inside TypeScript modules.
- Use `src/index.ts` as the entry point for your application.
- Describe your changes in `CHANGELOG.md`. By adding date time and description. Use pattern: "[date time][FIX/ADD FEATURE/CHANGE] Description"
- For each widget add **short** description widgets/widget-name/README.md: what it do, how to use, API (input/output), when to destroy, how it looks and behaves for the user etc. 