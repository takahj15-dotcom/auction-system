import { z } from "zod";
import { router, protectedProcedure, adminProcedure } from "../_core/trpc";
import * as db from "../db";

export const dashboardRouter = router({
  stats: protectedProcedure
    .input(z.object({ eventDate: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const today = new Date().toISOString().slice(0, 10);
      return db.getDashboardStats(input?.eventDate ?? today);
    }),
  eventSalesTrend: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(50).default(20) }).optional())
    .query(async ({ input }) => {
      return db.getEventSalesTrend(input?.limit ?? 20);
    }),
});

export const auditRouter = router({
  list: adminProcedure
    .input(z.object({
      limit: z.number().min(1).max(500).default(100),
      offset: z.number().min(0).default(0),
    }).optional())
    .query(async ({ input }) => {
      return db.listAuditLogs(input?.limit ?? 100, input?.offset ?? 0);
    }),
});
