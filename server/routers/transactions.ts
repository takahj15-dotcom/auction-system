import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../_core/trpc";
import * as db from "../db";
import { createAuditLog } from "../db";

export const transactionsRouter = router({
  list: protectedProcedure
    .input(z.object({ eventId: z.number() }))
    .query(async ({ input }) => {
      return db.listTransactions(input.eventId);
    }),

  create: protectedProcedure
    .input(z.object({
      eventId: z.number(),
      rowNumber: z.number().optional(),
      sellerMemberId: z.number(),
      buyerMemberId: z.number(),
      itemName: z.string().min(1),
      unitPrice: z.number().min(0),
      quantity: z.number().min(1).default(1),
      totalPrice: z.number().min(0),
      transactionType: z.enum(["normal", "return", "defect"]).default("normal"),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Check event is open
      const event = await db.getEventById(input.eventId);
      if (!event || event.status === "closed") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "このイベントは最終締め済みのため、取引を追加できません。取消しを行ってください。" });
      }
      const id = await db.createTransaction(input);
      // 取引が発生した会員が受付に未登録の場合、自動的に受付（出席）に反映し、参加費を未徴収にする
      await Promise.all([
        db.ensureAttendanceFromTransaction(input.eventId, input.sellerMemberId),
        db.ensureAttendanceFromTransaction(input.eventId, input.buyerMemberId),
      ]);
      await createAuditLog({
        userId: ctx.user.id,
        action: "create",
        tableName: "transactions",
        recordId: id,
        newValue: input,
      });
      return { id };
    }),

  bulkCreate: protectedProcedure
    .input(z.object({
      eventId: z.number(),
      rows: z.array(z.object({
        rowNumber: z.number().optional(),
        sellerMemberId: z.number(),
        buyerMemberId: z.number(),
        itemName: z.string().min(1),
        unitPrice: z.number().min(0),
        quantity: z.number().min(1).default(1),
        totalPrice: z.number().min(0),
        transactionType: z.enum(["normal", "return", "defect"]).default("normal"),
        notes: z.string().optional(),
      })),
    }))
    .mutation(async ({ input, ctx }) => {
      const event = await db.getEventById(input.eventId);
      if (!event || event.status === "closed") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "このイベントは最終締め済みのため、取引を追加できません。取消しを行ってください。" });
      }
      const dataList = input.rows.map(row => ({ ...row, eventId: input.eventId }));
      await db.bulkCreateTransactions(dataList);
      // 一括作成でも同様に、未登録なら自動受付（出席）＋未徴収
      const memberIds = new Set<number>();
      for (const row of input.rows) {
        memberIds.add(row.sellerMemberId);
        memberIds.add(row.buyerMemberId);
      }
      await Promise.all(Array.from(memberIds).map((memberId) =>
        db.ensureAttendanceFromTransaction(input.eventId, memberId)
      ));
      await createAuditLog({
        userId: ctx.user.id,
        action: "bulk_create",
        tableName: "transactions",
        newValue: { eventId: input.eventId, count: input.rows.length },
      });
      return { success: true, count: input.rows.length };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      version: z.number(),
      sellerMemberId: z.number().optional(),
      buyerMemberId: z.number().optional(),
      itemName: z.string().optional(),
      unitPrice: z.number().optional(),
      quantity: z.number().optional(),
      totalPrice: z.number().optional(),
      transactionType: z.enum(["normal", "return", "defect"]).optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { id, version, ...data } = input;
      const old = await db.getTransactionById(id);
      if (!old) throw new TRPCError({ code: "NOT_FOUND", message: "取引が見つかりません。" });

      // Check event is not closed
      const event = await db.getEventById(old.eventId);
      if (!event || event.status === "closed") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "このイベントは最終締め済みのため、取引を編集できません。取消しを行ってください。" });
      }

      const affected = await db.updateTransaction(id, data, version);
      if (affected === 0) {
        throw new TRPCError({ code: "CONFLICT", message: "他のユーザーが先にこのデータを更新しました。画面を更新してください。" });
      }
      await createAuditLog({
        userId: ctx.user.id,
        action: "update",
        tableName: "transactions",
        recordId: id,
        oldValue: old,
        newValue: data,
      });
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const old = await db.getTransactionById(input.id);
      if (!old) throw new TRPCError({ code: "NOT_FOUND" });
      const event = await db.getEventById(old.eventId);
      if (!event || event.status === "closed") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "このイベントは最終締め済みのため、取引を削除できません。取消しを行ってください。" });
      }
      await db.softDeleteTransaction(input.id);
      await createAuditLog({
        userId: ctx.user.id,
        action: "delete",
        tableName: "transactions",
        recordId: input.id,
        oldValue: old,
      });
      return { success: true };
    }),

  // 商品名オートコンプリート候補
  itemNameSuggestions: protectedProcedure
    .input(z.object({ query: z.string().min(1) }))
    .query(async ({ input }) => {
      return db.getItemNameSuggestions(input.query, 20);
    }),

  // よく使う商品名一覧
  frequentItemNames: protectedProcedure
    .query(async () => {
      return db.getFrequentItemNames(50);
    }),
});
