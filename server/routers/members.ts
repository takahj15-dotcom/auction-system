import { z } from "zod";
import { router, protectedProcedure, adminProcedure } from "../_core/trpc";
import * as db from "../db";
import { createAuditLog } from "../db";
import bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";

const TEMP_PASSWORD_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

function generateTemporaryPassword(length = 12): string {
  return Array.from({ length }, () => TEMP_PASSWORD_CHARS[randomInt(TEMP_PASSWORD_CHARS.length)]).join("");
}

export const membersRouter = router({
  list: protectedProcedure
    .input(z.object({ activeOnly: z.boolean().optional().default(true) }).optional())
    .query(async ({ input }) => {
      return db.listMembers(input?.activeOnly ?? true);
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return db.getMemberById(input.id);
    }),

  getByNumber: protectedProcedure
    .input(z.object({ memberNumber: z.number() }))
    .query(async ({ input }) => {
      return db.getMemberByNumber(input.memberNumber);
    }),

  create: adminProcedure
    .input(z.object({
      memberNumber: z.number().min(1).max(1000),
      displayName: z.string().min(1),
      tradeName: z.string().optional(),
      representative: z.string().optional(),
      invoiceNumber: z.string().optional(),
      antiquePermitNumber: z.string().optional(),
      sellCommissionRate: z.string().optional().default("10.00"),
      buyCommissionRate: z.string().optional().default("5.00"),
      useCustomCommission: z.boolean().optional().default(false),
      phone: z.string().optional(),
      mobile: z.string().optional(),
      email: z.string().optional(),
      postalCode: z.string().optional(),
      prefecture: z.string().optional(),
      address: z.string().optional(),
      participationFee: z.number().optional().default(0),
      isTaxable: z.boolean().optional().default(true),
    }))
    .mutation(async ({ input, ctx }) => {
      const id = await db.createMember(input);
      await createAuditLog({
        userId: ctx.user.id,
        action: "create",
        tableName: "members",
        recordId: id,
        newValue: input,
      });
      return { id };
    }),

  update: adminProcedure
    .input(z.object({
      id: z.number(),
      memberNumber: z.number().min(1).max(1000).optional(),
      displayName: z.string().min(1).optional(),
      tradeName: z.string().optional(),
      representative: z.string().optional(),
      invoiceNumber: z.string().optional(),
      antiquePermitNumber: z.string().optional(),
      sellCommissionRate: z.string().optional(),
      buyCommissionRate: z.string().optional(),
      useCustomCommission: z.boolean().optional(),
      phone: z.string().optional(),
      mobile: z.string().optional(),
      email: z.string().optional(),
      postalCode: z.string().optional(),
      prefecture: z.string().optional(),
      address: z.string().optional(),
      participationFee: z.number().optional(),
      isTaxable: z.boolean().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      const old = await db.getMemberById(id);
      await db.updateMember(id, data);
      await createAuditLog({
        userId: ctx.user.id,
        action: "update",
        tableName: "members",
        recordId: id,
        oldValue: old,
        newValue: data,
      });
      return { success: true };
    }),

  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const old = await db.getMemberById(input.id);
      await db.deleteMember(input.id);
      await createAuditLog({
        userId: ctx.user.id,
        action: "delete",
        tableName: "members",
        recordId: input.id,
        oldValue: old,
      });
      return { success: true };
    }),

  setPassword: adminProcedure
    .input(z.object({
      id: z.number(),
      password: z.string().min(4),
    }))
    .mutation(async ({ input, ctx }) => {
      const hashedPassword = await bcrypt.hash(input.password, 10);
      await db.updateMember(input.id, {
        password: hashedPassword,
        requirePasswordChange: true,
      });
      await createAuditLog({
        userId: ctx.user.id,
        action: "set_password",
        tableName: "members",
        recordId: input.id,
        newValue: { passwordSet: true },
      });
      return { success: true };
    }),

  // Issue a one-time temporary password. The plain value is returned once and never logged.
  resetPassword: adminProcedure
    .input(z.object({
      id: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      const temporaryPassword = generateTemporaryPassword();
      const hashedPassword = await bcrypt.hash(temporaryPassword, 10);
      await db.updateMember(input.id, {
        password: hashedPassword,
        requirePasswordChange: true,
      });
      await createAuditLog({
        userId: ctx.user.id,
        action: "reset_password",
        tableName: "members",
        recordId: input.id,
        newValue: { temporaryPasswordIssued: true },
      });
      return { success: true, temporaryPassword };
    }),
});
