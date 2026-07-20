# Astro 7.1 and Typst 0.15 compatibility findings

## Sources

- Astro v7 migration guide:
  <https://docs.astro.build/en/guides/upgrade-to/v7/>
- Astro v6 migration guide:
  <https://docs.astro.build/en/guides/upgrade-to/v6/>
- Astro 7.0.0 release:
  <https://github.com/withastro/astro/releases/tag/astro%407.0.0>
- Vite 8 migration guide:
  <https://vite.dev/guide/migration>
- Typst 0.15.0 release:
  <https://github.com/typst/typst/releases/tag/v0.15.0>
- typst.ts 0.8.0-rc3 release:
  <https://github.com/Myriad-Dreamin/typst.ts/releases/tag/v0.8.0-rc3>
- Astro Integration Kit migration guide:
  <https://astro-integration-kit.netlify.app/migration-guide/>

## Version constraints

- Astro 7.1.1 requires Node.js 22.12.0 or newer and uses Vite 8.
- Astro 7.1.1 develops against TypeScript 6.x. `@astrojs/check@0.9.9`
  declares support for TypeScript 5.x and 6.x, not TypeScript 7.
- typst.ts 0.7.0 embeds Typst 0.14.2.
- The npm `rc` tag for the three typst.ts packages is 0.8.0-rc3. The RC3
  `Cargo.lock` identifies Typst, `typst-library`, and `typst-syntax` as 0.15.0.
- `astro-integration-kit@0.20.0` is its latest npm release and its Astro peer
  range ends at Astro 6.

## Upstream migration effects

- Astro 7 replaces Astro's Go compiler with the stricter Rust compiler, changes
  default whitespace compression to JSX rules, and uses Satteri as the default
  Markdown processor. The demo build must cover templates and HTML output.
- Astro 7 rejects legacy content configuration. The project must use
  `src/content.config.ts`, a `glob()` loader, `entry.id`, and the top-level
  `render(entry)` API instead of `src/content/config.ts`, `entry.slug`, and
  `entry.render()`.
- Vite 8 uses Rolldown module-type detection. A plugin that transforms a custom
  extension into JavaScript should return `moduleType: "js"`; this applies to
  the `.typ` transform in `src/lib/vite.ts`.
- Typst 0.15 changes HTML paragraph grouping and removes classes from its plain
  SVG exporter. The project calls typst.ts `NodeCompiler.svg()`, whose rich SVG
  layer must be checked separately.
- Astro Integration Kit's migration guide removes `watchDirectory` without a
  replacement. This project already has a `.typ` watcher in its Vite plugin;
  the kit's resolver exists only to feed the package directory to that helper.
- Vite 8's native resolver accepts Astro's public `URL` renderer entrypoint.
  Using a URL anchored to `import.meta.url` replaces the old bare local
  `dist/renderer/index.js` specifier and removes the need for
  `@rollup/plugin-node-resolve`.
- Plugin code runs in Node's config environment, where `import.meta.env.PROD`
  is not a reliable build-mode signal. Astro may resolve the shared config for
  serving and transform `.typ` content during content sync before its production
  environments run. The integration must pass `astro:config:setup`'s command
  into the Vite plugin; transform environment mode and `configResolved.command`
  are only direct-plugin fallbacks.
- The integration's config normalization previously copied only `options` and
  `target`. That silently removed `emitSvg`, `emitSvgDir`, `htmlMode`, and other
  caller settings before the Vite plugin saw them; normalization must spread
  the complete config before applying defaults.
- Astro 7's static asset rearranger does not retain arbitrary `emitFile` calls
  made by the custom transform in its SSR asset registry. Astro builds need a
  small registry flushed from `astro:build:done`; standalone Vite builds can
  continue using Rollup's `emitFile` API.

## Direct compiler probe

A temporary `/tmp` probe loaded the published Linux x64 RC3 meta and native npm
packages. It compiled and queried:

```typ
#metadata(sys.version)<version>
```

The result was `version(0, 15, 0)`. A second compile through
`NodeCompiler.svg()` confirmed that rich SVG output still contains
`typst-doc` and `typst-text`, so the existing stylesheet and jump behavior do
not need a speculative rewrite.

## Local baseline

- `corepack pnpm run build` stops in `tsc` with an explicit-root requirement and
  non-portable declaration inference from `src/content/config.ts` under
  TypeScript 7.
- Running `astro check` or `astro build` directly cannot load the config because
  `@myriaddreamin/typst-ts-node-compiler` is a peer but not a linked local
  development dependency. Cheerio has the same manifest shape.
- The second publish job uses Node 20, below Astro 7's supported engine range.
- `nix develop --command typst --version` reports Typst 0.15.1, and
  `nix develop --command node --version` reports Node 24.18.0.

## Design implications

- Keep consumer peer ranges broad, but add matching local development
  dependencies fixed to typst.ts 0.8.0-rc3 for the verified target.
- Use TypeScript 6.x and an explicit `rootDir`.
- Remove Astro Integration Kit and its directory-wide reload helper.
- Migrate the demo collection and routes to Astro's loader-based content layer.
- Use a URL for the local renderer and remove the redundant Rollup resolver.
- Pass Astro's setup command into the Vite plugin so `emitSvg` produces files.
- Preserve every public integration config field during defaulting.
- Flush Astro-registered SVG assets from `astro:build:done` into the final
  output directory.
- Add Vite 8 module-type metadata to `.typ` transform results.
- Add a small version/rich-SVG probe to prevent silent compiler regression.
- Exercise the public integration through Astro check/build and inspect emitted
  HTML/SVG output, not just the standalone compiler.
