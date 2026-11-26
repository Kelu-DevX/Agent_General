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
