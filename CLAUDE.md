# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Check Commands

```bash
pnpm build                # Build all gadgets to dist/
pnpm lint                 # ESLint + Stylelint
pnpm lint:js              # ESLint only
pnpm lint:css             # Stylelint only
pnpm lint:fix             # Auto-fix
pnpm fmt                  # Format code with oxfmt
```

`pnpm build` cleans `dist/`, then scans each subdirectory under `src/gadgets/` and builds them via Vite as IIFE bundles. Output is `<GadgetName>.min.js` / `<GadgetName>.min.css` + sourcemap.

## Project Structure

```
src/
├── @types/
│   ├── global.d.ts       # *.scss module declarations
│   └── mediawiki.d.ts    # Imports types-mediawiki
├── utils/
│   ├── getContent.ts     # Page content fetch (mw.Api wrapper)
│   └── statusConsole.ts  # mw.notify success/error helpers
└── gadgets/              # Each subdirectory is a standalone gadget
    └── <GadgetName>/
        ├── <GadgetName>.ts/.tsx/.js  # Entry (filename must match dir name)
        ├── <GadgetName>.scss         # Or pure-style gadget (e.g. DisambigLinks)
        ├── components/               # Preact components (optional)
        └── modules/                  # Module files (optional)
```

## Code Standards

- **Language**: TypeScript (strict), some older gadgets use JavaScript
- **Module format**: ESM, built as IIFE
- **Indentation**: 4 spaces, Unix line endings
- **Quotes/Semicolons**: Single quotes, semicolons required
- **Braces**: `curly: ['error', 'all']` — braces required for all control structures (`if`/`else`/`for`/`while`/`do`), no brace-less single-line bodies
- **Package manager**: pnpm
- **JSX**: Preact (`jsxImportSource: preact`)
- **Path alias**: `@/` → `src/`
- **Formatter**: oxfmt (tabWidth 4, printWidth 120, singleQuote, semi, trailingComma all, arrowParens avoid, endOfLine lf, sortImports enabled)
- **TypeScript strict options**: `strict`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`, `isolatedModules`

## Gadget Architecture Conventions

1. Entry file matches directory name: `<GadgetName>.ts`/`.tsx`/`.js`/`.scss`
2. Each gadget is a self-executing IIFE with an early-return guard clause using `mw.config.get()`
3. Use `mw.util.addPortletLink()` or jQuery to add UI entry points
4. Use `mw.Api()` / `postWithToken('csrf', ...)` / `postWithToken('csrf', ...)` for MediaWiki API calls, always with `formatversion: 2`
5. Entry files do initialization only — business logic goes in `modules/`
6. Shared utilities in `src/utils/`, imported via `@/utils/xxx`
7. Preact components in `components/`, mounted via `render()`
8. CSS/SCSS-only gadgets (e.g. DisambigLinks) use the stylesheet as entry point
9. Global MediaWiki types come from `types-mediawiki`, imported via `src/@types/mediawiki.d.ts`
10. `tsconfig.json` enables `strict` + `noUncheckedIndexedAccess` — watch type safety
