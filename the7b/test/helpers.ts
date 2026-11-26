import { SELF, env } from "cloudflare:test";

export const BASE = "https://the7b.test";

/** Builds a tiny structurally valid JPEG. Not decodable as an image, but every segment is well-formed. */
export function makeJpeg(opts: { exif?: boolean; comment?: boolean; trailer?: boolean; progressive?: boolean } = {}): Uint8Array {
  const bytes: number[] = [0xff, 0xd8];
  const seg = (marker: number, payload: number[]) => {
    const l = payload.length + 2;
    bytes.push(0xff, marker, l >> 8, l & 0xff, ...payload);
  };
  const ascii = (s: string) => [...s].map((ch) => ch.charCodeAt(0));
  seg(0xe0, [...ascii("JFIF"), 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]);
  if (opts.exif) seg(0xe1, [...ascii("Exif"), 0, 0, ...ascii("GPS 48.2766N 116.5533W SECRET")]);
  if (opts.comment) seg(0xfe, ascii("shot at 123 Main St"));
  seg(0xdb, [0, ...Array(64).fill(1)]);
  seg(0xc0, [8, 0, 1, 0, 1, 1, 1, 0x11, 0]);
  seg(0xc4, [0, ...Array(16).fill(0), ]);
  seg(0xda, [1, 1, 0, 0, 63, 0]);
  bytes.push(0x12, 0x34, 0xff, 0x00, 0x56, 0xff, 0xd0, 0x78); // scan data with stuffing + restart marker
  if (opts.progressive) {
    if (opts.exif) seg(0xe1, [...ascii("Exif"), 0, 0, ...ascii("GPS SECOND COPY")]);
    seg(0xda, [1, 1, 0, 0, 63, 0]);
    bytes.push(0x9a, 0xbc);
  }
  bytes.push(0xff, 0xd9);
  if (opts.trailer) bytes.push(...ascii("GPS HIDDEN AFTER THE IMAGE"));
  return new Uint8Array(bytes);
}

export function hasMarker(b: Uint8Array, marker: number): boolean {
  for (let i = 0; i < b.length - 1; i++) if (b[i] === 0xff && b[i + 1] === marker) return true;
  return false;
}

export function containsText(b: Uint8Array, s: string): boolean {
  return new TextDecoder("latin1").decode(b).includes(s);
}

let n = 0;
export function uniq(prefix = "u"): string {
  n++;
  return `${prefix}${n}${crypto.randomUUID().slice(0, 6)}`;
}

/** Signs up through the real route. Returns the session cookie and the user's id. */
export async function signup(opts: { name?: string; email?: string; password?: string; consent?: boolean } = {}) {
  const name = opts.name ?? uniq("Player ");
  const email = opts.email ?? `${uniq("p")}@example.com`;
  const form = new URLSearchParams({ email, display_name: name, password: opts.password ?? "snowy-day-42", agree: "1" });
  if (opts.consent) form.set("mailing_consent", "1");
  const res = await SELF.fetch(`${BASE}/signup`, { method: "POST", body: form, redirect: "manual" });
  const cookie = (res.headers.get("set-cookie") ?? "").split(";")[0];
  const row = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first<{ id: number }>();
  return { res, cookie, id: row?.id ?? 0, name, email };
}

export async function makeAdmin(id: number) {
  await env.DB.prepare("UPDATE users SET is_admin = 1 WHERE id = ?").bind(id).run();
}

export async function submit(cookie: string, objectiveId: number, photo: Uint8Array | null = makeJpeg(), type = "image/jpeg") {
  const fd = new FormData();
  fd.set("objective_id", String(objectiveId));
  if (photo) fd.set("photo", new File([photo], "p.jpg", { type }));
  return SELF.fetch(`${BASE}/postcards/submit`, { method: "POST", body: fd, headers: { cookie }, redirect: "manual" });
}

export async function r2Count(): Promise<number> {
  return (await env.PHOTOS.list()).objects.length;
}

export const post = (path: string, cookie: string, form: Record<string, string> = {}) =>
  SELF.fetch(`${BASE}${path}`, {
    method: "POST",
    body: new URLSearchParams(form),
    headers: { cookie },
    redirect: "manual",
  });

export const get = (path: string, cookie = "") =>
  SELF.fetch(`${BASE}${path}`, { headers: cookie ? { cookie } : {}, redirect: "manual" });
