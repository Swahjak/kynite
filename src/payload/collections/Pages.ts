import type { CollectionConfig } from "payload";
import { HeroBlock, FeaturesBlock, PricingBlock, CtaBlock } from "../blocks";

// Reserved slugs that conflict with existing app routes
const RESERVED_SLUGS = [
  // Auth & onboarding
  "login",
  "onboarding",
  "join",
  "link-account",
  // App routes
  "dashboard",
  "calendar",
  "chores",
  "rewards",
  "reward-chart",
  "timers",
  "settings",
  "device",
  // System routes
  "admin",
  "api",
  "help",
];

export const Pages: CollectionConfig = {
  slug: "pages",
  admin: {
    useAsTitle: "title",
    defaultColumns: ["title", "slug", "status", "updatedAt"],
  },
  access: {
    read: () => true,
  },
  versions: {
    drafts: true,
  },
  fields: [
    {
      name: "title",
      type: "text",
      required: true,
      localized: true,
    },
    {
      name: "slug",
      type: "text",
      required: true,
      unique: true,
      admin: {
        position: "sidebar",
        description: `Reserved slugs: ${RESERVED_SLUGS.join(", ")}`,
      },
      validate: (value: string | null | undefined) => {
        if (!value) return "Slug is required";
        if (RESERVED_SLUGS.includes(value.toLowerCase())) {
          return `"${value}" is a reserved slug. Please choose a different one.`;
        }
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
          return "Slug must be lowercase alphanumeric with hyphens only";
        }
        return true;
      },
      hooks: {
        beforeValidate: [
          ({ value, data }) => {
            if (!value && data?.title) {
              return data.title
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-|-$/g, "");
            }
            return value;
          },
        ],
      },
    },
    {
      name: "status",
      type: "select",
      defaultValue: "draft",
      options: [
        { label: "Draft", value: "draft" },
        { label: "Published", value: "published" },
      ],
      admin: {
        position: "sidebar",
      },
    },
    {
      name: "content",
      type: "richText",
      localized: true,
    },
    {
      name: "layout",
      type: "blocks",
      blocks: [HeroBlock, FeaturesBlock, PricingBlock, CtaBlock],
      localized: true,
    },
    {
      name: "meta",
      type: "group",
      fields: [
        {
          name: "description",
          type: "textarea",
          localized: true,
        },
        {
          name: "image",
          type: "upload",
          relationTo: "media",
        },
      ],
    },
  ],
};
