# Upgrade Astro and Typst compatibility

## Goal

Upgrade the repository's development and demo path to Astro 7.1 and embedded
Typst 0.15, repairing local integration incompatibilities while keeping the
published Astro integration behavior and consumer-selected Typst peer model.

## Confirmed Facts

- The requested targets are Astro 7.1 and Typst 0.15.
- Existing user changes are present in `package.json`, `pnpm-lock.yaml`, and
  `pnpm-workspace.yaml`; unrelated changes must be preserved.
- Those changes already select Astro 7.1.1, Vite 8.1.5, and matching official
  Astro integrations, but select TypeScript 7.0.2. Astro 7.1.1 uses TypeScript
  6.x and `@astrojs/check@0.9.9` declares TypeScript 5.x/6.x support.
- `src/lib/typst.ts:1` imports `@myriaddreamin/typst-ts-node-compiler`; the
  system Typst executable is not the renderer used by the project. The current
  lockfile resolves the three typst.ts peer packages to 0.6.1-rc3 (Typst
  0.14.2).
- typst.ts `0.8.0-rc3` is the published RC line that embeds Typst 0.15. Its
  compiler probe returned `version(0, 15, 0)`, and `NodeCompiler.svg()` still
  emits the `typst-doc` and `typst-text` classes used by the project.
- The repository history and README intentionally expose Typst compiler
  packages as peer dependencies so consumers can select older Typst releases.
  The NodeCompiler APIs used here are unchanged between the current line and
  RC3; this task will not deliberately narrow that peer policy.
- `astro-integration-kit@0.20.0` is the latest published version and declares
  Astro support only through v6. `src/lib/integration.ts:7` imports its
  `createResolver` and `watchDirectory`; the latter only watches the package's
  own integration directory during development and is not needed by the Vite
  `.typ` watcher in `src/lib/vite.ts:42-62`.
- Vite 8's migration guide requires a transform that converts a non-JavaScript
  extension to return `moduleType: "js"`. `src/lib/vite.ts:167-170` currently
  returns only `code` and `map`.
- The current `pnpm run build` baseline stops in TypeScript with TS7
  `rootDir` and non-portable inferred-type diagnostics. Direct Astro commands
  then fail because peer-only compiler and Cheerio packages are not linked as
  local development dependencies.
- `.github/workflows/publish.yml:37-40` runs its second build on Node 20, below
  Astro 7's Node.js `>=22.12.0` requirement. The Nix development shell already
  provides Node 24.18.0 and Typst 0.15.1.

## Requirements

- R1. Keep Astro resolved at 7.1.x (the current requested patch is 7.1.1) and
  regenerate the lockfile consistently with the manifest.
- R2. Use `@myriaddreamin/typst-ts-node-compiler`,
  `@myriaddreamin/typst-ts-renderer`, and `@myriaddreamin/typst.ts` at the
  single `0.8.0-rc3` line for local development and compatibility verification;
  retain the existing broad peer ranges for consumers unless a tested API
  break makes that impossible.
- R3. Use a TypeScript 6.x release supported by Astro's checker, set an
  explicit source root for declaration output, and migrate the demo from the
  removed legacy content collection APIs to Astro's loader-based content layer.
- R4. Remove or replace `astro-integration-kit` usage so the integration has no
  dependency whose published Astro peer range excludes Astro 7. Preserve `.typ`
  file HMR through the existing Vite watcher.
- R5. Mark the Vite `.typ` transform as JavaScript-compatible for Vite 8 while
  preserving SVG/HTML output, emitted assets, frontmatter, and slots.
- R6. Make every package imported by local source available during repository
  development, without changing the peer dependency contract exposed to
  consumers.
- R7. Update user-facing version documentation and CI runtime declarations to
  describe and exercise the new target.

## Acceptance Criteria

- [ ] R1: `corepack pnpm install --frozen-lockfile` succeeds and the lockfile
      resolves Astro 7.1.x, Vite 8.x, and TypeScript 6.x.
- [ ] R2: the local compiler probe reports Typst `0.15.0`; the rich SVG output
      contains `typst-doc` and `typst-text`; all three typst.ts packages resolve
      to `0.8.0-rc3`.
- [ ] R3: `corepack pnpm run compile` and `corepack pnpm exec astro check`
      complete without TypeScript or declaration portability errors.
- [ ] R4/R5: `corepack pnpm run build` loads the integration, transforms `.typ`
      modules under Vite 8, and produces the demo's SVG and HTML routes without
      compatibility exceptions.
- [ ] R6: a clean install has no unresolved imports for the compiler, Cheerio,
      or other packages directly imported by `src/`.
- [ ] R7: README version instructions/badges mention Typst 0.15 and the RC3
      selection, and both publish jobs use a Node version supported by Astro 7.
- [ ] Existing user changes remain incorporated; no unrelated files are
      reverted.

## Out of Scope

- Replacing typst.ts with the system `typst` CLI or writing a new compiler
  backend.
- Removing support documentation for older consumer-selected Typst versions
  when the existing APIs remain compatible.
- Unrelated feature work, visual redesign, or broad refactoring.
