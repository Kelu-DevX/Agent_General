import { COPY } from "../copy";
import type { Env } from "../types";

export const MAX_BYTES = 2_500_000;

/** Error copy for anything that isn't a small-enough JPEG, else null. */
export function validateJpeg(bytes: ArrayBuffer): string | null {
  if (bytes.byteLength > MAX_BYTES) return COPY.errors.size;
  const b = new Uint8Array(bytes, 0, Math.min(3, bytes.byteLength));
  if (b.length < 3 || b[0] !== 0xff || b[1] !== 0xd8 || b[2] !== 0xff) return COPY.errors.type;
  return null;
}

export class JpegError extends Error {}

/** Reads the EXIF Orientation (1–8) out of an APP1 payload, or 1 if there isn't a readable one. */
export function exifOrientation(app1: Uint8Array): number {
  try {
    if (app1.length < 14) return 1;
    const exif = [0x45, 0x78, 0x69, 0x66, 0, 0]; // "Exif\0\0"
    if (!exif.every((b, i) => app1[i] === b)) return 1;
    const t = app1.subarray(6);
    const little = t[0] === 0x49 && t[1] === 0x49;
    if (!little && !(t[0] === 0x4d && t[1] === 0x4d)) return 1;
    const u16 = (o: number) => (little ? t[o] | (t[o + 1] << 8) : (t[o] << 8) | t[o + 1]);
    const u32 = (o: number) =>
      (little ? (t[o] | (t[o + 1] << 8) | (t[o + 2] << 16)) + t[o + 3] * 0x1000000
        : t[o] * 0x1000000 + ((t[o + 1] << 16) | (t[o + 2] << 8) | t[o + 3]));
    if (u16(2) !== 42) return 1;
    const ifd = u32(4);
    if (ifd + 2 > t.length) return 1;
    const count = u16(ifd);
    for (let k = 0; k < count; k++) {
      const e = ifd + 2 + k * 12;
      if (e + 12 > t.length) return 1;
      if (u16(e) === 0x0112 && u16(e + 2) === 3) {
        const v = u16(e + 8);
        return v >= 1 && v <= 8 ? v : 1;
      }
    }
  } catch {
    /* fall through */
  }
  return 1;
}

/** A fresh APP1 segment holding nothing but the Orientation tag, so phones still show the photo upright. */
function orientationSegment(v: number): Uint8Array {
  return Uint8Array.of(
    0xff, 0xe1, 0x00, 0x22, // APP1, length 34
    0x45, 0x78, 0x69, 0x66, 0x00, 0x00, // "Exif\0\0"
    0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08, // big-endian TIFF, IFD0 at 8
    0x00, 0x01, // one entry
    0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, v, 0x00, 0x00, // Orientation SHORT = v
    0x00, 0x00, 0x00, 0x00, // no next IFD
  );
}

// Segments that can carry location, camera serials or other personal data:
// APP1 (EXIF/XMP, where GPS lives) through APP13 (IPTC/Photoshop), APP15, and comments.
// APP0 (JFIF) and APP14 (Adobe colour transform) are kept: dropping APP14 can wreck colours.
function dropped(marker: number): boolean {
  return (marker >= 0xe1 && marker <= 0xed) || marker === 0xef || marker === 0xfe;
}

/**
 * Byte-level JPEG metadata stripper. No image decode.
 * Walks the marker segments, drops metadata segments wherever they appear
 * (including between progressive scans), and stops at the image's true end (EOI),
 * so data hidden after the image never survives.
 * The one thing carried over is the Orientation tag, rewritten into a fresh
 * minimal EXIF block, so an un-resized phone photo doesn't land sideways.
 * Throws JpegError on a malformed file.
 */
export function stripJpegMetadata(bytes: ArrayBuffer): ArrayBuffer {
  const b = new Uint8Array(bytes);
  const len = b.length;
  if (len < 4 || b[0] !== 0xff || b[1] !== 0xd8) throw new JpegError("not a jpeg");

  const out = new Uint8Array(len + 2);
  let o = 0;
  const put = (chunk: Uint8Array) => {
    out.set(chunk, o);
    o += chunk.length;
  };
  put(b.subarray(0, 2));
  let orientation = 1;
  let insertAt = 2; // the minimal EXIF goes right after SOI, or after APP0 if that comes first
  const finish = () => {
    if (orientation === 1) return out.slice(0, o).buffer;
    const seg = orientationSegment(orientation);
    const final = new Uint8Array(o + seg.length);
    final.set(out.subarray(0, insertAt), 0);
    final.set(seg, insertAt);
    final.set(out.subarray(insertAt, o), insertAt + seg.length);
    return final.buffer;
  };

  let i = 2;
  while (i < len) {
    if (b[i] !== 0xff) throw new JpegError(`expected marker at ${i}`);
    while (i < len && b[i] === 0xff) i++; // fill bytes
    if (i >= len) throw new JpegError("truncated marker");
    const m = b[i++];

    if (m === 0xd9) {
      put(Uint8Array.of(0xff, 0xd9));
      return finish();
    }
    if (m === 0x01 || (m >= 0xd0 && m <= 0xd7)) {
      put(Uint8Array.of(0xff, m));
      continue;
    }
    if (m === 0xd8 || m === 0x00) throw new JpegError("unexpected marker");

    if (i + 2 > len) throw new JpegError("truncated length");
    const segLen = (b[i] << 8) | b[i + 1];
    const end = i + segLen;
    if (segLen < 2 || end > len) throw new JpegError("bad segment length");
    if (m === 0xe1 && orientation === 1) orientation = exifOrientation(b.subarray(i + 2, end));
    if (!dropped(m)) {
      put(Uint8Array.of(0xff, m));
      put(b.subarray(i, end));
      if (m === 0xe0 && insertAt === 2 && o === 4 + segLen) insertAt = o;
    }
    i = end;

    if (m === 0xda) {
      // Entropy-coded scan data runs until a marker that isn't byte stuffing (FF00) or a restart (FFD0–D7).
      let k = i;
      while (k < len) {
        if (b[k] === 0xff && k + 1 < len) {
          const n = b[k + 1];
          if (n === 0x00 || (n >= 0xd0 && n <= 0xd7)) {
            k += 2;
            continue;
          }
          if (n === 0xff) {
            k++;
            continue;
          }
          break;
        }
        k++;
      }
      put(b.subarray(i, Math.min(k, len)));
      i = k;
      if (i >= len - 1) {
        // Truncated file with no EOI: close it properly ourselves.
        put(Uint8Array.of(0xff, 0xd9));
        return finish();
      }
    }
  }
  throw new JpegError("no end of image");
}

export function newPhotoKey(): string {
  return `photos/${Date.now().toString(36)}-${crypto.randomUUID()}.jpg`;
}

/** Strips metadata and stores in R2. Returns the object key. */
export async function storePhoto(env: Env, bytes: ArrayBuffer): Promise<string> {
  const clean = stripJpegMetadata(bytes);
  const key = newPhotoKey();
  await env.PHOTOS.put(key, clean, { httpMetadata: { contentType: "image/jpeg" } });
  return key;
}
