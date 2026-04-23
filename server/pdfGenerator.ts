import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getLocalUploadDir } from "./storage";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type PdfData = {
  settlement: any;
  member: any;
  event: any;
  salesTransactions: any[];
  purchaseTransactions: any[];
  salesReturnTransactions?: any[];
  purchaseReturnTransactions?: any[];
  breakdown: {
    salesTotalTaxable: number;
    salesTotalNonTaxable: number;
    purchaseTotalTaxable: number;
    purchaseTotalNonTaxable: number;
    salesCommissionTax: number;
    purchaseCommissionTax: number;
    salesReturnTotal?: number;
    purchaseReturnTotal?: number;
  };
  participationFeeStatus?: "collected" | "uncollected" | "exempt" | "absent";
  sealImageUrl?: string | null;
};

function fmt(n: number): string {
  return `¥${n.toLocaleString()}`;
}

// ─── Font loading (cached) ───
let fontBase64Cache: string | null = null;

function loadFontBase64(): string {
  if (fontBase64Cache) return fontBase64Cache;
  const candidates = [
    path.resolve(__dirname, "fonts/NotoSansJP.ttf"),
    path.resolve(__dirname, "../server/fonts/NotoSansJP.ttf"),
    path.resolve(process.cwd(), "server/fonts/NotoSansJP.ttf"),
  ];
  const fontPath = candidates.find(p => fs.existsSync(p));
  if (!fontPath) {
    throw new Error(`Font file not found in any of: ${candidates.join(", ")}`);
  }
  fontBase64Cache = fs.readFileSync(fontPath).toString("base64");
  return fontBase64Cache;
}

function createDoc(): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const fontBase64 = loadFontBase64();
  doc.addFileToVFS("NotoSansJP.ttf", fontBase64);
  doc.addFont("NotoSansJP.ttf", "NotoSansJP", "normal");
  doc.addFileToVFS("NotoSansJP-Bold.ttf", fontBase64);
  doc.addFont("NotoSansJP-Bold.ttf", "NotoSansJP", "bold");
  doc.setFont("NotoSansJP");
  return doc;
}

// ─── Seal image loading (cached) ───
let sealImageCache: { url: string; base64: string; format: string } | null = null;

async function loadSealImage(url: string): Promise<{ base64: string; format: string } | null> {
  try {
    if (sealImageCache && sealImageCache.url === url) {
      return { base64: sealImageCache.base64, format: sealImageCache.format };
    }
    const response = await fetch(url);
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") || "";
    const buffer = Buffer.from(await response.arrayBuffer());
    const base64 = buffer.toString("base64");
    let format = "PNG";
    if (contentType.includes("jpeg") || contentType.includes("jpg")) format = "JPEG";
    else if (contentType.includes("gif")) format = "GIF";
    else if (contentType.includes("webp")) format = "WEBP";
    sealImageCache = { url, base64, format };
    return { base64, format };
  } catch {
    return null;
  }
}

function guessImageFormatFromPath(p: string): "PNG" | "JPEG" | "WEBP" | "GIF" {
  const lower = p.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "JPEG";
  if (lower.endsWith(".webp")) return "WEBP";
  if (lower.endsWith(".gif")) return "GIF";
  return "PNG";
}

// ─── Render a single settlement page onto an existing jsPDF document ───
async function renderSettlementPage(
  doc: jsPDF,
  data: PdfData,
  sealData: { base64: string; format: string } | null
): Promise<void> {
  const { settlement, member, event, salesTransactions, purchaseTransactions, breakdown } = data;
  const salesReturnTransactions = data.salesReturnTransactions ?? [];
  const purchaseReturnTransactions = data.purchaseReturnTransactions ?? [];
  const salesReturnTotal = breakdown.salesReturnTotal ?? settlement.salesReturnTotal ?? 0;
  const purchaseReturnTotal = breakdown.purchaseReturnTotal ?? settlement.purchaseReturnTotal ?? 0;

  const pageWidth = 210;
  const marginLeft = 12;
  const marginRight = 12;
  const contentWidth = pageWidth - marginLeft - marginRight;
  let y = 14;

  // Title
  doc.setFontSize(16);
  doc.text("岐阜リサイクルオークション　精算書", pageWidth / 2, y, { align: "center" });
  y += 7;

  // Event date
  doc.setFontSize(9);
  doc.text(`開催日：${event?.eventDate ?? ""}`, marginLeft, y);
  y += 8;

  // ─── Left: Member info ───
  const leftColWidth = contentWidth * 0.44;
  const rightColX = marginLeft + contentWidth * 0.48;
  const rightColWidth = contentWidth * 0.52;

  doc.setFontSize(12);
  doc.text(`${member?.memberNumber ?? ""}　${member?.displayName ?? ""}　様`, marginLeft, y);
  const memberNameY = y;
  y += 8;

  doc.setFontSize(9);
  doc.text("岐阜リサイクルオークション", marginLeft, y, { maxWidth: leftColWidth });
  y += 5;
  doc.text("TEL:0575-24-3200", marginLeft, y);
  y += 4;
  doc.text("住所:岐阜県多治見市大原町8-1-1", marginLeft, y, { maxWidth: leftColWidth });
  y += 6;
  doc.setFontSize(8);
  doc.text("運営　総合リサイクルセンター JPH合同会社", marginLeft, y, { maxWidth: leftColWidth });
  y += 4;
  doc.text("登録番号：T7-2000-0300-4293", marginLeft, y);

  // Seal image (pre-loaded, shared across all pages)
  if (sealData) {
    try {
      doc.addImage(
        `data:image/${sealData.format.toLowerCase()};base64,${sealData.base64}`,
        sealData.format,
        marginLeft + 58, memberNameY + 2, 16, 16
      );
    } catch { /* ignore seal image errors */ }
  }

  // ─── Right: Summary table (通常取引のみ) ───
  let sy = memberNameY - 5;
  // 参加費・同伴者料金は事前徴収済のため精算書PDFには含めない

  // Build all summary rows in a single array for unified table rendering
  const allSummaryRows: { cells: [string, string, string, string]; type: "normal" | "return" | "fee" }[] = [
    { cells: ["売り合計金額", fmt(settlement.salesTotal), "内課税業者", fmt(breakdown.salesTotalTaxable)], type: "normal" },
    { cells: ["手数料", fmt(settlement.salesCommission), "内免税業者", fmt(breakdown.salesTotalNonTaxable)], type: "normal" },
    { cells: ["消費税(10%)", fmt(breakdown.salesCommissionTax), "", ""], type: "normal" },
    { cells: ["買い合計金額", fmt(settlement.purchaseTotal), "内課税業者", fmt(breakdown.purchaseTotalTaxable)], type: "normal" },
    { cells: ["手数料", fmt(settlement.purchaseCommission), "内免税業者", fmt(breakdown.purchaseTotalNonTaxable)], type: "normal" },
    { cells: ["消費税(10%)", fmt(breakdown.purchaseCommissionTax), "", ""], type: "normal" },
  ];

  // 返品行を追加（黄色マーク）
  if (salesReturnTotal > 0) {
    allSummaryRows.push({ cells: ["売返品", fmt(salesReturnTotal), "", ""], type: "return" });
  }
  if (purchaseReturnTotal > 0) {
    allSummaryRows.push({ cells: ["買返品", fmt(purchaseReturnTotal), "", ""], type: "return" });
  }

  // 受付情報に基づく参加費行の追加（未徴収のみ表示、領収済・免除・不参加は非表示）
  const feeStatus = data.participationFeeStatus ?? "absent";
  if (feeStatus === "uncollected") {
    // 未徴収: 「参加費」として金額を表示（精算書から差引）
    allSummaryRows.push({ cells: ["参加費", fmt(settlement.participationFee), "", "精算書より差引させていただきます"], type: "fee" });
  }
  // collected(領収済)・exempt(免除)・absent(不参加) は何も表示しない

  // Index of last normal row (消費税(10%) for 買い side = index 5)
  const lastNormalRowIndex = 5;
  // Indices of return rows
  const returnRowIndices = allSummaryRows
    .map((r, i) => r.type === "return" ? i : -1)
    .filter(i => i >= 0);
  // Index of fee row
  const feeRowIndex = allSummaryRows.findIndex(r => r.type === "fee");

  // 統合サマリーテーブル（1つのautoTableで全行を描画）
  autoTable(doc, {
    startY: sy,
    margin: { left: rightColX },
    tableWidth: rightColWidth,
    styles: {
      font: "NotoSansJP",
      fontSize: 8,
      cellPadding: { top: 1.2, bottom: 1.2, left: 1.5, right: 1.5 },
      lineColor: [200, 200, 200],
      lineWidth: 0.2,
      textColor: [0, 0, 0],
    },
    columnStyles: {
      0: { cellWidth: rightColWidth * 0.28, halign: "right" },
      1: { cellWidth: rightColWidth * 0.22, halign: "right" },
      2: { cellWidth: rightColWidth * 0.22, halign: "right", fontSize: 7, textColor: [100, 100, 100] },
      3: { cellWidth: rightColWidth * 0.28, halign: "right" },
    },
    body: allSummaryRows.map(r => r.cells),
    theme: "plain",
    didParseCell: (cellData: any) => {
      const rowIdx = cellData.row.index;
      // 消費税(10%)行（買い側）の下に太線（通常行と返品行の区切り）
      if (rowIdx === lastNormalRowIndex) {
        cellData.cell.styles.lineWidth = { bottom: 0.5 };
        cellData.cell.styles.lineColor = [0, 0, 0];
      }
      // 返品行は黄色背景
      if (returnRowIndices.includes(rowIdx)) {
        cellData.cell.styles.fillColor = [255, 255, 200];
      }
      // 参加費行のスタイリング
      if (rowIdx === feeRowIndex) {
        if (feeStatus === "collected") {
          // 徴収済み: 緑テキスト
          cellData.cell.styles.textColor = [0, 128, 0];
          cellData.cell.styles.fillColor = [230, 255, 230];
        } else if (feeStatus === "uncollected") {
          // 未徴収: 赤テキスト
          cellData.cell.styles.textColor = [200, 0, 0];
          cellData.cell.styles.fillColor = [255, 230, 230];
        }
      }
    },
  });

  let afterSummaryY = (doc as any).lastAutoTable.finalY;

  // Final settlement amount row (お支払金額)
  afterSummaryY += 1;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.4);
  doc.setFillColor(245, 245, 245);
  doc.rect(rightColX, afterSummaryY, rightColWidth, 8, "FD");
  doc.setFontSize(10);
  doc.text("お支払金額", rightColX + rightColWidth * 0.28 - 2, afterSummaryY + 5.5, { align: "right" });
  doc.setFontSize(13);
  doc.text(fmt(Math.abs(settlement.settlementAmount)), rightColX + rightColWidth - 2, afterSummaryY + 6, { align: "right" });

  if (member?.invoiceNumber) {
    doc.setFontSize(8);
    doc.text(`登録番号：${member.invoiceNumber}`, rightColX + rightColWidth, afterSummaryY + 12, { align: "right" });
  }

  y = Math.max(y + 8, afterSummaryY + 18);

  // ─── Purchase details ───
  if (purchaseTransactions.length > 0) {
    doc.setFontSize(10);
    doc.text("【買い明細】", marginLeft, y);
    y += 2;

    autoTable(doc, {
      startY: y,
      margin: { left: marginLeft, right: marginRight },
      tableWidth: contentWidth,
      styles: {
        font: "NotoSansJP",
        fontSize: 8,
        cellPadding: { top: 1, bottom: 1, left: 2, right: 2 },
        textColor: [0, 0, 0],
        lineColor: [220, 220, 220],
        lineWidth: 0.15,
      },
      headStyles: {
        font: "NotoSansJP",
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        lineWidth: { top: 0.4, bottom: 0.4 },
        lineColor: [0, 0, 0],
      },
      head: [["商品名", "数量", "金額", "売主", "インボイス"]],
      columnStyles: {
        0: { cellWidth: contentWidth * 0.30 },
        1: { cellWidth: contentWidth * 0.08, halign: "right" },
        2: { cellWidth: contentWidth * 0.12, halign: "right" },
        3: { cellWidth: contentWidth * 0.28 },
        4: { cellWidth: contentWidth * 0.22, fontSize: 7 },
      },
      body: purchaseTransactions.map((t: any) => [
        t.itemName,
        String(t.quantity),
        t.totalPrice.toLocaleString(),
        `${t.sellerMemberNumber}  ${t.sellerName}`,
        t.sellerInvoiceNumber || "",
      ]),
      theme: "plain",
    });
    y = (doc as any).lastAutoTable.finalY + 1;

    // ─── Purchase return details (黄色マーク) ───
    if (purchaseReturnTransactions.length > 0) {
      autoTable(doc, {
        startY: y,
        margin: { left: marginLeft, right: marginRight },
        tableWidth: contentWidth,
        styles: {
          font: "NotoSansJP",
          fontSize: 8,
          cellPadding: { top: 1, bottom: 1, left: 2, right: 2 },
          textColor: [0, 0, 0],
          lineColor: [220, 220, 220],
          lineWidth: 0.15,
          fillColor: [255, 255, 200],
        },
        columnStyles: {
          0: { cellWidth: contentWidth * 0.08 },
          1: { cellWidth: contentWidth * 0.30 },
          2: { cellWidth: contentWidth * 0.08, halign: "right" },
          3: { cellWidth: contentWidth * 0.12, halign: "right" },
          4: { cellWidth: contentWidth * 0.20 },
          5: { cellWidth: contentWidth * 0.22, fontSize: 7 },
        },
        body: purchaseReturnTransactions.map((t: any) => [
          "買返品",
          t.itemName,
          String(t.quantity),
          t.totalPrice.toLocaleString(),
          `${t.sellerMemberNumber}  ${t.sellerName}`,
          t.sellerInvoiceNumber || "",
        ]),
        theme: "plain",
      });
      y = (doc as any).lastAutoTable.finalY + 1;
    }
    y += 5;
  }

  // ─── Sales details ───
  if (salesTransactions.length > 0) {
    if (y > 260) {
      doc.addPage();
      y = 14;
    }

    doc.setFontSize(10);
    doc.text("【売り明細】", marginLeft, y);
    y += 2;

    autoTable(doc, {
      startY: y,
      margin: { left: marginLeft, right: marginRight },
      tableWidth: contentWidth,
      styles: {
        font: "NotoSansJP",
        fontSize: 8,
        cellPadding: { top: 1, bottom: 1, left: 2, right: 2 },
        textColor: [0, 0, 0],
        lineColor: [220, 220, 220],
        lineWidth: 0.15,
      },
      headStyles: {
        font: "NotoSansJP",
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        lineWidth: { top: 0.4, bottom: 0.4 },
        lineColor: [0, 0, 0],
      },
      head: [["商品名", "数量", "金額", "買主", "インボイス"]],
      columnStyles: {
        0: { cellWidth: contentWidth * 0.30 },
        1: { cellWidth: contentWidth * 0.08, halign: "right" },
        2: { cellWidth: contentWidth * 0.12, halign: "right" },
        3: { cellWidth: contentWidth * 0.28 },
        4: { cellWidth: contentWidth * 0.22, fontSize: 7 },
      },
      body: salesTransactions.map((t: any) => [
        t.itemName,
        String(t.quantity),
        t.totalPrice.toLocaleString(),
        `${t.buyerMemberNumber}  ${t.buyerName}`,
        t.buyerInvoiceNumber || "",
      ]),
      theme: "plain",
    });
    y = (doc as any).lastAutoTable.finalY + 1;

    // ─── Sales return details (黄色マーク) ───
    if (salesReturnTransactions.length > 0) {
      autoTable(doc, {
        startY: y,
        margin: { left: marginLeft, right: marginRight },
        tableWidth: contentWidth,
        styles: {
          font: "NotoSansJP",
          fontSize: 8,
          cellPadding: { top: 1, bottom: 1, left: 2, right: 2 },
          textColor: [0, 0, 0],
          lineColor: [220, 220, 220],
          lineWidth: 0.15,
          fillColor: [255, 255, 200],
        },
        columnStyles: {
          0: { cellWidth: contentWidth * 0.08 },
          1: { cellWidth: contentWidth * 0.30 },
          2: { cellWidth: contentWidth * 0.08, halign: "right" },
          3: { cellWidth: contentWidth * 0.12, halign: "right" },
          4: { cellWidth: contentWidth * 0.20 },
          5: { cellWidth: contentWidth * 0.22, fontSize: 7 },
        },
        body: salesReturnTransactions.map((t: any) => [
          "売返品",
          t.itemName,
          String(t.quantity),
          t.totalPrice.toLocaleString(),
          `${t.buyerMemberNumber}  ${t.buyerName}`,
          t.buyerInvoiceNumber || "",
        ]),
        theme: "plain",
      });
    }
  }
}

// ─── Single Settlement PDF (unchanged API) ───
export async function generateSettlementPdf(data: PdfData): Promise<Buffer> {
  const doc = createDoc();
  const sealData = data.sealImageUrl ? await loadSealImage(data.sealImageUrl) : null;
  await renderSettlementPage(doc, data, sealData);
  const arrayBuffer = doc.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}

// ─── Bulk Settlement PDF (optimized: single document, font embedded once) ───
export async function generateBulkSettlementPdf(allData: PdfData[]): Promise<Buffer> {
  if (allData.length === 0) {
    throw new Error("No settlement data provided");
  }

  const doc = createDoc();

  // Pre-load seal image once (shared across all pages)
  const sealImageUrl = allData[0].sealImageUrl;
  const sealData = sealImageUrl ? await loadSealImage(sealImageUrl) : null;

  for (let i = 0; i < allData.length; i++) {
    if (i > 0) {
      doc.addPage();
    }
    await renderSettlementPage(doc, allData[i], sealData);
  }

  const arrayBuffer = doc.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}

// ─── Register Closing Receipt PDF ───
type RegisterClosingPdfData = {
  eventDate: string;
  initialFund: number;
  transactions: {
    memberNumber: number;
    memberName: string;
    depositAmount: number;
    receivedAmount: number;
    changeAmount: number;
    paymentAmount: number;
    signatureUrl: string | null;
  }[];
  totalDeposits: number;
  totalPayments: number;
  totalReceived: number;
  totalChange: number;
  theoreticalBalance: number;
  actualBalance: number;
  difference: number;
};

export async function generateRegisterClosingPdf(data: RegisterClosingPdfData): Promise<Buffer> {
  const doc = createDoc();
  const pageWidth = 210;
  const marginLeft = 12;
  const marginRight = 12;
  const contentWidth = pageWidth - marginLeft - marginRight;
  let y = 14;

  // Title
  doc.setFontSize(16);
  doc.text("レジ締めレシート", pageWidth / 2, y, { align: "center" });
  y += 7;

  doc.setFontSize(9);
  doc.text(`開催日：${data.eventDate}　　出力日時：${new Date().toLocaleString("ja-JP")}`, marginLeft, y);
  y += 8;

  // Transaction table
  doc.setFontSize(10);
  doc.text(`レジ取引一覧（${data.transactions.length}件）`, marginLeft, y);
  y += 3;

  // 2列（左右）で、入金/支払い/サインのみを表示
  const colGap = 4;
  const halfWidth = (contentWidth - colGap) / 2;
  const numberW = halfWidth * 0.16;
  const depositW = halfWidth * 0.24;
  const paymentW = halfWidth * 0.24;
  const signW = halfWidth - numberW - depositW - paymentW;

  // 2件ずつペアにして1行に詰める
  const pairs: Array<[RegisterClosingPdfData["transactions"][number] | null, RegisterClosingPdfData["transactions"][number] | null]> = [];
  for (let i = 0; i < data.transactions.length; i += 2) {
    pairs.push([data.transactions[i] ?? null, data.transactions[i + 1] ?? null]);
  }

  // サイン画像を事前に読み込み（ローカル /uploads の場合はFSから読む）
  const signatureMap = new Map<string, { base64: string; format: string }>();
  const loadSignature = async (url: string): Promise<{ base64: string; format: string } | null> => {
    if (signatureMap.has(url)) return signatureMap.get(url)!;
    try {
      if (url.startsWith("/uploads/")) {
        const rel = url.replace(/^\/uploads\//, "");
        const localPath = path.join(getLocalUploadDir(), rel);
        if (!fs.existsSync(localPath)) return null;
        const base64 = fs.readFileSync(localPath).toString("base64");
        const format = guessImageFormatFromPath(localPath);
        const v = { base64, format };
        signatureMap.set(url, v);
        return v;
      }
      // 絶対URL等はfetchで取得
      const res = await fetch(url);
      if (!res.ok) return null;
      const contentType = res.headers.get("content-type") || "";
      const buffer = Buffer.from(await res.arrayBuffer());
      const base64 = buffer.toString("base64");
      let format: string = "PNG";
      if (contentType.includes("jpeg") || contentType.includes("jpg")) format = "JPEG";
      else if (contentType.includes("gif")) format = "GIF";
      else if (contentType.includes("webp")) format = "WEBP";
      const v = { base64, format };
      signatureMap.set(url, v);
      return v;
    } catch {
      return null;
    }
  };

  const signatureUrls = Array.from(
    new Set(
      data.transactions
        .map((t) => t.signatureUrl)
        .filter((u): u is string => Boolean(u))
    )
  );
  await Promise.all(signatureUrls.map((u) => loadSignature(u)));

  autoTable(doc, {
    startY: y,
    margin: { left: marginLeft, right: marginRight },
    tableWidth: contentWidth,
    styles: {
      font: "NotoSansJP",
      fontSize: 7.2,
      cellPadding: { top: 1.2, bottom: 1.2, left: 1.4, right: 1.4 },
      textColor: [0, 0, 0],
      lineColor: [220, 220, 220],
      lineWidth: 0.15,
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: "bold",
      lineWidth: { top: 0.5, bottom: 0.3 },
      lineColor: [0, 0, 0],
    },
    head: [["会員番号", "入金", "支払い", "サイン", "", "会員番号", "入金", "支払い", "サイン"]],
    columnStyles: {
      0: { cellWidth: numberW, halign: "center" },
      1: { cellWidth: depositW, halign: "right" },
      2: { cellWidth: paymentW, halign: "right" },
      3: { cellWidth: signW, halign: "center" },
      4: { cellWidth: colGap, halign: "center", lineWidth: 0 },
      5: { cellWidth: numberW, halign: "center" },
      6: { cellWidth: depositW, halign: "right" },
      7: { cellWidth: paymentW, halign: "right" },
      8: { cellWidth: signW, halign: "center" },
    },
    body: pairs.map(([a, b]) => [
      a ? String(a.memberNumber) : "",
      a?.depositAmount ? fmt(a.depositAmount) : "",
      a?.paymentAmount ? fmt(a.paymentAmount) : "",
      a?.signatureUrl ? " " : "",
      "",
      b ? String(b.memberNumber) : "",
      b?.depositAmount ? fmt(b.depositAmount) : "",
      b?.paymentAmount ? fmt(b.paymentAmount) : "",
      b?.signatureUrl ? " " : "",
    ]),
    theme: "plain",
    didParseCell: (cellData: any) => {
      // セパレータ列は枠線なし
      if (cellData.column.index === 4) {
        cellData.cell.styles.fillColor = [255, 255, 255];
        cellData.cell.styles.textColor = [255, 255, 255];
        cellData.cell.styles.lineWidth = 0;
      }
    },
    didDrawCell: (cellData: any) => {
      // サイン画像をセル内に描画
      const rowIdx = cellData.row.index;
      const colIdx = cellData.column.index;
      const pair = pairs[rowIdx];
      const tx = colIdx === 3 ? pair?.[0] : colIdx === 8 ? pair?.[1] : null;
      if (!tx?.signatureUrl) return;
      if (colIdx !== 3 && colIdx !== 8) return;

      try {
        const sig = signatureMap.get(tx.signatureUrl);
        if (!sig) {
          doc.setDrawColor(200, 200, 200);
          doc.setLineWidth(0.2);
          doc.rect(cellData.cell.x + 1, cellData.cell.y + 1, cellData.cell.width - 2, cellData.cell.height - 2);
          return;
        }

        const padding = 1;
        const maxW = cellData.cell.width - padding * 2;
        const maxH = cellData.cell.height - padding * 2;
        // 署名は横長が多いので高さ優先でフィット
        const drawH = Math.min(10, maxH);
        const drawW = Math.min(maxW, drawH * 3.2);
        const x = cellData.cell.x + (cellData.cell.width - drawW) / 2;
        const y = cellData.cell.y + (cellData.cell.height - drawH) / 2;
        doc.addImage(
          `data:image/${sig.format.toLowerCase()};base64,${sig.base64}`,
          sig.format,
          x,
          y,
          drawW,
          drawH
        );
      } catch {
        // ignore
      }
    },
  });

  const arrayBuffer = doc.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}

// No browser to close anymore
export async function closeBrowser() {
  // No-op: puppeteer removed
}
