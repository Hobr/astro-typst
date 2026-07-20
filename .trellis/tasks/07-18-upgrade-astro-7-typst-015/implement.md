# Implementation plan: Astro 7.1 and Typst 0.15 compatibility

## Preconditions

- Preserve the pre-existing user changes in `package.json`, `pnpm-lock.yaml`,
  and `pnpm-workspace.yaml`.
- Keep the task in `planning` until this plan is approved and
  `task.py start` is run.
- In Phase 2, load `trellis-before-dev` before editing source or manifests.

## 1. Normalize the supported dependency set

- [x] Update `package.json`:
  - remove `astro-integration-kit`;
  - replace TypeScript 7 with the supported TypeScript 6.x line;
  - add local development dependencies for
    `@myriaddreamin/typst-ts-node-compiler`,
    `@myriaddreamin/typst-ts-renderer`, and `@myriaddreamin/typst.ts`, all
    exactly `0.8.0-rc3`;
  - add a local Cheerio development dependency compatible with the existing
    peer range;
  - retain Astro 7.1.1, Vite 8.1.x, the user's other compatible dependency
    updates, and the existing consumer peer ranges;
  - add a compatibility-probe script and include it in the build gate.
- [x] Regenerate `pnpm-lock.yaml` using `corepack pnpm install`.
- [x] Confirm the lockfile contains one RC3 line for the three typst.ts packages,
  TypeScript 6.x, and no Astro Integration Kit package.

Review gate: installation must complete without an unsupported Astro peer or a
missing native compiler package before source migration proceeds.

## 2. Add an executable Typst compatibility probe

- [x] Add a small Node script under `scripts/` using built-in assertions only.
- [x] Compile and query `#metadata(sys.version)<version>` and require Typst
  `version(0, 15, 0)`.
- [x] Compile a minimal document through `NodeCompiler.svg()` and require the
  `typst-doc` and `typst-text` rich-SVG markers.
- [x] Make failures print the observed version or missing output contract so CI
  diagnostics are actionable.

Review gate: run the probe directly before relying on the Astro demo build.

## 3. Restore TypeScript declaration compilation

- [x] Add `rootDir: "src"` to `tsconfig.json`, retaining `dist/` output and
  declaration/source-map settings.
- [x] Run `corepack pnpm run compile`.
- [x] Move the legacy collection to `src/content.config.ts`, add a `glob()`
  loader, use `entry.id` and `render(entry)`, and add a portable public
  collection-map annotation.
- [x] Inspect `dist/index.js`, `dist/index.d.ts`, and `dist/renderer/index.js` to
  confirm the published path layout did not shift.

Review gate: compilation and declaration emission must pass without disabling
checks or excluding relevant source merely to suppress diagnostics.

## 4. Migrate the Astro and Vite integration boundary

- [x] In `src/lib/integration.ts`, remove Astro Integration Kit imports, the
  resolver, and `watchDirectory()` call.
- [x] Preserve renderer registration, `.typ` page/content registration,
  frontmatter extraction, native compiler externalization, and the existing
  Vite plugin installation.
- [x] Preserve all public `AstroTypstConfig` fields while applying integration
  defaults, including emitted-asset and HTML-mode settings.
- [x] Preserve the configured `emitSvgDir`, including nested dot-prefixed
  paths, while preventing traversal outside the final Astro output directory.
- [x] Use an Astro-supported `URL` for the local renderer and remove the
  redundant Rollup node resolver.
- [x] In `src/lib/vite.ts`, add `moduleType: "js"` to generated `.typ` transform
  results using the Vite 8-compatible result type.
- [x] Pass Astro's setup command into the Vite plugin, with Vite environment
  fallbacks, so `emitSvg` writes standalone files during production builds.
- [x] Register Astro-build SVGs and flush them from `astro:build:done`; retain
  Rollup `emitFile` for direct Vite builds.
- [x] Run TypeScript compilation after each boundary edit.
- [x] Run `corepack pnpm exec astro check` to catch stricter Astro 7 template and
  content diagnostics.

Rollback point: if imported `.typ` HMR no longer works, keep Astro Integration
Kit removed and add the smallest direct Astro/Vite watcher behavior supported by
Astro 7; do not restore an unsupported peer dependency.

## 5. Update version documentation and release runtime

- [x] Add a Typst 0.15 badge and a documented 0.8.0-rc3 dependency set to
  `README.md`, preserving the older compiler-selection examples.
- [x] Update stale minimum-version diagnostics in local code if they would point
  users at a compiler that cannot provide Typst 0.15.
- [x] Change the Node 20 publish job in `.github/workflows/publish.yml` to an
  Astro 7-supported Node release, keeping the existing Node 22 job valid.
- [x] Leave `flake.nix`/`flake.lock` unchanged unless verification stops reporting
  Typst 0.15.x and Node 22.12+.

## 6. Full validation

Run in this order:

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm run test
corepack pnpm run compile
corepack pnpm exec astro check
corepack pnpm run build
nix develop --command typst --version
nix develop --command node --version
corepack pnpm pack --pack-destination /tmp/astro-typst-pack --json
git diff --check
```

- [x] Confirm the compatibility probe reports embedded Typst 0.15.0.
- [x] Confirm `dist-demo/` contains the index, `.typ` page, content collection,
  HTML export, SVG export, slot, and emitted-asset outputs expected from the
  demo.
- [x] Inspect the 0.15.0 probe plus representative generated HTML for non-empty
  Typst HTML, non-empty emitted SVG references, and slot content.
- [x] Start the Astro 7 development server on an available localhost port and
  request representative SVG, HTML, content, and slot routes.
- [x] Touch an imported `.typ` file without changing its contents, request the
  route again, and confirm the development server remains healthy.
- [x] Stop the development server before ending the implementation turn.
- [x] Review `git diff --stat`, `git diff`, and `git status --short` to ensure no
  unrelated user changes were reverted and no generated output is accidentally
  tracked.

Validation note: pnpm 10.11 does not support `pack --dry-run`, so the package
was generated under `/tmp` with `pack --json` and its file list was inspected.
The workspace filesystem had an unrelated, uninterruptible stale Astro process
holding generated paths; the exact source and dependency tree was copied to
`/tmp` for the successful `astro check`, full build, route, asset, and HMR runs.

## Risk handling

- RC3 native-package failure: verify the platform-specific optional package and
  lockfile first; do not fall back to typst.ts 0.7 because that would violate
  the Typst 0.15 target.
- Vite 8 module typing failure: type the transform result against the Vite 8
  plugin contract or use a narrow compatibility type; do not cast the entire
  plugin to `any`.
- Astro internal-hook failure: update the local `SetupHookParams` boundary in
  one place and keep the rest of the integration unaware of the internal type.
- Typst 0.15 content failure: update only affected demo syntax and add the
  failing document to validation; do not weaken compiler diagnostics.
- Generated-output drift from Astro 7 whitespace or Typst 0.15 HTML changes:
  verify semantics and route content before deciding whether an explicit legacy
  configuration is required.

## Completion gate

Implementation is complete only when all PRD acceptance criteria are satisfied,
the full validation sequence passes, the development server has been stopped,
and the final diff contains only the migration, its regression probe, docs, CI,
lockfile, and Trellis task artifacts.
