# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Check Commands

```bash
pnpm build                # Build all gadgets to dist/
pnpm lint                 # oxlint + Stylelint
pnpm lint:js              # oxlint only
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
│   ├── index.ts          # Barrel export
│   ├── getContent.ts     # Page content fetch (mw.Api wrapper)
│   └── log.ts            # mw.notify success/error helpers
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
- **Braces**: braces required for all control structures (`if`/`else`/`for`/`while`/`do`), no brace-less single-line bodies — enforced by `curly: ['error', 'all']`
- **Package manager**: pnpm
- **JSX**: Preact (`jsxImportSource: preact`)
- **Path alias**: `@/` → `src/`
- **Linter**: oxlint (`.oxlintrc.json`, `correctness` category at error; plugins `typescript`/`unicorn`/`oxc`/`import`/`jsdoc`/`react`/`promise`). Formatting rules are intentionally not linted — oxfmt owns them. Type-aware linting is on via `oxlint-tsgolint` (`typescript/no-floating-promises`, `no-misused-promises`, `switch-exhaustiveness-check`); `pnpm build` still runs `tsc` for type checking. `pnpm lint:js` covers the whole repo (`src/` + `scripts/`). Functions that carry a JSDoc block must document every param with `@param` and any return value with `@returns` (enforced by the jsdoc rules; destructured roots are unchecked via `checkDestructuredRoots: false`). Avoid `{{` inside JSDoc descriptions — oxlint's jsdoc parser fails to read the tags of a block containing it
- **Formatter**: oxfmt (tabWidth 4, printWidth 120, singleQuote, semi, trailingComma all, arrowParens avoid, endOfLine lf, sortImports enabled) — it also covers import ordering via `sortImports`
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
