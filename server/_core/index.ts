import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import path from "node:path";
import fs from "node:fs";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { ENV } from "./env";
import { securityHeaders, loginRateLimiter, apiRateLimiter } from "./security";
import { getSettlementPdfDataInternal, getBulkSettlementPdfData } from "../routers/pdf";
import { generateSettlementPdf, generateBulkSettlementPdf, generateRegisterClosingPdf } from "../pdfGenerator";
import { generateTransactionsExcel, ExcelTransactionRow } from "../excelGenerator";
import * as db from "../db";
import { getLocalUploadDir } from "../storage";
import { bootstrapDatabase } from "../bootstrap";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  // DB初期化（マイグレーション + サンプルデータ投入）
  await bootstrapDatabase();

  const app = express();
  const server = createServer(app);

  // リバースプロキシ配下で本番運用する場合のIP判定（X-Forwarded-For）
  if (ENV.trustProxy) {
    app.set("trust proxy", 1);
  }

  // セキュリティHTTPヘッダ
  app.use(securityHeaders);

  // 画像/署名のアップロード用に大きめのbody制限を必要とするのは tRPC のみ。
  // それ以外のリクエストは 1MB に抑えてDoSのリスクを下げる。
  app.use("/api/trpc", express.json({ limit: "10mb" }));
  app.use("/api/trpc", express.urlencoded({ limit: "10mb", extended: true }));
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ limit: "1mb", extended: true }));

  // ログイン専用の厳しめレートリミッタ（ブルートフォース対策）
  app.use("/api/trpc/portal.login", loginRateLimiter);
  // 全 tRPC エンドポイントの緩いレートリミッタ
  app.use("/api/trpc", apiRateLimiter);

  // Serve local uploads (signatures, seal images, etc.)
  const uploadDir = getLocalUploadDir();
  fs.mkdirSync(uploadDir, { recursive: true });
  app.use("/uploads", express.static(uploadDir));

  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // PDF download endpoint
  app.get("/api/pdf/settlement/:id", async (req, res) => {
    try {
      const settlementId = parseInt(req.params.id);
      if (isNaN(settlementId)) {
        return res.status(400).json({ error: "Invalid settlement ID" });
      }
      const data = await getSettlementPdfDataInternal(settlementId);
      const pdfBuffer = await generateSettlementPdf(data);
      const memberName = data.member?.displayName ?? "unknown";
      const eventDate = data.event?.eventDate ?? "unknown";
      const filename = encodeURIComponent(`精算書_${memberName}_${eventDate}.pdf`);
      res.setHeader("Content-Type", "application/pdf");
      // Use inline disposition when ?inline=1 is set (for mobile browser viewing)
      const disposition = req.query.inline === "1" ? "inline" : "attachment";
      res.setHeader("Content-Disposition", `${disposition}; filename*=UTF-8''${filename}`);
      res.setHeader("Content-Length", pdfBuffer.length);
      res.setHeader("Cache-Control", "no-cache");
      return res.send(pdfBuffer);
    } catch (err: any) {
      console.error("PDF generation error:", err);
      return res.status(500).json({ error: "PDF generation failed" });
    }
  });

  // Bulk PDF download endpoint (all settlements for an event)
  app.get("/api/pdf/bulk/:eventId", async (req, res) => {
    try {
      const eventId = parseInt(req.params.eventId);
      if (isNaN(eventId)) {
        return res.status(400).json({ error: "Invalid event ID" });
      }
      // Optimized: fetch all data in parallel with minimal DB calls
      const allData = await getBulkSettlementPdfData(eventId);
      if (allData.length === 0) {
        return res.status(404).json({ error: "No settlements found" });
      }
      const event = allData[0].event;
      // Generate single multi-page PDF (font embedded once, no pdf-lib merge needed)
      const mergedBuffer = await generateBulkSettlementPdf(allData);
      const filename = encodeURIComponent(`精算書一括_${event?.eventDate ?? "unknown"}.pdf`);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${filename}`);
      res.setHeader("Content-Length", mergedBuffer.length);
      return res.send(mergedBuffer);
    } catch (err: any) {
      console.error("Bulk PDF generation error:", err);
      return res.status(500).json({ error: "Bulk PDF generation failed" });
    }
  });

  // Register closing receipt PDF endpoint
  app.get("/api/pdf/register-closing/:eventId", async (req, res) => {
    try {
      const eventId = parseInt(req.params.eventId);
      if (isNaN(eventId)) {
        return res.status(400).json({ error: "Invalid event ID" });
      }
      const actualBalance = parseInt(req.query.actualBalance as string) || 0;
      const event = await db.getEventById(eventId);
      if (!event) {
        return res.status(404).json({ error: "Event not found" });
      }
      const regTxns = await db.listRegisterTransactions(eventId);
      const initialFundSetting = await db.getSetting("register_initial_fund");
      const initialFund = parseInt(initialFundSetting?.settingValue || "50000", 10);

      let totalDeposits = 0;
      let totalPayments = 0;
      let totalReceived = 0;
      let totalChange = 0;
      for (const tx of regTxns) {
        totalDeposits += tx.depositAmount;
        totalPayments += tx.paymentAmount;
        totalReceived += tx.receivedAmount;
        totalChange += tx.changeAmount;
      }
      const theoreticalBalance = initialFund + totalReceived - totalChange - totalPayments;
      const difference = actualBalance - theoreticalBalance;

      const pdfBuffer = await generateRegisterClosingPdf({
        eventDate: event.eventDate,
        initialFund,
        transactions: regTxns.map((tx: any) => ({
          memberNumber: tx.memberNumber,
          memberName: tx.memberName,
          depositAmount: tx.depositAmount,
          receivedAmount: tx.receivedAmount,
          changeAmount: tx.changeAmount,
          paymentAmount: tx.paymentAmount,
          signatureUrl: tx.signatureUrl,
        })),
        totalDeposits,
        totalPayments,
        totalReceived,
        totalChange,
        theoreticalBalance,
        actualBalance,
        difference,
      });

      const filename = encodeURIComponent(`レジ締めレシート_${event.eventDate}.pdf`);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${filename}`);
      res.setHeader("Content-Length", pdfBuffer.length);
      return res.send(pdfBuffer);
    } catch (err: any) {
      console.error("Register closing PDF error:", err);
      return res.status(500).json({ error: "PDF generation failed" });
    }
  });

  // Excel export endpoint
  app.get("/api/excel/transactions/:eventId", async (req, res) => {
    try {
      const eventId = parseInt(req.params.eventId);
      if (isNaN(eventId)) {
        return res.status(400).json({ error: "Invalid event ID" });
      }
      const event = await db.getEventById(eventId);
      if (!event) {
        return res.status(404).json({ error: "Event not found" });
      }
      const txList = await db.listTransactions(eventId);
      const memberIdSet = new Set<number>();
      txList.forEach(t => { memberIdSet.add(t.sellerMemberId); memberIdSet.add(t.buyerMemberId); });
      const memberIds = Array.from(memberIdSet);
      const memberMap = new Map<number, { memberNumber: number; displayName: string }>();
      for (const mid of memberIds) {
        const m = await db.getMemberById(mid);
        if (m) memberMap.set(m.id, { memberNumber: m.memberNumber, displayName: m.displayName });
      }
      const rows: ExcelTransactionRow[] = txList.map((tx, idx) => {
        const seller = memberMap.get(tx.sellerMemberId);
        const buyer = memberMap.get(tx.buyerMemberId);
        return {
          rowNumber: tx.rowNumber || idx + 1,
          sellerMemberNumber: seller?.memberNumber ?? 0,
          sellerName: seller?.displayName ?? "不明",
          itemName: tx.itemName,
          unitPrice: tx.unitPrice,
          quantity: tx.quantity,
          totalPrice: tx.totalPrice,
          buyerMemberNumber: buyer?.memberNumber ?? 0,
          buyerName: buyer?.displayName ?? "不明",
          transactionType: tx.transactionType,
          notes: tx.notes || "",
        };
      });
      const excelBuffer = await generateTransactionsExcel({
        eventTitle: event.title || "岐阜リサイクルオークション",
        eventDate: event.eventDate,
        transactions: rows,
      });
      const filename = encodeURIComponent(`取引データ_${event.eventDate}.xlsx`);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${filename}`);
      res.setHeader("Content-Length", excelBuffer.length);
      return res.send(excelBuffer);
    } catch (err: any) {
      console.error("Excel export error:", err);
      return res.status(500).json({ error: "Excel export failed" });
    }
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
