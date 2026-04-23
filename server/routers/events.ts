import { z } from "zod";
import { router, protectedProcedure, adminProcedure } from "../_core/trpc";
import * as db from "../db";
import { createAuditLog } from "../db";

export const eventsRouter = router({
  list: protectedProcedure.query(async () => {
    return db.listEvents();
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return db.getEventById(input.id);
    }),

  create: adminProcedure
    .input(z.object({
      eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      title: z.string().optional(),
      notes: z.string().optional(),
      sellCommissionRate: z.string().optional(),
      buyCommissionRate: z.string().optional(),
      absentSellCommissionRate: z.string().optional(),
      absentBuyCommissionRate: z.string().optional(),
      participationFee: z.number().optional(),
      companionFee: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const id = await db.createEvent(input);
      await createAuditLog({
        userId: ctx.user.id,
        action: "create",
        tableName: "events",
        recordId: id,
        newValue: input,
      });
      return { id };
    }),

  update: adminProcedure
    .input(z.object({
      id: z.number(),
      eventDate: z.string().optional(),
      title: z.string().optional(),
      notes: z.string().optional(),
      status: z.enum(["open", "closed", "settled"]).optional(),
      sellCommissionRate: z.string().optional(),
      buyCommissionRate: z.string().optional(),
      absentSellCommissionRate: z.string().optional(),
      absentBuyCommissionRate: z.string().optional(),
      participationFee: z.number().optional(),
      companionFee: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      const old = await db.getEventById(id);
      await db.updateEvent(id, data);
      await createAuditLog({
        userId: ctx.user.id,
        action: "update",
        tableName: "events",
        recordId: id,
        oldValue: old,
        newValue: data,
      });
      return { success: true };
    }),

  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const old = await db.getEventById(input.id);
      if (!old) {
        return { success: true } as const;
      }
      await db.deleteEventCascade(input.id);
      await createAuditLog({
        userId: ctx.user.id,
        action: "delete",
        tableName: "events",
        recordId: input.id,
        oldValue: old,
      });
      return { success: true } as const;
    }),

  // ─── 出欠管理 ───
  listAttendance: protectedProcedure
    .input(z.object({ eventId: z.number() }))
    .query(async ({ input }) => {
      const attendance = await db.listAttendance(input.eventId);
      const enriched = await Promise.all(attendance.map(async (a) => {
        const member = await db.getMemberById(a.memberId);
        return { ...a, member };
      }));
      return enriched;
    }),

  initAttendance: adminProcedure
    .input(z.object({ eventId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const result = await db.bulkInitAttendance(input.eventId);
      await db.createAuditLog({
        userId: ctx.user.id,
        action: "init_attendance",
        tableName: "event_attendance",
        recordId: input.eventId,
        newValue: result,
      });
      return result;
    }),

  checkIn: protectedProcedure
    .input(z.object({
      eventId: z.number(),
      memberId: z.number(),
      isPresent: z.boolean(),
      isFeeExempt: z.boolean().optional(),
      companionCount: z.number().optional(),
      autoCollect: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      await db.upsertAttendance(input.eventId, input.memberId, input.isPresent, input.isFeeExempt, input.companionCount);
      // 受付と同時に徴収済みにするオプション
      if (input.isPresent && input.autoCollect) {
        await db.updateFeeCollected(input.eventId, input.memberId, true);
      }
      return { success: true };
    }),

  updateCompanionCount: protectedProcedure
    .input(z.object({
      eventId: z.number(),
      memberId: z.number(),
      companionCount: z.number(),
    }))
    .mutation(async ({ input }) => {
      await db.updateCompanionCount(input.eventId, input.memberId, input.companionCount);
      return { success: true };
    }),

  toggleFeeExempt: protectedProcedure
    .input(z.object({
      eventId: z.number(),
      memberId: z.number(),
      isFeeExempt: z.boolean(),
    }))
    .mutation(async ({ input }) => {
      await db.updateFeeExempt(input.eventId, input.memberId, input.isFeeExempt);
      return { success: true };
    }),

  toggleFeeCollected: protectedProcedure
    .input(z.object({
      eventId: z.number(),
      memberId: z.number(),
      feeCollected: z.boolean(),
    }))
    .mutation(async ({ input }) => {
      await db.updateFeeCollected(input.eventId, input.memberId, input.feeCollected);
      return { success: true };
    }),

  bulkCheckIn: adminProcedure
    .input(z.object({
      eventId: z.number(),
      memberIds: z.array(z.number()),
      isPresent: z.boolean(),
    }))
    .mutation(async ({ input }) => {
      for (const memberId of input.memberIds) {
        await db.upsertAttendance(input.eventId, memberId, input.isPresent);
      }
      return { success: true, count: input.memberIds.length };
    }),
});
