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

  let i = 2;
  while (i < len) {
    if (b[i] !== 0xff) throw new JpegError(`expected marker at ${i}`);
    while (i < len && b[i] === 0xff) i++; // fill bytes
    if (i >= len) throw new JpegError("truncated marker");
    const m = b[i++];

    if (m === 0xd9) {
      put(Uint8Array.of(0xff, 0xd9));
      return out.slice(0, o).buffer;
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
    if (!dropped(m)) {
      put(Uint8Array.of(0xff, m));
      put(b.subarray(i, end));
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
        return out.slice(0, o).buffer;
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
