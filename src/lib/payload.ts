import { getPayload } from "payload";
import config from "@payload-config";
import type { Page } from "@/payload/payload-types";

/**
 * Get the Payload CMS client instance
 * @returns The initialized Payload client
 */
export async function getPayloadClient() {
  return getPayload({ config });
}

/**
 * Fetch a published page by its slug
 * @param slug - The page slug to fetch
 * @param locale - The locale to fetch content for (default: "nl")
 * @returns The page if found and published, otherwise null
 */
export async function getPageBySlug(
  slug: string,
  locale: "nl" | "en" = "nl"
): Promise<Page | null> {
  const payload = await getPayloadClient();

  const { docs } = await payload.find({
    collection: "pages",
    where: {
      slug: { equals: slug },
      status: { equals: "published" },
    },
    locale,
    limit: 1,
  });

  return (docs[0] as Page | undefined) || null;
}

/**
 * Fetch the homepage (page with slug "home")
 * @param locale - The locale to fetch content for (default: "nl")
 * @returns The homepage if found and published, otherwise null
 */
export async function getHomepage(
  locale: "nl" | "en" = "nl"
): Promise<Page | null> {
  return getPageBySlug("home", locale);
}

/**
 * Fetch all published page slugs for static generation
 * @returns Array of all published page slugs (excluding "home")
 */
export async function getAllPageSlugs(): Promise<string[]> {
  const payload = await getPayloadClient();

  const { docs } = await payload.find({
    collection: "pages",
    where: {
      status: { equals: "published" },
      slug: { not_equals: "home" }, // Exclude homepage from dynamic routes
    },
    limit: 100,
  });

  return docs.map((page) => page.slug);
}
