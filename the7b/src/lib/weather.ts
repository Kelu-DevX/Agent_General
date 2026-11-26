// Current Sandpoint weather from Open-Meteo: free, keyless, no account.
// Any failure returns null and the home page simply leaves the chip out.

const URL_ =
  "https://api.open-meteo.com/v1/forecast?latitude=48.2766&longitude=-116.5533" +
  "&current=temperature_2m,weather_code&temperature_unit=fahrenheit&timezone=America%2FLos_Angeles";

export interface Weather {
  tempF: number;
  desc: string;
}

/** Swappable for tests, so the suite never depends on the network. */
export const weatherDeps: { fetch: typeof fetch } = {
  fetch: (input, init) => fetch(input, init),
};

let cache: { at: number; value: Weather | null } | undefined;
const CACHE_MS = 10 * 60_000;

export function resetWeatherCache() {
  cache = undefined;
}

export function describeCode(code: number): string {
  if (code === 0) return "clear skies";
  if (code === 1) return "mostly clear";
  if (code === 2) return "partly cloudy";
  if (code === 3) return "overcast";
  if (code === 45 || code === 48) return "foggy";
  if (code >= 51 && code <= 57) return "drizzle";
  if (code === 66 || code === 67) return "freezing rain";
  if (code >= 61 && code <= 65) return "rain";
  if (code === 71) return "light snow";
  if (code === 73) return "snowing";
  if (code === 75) return "heavy snow";
  if (code === 77) return "snow grains";
  if (code >= 80 && code <= 82) return "rain showers";
  if (code === 85 || code === 86) return "snow showers";
  if (code >= 95 && code <= 99) return "thunderstorms";
  return "";
}

export async function getWeather(): Promise<Weather | null> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  let value: Weather | null = null;
  try {
    const res = await weatherDeps.fetch(URL_, {
      signal: AbortSignal.timeout(2500),
      cf: { cacheTtl: 1800, cacheEverything: true },
    } as RequestInit);
    if (res.ok) {
      const data = (await res.json()) as { current?: { temperature_2m?: unknown; weather_code?: unknown } };
      const t = data.current?.temperature_2m;
      const code = data.current?.weather_code;
      if (typeof t === "number" && Number.isFinite(t)) {
        value = { tempF: Math.round(t), desc: typeof code === "number" ? describeCode(code) : "" };
      }
    }
  } catch {
    value = null;
  }
  // Cache failures briefly too, so a down API doesn't slow every page view.
  cache = { at: value ? Date.now() : Date.now() - CACHE_MS + 60_000, value };
  return value;
}
