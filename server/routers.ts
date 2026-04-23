import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { membersRouter } from "./routers/members";
import { eventsRouter } from "./routers/events";
import { transactionsRouter } from "./routers/transactions";
import { settlementsRouter } from "./routers/settlements";
import { dashboardRouter, auditRouter } from "./routers/dashboard";
import { pdfRouter } from "./routers/pdf";
import { portalRouter } from "./routers/portal";
import { settingsRouter } from "./routers/settings";
import { registerRouter } from "./routers/register";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  members: membersRouter,
  events: eventsRouter,
  transactions: transactionsRouter,
  settlements: settlementsRouter,
  dashboard: dashboardRouter,
  audit: auditRouter,
  pdf: pdfRouter,
  portal: portalRouter,
  settings: settingsRouter,
  register: registerRouter,
});

export type AppRouter = typeof appRouter;
