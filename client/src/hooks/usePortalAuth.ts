import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";

/**
 * 会員ポータルの認証情報取得フック
 *
 * 優先順位:
 * 1. URL クエリ `?impersonate_token=&impersonate_member=` (管理者によるなりすまし時に渡される)
 *    → sessionStorage に退避してURLから除去。以降このタブでのみ有効。
 * 2. sessionStorage (なりすまし中)
 * 3. localStorage (通常の会員ログイン)
 */
export function usePortalAuth() {
  const [, setLocation] = useLocation();
  const [bootstrap, setBootstrap] = useState<{ token: string | null; member: any | null; impersonated: boolean }>(() => {
    // URL クエリを最初に確認（新タブで開かれた直後）
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const qToken = params.get("impersonate_token");
      const qMember = params.get("impersonate_member");
      if (qToken && qMember) {
        try {
          sessionStorage.setItem("portal_token", qToken);
          sessionStorage.setItem("portal_member", qMember);
          sessionStorage.setItem("portal_impersonated", "1");
        } catch {}
        // URL からクエリ除去
        const url = new URL(window.location.href);
        url.searchParams.delete("impersonate_token");
        url.searchParams.delete("impersonate_member");
        window.history.replaceState({}, "", url.toString());
      }
    }

    const sToken = sessionStorage.getItem("portal_token");
    const sMember = sessionStorage.getItem("portal_member");
    if (sToken && sMember) {
      return {
        token: sToken,
        member: JSON.parse(sMember),
        impersonated: sessionStorage.getItem("portal_impersonated") === "1",
      };
    }

    const lToken = localStorage.getItem("portal_token");
    const lMember = localStorage.getItem("portal_member");
    return {
      token: lToken,
      member: lMember ? JSON.parse(lMember) : null,
      impersonated: false,
    };
  });

  const logout = useCallback(() => {
    sessionStorage.removeItem("portal_token");
    sessionStorage.removeItem("portal_member");
    sessionStorage.removeItem("portal_impersonated");
    if (!bootstrap.impersonated) {
      localStorage.removeItem("portal_token");
      localStorage.removeItem("portal_member");
    }
    setBootstrap({ token: null, member: null, impersonated: false });
    setLocation("/portal/login");
  }, [setLocation, bootstrap.impersonated]);

  useEffect(() => {
    if (!bootstrap.token) {
      setLocation("/portal/login");
    }
  }, [bootstrap.token, setLocation]);

  return useMemo(
    () => ({
      token: bootstrap.token,
      member: bootstrap.member,
      impersonated: bootstrap.impersonated,
      logout,
    }),
    [bootstrap, logout],
  );
}
