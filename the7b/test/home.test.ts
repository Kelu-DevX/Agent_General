import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { describeCode, getWeather, resetWeatherCache, weatherDeps } from "../src/lib/weather";
import { get } from "./helpers";

const fakeWeather = (body: unknown, status = 200) => {
  const calls: string[] = [];
  weatherDeps.fetch = (async (url: RequestInfo | URL) => {
    calls.push(String(url));
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  return calls;
};

describe("home", () => {
  it("renders the hero, the Play Postcards button and what's going on", async () => {
    await env.DB.prepare("INSERT INTO happenings (text, date_label, sort) VALUES ('Lost in the 50s winter dance', 'Fri 7pm', -100)").run();
    await env.DB.prepare("INSERT INTO happenings (text, active) VALUES ('Hidden item', 0)").run();
    const res = await get("/");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html.startsWith("<!DOCTYPE html>")).toBe(true);
    expect(html).toContain("Greetings from");
    expect(html).toContain(">7B<");
    expect(html).toContain("Play Postcards");
    expect(html).toContain("What&#39;s going on in 7B");
    expect(html).toContain("Lost in the 50s winter dance");
    expect(html).toContain("Fri 7pm");
    expect(html).not.toContain("Hidden item");
    expect(html).not.toMatch(/the 7B/i);
  });

  it("still renders when the weather service is down", async () => {
    // Setup already makes every weather fetch throw.
    const res = await get("/");
    expect(res.status).toBe(200);
    expect(await res.text()).not.toContain("Right now in Sandpoint");
  });

  it("shows live weather when the service answers", async () => {
    const calls = fakeWeather({ current: { temperature_2m: 27.6, weather_code: 73 } });
    const html = await (await get("/")).text();
    expect(html).toContain("Right now in Sandpoint");
    expect(html).toContain("28°");
    expect(html).toContain("snowing");
    expect(calls[0]).toContain("latitude=48.2766");
    expect(calls[0]).toContain("temperature_unit=fahrenheit");
  });
});

describe("getWeather", () => {
  it("returns null on HTTP errors and garbage bodies", async () => {
    fakeWeather({ error: true }, 500);
    expect(await getWeather()).toBeNull();
    resetWeatherCache();
    fakeWeather({ current: { temperature_2m: "warm" } });
    expect(await getWeather()).toBeNull();
  });

  it("caches a good answer instead of calling every page view", async () => {
    const calls = fakeWeather({ current: { temperature_2m: 30, weather_code: 0 } });
    expect(await getWeather()).toEqual({ tempF: 30, desc: "clear skies" });
    await getWeather();
    expect(calls.length).toBe(1);
  });

  it("describes weather codes in plain words", () => {
    expect(describeCode(71)).toBe("light snow");
    expect(describeCode(45)).toBe("foggy");
    expect(describeCode(1234)).toBe("");
  });
});

describe("terms", () => {
  it("has the plain-language terms, including the age floor and the sponsored clause", async () => {
    const html = await (await get("/terms")).text();
    expect(html).toContain("13 or older");
    expect(html).toContain("sponsored");
    expect(html).toContain("never your location");
    expect(html).toContain("We never sell your info");
  });
});

describe("security headers", () => {
  it("sends a strict CSP and friends", async () => {
    const res = await get("/");
    expect(res.headers.get("content-security-policy")).toContain("default-src 'self'");
    expect(res.headers.get("x-frame-options")).toBe("DENY");
  });
  it("gives a friendly 404", async () => {
    const res = await get("/no-such-page");
    expect(res.status).toBe(404);
    expect(await res.text()).toContain("Probably out sledding");
  });
});
