// e2e/global-setup.ts
import { execSync } from "child_process";

async function globalSetup() {
  if (!process.env.CI) {
    console.log("Starting test database...");
    try {
      execSync("pnpm e2e:db:up", { stdio: "inherit" });
      execSync("pnpm e2e:db:migrate", { stdio: "inherit" });
    } catch (error) {
      console.error("Failed to setup test database:", error);
      throw error;
    }
  }
}

export default globalSetup;
