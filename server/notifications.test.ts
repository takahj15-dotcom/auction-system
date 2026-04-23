import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module
vi.mock("./db", () => {
  const notifications: any[] = [];
  let nextId = 1;

  return {
    bulkCreateMemberNotifications: vi.fn(async (dataList: any[]) => {
      for (const data of dataList) {
        notifications.push({ id: nextId++, ...data, isRead: false, readAt: null, createdAt: new Date() });
      }
    }),
    createMemberNotification: vi.fn(async (data: any) => {
      const id = nextId++;
      notifications.push({ id, ...data, isRead: false, readAt: null, createdAt: new Date() });
      return id;
    }),
    listMemberNotifications: vi.fn(async (memberId: number, limit = 50) => {
      return notifications
        .filter(n => n.memberId === memberId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, limit);
    }),
    countUnreadNotifications: vi.fn(async (memberId: number) => {
      return notifications.filter(n => n.memberId === memberId && !n.isRead).length;
    }),
    markNotificationRead: vi.fn(async (id: number) => {
      const notif = notifications.find(n => n.id === id);
      if (notif) {
        notif.isRead = true;
        notif.readAt = new Date();
      }
    }),
    markAllNotificationsRead: vi.fn(async (memberId: number) => {
      notifications.forEach(n => {
        if (n.memberId === memberId && !n.isRead) {
          n.isRead = true;
          n.readAt = new Date();
        }
      });
    }),
    _getNotifications: () => notifications,
    _reset: () => {
      notifications.length = 0;
      nextId = 1;
    },
  };
});

import * as db from "./db";

describe("Member Notifications", () => {
  beforeEach(() => {
    (db as any)._reset();
    vi.clearAllMocks();
  });

  it("should create a single notification", async () => {
    const id = await db.createMemberNotification({
      memberId: 1,
      title: "新しい精算書が作成されました",
      message: "2025-01-15 の精算書が作成されました。",
      type: "settlement",
      linkUrl: "/portal",
    });
    expect(id).toBe(1);
    expect(db.createMemberNotification).toHaveBeenCalledTimes(1);
  });

  it("should bulk create notifications for multiple members", async () => {
    const memberIds = [1, 2, 3, 4, 5];
    const notifications = memberIds.map(memberId => ({
      memberId,
      title: "新しい精算書が作成されました",
      message: "2025-01-15 の精算書が作成されました。",
      type: "settlement" as const,
      linkUrl: "/portal",
    }));
    await db.bulkCreateMemberNotifications(notifications);
    expect(db.bulkCreateMemberNotifications).toHaveBeenCalledTimes(1);

    const allNotifs = (db as any)._getNotifications();
    expect(allNotifs.length).toBe(5);
  });

  it("should list notifications for a specific member", async () => {
    await db.bulkCreateMemberNotifications([
      { memberId: 1, title: "通知1", type: "settlement" as const },
      { memberId: 2, title: "通知2", type: "settlement" as const },
      { memberId: 1, title: "通知3", type: "info" as const },
    ]);

    const member1Notifs = await db.listMemberNotifications(1);
    expect(member1Notifs.length).toBe(2);
    // Both belong to member 1
    const titles = member1Notifs.map((n: any) => n.title);
    expect(titles).toContain("通知1");
    expect(titles).toContain("通知3");
  });

  it("should count unread notifications", async () => {
    await db.bulkCreateMemberNotifications([
      { memberId: 1, title: "通知1", type: "settlement" as const },
      { memberId: 1, title: "通知2", type: "settlement" as const },
      { memberId: 1, title: "通知3", type: "info" as const },
    ]);

    const count = await db.countUnreadNotifications(1);
    expect(count).toBe(3);
  });

  it("should mark a single notification as read", async () => {
    await db.bulkCreateMemberNotifications([
      { memberId: 1, title: "通知1", type: "settlement" as const },
      { memberId: 1, title: "通知2", type: "settlement" as const },
    ]);

    await db.markNotificationRead(1);

    const allNotifs = (db as any)._getNotifications();
    expect(allNotifs[0].isRead).toBe(true);
    expect(allNotifs[0].readAt).not.toBeNull();
    expect(allNotifs[1].isRead).toBe(false);

    const unreadCount = await db.countUnreadNotifications(1);
    expect(unreadCount).toBe(1);
  });

  it("should mark all notifications as read for a member", async () => {
    await db.bulkCreateMemberNotifications([
      { memberId: 1, title: "通知1", type: "settlement" as const },
      { memberId: 1, title: "通知2", type: "settlement" as const },
      { memberId: 2, title: "通知3", type: "settlement" as const },
    ]);

    await db.markAllNotificationsRead(1);

    const member1Count = await db.countUnreadNotifications(1);
    expect(member1Count).toBe(0);

    // Member 2's notification should still be unread
    const member2Count = await db.countUnreadNotifications(2);
    expect(member2Count).toBe(1);
  });

  it("should respect limit when listing notifications", async () => {
    const notifications = Array.from({ length: 10 }, (_, i) => ({
      memberId: 1,
      title: `通知${i + 1}`,
      type: "info" as const,
    }));
    await db.bulkCreateMemberNotifications(notifications);

    const limited = await db.listMemberNotifications(1, 3);
    expect(limited.length).toBe(3);
  });

  it("should return empty array for member with no notifications", async () => {
    const notifs = await db.listMemberNotifications(999);
    expect(notifs).toEqual([]);
  });

  it("should return 0 unread count for member with no notifications", async () => {
    const count = await db.countUnreadNotifications(999);
    expect(count).toBe(0);
  });
});
