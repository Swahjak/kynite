import { getPayload } from "payload";
import config from "@/payload.config";
import nlMessages from "@/../messages/nl.json" with { type: "json" };
import enMessages from "@/../messages/en.json" with { type: "json" };

export async function seedHomepage() {
  const payload = await getPayload({ config });

  // Check if homepage already exists
  const existing = await payload.find({
    collection: "pages",
    where: { slug: { equals: "home" } },
  });

  if (existing.docs.length > 0) {
    return {
      success: true,
      message: "Homepage already exists, skipping seed",
      data: { skipped: true, existingId: existing.docs[0].id },
    };
  }

  const nl = nlMessages.HomePage;
  const en = enMessages.HomePage;

  // Create homepage with Dutch content (default locale)
  const page = await payload.create({
    collection: "pages",
    locale: "nl",
    data: {
      title: "Kynite",
      slug: "home",
      status: "published",
      layout: [
        {
          blockType: "hero",
          badge: nl.hero.badge,
          title: nl.hero.title,
          description: nl.hero.description,
          primaryCta: {
            label: nl.hero.cta,
            href: "/login",
          },
          secondaryCta: {
            label: nl.hero.ctaSecondary,
            href: "/dashboard",
          },
          previewLabel: nl.hero.previewLabel,
        },
        {
          blockType: "features",
          title: nl.features.title,
          subtitle: nl.features.subtitle,
          features: [
            {
              icon: "Calendar",
              title: nl.features.calendar.title,
              description: nl.features.calendar.description,
            },
            {
              icon: "Gamepad2",
              title: nl.features.routines.title,
              description: nl.features.routines.description,
            },
            {
              icon: "UtensilsCrossed",
              title: nl.features.meals.title,
              description: nl.features.meals.description,
            },
          ],
        },
        {
          blockType: "pricing",
          title: nl.pricing.title,
          subtitle: nl.pricing.subtitle,
          tiers: [
            {
              name: nl.pricing.free.name,
              price: Number(nl.pricing.free.price),
              currency: "EUR",
              period: nl.pricing.perMonth,
              description: nl.pricing.free.description,
              featured: false,
              features: nl.pricing.free.features.map((text) => ({ text })),
              cta: { label: nl.pricing.free.cta, href: "/login" },
            },
            {
              name: nl.pricing.basic.name,
              price: Number(nl.pricing.basic.price),
              currency: "EUR",
              period: nl.pricing.perMonth,
              description: nl.pricing.basic.description,
              featured: true,
              features: nl.pricing.basic.features.map((text) => ({ text })),
              cta: { label: nl.pricing.basic.cta, href: "/login" },
            },
            {
              name: nl.pricing.pro.name,
              price: Number(nl.pricing.pro.price),
              currency: "EUR",
              period: nl.pricing.perMonth,
              description: nl.pricing.pro.description,
              featured: false,
              features: nl.pricing.pro.features.map((text) => ({ text })),
              cta: { label: nl.pricing.pro.cta, href: "/login" },
            },
          ],
        },
        {
          blockType: "cta",
          title: nl.cta.title,
          description: nl.cta.description,
          button: {
            label: nl.cta.button,
            href: "/login",
            variant: "default",
          },
        },
      ],
    },
  });

  // Update with English translations
  await payload.update({
    collection: "pages",
    id: page.id,
    locale: "en",
    data: {
      title: "Kynite",
      layout: [
        {
          blockType: "hero",
          badge: en.hero.badge,
          title: en.hero.title,
          description: en.hero.description,
          primaryCta: {
            label: en.hero.cta,
            href: "/login",
          },
          secondaryCta: {
            label: en.hero.ctaSecondary,
            href: "/dashboard",
          },
          previewLabel: en.hero.previewLabel,
        },
        {
          blockType: "features",
          title: en.features.title,
          subtitle: en.features.subtitle,
          features: [
            {
              icon: "Calendar",
              title: en.features.calendar.title,
              description: en.features.calendar.description,
            },
            {
              icon: "Gamepad2",
              title: en.features.routines.title,
              description: en.features.routines.description,
            },
            {
              icon: "UtensilsCrossed",
              title: en.features.meals.title,
              description: en.features.meals.description,
            },
          ],
        },
        {
          blockType: "pricing",
          title: en.pricing.title,
          subtitle: en.pricing.subtitle,
          tiers: [
            {
              name: en.pricing.free.name,
              price: Number(en.pricing.free.price),
              currency: "EUR",
              period: en.pricing.perMonth,
              description: en.pricing.free.description,
              featured: false,
              features: en.pricing.free.features.map((text) => ({ text })),
              cta: { label: en.pricing.free.cta, href: "/login" },
            },
            {
              name: en.pricing.basic.name,
              price: Number(en.pricing.basic.price),
              currency: "EUR",
              period: en.pricing.perMonth,
              description: en.pricing.basic.description,
              featured: true,
              features: en.pricing.basic.features.map((text) => ({ text })),
              cta: { label: en.pricing.basic.cta, href: "/login" },
            },
            {
              name: en.pricing.pro.name,
              price: Number(en.pricing.pro.price),
              currency: "EUR",
              period: en.pricing.perMonth,
              description: en.pricing.pro.description,
              featured: false,
              features: en.pricing.pro.features.map((text) => ({ text })),
              cta: { label: en.pricing.pro.cta, href: "/login" },
            },
          ],
        },
        {
          blockType: "cta",
          title: en.cta.title,
          description: en.cta.description,
          button: {
            label: en.cta.button,
            href: "/login",
            variant: "default",
          },
        },
      ],
    },
  });

  return {
    success: true,
    message: "Homepage seeded successfully with nl and en content",
    data: { pageId: page.id },
  };
}
