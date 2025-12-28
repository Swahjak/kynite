import type { Block } from "payload";

export const FeaturesBlock: Block = {
  slug: "features",
  labels: {
    singular: "Features Section",
    plural: "Features Sections",
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
      name: "features",
      type: "array",
      minRows: 1,
      fields: [
        {
          name: "icon",
          type: "text",
          required: true,
          admin: {
            description:
              "Lucide icon name (e.g., 'Calendar', 'Users', 'CheckCircle')",
          },
        },
        {
          name: "title",
          type: "text",
          required: true,
          localized: true,
        },
        {
          name: "description",
          type: "textarea",
          required: true,
          localized: true,
        },
      ],
    },
  ],
};
