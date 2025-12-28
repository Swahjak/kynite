import type { Block } from "payload";

export const PricingBlock: Block = {
  slug: "pricing",
  labels: {
    singular: "Pricing Section",
    plural: "Pricing Sections",
  },
  fields: [
    {
      name: "title",
      type: "text",
      required: true,
      localized: true,
    },
    {
      name: "subtitle",
      type: "textarea",
      localized: true,
    },
    {
      name: "tiers",
      type: "array",
      minRows: 1,
      fields: [
        {
          name: "name",
          type: "text",
          required: true,
          localized: true,
        },
        {
          name: "price",
          type: "number",
          required: true,
        },
        {
          name: "currency",
          type: "text",
          defaultValue: "EUR",
        },
        {
          name: "period",
          type: "text",
          defaultValue: "/month",
          localized: true,
        },
        {
          name: "description",
          type: "textarea",
          localized: true,
        },
        {
          name: "featured",
          type: "checkbox",
          defaultValue: false,
        },
        {
          name: "features",
          type: "array",
          fields: [
            {
              name: "text",
              type: "text",
              required: true,
              localized: true,
            },
          ],
        },
        {
          name: "cta",
          type: "group",
          fields: [
            { name: "label", type: "text", required: true, localized: true },
            { name: "href", type: "text", required: true },
          ],
        },
      ],
    },
  ],
};
