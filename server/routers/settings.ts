import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../_core/trpc";
import * as db from "../db";
import { storagePut } from "../storage";

export const settingsRouter = router({
  // 全設定取得
  getAll: protectedProcedure.query(async () => {
    const settings = await db.getAllSettings();
    const result: Record<string, string | null> = {};
    for (const s of settings) {
      result[s.settingKey] = s.settingValue;
    }
    return result;
  }),

  // 特定の設定値を取得
  get: protectedProcedure
    .input(z.object({ key: z.string() }))
    .query(async ({ input }) => {
      const setting = await db.getSetting(input.key);
      return setting?.settingValue ?? null;
    }),

  // 設定値を更新
  upsert: protectedProcedure
    .input(z.object({
      key: z.string().min(1).max(100),
      value: z.string().nullable(),
      description: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      await db.upsertSetting(input.key, input.value, input.description);
      return { success: true };
    }),

  // 設定値を削除
  delete: protectedProcedure
    .input(z.object({ key: z.string() }))
    .mutation(async ({ input }) => {
      await db.deleteSetting(input.key);
      return { success: true };
    }),

  // 印鑑画像アップロード
  uploadSealImage: protectedProcedure
    .input(z.object({
      base64Data: z.string(),
      mimeType: z.string().regex(/^image\/(png|jpeg|gif|webp)$/),
      fileName: z.string(),
    }))
    .mutation(async ({ input }) => {
      try {
        // Convert base64 to buffer
        const buffer = Buffer.from(input.base64Data, "base64");
        
        // Generate unique file key
        const ext = input.mimeType.split("/")[1] || "png";
        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substring(2, 8);
        const fileKey = `seal-images/seal-${timestamp}-${randomSuffix}.${ext}`;
        
        // Upload to S3
        const { url } = await storagePut(fileKey, buffer, input.mimeType);
        
        // Save URL to settings
        await db.upsertSetting("seal_image_url", url, "精算書に表示する印鑑画像のURL");
        
        return { success: true, url };
      } catch (error) {
        console.error("Seal image upload error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "印鑑画像のアップロードに失敗しました",
        });
      }
    }),

  // 印鑑画像を削除
  removeSealImage: protectedProcedure
    .mutation(async () => {
      await db.upsertSetting("seal_image_url", null, "精算書に表示する印鑑画像のURL");
      return { success: true };
    }),
});
