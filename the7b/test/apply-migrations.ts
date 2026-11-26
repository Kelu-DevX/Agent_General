import { applyD1Migrations, env } from "cloudflare:test";

await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);

// No test ever reaches the network: weather calls fail fast unless a test stubs them.
import { resetWeatherCache, weatherDeps } from "../src/lib/weather";
import { beforeEach } from "vitest";

beforeEach(() => {
  resetWeatherCache();
  weatherDeps.fetch = async () => {
    throw new Error("network disabled in tests");
  };
});
