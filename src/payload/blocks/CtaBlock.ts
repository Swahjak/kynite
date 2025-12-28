import type { Block } from "payload";

export const CtaBlock: Block = {
  slug: "cta",
  labels: {
    singular: "CTA Section",
    plural: "CTA Sections",
  },
  fields: [
    {
      name: "title",
      type: "text",
      required: true,
      localized: true,
    },
    {
      name: "description",
      type: "textarea",
      localized: true,
    },
    {
      name: "button",
      type: "group",
      fields: [
        { name: "label", type: "text", required: true, localized: true },
        { name: "href", type: "text", required: true },
        {
          name: "variant",
          type: "select",
          options: [
            { label: "Primary", value: "default" },
            { label: "Secondary", value: "secondary" },
            { label: "Outline", value: "outline" },
          ],
          defaultValue: "default",
        },
      ],
    },
  ],
};
