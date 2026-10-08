import { jsPDF } from "jspdf";
import type { Note } from "../types/note.types";

// ---------------------------------------------------------------------------
// Strip inline markdown markers for plain-text PDF output
// e.g. **bold** -> bold, *italic* -> italic, `code` -> code
// ---------------------------------------------------------------------------
function stripInline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1");
}

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------
type RGB = [number, number, number];
const EMERALD: RGB   = [16, 185, 129];
const ZINC900: RGB   = [17, 24, 39];
const ZINC600: RGB   = [75, 85, 99];
const ZINC400: RGB   = [156, 163, 175];
const ZINC200: RGB   = [228, 228, 231];
const GREEN_BG: RGB  = [240, 253, 244];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
export async function downloadNoteAsPdf(note: Note): Promise<void> {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const pageW = pdf.internal.pageSize.getWidth();   // 210
  const pageH = pdf.internal.pageSize.getHeight();  // 297
  const marginL = 16;
  const marginR = pageW - 16;
  const contentW = marginR - marginL;

  // ── Cornell Layout Parameters ───────────────────────────────────────────
  const mainIdeasW = 50;
  const gap = 4;
  const notesW = contentW - mainIdeasW - gap;
  const summaryH = 45;

  const notesX = marginL + mainIdeasW + gap;
  const boxTopY = 32;
  const boxBottomY = pageH - 16 - summaryH - gap;
  const boxH = boxBottomY - boxTopY;

  const summaryY = boxBottomY + gap;
  const textLeftX = notesX + 4;
  const textMaxW = notesW - 8;

  // ── We track the Y cursor across pages ──────────────────────────────────
  let y = boxTopY + 10;

  const ensureSpace = (needed: number) => {
    if (y + needed > boxBottomY - 4) {
      addFooter();
      pdf.addPage();
      drawHeader();
      drawCornellBoxes();
      y = boxTopY + 10;
    }
  };

  // ── Cornell Boxes ────────────────────────────────────────────────────────
  const drawCornellBoxes = () => {
    pdf.setDrawColor(...ZINC900);
    pdf.setLineWidth(0.5);

    // Main Ideas box
    pdf.rect(marginL, boxTopY, mainIdeasW, boxH);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.setTextColor(...ZINC900);
    pdf.text("Main Ideas", marginL + 3, boxTopY + 6);

    // Notes box
    pdf.rect(notesX, boxTopY, notesW, boxH);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.setTextColor(...ZINC900);
    pdf.text("Notes", notesX + 3, boxTopY + 6);

    // Summary box
    pdf.rect(marginL, summaryY, contentW, summaryH);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.setTextColor(...ZINC900);
    pdf.text("Summary", marginL + 3, summaryY + 6);
  };

  // ── Header ───────────────────────────────────────────────────────────────
  const drawHeader = () => {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(22);
    pdf.setTextColor(...ZINC900);
    pdf.text("Qrious Notes", pageW / 2, 16, { align: "center" });

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(12);
    const titleText = note.title || "Untitled Note";
    pdf.text(titleText, pageW / 2, 24, { align: "center", maxWidth: contentW });
  };

  // ── Footer ───────────────────────────────────────────────────────────────
  const addFooter = () => {
    pdf.setFontSize(8);
    pdf.setTextColor(...ZINC400);
    const page = pdf.getNumberOfPages();
    pdf.text(`Page ${page}`, pageW / 2, pageH - 8, { align: "center" });
  };

  // ── Markdown block renderer ──────────────────────────────────────────────
  const renderBody = (raw: string) => {
    if (!raw.trim()) {
      pdf.setFont("helvetica", "italic");
      pdf.setFontSize(10);
      pdf.setTextColor(...ZINC400);
      pdf.text("(Empty note)", textLeftX, y);
      y += 8;
      return;
    }

    const lines = raw.split("\n");
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      // ── Fenced code block ────────────────────────────────────────────────
      if (line.trimStart().startsWith("```")) {
        const lang = line.trim().slice(3).trim();
        const codeLines: string[] = [];
        i++;
        while (i < lines.length && !lines[i].trimStart().startsWith("```")) {
          codeLines.push(lines[i]);
          i++;
        }
        i++;

        const lineH = 5;
        const blockH = codeLines.length * lineH + (lang ? 12 : 6) + 4;
        ensureSpace(blockH + 4);

        // Background rect
        pdf.setFillColor(249, 250, 251);
        pdf.setDrawColor(...ZINC200);
        pdf.setLineWidth(0.3);
        pdf.roundedRect(textLeftX, y - 1, textMaxW, blockH, 3, 3, "FD");

        // Lang label
        if (lang) {
          pdf.setFont("courier", "normal");
          pdf.setFontSize(7.5);
          pdf.setTextColor(...EMERALD);
          pdf.text(lang.toUpperCase(), textLeftX + 3, y + 4);
          y += 8;
          // inner separator
          pdf.setDrawColor(...ZINC200);
          pdf.line(textLeftX, y, textLeftX + textMaxW, y);
          y += 3;
        } else {
          y += 3;
        }

        pdf.setFont("courier", "normal");
        pdf.setFontSize(8.5);
        pdf.setTextColor(...EMERALD);
        codeLines.forEach((cl) => {
          const wrapped = pdf.splitTextToSize(cl || " ", textMaxW - 6);
          pdf.text(wrapped, textLeftX + 3, y);
          y += wrapped.length * lineH;
        });

        y += 4;
        continue;
      }

      // ── Bullet list ──────────────────────────────────────────────────────
      if (line.startsWith("- ") || line.startsWith("* ")) {
        while (i < lines.length && (lines[i].startsWith("- ") || lines[i].startsWith("* "))) {
          const text = stripInline(lines[i].slice(2));
          const wrapped = pdf.splitTextToSize(text, textMaxW - 8);
          ensureSpace(wrapped.length * 5 + 2);

          pdf.setFillColor(...EMERALD);
          pdf.circle(textLeftX + 2, y - 1.2, 1, "F");

          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(10);
          pdf.setTextColor(...ZINC900);
          pdf.text(wrapped, textLeftX + 6, y);
          y += wrapped.length * 5 + 1.5;
          i++;
        }
        y += 2;
        continue;
      }

      // ── Headings ─────────────────────────────────────────────────────────
      if (line.startsWith("### ")) {
        ensureSpace(12);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(11);
        pdf.setTextColor(...ZINC900);
        pdf.text(stripInline(line.slice(4)), textLeftX, y);
        y += 7;
        i++; continue;
      }
      if (line.startsWith("## ")) {
        ensureSpace(16);
        y += 2;
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(13);
        pdf.setTextColor(...ZINC900);
        pdf.text(stripInline(line.slice(3)), textLeftX, y);
        y += 2;
        pdf.setDrawColor(...ZINC200);
        pdf.line(textLeftX, y + 1, textLeftX + textMaxW, y + 1);
        y += 6;
        i++; continue;
      }
      if (line.startsWith("# ")) {
        ensureSpace(18);
        y += 3;
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(15);
        pdf.setTextColor(...ZINC900);
        pdf.text(stripInline(line.slice(2)), textLeftX, y);
        y += 8;
        i++; continue;
      }

      // ── Horizontal rule ──────────────────────────────────────────────────
      if (/^[-*_]{3,}$/.test(line.trim())) {
        ensureSpace(6);
        pdf.setDrawColor(...ZINC200);
        pdf.setLineWidth(0.3);
        pdf.line(textLeftX, y, textLeftX + textMaxW, y);
        y += 5;
        i++; continue;
      }

      // ── Blank line ───────────────────────────────────────────────────────
      if (!line.trim()) {
        y += 3;
        i++; continue;
      }

      // ── Paragraph ────────────────────────────────────────────────────────
      const text = stripInline(line);
      const wrapped = pdf.splitTextToSize(text, textMaxW);
      ensureSpace(wrapped.length * 5.5 + 2);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.setTextColor(...ZINC900);
      pdf.text(wrapped, textLeftX, y);
      y += wrapped.length * 5.5 + 1.5;
      i++;
    }
  };

  // ── Parse Markdown into Cornell Sections ──────────────────────────────────
  const parseMarkdown = (raw: string) => {
    const lines = raw.split("\n");
    const notesLines: string[] = [];
    const mainIdeasLines: string[] = [];
    const summaryLines: string[] = [];
    let currentSection = "notes";

    for (const line of lines) {
      const headingMatch = line.match(/^#{1,3}\s+(.*)/);
      if (headingMatch) {
        const text = headingMatch[1].toLowerCase().trim();
        if (text === "main idea" || text === "main ideas") {
          currentSection = "mainIdeas";
          continue;
        } else if (text === "summary") {
          currentSection = "summary";
          continue;
        } else {
          currentSection = "notes";
        }
      }

      if (currentSection === "mainIdeas") mainIdeasLines.push(line);
      else if (currentSection === "summary") summaryLines.push(line);
      else notesLines.push(line);
    }
    return {
      notes: notesLines.join("\n"),
      mainIdeas: mainIdeasLines.join("\n"),
      summary: summaryLines.join("\n"),
    };
  };

  const renderSimpleText = (raw: string, startX: number, startY: number, maxW: number) => {
    let currentY = startY;
    const lines = raw.split("\n");
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.setTextColor(...ZINC900);

    for (const line of lines) {
      const text = stripInline(line).replace(/^#{1,6}\s*/, "").replace(/^[-*]\s*/, "");
      if (!text.trim()) {
        currentY += 4;
        continue;
      }
      const wrapped = pdf.splitTextToSize(text, maxW);
      pdf.text(wrapped, startX, currentY);
      currentY += wrapped.length * 5.5 + 1.5;
    }
  };

  // ── Assemble the document ────────────────────────────────────────────────
  const parsed = parseMarkdown(note.content_markdown || "");
  drawHeader();
  drawCornellBoxes();

  if (parsed.mainIdeas.trim()) {
    renderSimpleText(parsed.mainIdeas, marginL + 3, boxTopY + 12, mainIdeasW - 6);
  }
  if (parsed.summary.trim()) {
    renderSimpleText(parsed.summary, marginL + 3, summaryY + 12, contentW - 6);
  }

  renderBody(parsed.notes);
  addFooter();

  // ── Add footer + watermark to every page ──────────────────────────────────
  const totalPages = pdf.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    pdf.setPage(p);
    // Footer text already added at page-break time; update page totals
    pdf.setDrawColor(...EMERALD);
    pdf.setLineWidth(0.4);
    pdf.line(marginL, pageH - 10, marginR, pageH - 10);
    pdf.setFontSize(7.5);
    pdf.setTextColor(...ZINC400);
    pdf.text("Qrious — Quantum Learning Platform", marginL, pageH - 5);
    pdf.text(`Page ${p} of ${totalPages}`, marginR, pageH - 5, { align: "right" });
  }

  const safeTitle = (note.title || "note")
    .replace(/[^a-z0-9]/gi, "_")
    .toLowerCase()
    .slice(0, 60);
  pdf.save(`quantlms_${safeTitle}.pdf`);
}
