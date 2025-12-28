/* THIS FILE WAS GENERATED AUTOMATICALLY BY PAYLOAD. */
/* DO NOT MODIFY IT BECAUSE IT COULD BE REWRITTEN AT ANY TIME. */
import type { ServerFunctionClient } from "payload";

import config from "@payload-config";
import { RootLayout } from "@payloadcms/next/layouts";
import React from "react";

import { importMap } from "./admin/importMap";
import "./custom.scss";

type Args = {
  children: React.ReactNode;
};

const serverFunctions: ServerFunctionClient = async function (args) {
  "use server";
  const { default: payload } = await import("payload");
  return payload.serverFunction({ ...args, config, importMap });
};

const Layout = ({ children }: Args) => (
  <RootLayout
    config={config}
    importMap={importMap}
    serverFunction={serverFunctions}
  >
    {children}
  </RootLayout>
);

export default Layout;
