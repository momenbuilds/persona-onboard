import type { DocSpec } from "@/lib/chat/protocol";

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "document";
}

/** Strip inline markdown for plain PDF text (math stays as its LaTeX source). */
function plain(s: string) {
  return s
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/(^|[^*])\*(?!\s)(.+?)\*/g, "$1$2")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\$\$?([^$]+)\$\$?/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadMarkdown(doc: DocSpec) {
  save(new Blob([doc.markdown], { type: "text/markdown;charset=utf-8" }), `${slug(doc.title)}.md`);
}

/**
 * Lay the document's markdown out as a clean PDF. jsPDF + marked are loaded on
 * demand, only when someone actually downloads.
 */
export async function downloadPdf(doc: DocSpec) {
  const [{ jsPDF }, { marked }] = await Promise.all([import("jspdf"), import("marked")]);
  const pdf = new jsPDF({ unit: "pt", format: "letter" });
  const PW = pdf.internal.pageSize.getWidth();
  const PH = pdf.internal.pageSize.getHeight();
  const M = 60;
  const width = PW - M * 2;
  let y = M;

  const ensure = (h: number) => {
    if (y + h > PH - M) {
      pdf.addPage();
      y = M;
    }
  };
  const write = (
    text: string,
    o: { size?: number; style?: "normal" | "bold" | "italic"; color?: [number, number, number]; indent?: number; gap?: number; font?: string } = {},
  ) => {
    const size = o.size ?? 11;
    pdf.setFont(o.font ?? "helvetica", o.style ?? "normal");
    pdf.setFontSize(size);
    pdf.setTextColor(...(o.color ?? [66, 66, 69]));
    const lines = pdf.splitTextToSize(text, width - (o.indent ?? 0)) as string[];
    for (const line of lines) {
      ensure(size * 1.45);
      pdf.text(line, M + (o.indent ?? 0), y + size);
      y += size * 1.45;
    }
    y += o.gap ?? 0;
  };

  type Tok = { type: string; [k: string]: unknown };
  const tokens = marked.lexer(doc.markdown) as unknown as Tok[];
  for (const t of tokens) {
    switch (t.type) {
      case "heading": {
        const depth = t.depth as number;
        const size = depth === 1 ? 22 : depth === 2 ? 15 : 12.5;
        y += depth === 1 ? 0 : 10;
        write(plain(t.text as string), { size, style: "bold", color: [29, 29, 31], gap: depth === 1 ? 8 : 4 });
        if (depth === 1) {
          pdf.setDrawColor(210, 210, 215);
          pdf.line(M, y, PW - M, y);
          y += 12;
        }
        break;
      }
      case "paragraph":
        write(plain(t.text as string), { gap: 8 });
        break;
      case "list": {
        const items = t.items as { text: string }[];
        items.forEach((item, i) => {
          const bullet = t.ordered ? `${(Number(t.start) || 1) + i}.` : "•";
          ensure(16);
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(11);
          pdf.setTextColor(142, 142, 147);
          pdf.text(bullet, M + 4, y + 11);
          write(plain(item.text.split("\n")[0]), { indent: 20, gap: 3 });
        });
        y += 6;
        break;
      }
      case "table": {
        const header = (t.header as { text: string }[]).map((c) => plain(c.text));
        const rows = (t.rows as { text: string }[][]).map((r) => r.map((c) => plain(c.text)));
        const cols = header.length;
        const cw = width / cols;
        const row = (cells: string[], bold: boolean) => {
          pdf.setFont("helvetica", bold ? "bold" : "normal");
          pdf.setFontSize(10);
          const wrapped = cells.map((c) => pdf.splitTextToSize(c, cw - 12) as string[]);
          const h = Math.max(...wrapped.map((w) => w.length)) * 13 + 10;
          ensure(h);
          if (bold) {
            pdf.setFillColor(245, 245, 247);
            pdf.rect(M, y, width, h, "F");
          }
          pdf.setTextColor(bold ? 29 : 66, bold ? 29 : 66, bold ? 31 : 69);
          wrapped.forEach((lines, ci) => lines.forEach((line, li) => pdf.text(line, M + ci * cw + 6, y + 15 + li * 13)));
          pdf.setDrawColor(229, 229, 234);
          pdf.line(M, y + h, PW - M, y + h);
          y += h;
        };
        row(header, true);
        rows.forEach((r) => row(r, false));
        y += 12;
        break;
      }
      case "code": {
        const lines = (t.text as string).split("\n");
        const h = lines.length * 12 + 14;
        ensure(Math.min(h, 200));
        pdf.setFillColor(245, 245, 247);
        pdf.roundedRect(M, y, width, Math.min(h, PH - M - y), 6, 6, "F");
        y += 8;
        write(t.text as string, { font: "courier", size: 9.5, color: [29, 29, 31], indent: 8, gap: 10 });
        break;
      }
      case "blockquote":
        write(plain(t.text as string), { style: "italic", color: [110, 110, 115], indent: 14, gap: 8 });
        break;
      case "hr":
        ensure(16);
        pdf.setDrawColor(210, 210, 215);
        pdf.line(M, y + 6, PW - M, y + 6);
        y += 16;
        break;
      case "space":
        y += 4;
        break;
      default:
        if (typeof t.text === "string" && t.text.trim()) write(plain(t.text), { gap: 6 });
    }
  }

  const pages = pdf.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    pdf.setPage(i);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.5);
    pdf.setTextColor(142, 142, 147);
    pdf.text("Persona", M, PH - 30);
    pdf.text(`${i} / ${pages}`, PW - M, PH - 30, { align: "right" });
  }
  pdf.setProperties({ title: doc.title, creator: "Persona" });
  save(pdf.output("blob"), `${slug(doc.title)}.pdf`);
}

/** Rough page estimate for the file card ("PDF · 2 pages"). */
export function estimatePages(markdown: string) {
  const lines = markdown.split("\n").length;
  return Math.max(1, Math.round((markdown.length / 2600 + lines / 45) / 1.6));
}
