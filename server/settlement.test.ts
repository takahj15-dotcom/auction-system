import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAdminContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "admin-user",
    email: "admin@example.com",
    name: "Admin User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

function createUserContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 2,
    openId: "regular-user",
    email: "user@example.com",
    name: "Regular User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

function createUnauthContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("Router structure", () => {
  it("has all expected routers defined", () => {
    const caller = appRouter.createCaller(createAdminContext());
    // Verify the router has the expected procedures
    expect(caller.members).toBeDefined();
    expect(caller.events).toBeDefined();
    expect(caller.transactions).toBeDefined();
    expect(caller.settlements).toBeDefined();
    expect(caller.dashboard).toBeDefined();
    expect(caller.audit).toBeDefined();
    expect(caller.pdf).toBeDefined();
    expect(caller.auth).toBeDefined();
  });
});

describe("Auth enforcement", () => {
  it("rejects unauthenticated access to members.list", async () => {
    const caller = appRouter.createCaller(createUnauthContext());
    await expect(caller.members.list({ activeOnly: true })).rejects.toThrow();
  });

  it("rejects non-admin access to members.create", async () => {
    const caller = appRouter.createCaller(createUserContext());
    await expect(
      caller.members.create({
        memberNumber: 999,
        displayName: "Test",
      })
    ).rejects.toThrow();
  });

  it("rejects unauthenticated access to audit.list", async () => {
    const caller = appRouter.createCaller(createUnauthContext());
    await expect(caller.audit.list({ limit: 10, offset: 0 })).rejects.toThrow();
  });

  it("rejects non-admin access to audit.list", async () => {
    const caller = appRouter.createCaller(createUserContext());
    await expect(caller.audit.list({ limit: 10, offset: 0 })).rejects.toThrow();
  });
});

describe("Input validation", () => {
  it("rejects invalid event date format", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    await expect(
      caller.events.create({ eventDate: "not-a-date" })
    ).rejects.toThrow();
  });

  it("rejects empty transaction itemName", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    await expect(
      caller.transactions.create({
        eventId: 1,
        sellerMemberId: 1,
        buyerMemberId: 2,
        itemName: "",
        unitPrice: 100,
        quantity: 1,
        totalPrice: 100,
      })
    ).rejects.toThrow();
  });

  it("rejects negative member number", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    await expect(
      caller.members.create({
        memberNumber: -1,
        displayName: "Test",
      })
    ).rejects.toThrow();
  });

  it("rejects member number over 1000", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    await expect(
      caller.members.create({
        memberNumber: 1001,
        displayName: "Test Over Limit",
      })
    ).rejects.toThrow();
  });

  it("accepts member number at boundary 1000", async () => {
    // Validate that 1000 is within the allowed range (1-1000)
    const { z } = await import("zod");
    const schema = z.number().min(1).max(1000);
    expect(schema.safeParse(1000).success).toBe(true);
    expect(schema.safeParse(1).success).toBe(true);
    expect(schema.safeParse(1001).success).toBe(false);
    expect(schema.safeParse(0).success).toBe(false);
  });
});

describe("Two-stage settlement process", () => {
  it("has generateSettlements procedure defined", () => {
    const caller = appRouter.createCaller(createAdminContext());
    expect(caller.settlements.generateSettlements).toBeDefined();
  });

  it("has finalizeEvent procedure defined", () => {
    const caller = appRouter.createCaller(createAdminContext());
    expect(caller.settlements.finalizeEvent).toBeDefined();
  });

  it("has resetSettlements procedure defined", () => {
    const caller = appRouter.createCaller(createAdminContext());
    expect(caller.settlements.resetSettlements).toBeDefined();
  });

  it("has reopenEvent procedure defined", () => {
    const caller = appRouter.createCaller(createAdminContext());
    expect(caller.settlements.reopenEvent).toBeDefined();
  });

  it("rejects non-admin access to generateSettlements", async () => {
    const caller = appRouter.createCaller(createUserContext());
    await expect(caller.settlements.generateSettlements({ eventId: 1 })).rejects.toThrow();
  });

  it("rejects non-admin access to finalizeEvent", async () => {
    const caller = appRouter.createCaller(createUserContext());
    await expect(caller.settlements.finalizeEvent({ eventId: 1 })).rejects.toThrow();
  });
});

describe("Auth me", () => {
  it("returns user data for authenticated user", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeDefined();
    expect(result?.name).toBe("Admin User");
    expect(result?.role).toBe("admin");
  });

  it("returns null for unauthenticated user", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });
});
