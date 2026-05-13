const isProduction = process.env.NODE_ENV === "production";

function resolveJwtSecret(): string {
  const raw = process.env.JWT_SECRET ?? "";
  if (isProduction) {
    if (!raw || raw.length < 32) {
      throw new Error(
        "[ENV] JWT_SECRET must be set and at least 32 characters in production. " +
        "Generate with: node -e \"console.log(require('crypto').randomBytes(48).toString('base64'))\""
      );
    }
    return raw;
  }
  // 開発時は警告のみ。固定の弱いシークレットでも起動はさせる
  if (!raw) {
    console.warn("[ENV] JWT_SECRET is not set — using insecure dev fallback.");
    return "dev-insecure-secret-do-not-use-in-production";
  }
  return raw;
}

export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: resolveJwtSecret(),
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction,
  trustProxy: process.env.TRUST_PROXY === "1" || isProduction,
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
};
