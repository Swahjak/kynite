// e2e/global-teardown.ts
import { execSync } from "child_process";

async function globalTeardown() {
  if (process.env.CI) {
    console.log("Stopping test database...");
    try {
      execSync("pnpm e2e:teardown", { stdio: "inherit" });
    } catch (error) {
      console.error("Failed to teardown test database:", error);
    }
  }
}

export default globalTeardown;
