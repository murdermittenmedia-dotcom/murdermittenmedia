import PDFDocument from "pdfkit";
import { buildBeatLicenseContractText, type ContractSnapshot } from "../shared/beat-marketplace";

const COLORS = {
  ink: "#0b0b0b",
  panel: "#141414",
  panelSoft: "#f4f1ed",
  red: "#d10000",
  gold: "#f1c40f",
  white: "#ffffff",
  black: "#121212",
  muted: "#686868",
  line: "#dedad4",
};

function safe(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)} USD`;
}

function isHeading(value: string) {
  return /^[A-Z][A-Z &/,-]+\.$/.test(value.trim());
}

/**
 * Creates a portable, branded Murder Mitten Media agreement. It intentionally
 * contains the producer-selected terms as a snapshot so the delivered file is
 * a durable record of the exact license purchased or claimed.
 */
export async function buildBeatLicensePdf(snapshot: ContractSnapshot): Promise<Buffer> {
  const doc = new PDFDocument({
    size: "LETTER",
    margins: { top: 54, bottom: 58, left: 54, right: 54 },
    info: {
      Title: `${snapshot.beatTitle} — Murder Mitten Media Beat License`,
      Author: "Murder Mitten Media",
      Subject: "Beat license agreement",
      Creator: "Murder Mitten Media Beat Marketplace",
    },
  });
  const chunks: Buffer[] = [];
  let pageNumber = 1;
  const pdf = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const drawFooter = () => {
    const y = 720;
    doc.save().moveTo(54, y).lineTo(558, y).lineWidth(0.6).strokeColor(COLORS.line).stroke();
    doc.font("Helvetica").fontSize(7.5).fillColor(COLORS.muted)
      .text("MURDER MITTEN MEDIA  /  THE MITTEN SOUND", 54, y + 10, { width: 350 });
    doc.text(`CONTRACT ${safe(snapshot.contractNumber)}  ·  PAGE ${pageNumber}`, 370, y + 10, { width: 188, align: "right" });
    doc.restore();
  };

  const drawPageHeader = () => {
    doc.save();
    doc.rect(0, 0, 612, 32).fill(COLORS.ink);
    doc.circle(72, 16, 9).fill(COLORS.red);
    doc.font("Helvetica-Bold").fontSize(9).fillColor(COLORS.white).text("M", 68.7, 11.3, { width: 7, align: "center" });
    doc.font("Helvetica-Bold").fontSize(8).fillColor(COLORS.white).text("MURDER MITTEN", 88, 11, { characterSpacing: 0.7 });
    doc.font("Helvetica-Bold").fontSize(8).fillColor(COLORS.red).text(" MEDIA", 168, 11, { characterSpacing: 0.7 });
    doc.restore();
  };

  // Branded cover masthead.
  doc.rect(0, 0, 612, 154).fill(COLORS.ink);
  doc.rect(0, 0, 10, 154).fill(COLORS.red);
  doc.circle(76, 61, 23).fill(COLORS.red);
  doc.circle(76, 61, 18).lineWidth(1.2).strokeColor(COLORS.gold).stroke();
  doc.font("Helvetica-Bold").fontSize(22).fillColor(COLORS.white).text("M", 64, 48, { width: 24, align: "center" });
  doc.font("Helvetica-Bold").fontSize(15).fillColor(COLORS.white).text("MURDER MITTEN", 115, 42, { characterSpacing: 1.2 });
  doc.font("Helvetica-Bold").fontSize(15).fillColor(COLORS.red).text("MEDIA", 115, 62, { characterSpacing: 1.2 });
  doc.font("Helvetica-Bold").fontSize(8).fillColor(COLORS.gold).text("THE MITTEN SOUND  /  BEAT MARKETPLACE", 115, 91, { characterSpacing: 1.1 });
  doc.font("Helvetica-Bold").fontSize(28).fillColor(COLORS.white).text("BEAT LICENSE", 54, 116, { characterSpacing: 0.4 });
  doc.font("Helvetica").fontSize(9).fillColor("#d7d7d7").text("AGREEMENT", 425, 126, { width: 133, align: "right", characterSpacing: 1.8 });

  doc.y = 179;
  doc.font("Helvetica-Bold").fontSize(20).fillColor(COLORS.black).text(safe(snapshot.beatTitle).toUpperCase(), 54, doc.y, { width: 504 });
  doc.moveDown(0.35);
  doc.font("Helvetica").fontSize(9).fillColor(COLORS.muted).text("A producer-defined license issued through the Murder Mitten Media marketplace.", { width: 504 });

  const pillY = doc.y + 18;
  doc.roundedRect(54, pillY, 132, 22, 3).fill(COLORS.red);
  doc.font("Helvetica-Bold").fontSize(8).fillColor(COLORS.white).text(snapshot.amountCents === 0 ? "FREE LICENSE" : "LICENSE ISSUED", 54, pillY + 7, { width: 132, align: "center", characterSpacing: 0.9 });
  doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.black).text(safe(snapshot.license.name), 202, pillY + 6, { width: 210 });
  doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.red).text(money(snapshot.amountCents), 414, pillY + 6, { width: 144, align: "right" });
  doc.y = pillY + 45;

  const cardTop = doc.y;
  const cardHeight = 94;
  doc.roundedRect(54, cardTop, 504, cardHeight, 5).fill(COLORS.panelSoft);
  doc.font("Helvetica-Bold").fontSize(7.5).fillColor(COLORS.red).text("PARTIES & RECORD", 70, cardTop + 15, { characterSpacing: 1.2 });
  const leftX = 70;
  const rightX = 320;
  const row = (label: string, value: string, x: number, y: number, width: number) => {
    doc.font("Helvetica-Bold").fontSize(7).fillColor(COLORS.muted).text(label.toUpperCase(), x, y, { width });
    doc.font("Helvetica").fontSize(9).fillColor(COLORS.black).text(value || "Not provided", x, y + 10, { width, ellipsis: true });
  };
  row("Producer", safe(snapshot.producerName), leftX, cardTop + 31, 215);
  row("Artist / buyer", safe(snapshot.buyerName), rightX, cardTop + 31, 215);
  row("Contract number", safe(snapshot.contractNumber), leftX, cardTop + 61, 215);
  row("Effective date", safe(snapshot.effectiveDate), rightX, cardTop + 61, 215);
  doc.y = cardTop + cardHeight + 25;

  const ensureRoom = (height: number) => {
    if (doc.y + height > 710) {
      drawFooter();
      doc.addPage();
      pageNumber += 1;
      drawPageHeader();
      doc.y = 54;
    }
  };
  const section = (title: string, paragraphs: string[]) => {
    ensureRoom(54);
    doc.roundedRect(54, doc.y, 504, 25, 3).fill(COLORS.ink);
    doc.rect(54, doc.y, 5, 25).fill(COLORS.red);
    doc.font("Helvetica-Bold").fontSize(9).fillColor(COLORS.white).text(title, 70, doc.y + 8, { characterSpacing: 0.6 });
    doc.y += 36;
    for (const paragraph of paragraphs) {
      if (!paragraph) continue;
      if (isHeading(paragraph)) {
        ensureRoom(34);
        doc.font("Helvetica-Bold").fontSize(8).fillColor(COLORS.red).text(paragraph.replace(/\.$/, ""), 70, doc.y, { characterSpacing: 0.6 });
        doc.moveDown(0.55);
      } else {
        ensureRoom(34);
        doc.font("Helvetica").fontSize(9).fillColor(COLORS.black).text(paragraph, 70, doc.y, { width: 472, lineGap: 3, paragraphGap: 8 });
        doc.moveDown(0.45);
      }
    }
    doc.y += 8;
  };

  section("LICENSE SUMMARY", [
    `This agreement records the license selected for “${safe(snapshot.beatTitle)}” by ${safe(snapshot.buyerName)} from ${safe(snapshot.producerName)}.`,
    `The license tier is ${safe(snapshot.license.name)}. The producer’s usage limits, permissions, attribution requirements, and restrictions below control this transaction.`,
  ]);

  const body = buildBeatLicenseContractText(snapshot);
  section("TERMS & CONDITIONS", body);

  ensureRoom(126);
  doc.roundedRect(54, doc.y, 504, 100, 5).fill(COLORS.panelSoft);
  doc.font("Helvetica-Bold").fontSize(8).fillColor(COLORS.red).text("ACKNOWLEDGEMENT", 70, doc.y + 15, { characterSpacing: 1.1 });
  doc.font("Helvetica").fontSize(8.5).fillColor(COLORS.black).text("By accepting this license, the parties acknowledge the terms above and agree that this document is the marketplace record for the transaction.", 70, doc.y + 31, { width: 472, lineGap: 3 });
  doc.moveTo(70, doc.y + 78).lineTo(275, doc.y + 78).lineWidth(0.7).strokeColor(COLORS.black).stroke();
  doc.moveTo(337, doc.y + 78).lineTo(542, doc.y + 78).lineWidth(0.7).strokeColor(COLORS.black).stroke();
  doc.font("Helvetica").fontSize(7.5).fillColor(COLORS.muted).text("Producer acknowledgement", 70, doc.y + 84);
  doc.text("Artist / buyer acknowledgement", 337, doc.y + 84);
  doc.y += 124;

  ensureRoom(34);
  doc.font("Helvetica").fontSize(7.5).fillColor(COLORS.muted).text("This agreement was generated by Murder Mitten Media Beat Marketplace. Keep this file with your release records. This document is not legal advice.", 54, doc.y, { width: 504, align: "center" });
  drawFooter();
  doc.end();
  return pdf;
}
