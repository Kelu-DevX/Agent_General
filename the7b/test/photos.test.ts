import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { COPY } from "../src/copy";
import { JpegError, MAX_BYTES, storePhoto, stripJpegMetadata, validateJpeg } from "../src/lib/photos";
import { containsText, hasMarker, makeJpeg } from "./helpers";

const buf = (u: Uint8Array) => u.slice().buffer;

describe("validateJpeg", () => {
  it("accepts a small JPEG", () => {
    expect(validateJpeg(buf(makeJpeg()))).toBeNull();
  });
  it("rejects PNG magic bytes", () => {
    const png = Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
    expect(validateJpeg(buf(png))).toBe(COPY.errors.type);
  });
  it("rejects an empty file", () => {
    expect(validateJpeg(new ArrayBuffer(0))).toBe(COPY.errors.type);
  });
  it("rejects anything over 2.5 MB", () => {
    const big = new Uint8Array(MAX_BYTES + 1);
    big.set([0xff, 0xd8, 0xff]);
    expect(validateJpeg(big.buffer)).toBe(COPY.errors.size);
  });
});

describe("stripJpegMetadata", () => {
  it("drops the EXIF (GPS) segment and comments, keeps SOI, JFIF and EOI", () => {
    const src = makeJpeg({ exif: true, comment: true });
    expect(hasMarker(src, 0xe1)).toBe(true);
    const out = new Uint8Array(stripJpegMetadata(buf(src)));
    expect(hasMarker(out, 0xe1)).toBe(false);
    expect(hasMarker(out, 0xfe)).toBe(false);
    expect(containsText(out, "GPS")).toBe(false);
    expect(containsText(out, "Main St")).toBe(false);
    expect([out[0], out[1]]).toEqual([0xff, 0xd8]);
    expect([out[out.length - 2], out[out.length - 1]]).toEqual([0xff, 0xd9]);
    expect(containsText(out, "JFIF")).toBe(true);
  });

  it("leaves a clean JPEG byte-for-byte identical", () => {
    const src = makeJpeg();
    expect(new Uint8Array(stripJpegMetadata(buf(src)))).toEqual(src);
  });

  it("keeps scan data intact, including byte stuffing and restart markers", () => {
    const out = new Uint8Array(stripJpegMetadata(buf(makeJpeg({ exif: true }))));
    const hex = [...out].map((x) => x.toString(16).padStart(2, "0")).join("");
    expect(hex).toContain("1234ff0056ffd078ffd9");
  });

  it("cuts off data hidden after the end of the image", () => {
    const src = makeJpeg({ trailer: true });
    expect(containsText(src, "HIDDEN")).toBe(true);
    const out = new Uint8Array(stripJpegMetadata(buf(src)));
    expect(containsText(out, "HIDDEN")).toBe(false);
    expect([out[out.length - 2], out[out.length - 1]]).toEqual([0xff, 0xd9]);
  });

  it("strips metadata tucked between progressive scans", () => {
    const out = new Uint8Array(stripJpegMetadata(buf(makeJpeg({ exif: true, progressive: true }))));
    expect(hasMarker(out, 0xe1)).toBe(false);
    expect(containsText(out, "SECOND COPY")).toBe(false);
    const hex = [...out].map((x) => x.toString(16).padStart(2, "0")).join("");
    expect(hex).toContain("ffda000801010000 3f009abcffd9".replace(" ", ""));
  });

  it("throws on a malformed file rather than passing it through", () => {
    const bad = makeJpeg({ exif: true });
    bad[5] = 0xff; // corrupt the APP0 length so it overruns the file
    expect(() => stripJpegMetadata(buf(bad))).toThrow(JpegError);
    expect(() => stripJpegMetadata(buf(Uint8Array.of(1, 2, 3, 4)))).toThrow(JpegError);
  });
});

describe("storePhoto", () => {
  it("stores a stripped copy in R2 as image/jpeg", async () => {
    const key = await storePhoto(env, buf(makeJpeg({ exif: true, trailer: true })));
    expect(key).toMatch(/^photos\/[a-z0-9]+-[0-9a-f-]{36}\.jpg$/);
    const obj = await env.PHOTOS.get(key);
    expect(obj?.httpMetadata?.contentType).toBe("image/jpeg");
    const stored = new Uint8Array(await obj!.arrayBuffer());
    expect(hasMarker(stored, 0xe1)).toBe(false);
    expect(containsText(stored, "GPS")).toBe(false);
  });
});

/** A real-shaped EXIF APP1: little-endian TIFF, IFD0 with Orientation and a GPS pointer, plus GPS text. */
function exifWithOrientation(v: number): Uint8Array {
  const tiff = [
    0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, // II, 42, IFD0 at 8
    0x02, 0x00, // two entries
    0x12, 0x01, 0x03, 0x00, 0x01, 0x00, 0x00, 0x00, v, 0x00, 0x00, 0x00, // Orientation = v
    0x25, 0x88, 0x04, 0x00, 0x01, 0x00, 0x00, 0x00, 0x26, 0x00, 0x00, 0x00, // GPSInfo pointer
    0x00, 0x00, 0x00, 0x00,
    ...[..."GPS 48.2766N 116.5533W"].map((c) => c.charCodeAt(0)),
  ];
  const payload = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];
  const l = payload.length + 2;
  return Uint8Array.of(0xff, 0xe1, l >> 8, l & 0xff, ...payload);
}
function withSegment(seg: Uint8Array): Uint8Array {
  const base = makeJpeg();
  const app0End = 4 + ((base[4] << 8) | base[5]);
  return Uint8Array.of(...base.subarray(0, app0End), ...seg, ...base.subarray(app0End));
}

describe("orientation", async () => {
  const { exifOrientation } = await import("../src/lib/photos");
  it("reads the orientation from a real EXIF block", () => {
    expect(exifOrientation(exifWithOrientation(6).subarray(4))).toBe(6);
    expect(exifOrientation(Uint8Array.of(1, 2, 3))).toBe(1);
  });
  it("keeps a rotated phone photo upright but carries no GPS", () => {
    const out = new Uint8Array(stripJpegMetadata(withSegment(exifWithOrientation(6)).slice().buffer));
    expect(containsText(out, "GPS")).toBe(false);
    expect(hasMarker(out, 0xe1)).toBe(true);
    const app0End = 4 + ((out[4] << 8) | out[5]);
    const app1 = out.subarray(app0End, app0End + 36); // marker + 34-byte length field
    expect([app1[0], app1[1], app1[2], app1[3]]).toEqual([0xff, 0xe1, 0x00, 0x22]);
    expect(exifOrientation(app1.subarray(4))).toBe(6);
    expect(out.length).toBe(makeJpeg().length + 36);
  });
  it("adds nothing for an already-upright photo", () => {
    const out = new Uint8Array(stripJpegMetadata(withSegment(exifWithOrientation(1)).slice().buffer));
    expect(hasMarker(out, 0xe1)).toBe(false);
  });
});
