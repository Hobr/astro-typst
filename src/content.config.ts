import { defineCollection, type BaseSchema } from "astro:content";
import type { CollectionConfig } from "astro/content/config";
import { glob, type Loader } from "astro/loaders";
import { z } from "astro/zod";

type ContentCollection = CollectionConfig<BaseSchema, Loader>;

const typSchema = z.object({
  title: z.string(),
  author: z.string().optional(),
  desc: z.any().optional(),
  date: z.any(),
});

const typCollection = defineCollection<typeof typSchema, Loader>({
  loader: glob({
    pattern: "**/*.typ",
    base: "./src/content/typ",
  }),
  schema: typSchema,
});

export const collections: Record<string, ContentCollection> = {
  typ: typCollection,
};
