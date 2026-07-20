import type { AstroIntegration, AstroRenderer, ContentEntryType, HookParameters } from "astro";
import vitePluginTypst from "./vite.js"
import { renderToHTMLish } from "./typst.js";
import { fileURLToPath } from "url";
import type { PluginOption } from "vite";
import { defaultTarget, detectTarget, type AstroTypstConfig } from "./prelude.js";
import { setAstroConfig, setConfig } from "./store.js";
import logger from "./logger.js";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { clearTypstAssets, takeTypstAssets } from "./typst-assets.js";

function getRenderer(): AstroRenderer {
    const isDebug = !!process.env.ASTRO_TYPST;
    const serverEntrypoint = isDebug
        ? new URL("../../dist/renderer/index.js", import.meta.url)
        : "astro-typst/dist/renderer/index.js";
    logger.debug(`\x1b[42mYou are running the demo of \x1b[33mastro-typst\x1b[42m, not importing the package from elsewhere.\x1b[0m
\x1b[32mThis mode is good for test, debug, and build the demo site.\x1b[0m
Server entry point: ${serverEntrypoint}`);
    return {
        name: "astro:jsx",
        serverEntrypoint,
    };
}

export const getContainerRenderer = getRenderer;

type SetupHookParams = HookParameters<'astro:config:setup'> & {
    // `addPageExtension` and `contentEntryType` are not a public APIs
    // Add type defs here
    addPageExtension: (extension: string) => void;
    addContentEntryType: (contentEntryType: ContentEntryType) => void;
};

export default function typstIntegration(
    config: Partial<AstroTypstConfig> = {}
): AstroIntegration {
    const astroTypstConfig: AstroTypstConfig = {
        ...config,
        options: {
            remPx: 16,
            ...config.options,
        },
        target: config.target ?? defaultTarget,
    };
    return {
        name: 'typst',
        hooks: {
            "astro:config:setup": (options) => {
                clearTypstAssets();
                setConfig(astroTypstConfig);
                setAstroConfig(options.config);
                const {
                    addRenderer, addContentEntryType, addPageExtension, updateConfig
                } = (options as SetupHookParams);
                addRenderer(getRenderer());
                addPageExtension('.typ');
                addContentEntryType({
                    extensions: ['.typ'],
                    async getEntryInfo({ fileUrl, contents }) {
                        const mainFilePath = fileURLToPath(fileUrl);
                        const isHtml = await detectTarget(fileUrl.pathname, astroTypstConfig.target) === "html";
                        let { getFrontmatter } = await renderToHTMLish(
                            {
                                mainFilePath,
                            },
                            astroTypstConfig?.options,
                            isHtml
                        )
                        const frontmatterResult = getFrontmatter?.();
                        return {
                            data: frontmatterResult || {},
                            body: contents,
                            // @ts-ignore
                            slug: frontmatterResult?.slug as any,
                            rawData: contents,
                        };
                    },
                    // Typ cannot import scripts and styles
                    handlePropagation: false,
                    contentModuleTypes: `
declare module 'astro:content' {
  interface Render {
    '.typ': Promise<{
      Content: import('astro').MarkdownInstance<{}>['Content'];
    }>;
  }
}
`
                });
                updateConfig({
                    vite: {
                        build: {
                            rollupOptions: {
                                external: [
                                    "@myriaddreamin/typst-ts-node-compiler",
                                ],
                            }
                        },
                        // @ts-ignore
                        plugins: [vitePluginTypst(astroTypstConfig, options.command === 'build') as PluginOption],
                    },
                });
            },

            "astro:build:done": async ({ dir, logger: buildLogger }) => {
                const outputDir = fileURLToPath(dir);
                for (const { fileName, source } of takeTypstAssets()) {
                    const assetPath = resolve(outputDir, fileName);
                    const relativePath = relative(outputDir, assetPath);
                    if (relativePath.startsWith("..") || isAbsolute(relativePath)) {
                        throw new Error(`Typst asset path escapes the Astro output directory: ${fileName}`);
                    }
                    await mkdir(dirname(assetPath), { recursive: true });
                    await writeFile(assetPath, source, "utf8");
                    buildLogger.debug(`Wrote Typst asset: ${fileName}`);
                }
            },

            "astro:config:done": ({ config, injectTypes }) => {
                injectTypes(
                    {
                        filename: "astro-typst.d.ts",
                        content: `declare module '*.typ' {
    const component: () => any;
    export default component;
}`,
                    }
                )
                setAstroConfig(config);
            }
        }
    }
}
