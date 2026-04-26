const isProd = process.env.NODE_ENV === "production";

type ReadOptions = {
  required?: boolean;
  minLength?: number;
};

function readEnv(name: string, options: ReadOptions = {}): string {
  const value = (process.env[name] ?? "").trim();
  const required = options.required ?? true;
  const minLength = options.minLength ?? 0;

  if (!value) {
    if (isProd && required) {
      throw new Error(
        `[ENV] Required environment variable ${name} is not set. Refusing to start in production.`
      );
    }
    if (!isProd && required) {
      console.warn(
        `[ENV] ${name} is not set; using empty string fallback (non-production only).`
      );
    }
    return "";
  }

  if (value.length < minLength) {
    const message = `[ENV] ${name} is too short (got ${value.length} chars, need ${minLength}).`;
    if (isProd) throw new Error(message);
    console.warn(`${message} Continuing with weak value because NODE_ENV is not "production".`);
  }

  return value;
}

export const ENV = {
  appId: readEnv("VITE_APP_ID"),
  cookieSecret: readEnv("JWT_SECRET", { minLength: 32 }),
  databaseUrl: readEnv("DATABASE_URL", { required: false }),
  oAuthServerUrl: readEnv("OAUTH_SERVER_URL"),
  ownerOpenId: readEnv("OWNER_OPEN_ID", { required: false }),
  isProduction: isProd,
  forgeApiUrl: readEnv("BUILT_IN_FORGE_API_URL", { required: false }),
  forgeApiKey: readEnv("BUILT_IN_FORGE_API_KEY", { required: false }),
};
