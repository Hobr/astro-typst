# Astro-Typst Integration Contract

## 1. Scope / Trigger

Use this contract when changing Astro, Vite, TypeScript, typst.ts, `.typ`
content loading, renderer registration, or the demo build. These boundaries
must be verified together because a standalone Typst compile does not exercise
Astro content sync, generated modules, renderers, routes, or emitted assets.

## 2. Signatures

```typescript
typstIntegration(config?: Partial<AstroTypstConfig>): AstroIntegration

// Vite transform result for every handled `.typ` module
{
  code: string;
  map: null;
  moduleType: "js";
}
```

The Astro 7 content collection is declared in `src/content.config.ts`:

```typescript
defineCollection({
  loader: glob({ pattern: "**/*.typ", base: "./src/content/typ" }),
  schema: typSchema,
});
```

## 3. Contracts

- Local development pins all three typst.ts packages to one version. For the
  Typst 0.15 target, that version is `0.8.0-rc3`.
- `typstIntegration()` forwards every `AstroTypstConfig` field to the Vite
  plugin, then applies defaults only to `options` and `target`. Do not rebuild a
  partial config that drops `emitSvg`, `emitSvgDir`, `htmlMode`, or `fontArgs`.
- `peerDependencies` remain the consumer compatibility policy; matching local
  `devDependencies` make repository builds reproducible.
- Debug renderer registration uses a `file:` URL anchored to `import.meta.url`.
  Published-package mode uses `astro-typst/dist/renderer/index.js`.
- The native compiler remains external in the Vite build.
- Build-vs-serve behavior is passed from Astro's `astro:config:setup` command
  when the Vite plugin is created. Transform environment mode and
  `configResolved.command` are fallbacks for direct plugin use. Plugin code
  runs in Node and must not branch on `import.meta.env.PROD`.
- Collection routes use `entry.id`; renderable entries use `render(entry)` from
  `astro:content`.
- `emitSvgDir` must resolve inside the final Astro output directory. Nested and
  dot-prefixed relative paths remain supported.
- Astro builds register generated SVGs during transforms and write them beneath
  the final `astro:build:done` `dir`; direct Vite builds use Rollup's
  `emitFile` fallback.
- Vite handles `.typ` HMR. Do not reintroduce Astro Integration Kit solely for
  `watchDirectory()`.

## 4. Validation & Error Matrix

| Condition | Expected failure or response |
| --- | --- |
| Embedded Typst is not 0.15.0 | `pnpm test` fails and prints the observed version |
| Rich SVG markers disappear | `pnpm test` fails on `typst-doc` or `typst-text` |
| Legacy `src/content/config.ts` is restored | Astro reports `LegacyContentConfigError` |
| A content route uses `slug` or `entry.render()` | Astro 7 type checking fails |
| `.typ` transform omits `moduleType: "js"` | Vite 8 may parse generated code as the wrong module type |
| Debug renderer uses bare `dist/renderer/index.js` | Rolldown cannot resolve the virtual renderer import |
| Emit mode reads `import.meta.env.PROD` in plugin code | Build output incorrectly keeps base64 SVG data instead of emitted files |
| Integration drops optional config fields | `emitSvg`, HTML mode, or compiler options silently have no effect |
| Astro-only transform calls `emitFile` without final registration | Static asset rearrangement drops the file and leaves a broken page URL |
| `emitSvgDir` escapes the final output directory | `astro:build:done` throws before writing any escaped asset path |

## 5. Good / Base / Bad Cases

- Good: run the compiler probe, Astro check, a nine-route static build, and a
  development-server HMR smoke test.
- Base: a minimal `.typ` file compiles to a non-empty rich SVG and reports
  `version(0, 15, 0)`.
- Bad: infer compatibility from the system `typst` binary or from TypeScript
  compilation alone.

## 6. Tests Required

- `corepack pnpm test`: assert embedded version and rich-SVG class markers.
- `corepack pnpm run compile`: assert package JavaScript and declarations emit
  under `dist/`.
- `corepack pnpm exec astro check`: assert zero diagnostics after content sync.
- `corepack pnpm exec astro build`: assert SVG, HTML, content, slot, and emitted
  asset routes build.
- Development smoke test: request representative routes, touch an imported
  `.typ` file, and assert the server remains healthy.

## 7. Wrong vs Correct

Wrong:

```typescript
const serverEntrypoint = "dist/renderer/index.js";
const isBuild = import.meta.env.PROD;
const normalized = { options, target };
return { code, map: null };
```

Correct:

```typescript
const serverEntrypoint = isDebug
  ? new URL("../../dist/renderer/index.js", import.meta.url)
  : "astro-typst/dist/renderer/index.js";

const normalized = {
  ...config,
  options: { remPx: 16, ...config.options },
  target: config.target ?? defaultTarget,
};

configResolved(config) {
  command = config.command;
}

const isBuild = isAstroBuild
  || this.environment?.mode === "build"
  || command === "build";

return { code, map: null, moduleType: "js" };
```
