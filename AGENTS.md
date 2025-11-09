# Repository Guidance

- Follow the self-contained widget / encapsulated component approach when adding UI features. Each widget should manage its own markup, styles, and logic without leaking globals.
- Prefer creating reusable TypeScript classes or factory functions for widgets and instantiate them from entry points.
