import "dotenv/config";
import express from "express";
import helmet from "helmet";
import { createServer } from "http";
import net from "net";
import path from "node:path";
import fs from "node:fs";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { requireAdmin, requireCookieSession, requireSessionOrPortalToken, type AuthenticatedRequest } from "./httpAuth";
import { serveStatic, setupVite } from "./vite";
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
  // セキュリティヘッダ。CSP は SPA + 外部 OAuth + 地図サービス等の都合で
  // 別途設計するため、ここでは無効化して他のヘッダ (HSTS, X-Frame-Options,
  // X-Content-Type-Options, Referrer-Policy など) を有効化する。
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: "same-site" },
    })
  );
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // Serve local uploads. signatures は会員の個人情報なので cookie セッション必須、
  // seal-images は会社の印影で会員ポータル側でも <img> 表示するため公開のままにする。
  const uploadDir = getLocalUploadDir();
  fs.mkdirSync(uploadDir, { recursive: true });
  fs.mkdirSync(path.join(uploadDir, "signatures"), { recursive: true });
  fs.mkdirSync(path.join(uploadDir, "seal-images"), { recursive: true });
  app.use(
    "/uploads/signatures",
    requireCookieSession,
    express.static(path.join(uploadDir, "signatures"))
  );
  app.use("/uploads/seal-images", express.static(path.join(uploadDir, "seal-images")));

  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // PDF download endpoint
  // 認可: 管理者 cookie セッション or 会員ポータル token (?token=)。
  // 会員ポータル経由の場合は本人の精算データのみアクセス可。
  app.get("/api/pdf/settlement/:id", requireSessionOrPortalToken, async (req: AuthenticatedRequest, res) => {
    try {
      const settlementId = parseInt(req.params.id);
      if (isNaN(settlementId)) {
        return res.status(400).json({ error: "Invalid settlement ID" });
      }
      const data = await getSettlementPdfDataInternal(settlementId);
      // ポータルトークン経由の場合、本人の精算データかチェック
      if (req.portalMemberId !== undefined && data.settlement.memberId !== req.portalMemberId) {
        return res.status(403).json({ error: "Forbidden" });
      }
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
  // 認可: 管理者のみ。
  app.get("/api/pdf/bulk/:eventId", requireAdmin, async (req, res) => {
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
  // 認可: 管理者のみ。
  app.get("/api/pdf/register-closing/:eventId", requireAdmin, async (req, res) => {
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
  // 認可: 管理者のみ。
  app.get("/api/excel/transactions/:eventId", requireAdmin, async (req, res) => {
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
