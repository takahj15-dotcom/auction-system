// Storage helper: Manusのstorage proxyに加えて、ローカルファイルシステムへのフォールバックをサポート
// ローカル開発では ./uploads 以下にファイルを書き出し、/uploads/* で配信する

import fs from "node:fs";
import path from "node:path";
import { ENV } from "./_core/env";

const LOCAL_UPLOAD_DIR = path.resolve(process.cwd(), "uploads");

function hasForgeCreds() {
  return Boolean(ENV.forgeApiUrl && ENV.forgeApiKey);
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function toFormData(
  data: Buffer | Uint8Array | string,
  contentType: string,
  fileName: string
): FormData {
  const blob =
    typeof data === "string"
      ? new Blob([data], { type: contentType })
      : new Blob([data as any], { type: contentType });
  const form = new FormData();
  form.append("file", blob, fileName || "file");
  return form;
}

function buildAuthHeaders(apiKey: string): HeadersInit {
  return { Authorization: `Bearer ${apiKey}` };
}

function buildUploadUrl(baseUrl: string, relKey: string): URL {
  const url = new URL("v1/storage/upload", ensureTrailingSlash(baseUrl));
  url.searchParams.set("path", normalizeKey(relKey));
  return url;
}

async function buildDownloadUrl(
  baseUrl: string,
  relKey: string,
  apiKey: string
): Promise<string> {
  const downloadApiUrl = new URL(
    "v1/storage/downloadUrl",
    ensureTrailingSlash(baseUrl)
  );
  downloadApiUrl.searchParams.set("path", normalizeKey(relKey));
  const response = await fetch(downloadApiUrl, {
    method: "GET",
    headers: buildAuthHeaders(apiKey),
  });
  return (await response.json()).url;
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  // 本番: Manus storage proxyが設定されていればそちらに送る
  if (hasForgeCreds()) {
    const baseUrl = ENV.forgeApiUrl.replace(/\/+$/, "");
    const apiKey = ENV.forgeApiKey;
    const uploadUrl = buildUploadUrl(baseUrl, key);
    const formData = toFormData(data, contentType, key.split("/").pop() ?? key);
    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: buildAuthHeaders(apiKey),
      body: formData,
    });
    if (!response.ok) {
      const message = await response.text().catch(() => response.statusText);
      throw new Error(
        `Storage upload failed (${response.status} ${response.statusText}): ${message}`
      );
    }
    const url = (await response.json()).url;
    return { key, url };
  }
  // ローカル: uploads/ 配下に保存し、/uploads/{key} でアクセスできるようにする
  const targetPath = path.join(LOCAL_UPLOAD_DIR, key);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  const buffer =
    typeof data === "string"
      ? Buffer.from(data, "utf8")
      : data instanceof Buffer
        ? data
        : Buffer.from(data);
  fs.writeFileSync(targetPath, buffer);
  return { key, url: `/uploads/${key}` };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string; }> {
  const key = normalizeKey(relKey);
  if (hasForgeCreds()) {
    const baseUrl = ENV.forgeApiUrl.replace(/\/+$/, "");
    return {
      key,
      url: await buildDownloadUrl(baseUrl, key, ENV.forgeApiKey),
    };
  }
  return { key, url: `/uploads/${key}` };
}

export function getLocalUploadDir() {
  return LOCAL_UPLOAD_DIR;
}
