// Turns a PDF into page pictures in the browser (so the student's room only loads images).
const TARGET_WIDTH = 1600;
const MAX_PAGES = 60;

export type PdfPage = { blob: Blob; width: number; height: number };

export async function pdfToImages(file: File, onProgress?: (done: number, total: number) => void): Promise<PdfPage[]> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const total = Math.min(doc.numPages, MAX_PAGES);
  const out: PdfPage[] = [];
  for (let i = 1; i <= total; i++) {
    const page = await doc.getPage(i);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: TARGET_WIDTH / base.width });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("image"))), "image/jpeg", 0.86));
    out.push({ blob, width: canvas.width, height: canvas.height });
    page.cleanup();
    onProgress?.(i, total);
  }
  await doc.destroy();
  return out;
}
