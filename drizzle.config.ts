import { defineConfig } from "drizzle-kit";
import path from "node:path";

const dbFile = process.env.DATABASE_URL?.replace(/^sqlite:/, "") || path.resolve("./data.sqlite");

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: dbFile,
  },
});
