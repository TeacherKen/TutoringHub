// 📷 Reading a photo in the browser, whatever camera it came from.
// iPhone/iPad photos are often HEIC. Safari can open those, but Chrome on a Mac or Windows can't —
// and Chrome often gives them no file type at all. So: spot them by name too, and convert them to JPG
// here in the browser first (the converter only downloads when a HEIC photo is actually picked).

const HEIC = /\.(heic|heif)$/i;
const PICTURE = /\.(heic|heif|jpe?g|png|webp|gif|bmp|avif)$/i;

export const isHeic = (f: File | Blob) => /image\/hei[cf]/i.test(f.type) || ("name" in f && HEIC.test((f as File).name));

/** True for anything that looks like a photo, even when the browser left the type empty. */
export const isPhoto = (f: File | Blob) => f.type.startsWith("image/") || ("name" in f && PICTURE.test((f as File).name));

async function heicToJpeg(f: Blob): Promise<Blob> {
  // Newer converter first: it reads photos from recent iPhones (iOS 17+), which the older one can't.
  try {
    const { heicTo } = await import("heic-to/next");
    return await heicTo({ blob: f, type: "image/jpeg", quality: 0.9 });
  } catch {
    const { default: heic2any } = await import("heic2any");
    const out = await heic2any({ blob: f, toType: "image/jpeg", quality: 0.9 });
    return Array.isArray(out) ? out[0] : out;
  }
}

/** Fallback for browsers whose createImageBitmap can't read a type but an <img> can. */
function viaImg(f: Blob): Promise<ImageBitmap> {
  return new Promise((ok, bad) => {
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => {
      createImageBitmap(img)
        .then(ok, bad)
        .finally(() => URL.revokeObjectURL(url));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      bad(new Error("unreadable"));
    };
    img.src = url;
  });
}

/** Safari can open HEIC itself; Chrome can't. */
async function canDecodeHere(f: Blob): Promise<boolean> {
  try {
    (await createImageBitmap(f)).close();
    return true;
  } catch {
    return false;
  }
}

/** Open any photo as a bitmap ready to draw. Throws only if it really can't be read. */
export async function readPhoto(f: Blob): Promise<ImageBitmap> {
  if (isHeic(f) && !(await canDecodeHere(f))) return await createImageBitmap(await heicToJpeg(f));
  try {
    return await createImageBitmap(f);
  } catch {
    /* try the other ways */
  }
  try {
    return await viaImg(f);
  } catch {
    /* maybe HEIC */
  }
  return await createImageBitmap(await heicToJpeg(f));
}

/** A smaller JPG of the photo (longest side `max` px), on a white background. */
export async function photoToJpeg(f: Blob, max = 2000, quality = 0.85): Promise<Blob> {
  const bmp = await readPhoto(f);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bmp.width * scale));
  canvas.height = Math.max(1, Math.round(bmp.height * scale));
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  return new Promise((ok, no) => canvas.toBlob((b) => (b ? ok(b) : no(new Error("jpeg"))), "image/jpeg", quality));
}
