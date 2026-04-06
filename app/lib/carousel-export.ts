import html2canvas from "html2canvas";
import { PDFDocument } from "pdf-lib";

export interface SlideData {
  index: number;
  title: string;
  body: string;
  imagePrompt?: string;
}

export async function exportCarouselAsPdf(slides: SlideData[]): Promise<Blob> {
  const images: string[] = [];

  // Create temporary DOM elements for each slide
  for (const slide of slides) {
    const slideElement = createSlideElement(slide);
    document.body.appendChild(slideElement);

    try {
      const canvas = await html2canvas(slideElement, {
        scale: 2,
        backgroundColor: "#ffffff",
      });
      images.push(canvas.toDataURL("image/png"));
    } finally {
      document.body.removeChild(slideElement);
    }
  }

  // Create PDF
  const pdfDoc = await PDFDocument.create();

  for (const imgData of images) {
    const imgBuffer = await fetch(imgData).then((res) => res.arrayBuffer());
    const img = await pdfDoc.embedPng(imgBuffer);

    const pageWidth = img.width / 2; // Account for 2x scale
    const pageHeight = img.height / 2;

    const page = pdfDoc.addPage([pageWidth, pageHeight]);
    page.drawImage(img, {
      x: 0,
      y: 0,
      width: pageWidth,
      height: pageHeight,
    });
  }

  const pdfBytes = await pdfDoc.save();
  const uint8Array = new Uint8Array(pdfBytes);
  return new Blob([uint8Array], { type: "application/pdf" });
}

function createSlideElement(slide: SlideData): HTMLElement {
  const div = document.createElement("div");
  div.style.width = "1080px";
  div.style.height = "1080px";
  div.style.padding = "60px";
  div.style.backgroundColor = "#ffffff";
  div.style.fontFamily = "Arial, sans-serif";
  div.style.display = "flex";
  div.style.flexDirection = "column";
  div.style.justifyContent = "center";
  div.style.alignItems = "center";
  div.style.textAlign = "center";

  div.innerHTML = `
    <div style="font-size: 48px; font-weight: bold; margin-bottom: 40px; color: #333;">
      ${escapeHtml(slide.title)}
    </div>
    <div style="font-size: 32px; color: #666; line-height: 1.6; white-space: pre-wrap;">
      ${escapeHtml(slide.body)}
    </div>
  `;

  return div;
}

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
