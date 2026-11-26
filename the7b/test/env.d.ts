import type { D1Migration } from "@cloudflare/vitest-plugin";

declare global {
  namespace Cloudflare {
    interface Env {
      DB: D1Database;
      PHOTOS: R2Bucket;
      SITE_URL: string;
      SEASON_END: string;
      CONTACT_EMAIL: string;
      TEST_MIGRATIONS: D1Migration[];
    }
  }
}
export {};
