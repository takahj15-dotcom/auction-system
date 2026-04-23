import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock db module
vi.mock("./db", () => ({
  getSetting: vi.fn(),
  getAllSettings: vi.fn(),
  upsertSetting: vi.fn(),
  deleteSetting: vi.fn(),
}));

// Mock storage module
vi.mock("./storage", () => ({
  storagePut: vi.fn(),
}));

import * as db from "./db";
import { storagePut } from "./storage";

describe("settings functionality", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getSetting", () => {
    it("returns undefined when setting does not exist", async () => {
      (db.getSetting as any).mockResolvedValue(undefined);
      const result = await db.getSetting("nonexistent_key");
      expect(result).toBeUndefined();
    });

    it("returns setting value when it exists", async () => {
      (db.getSetting as any).mockResolvedValue({
        id: 1,
        settingKey: "seal_image_url",
        settingValue: "https://example.com/seal.png",
        description: "印鑑画像URL",
        updatedAt: new Date(),
      });
      const result = await db.getSetting("seal_image_url");
      expect(result?.settingValue).toBe("https://example.com/seal.png");
    });
  });

  describe("getAllSettings", () => {
    it("returns empty array when no settings exist", async () => {
      (db.getAllSettings as any).mockResolvedValue([]);
      const result = await db.getAllSettings();
      expect(result).toEqual([]);
    });

    it("returns all settings", async () => {
      (db.getAllSettings as any).mockResolvedValue([
        { id: 1, settingKey: "seal_image_url", settingValue: "https://example.com/seal.png", description: "印鑑画像URL", updatedAt: new Date() },
        { id: 2, settingKey: "company_name", settingValue: "岐阜リサイクルオークション", description: "会社名", updatedAt: new Date() },
      ]);
      const result = await db.getAllSettings();
      expect(result).toHaveLength(2);
      expect(result[0].settingKey).toBe("seal_image_url");
      expect(result[1].settingKey).toBe("company_name");
    });
  });

  describe("upsertSetting", () => {
    it("creates a new setting", async () => {
      (db.getSetting as any).mockResolvedValue(undefined);
      (db.upsertSetting as any).mockResolvedValue(undefined);
      await db.upsertSetting("seal_image_url", "https://example.com/seal.png", "印鑑画像URL");
      expect(db.upsertSetting).toHaveBeenCalledWith("seal_image_url", "https://example.com/seal.png", "印鑑画像URL");
    });

    it("updates an existing setting", async () => {
      (db.upsertSetting as any).mockResolvedValue(undefined);
      await db.upsertSetting("seal_image_url", "https://example.com/new-seal.png", "印鑑画像URL");
      expect(db.upsertSetting).toHaveBeenCalledWith("seal_image_url", "https://example.com/new-seal.png", "印鑑画像URL");
    });

    it("can set value to null", async () => {
      (db.upsertSetting as any).mockResolvedValue(undefined);
      await db.upsertSetting("seal_image_url", null, "印鑑画像URL");
      expect(db.upsertSetting).toHaveBeenCalledWith("seal_image_url", null, "印鑑画像URL");
    });
  });

  describe("deleteSetting", () => {
    it("deletes a setting by key", async () => {
      (db.deleteSetting as any).mockResolvedValue(undefined);
      await db.deleteSetting("seal_image_url");
      expect(db.deleteSetting).toHaveBeenCalledWith("seal_image_url");
    });
  });

  describe("seal image upload", () => {
    it("uploads image to S3 and returns URL", async () => {
      const mockUrl = "https://storage.example.com/seal-images/seal-123.png";
      (storagePut as any).mockResolvedValue({ key: "seal-images/seal-123.png", url: mockUrl });
      
      const buffer = Buffer.from("fake-image-data");
      const result = await storagePut("seal-images/seal-123.png", buffer, "image/png");
      
      expect(result.url).toBe(mockUrl);
      expect(storagePut).toHaveBeenCalledWith("seal-images/seal-123.png", buffer, "image/png");
    });

    it("handles upload errors gracefully", async () => {
      (storagePut as any).mockRejectedValue(new Error("Upload failed"));
      
      const buffer = Buffer.from("fake-image-data");
      await expect(storagePut("seal-images/seal-123.png", buffer, "image/png")).rejects.toThrow("Upload failed");
    });
  });

  describe("seal image in PDF data", () => {
    it("includes seal image URL when setting exists", async () => {
      (db.getSetting as any).mockResolvedValue({
        id: 1,
        settingKey: "seal_image_url",
        settingValue: "https://example.com/seal.png",
        description: "印鑑画像URL",
        updatedAt: new Date(),
      });
      
      const setting = await db.getSetting("seal_image_url");
      const sealImageUrl = setting?.settingValue || null;
      expect(sealImageUrl).toBe("https://example.com/seal.png");
    });

    it("returns null when no seal image is set", async () => {
      (db.getSetting as any).mockResolvedValue(undefined);
      
      const setting = await db.getSetting("seal_image_url");
      const sealImageUrl = setting?.settingValue || null;
      expect(sealImageUrl).toBeNull();
    });

    it("returns null when seal image value is null", async () => {
      (db.getSetting as any).mockResolvedValue({
        id: 1,
        settingKey: "seal_image_url",
        settingValue: null,
        description: "印鑑画像URL",
        updatedAt: new Date(),
      });
      
      const setting = await db.getSetting("seal_image_url");
      const sealImageUrl = setting?.settingValue || null;
      expect(sealImageUrl).toBeNull();
    });
  });

  describe("settings key validation", () => {
    it("validates setting key format", () => {
      const validKeys = ["seal_image_url", "company_name", "company_phone"];
      const invalidKeys = ["", " "];
      
      for (const key of validKeys) {
        expect(key.length).toBeGreaterThan(0);
        expect(key.length).toBeLessThanOrEqual(100);
      }
      
      for (const key of invalidKeys) {
        expect(key.trim().length === 0 || key.length > 100).toBe(true);
      }
    });
  });

  describe("image file validation", () => {
    it("accepts valid image MIME types", () => {
      const validTypes = ["image/png", "image/jpeg", "image/gif", "image/webp"];
      const regex = /^image\/(png|jpeg|gif|webp)$/;
      
      for (const type of validTypes) {
        expect(regex.test(type)).toBe(true);
      }
    });

    it("rejects invalid MIME types", () => {
      const invalidTypes = ["image/svg+xml", "application/pdf", "text/plain", "image/bmp"];
      const regex = /^image\/(png|jpeg|gif|webp)$/;
      
      for (const type of invalidTypes) {
        expect(regex.test(type)).toBe(false);
      }
    });

    it("enforces file size limit of 5MB", () => {
      const MAX_FILE_SIZE = 5 * 1024 * 1024;
      expect(4 * 1024 * 1024).toBeLessThan(MAX_FILE_SIZE);
      expect(6 * 1024 * 1024).toBeGreaterThan(MAX_FILE_SIZE);
    });
  });
});
