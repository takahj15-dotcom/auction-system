import ExcelJS from "exceljs";

export interface ExcelTransactionRow {
  rowNumber: number;
  sellerMemberNumber: number;
  sellerName: string;
  itemName: string;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
  buyerMemberNumber: number;
  buyerName: string;
  transactionType: string;
  notes: string;
}

export interface ExcelExportData {
  eventTitle: string;
  eventDate: string;
  transactions: ExcelTransactionRow[];
}

const TYPE_LABELS: Record<string, string> = {
  normal: "通常",
  return: "返品",
  defect: "クレーム",
};

export async function generateTransactionsExcel(data: ExcelExportData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "岐阜リサイクルオークション";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("取引データ");

  // ── Title row ──
  sheet.mergeCells("A1:K1");
  const titleCell = sheet.getCell("A1");
  titleCell.value = `${data.eventTitle || "岐阜リサイクルオークション"} 取引一覧`;
  titleCell.font = { size: 14, bold: true };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(1).height = 28;

  // ── Event date row ──
  sheet.mergeCells("A2:K2");
  const dateCell = sheet.getCell("A2");
  dateCell.value = `開催日: ${data.eventDate}`;
  dateCell.font = { size: 11 };
  dateCell.alignment = { horizontal: "left", vertical: "middle" };
  sheet.getRow(2).height = 20;

  // ── Header row ──
  const headers = [
    "No.", "売主番号", "売主名", "商品名", "単価", "数量", "合計", "買主番号", "買主名", "種別", "備考"
  ];
  const headerRow = sheet.addRow(headers);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF2E7D32" },
    };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin" },
      bottom: { style: "thin" },
      left: { style: "thin" },
      right: { style: "thin" },
    };
  });
  sheet.getRow(3).height = 22;

  // ── Column widths ──
  sheet.getColumn(1).width = 6;   // No.
  sheet.getColumn(2).width = 10;  // 売主番号
  sheet.getColumn(3).width = 20;  // 売主名
  sheet.getColumn(4).width = 25;  // 商品名
  sheet.getColumn(5).width = 12;  // 単価
  sheet.getColumn(6).width = 8;   // 数量
  sheet.getColumn(7).width = 14;  // 合計
  sheet.getColumn(8).width = 10;  // 買主番号
  sheet.getColumn(9).width = 20;  // 買主名
  sheet.getColumn(10).width = 10; // 種別
  sheet.getColumn(11).width = 20; // 備考

  // ── Data rows ──
  data.transactions.forEach((tx, idx) => {
    const row = sheet.addRow([
      tx.rowNumber || idx + 1,
      tx.sellerMemberNumber,
      tx.sellerName,
      tx.itemName,
      tx.unitPrice,
      tx.quantity,
      tx.totalPrice,
      tx.buyerMemberNumber,
      tx.buyerName,
      TYPE_LABELS[tx.transactionType] || tx.transactionType,
      tx.notes || "",
    ]);

    row.eachCell((cell, colNumber) => {
      cell.border = {
        top: { style: "thin", color: { argb: "FFD0D0D0" } },
        bottom: { style: "thin", color: { argb: "FFD0D0D0" } },
        left: { style: "thin", color: { argb: "FFD0D0D0" } },
        right: { style: "thin", color: { argb: "FFD0D0D0" } },
      };

      // Number formatting
      if (colNumber === 5 || colNumber === 7) {
        cell.numFmt = "#,##0";
        cell.alignment = { horizontal: "right" };
      } else if (colNumber === 1 || colNumber === 2 || colNumber === 6 || colNumber === 8) {
        cell.alignment = { horizontal: "center" };
      }

      // Alternate row colors
      if (idx % 2 === 1) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF5F5F5" },
        };
      }
    });
  });

  // ── Summary row ──
  const summaryRowNum = data.transactions.length + 4; // 1 title + 1 date + 1 header + data
  const summaryRow = sheet.addRow([
    "", "", "", "合計", "", "",
    data.transactions.reduce((sum, tx) => sum + tx.totalPrice, 0),
    "", "", "",
    `${data.transactions.length}件`,
  ]);
  summaryRow.eachCell((cell, colNumber) => {
    cell.font = { bold: true };
    cell.border = {
      top: { style: "double" },
      bottom: { style: "double" },
    };
    if (colNumber === 7) {
      cell.numFmt = "#,##0";
      cell.alignment = { horizontal: "right" };
    }
  });

  // ── Auto filter ──
  sheet.autoFilter = {
    from: { row: 3, column: 1 },
    to: { row: data.transactions.length + 3, column: 11 },
  };

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
