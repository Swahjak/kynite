import sharp from "sharp";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import { postgresAdapter } from "@payloadcms/db-postgres";
import { buildConfig } from "payload";
import { Users } from "./src/payload/collections/Users";

export default buildConfig({
  admin: {
    user: Users.slug,
  },
  editor: lexicalEditor(),
  collections: [Users],
  secret: process.env.PAYLOAD_SECRET || "",
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL_PAYLOAD || "",
    },
  }),
  sharp,
  typescript: {
    outputFile: "src/payload/payload-types.ts",
  },
  localization: {
    locales: [
      { label: "Nederlands", code: "nl" },
      { label: "English", code: "en" },
    ],
    defaultLocale: "nl",
    fallback: true,
  },
});
