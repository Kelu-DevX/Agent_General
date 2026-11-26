// Shrinks a chosen photo to postcard size before it's sent.
// Re-encoding through a canvas also drops EXIF (GPS included) and turns
// iPhone HEIC into JPEG. The server strips metadata again as the backstop.
(() => {
  const MAX_EDGE = 1600;
  const QUALITY = 0.82;
  const MAX_BYTES = 2_500_000;

  async function shrink(file) {
    let bitmap;
    try {
      bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      return null; // Browser can't decode it; let the server give the friendly error.
    }
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", QUALITY));
    if (!blob) return null;
    const name = (file.name || "postcard").replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg" });
  }

  for (const form of document.querySelectorAll("form[data-upload]")) {
    const input = form.querySelector('input[type="file"]');
    const label = form.querySelector(".file-label");
    const button = form.querySelector('button[type="submit"]');
    let preview = null;

    input.addEventListener("change", async () => {
      const file = input.files && input.files[0];
      if (!file) return;
      button.disabled = true;
      label.textContent = "Getting it ready…";
      const small = await shrink(file);
      if (small && typeof DataTransfer !== "undefined") {
        const dt = new DataTransfer();
        dt.items.add(small);
        input.files = dt.files;
      }
      const chosen = input.files[0];
      label.textContent = chosen.size > MAX_BYTES ? "Still a bit big — try another?" : "Ready to mail ✓";
      if (preview) URL.revokeObjectURL(preview.src);
      preview = preview || Object.assign(document.createElement("img"), { className: "send-preview", alt: "" });
      preview.src = URL.createObjectURL(chosen);
      form.insertBefore(preview, form.firstChild);
      button.disabled = false;
    });

    form.addEventListener("submit", () => {
      button.disabled = true;
      button.textContent = "Mailing…";
    });
  }
})();
