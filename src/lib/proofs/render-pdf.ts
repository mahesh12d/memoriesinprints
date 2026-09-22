/**
 * Renders the first page of a PDF onto a canvas, in the browser.
 *
 * Shared by the proofing canvas and the comparison view so there is one copy
 * of the pdf.js setup — the worker path and the polyfill below are both easy
 * to get subtly wrong, and two copies would drift.
 */
export async function renderPdfFirstPage(
  fileUrl: string,
  canvas: HTMLCanvasElement,
  displayWidth: number,
): Promise<void> {
  // Must run before pdf.js is evaluated — it reaches for these on load.
  const { installMapUpsertPolyfill } = await import(
    "@/lib/proofs/map-upsert-polyfill"
  );
  installMapUpsertPolyfill();

  const pdfjs = await import("pdfjs-dist");

  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const document = await pdfjs.getDocument({ url: fileUrl }).promise;
  const page = await document.getPage(1);

  // Render at twice the display width so the artwork stays sharp when someone
  // leans in to check a date or a spelling.
  const target = displayWidth * 2;
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: target / base.width });

  canvas.width = viewport.width;
  canvas.height = viewport.height;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("No 2d context");

  await page.render({ canvas, canvasContext: context, viewport }).promise;
}
