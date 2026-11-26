import { SELF } from "cloudflare:test";
import { expect, it } from "vitest";

it("GET / returns 200 and says 7B", async () => {
  const res = await SELF.fetch("https://the7b.test/");
  expect(res.status).toBe(200);
  expect(await res.text()).toContain("7B");
});
