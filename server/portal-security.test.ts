import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";

const mockState = vi.hoisted(() => ({
  members: new Map<number, any>(),
  notifications: [] as any[],
  auditLogs: [] as any[],
}));

vi.mock("./db", () => ({
  getMemberByNumber: vi.fn(async (memberNumber: number) => {
    return Array.from(mockState.members.values()).find((member: any) => member.memberNumber === memberNumber);
  }),
  getMemberById: vi.fn(async (id: number) => mockState.members.get(id)),
  updateMember: vi.fn(async (id: number, data: any) => {
    const member = mockState.members.get(id);
    if (!member) return;
    mockState.members.set(id, { ...member, ...data });
  }),
  markNotificationRead: vi.fn(async (id: number, memberId: number) => {
    const notification = mockState.notifications.find((n: any) => n.id === id && n.memberId === memberId);
    if (notification) {
      notification.isRead = true;
      notification.readAt = new Date();
    }
  }),
  countUnreadNotifications: vi.fn(async (memberId: number) => {
    return mockState.notifications.filter((n: any) => n.memberId === memberId && !n.isRead).length;
  }),
  createAuditLog: vi.fn(async (data: any) => {
    mockState.auditLogs.push(data);
  }),
}));

function createPortalCaller(router: any) {
  return router.createCaller({ user: null, req: {}, res: {} });
}

function createAdminCaller(router: any) {
  return router.createCaller({
    user: {
      id: 1,
      openId: "admin",
      name: "Admin",
      email: "admin@example.com",
      loginMethod: "test",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {},
    res: {},
  });
}

async function seedMember(overrides: Partial<any> = {}) {
  const password = overrides.plainPassword ?? "old-password";
  mockState.members.set(overrides.id ?? 1, {
    id: overrides.id ?? 1,
    memberNumber: overrides.memberNumber ?? 101,
    displayName: overrides.displayName ?? "テスト会員",
    password: await bcrypt.hash(password, 10),
    requirePasswordChange: overrides.requirePasswordChange ?? false,
  });
}

describe("portal security blockers", () => {
  let portalRouter: any;
  let membersRouter: any;

  beforeAll(async () => {
    vi.stubEnv("JWT_SECRET", "test-secret-key-for-portal-security");
    portalRouter = (await import("./routers/portal")).portalRouter;
    membersRouter = (await import("./routers/members")).membersRouter;
  });

  beforeEach(async () => {
    mockState.members.clear();
    mockState.notifications.length = 0;
    mockState.auditLogs.length = 0;
    await seedMember();
  });

  it("requires currentPassword for a normal password change", async () => {
    const caller = createPortalCaller(portalRouter);
    const login = await caller.login({ memberNumber: 101, password: "old-password" });

    await expect(caller.changePassword({ token: login.token, newPassword: "new-password" }))
      .rejects.toThrow("現在のパスワードを入力してください。");
  });

  it("rejects a normal password change with an invalid currentPassword", async () => {
    const caller = createPortalCaller(portalRouter);
    const login = await caller.login({ memberNumber: 101, password: "old-password" });

    await expect(caller.changePassword({
      token: login.token,
      currentPassword: "wrong-password",
      newPassword: "new-password",
    })).rejects.toThrow("現在のパスワードが正しくありません。");
  });

  it("accepts a normal password change with the correct currentPassword", async () => {
    const caller = createPortalCaller(portalRouter);
    const login = await caller.login({ memberNumber: 101, password: "old-password" });

    await expect(caller.changePassword({
      token: login.token,
      currentPassword: "old-password",
      newPassword: "new-password",
    })).resolves.toEqual({ success: true });

    const member = mockState.members.get(1);
    expect(await bcrypt.compare("new-password", member.password)).toBe(true);
    expect(member.requirePasswordChange).toBe(false);
  });

  it("allows first-time password changes without currentPassword", async () => {
    await seedMember({ requirePasswordChange: true, plainPassword: "temporary-password" });
    const caller = createPortalCaller(portalRouter);
    const login = await caller.login({ memberNumber: 101, password: "temporary-password" });

    await expect(caller.changePassword({ token: login.token, newPassword: "new-password" }))
      .resolves.toEqual({ success: true });

    const member = mockState.members.get(1);
    expect(await bcrypt.compare("new-password", member.password)).toBe(true);
    expect(member.requirePasswordChange).toBe(false);
  });

  it("does not mark another member's notification as read", async () => {
    const caller = createPortalCaller(portalRouter);
    const login = await caller.login({ memberNumber: 101, password: "old-password" });
    mockState.notifications.push(
      { id: 1, memberId: 1, isRead: false, readAt: null },
      { id: 2, memberId: 2, isRead: false, readAt: null },
    );

    await caller.markNotificationRead({ token: login.token, notificationId: 1 });
    await caller.markNotificationRead({ token: login.token, notificationId: 2 });

    expect(mockState.notifications[0].isRead).toBe(true);
    expect(mockState.notifications[1].isRead).toBe(false);
    await expect(caller.unreadNotificationCount({ token: login.token })).resolves.toEqual({ count: 0 });
    expect(mockState.notifications.filter((n: any) => n.memberId === 2 && !n.isRead)).toHaveLength(1);
  });

  it("issues a random temporary password and does not keep the old password valid", async () => {
    const adminCaller = createAdminCaller(membersRouter);
    const portalCaller = createPortalCaller(portalRouter);

    const result = await adminCaller.resetPassword({ id: 1 });

    expect(result.success).toBe(true);
    expect(result.temporaryPassword).toHaveLength(12);
    expect(result.temporaryPassword).not.toBe("0000");
    expect(mockState.auditLogs[0].newValue).toEqual({ temporaryPasswordIssued: true });
    expect(JSON.stringify(mockState.auditLogs)).not.toContain(result.temporaryPassword);

    await expect(portalCaller.login({ memberNumber: 101, password: "old-password" })).rejects.toThrow();
    const login = await portalCaller.login({ memberNumber: 101, password: result.temporaryPassword });
    expect(login.member.requirePasswordChange).toBe(true);
  });
});
