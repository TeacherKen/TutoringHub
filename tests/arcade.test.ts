import { describe, expect, it, vi, beforeEach } from "vitest";
import { existsSync } from "node:fs";
import { NextRequest } from "next/server";
import { ARCADE_META, GAMES, gameById } from "@/lib/games";
import { NEXT_COOKIE, isArcade, safeNext } from "@/lib/safeNext";

// 🎮 The games corner on the iPad: the game list, its own home-screen app, and coming back to it after signing in.

const exchange = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { exchangeCodeForSession: exchange } }) }));
const claims = vi.fn();
vi.mock("@supabase/ssr", () => ({ createServerClient: () => ({ auth: { getClaims: claims } }) }));

describe("game list", () => {
  it("has every game once, and the files of the built-in games exist", () => {
    const ids = GAMES.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(expect.arrayContaining(["football", "wolf-vs-sheep", "magic-square", "qm", "tt", "sd"]));
    for (const g of GAMES) if (g.src) expect(existsSync(`public${g.src}`), g.src).toBe(true);
  });
  it("finds a game by id, and nothing for a made-up one", () => {
    expect(gameById("qm")?.name).toBe("Quick Maths");
    expect(gameById("chess")).toBeNull();
  });
  it("the games corner is its own home-screen app called Games", async () => {
    expect(ARCADE_META.manifest).toBe("/arcade/manifest.webmanifest");
    expect((ARCADE_META.appleWebApp as { title: string }).title).toBe("Games");
    expect(existsSync("public/icons/games-180.png")).toBe(true);
    const { GET } = await import("@/app/arcade/manifest.webmanifest/route");
    const m = await GET().json();
    expect(m.start_url).toBe("/arcade");
    expect(m.short_name).toBe("Games");
    for (const i of m.icons) expect(existsSync(`public${i.src}`)).toBe(true);
  });
});

describe("going back after signing in", () => {
  it("only allows pages inside TutoringHub", () => {
    expect(safeNext("/arcade")).toBe("/arcade");
    expect(safeNext("/arcade/qm")).toBe("/arcade/qm");
    expect(safeNext("/students/abc?tab=notes")).toBe("/students/abc?tab=notes");
    for (const bad of ["https://evil.com", "//evil.com", "/\\evil.com", "evil", "", null, undefined, "/login", "/login?next=/x", "/auth/callback", "/a\nb", `/${"x".repeat(300)}`])
      expect(safeNext(bad as string), String(bad)).toBeNull();
  });
  it("knows which pages are the games corner", () => {
    expect(isArcade("/arcade")).toBe(true);
    expect(isArcade("/arcade/football/1")).toBe(true);
    expect(isArcade("/arcadeX")).toBe(false);
    expect(isArcade("/play")).toBe(false);
    expect(isArcade(null)).toBe(false);
  });

  beforeEach(() => {
    exchange.mockReset();
    claims.mockReset();
  });
  const callback = async (cookie: string | null, code = "abc") => {
    const { GET } = await import("@/app/auth/callback/route");
    const req = new NextRequest(`https://th.test/auth/callback?code=${code}`, { headers: cookie ? { cookie: `${NEXT_COOKIE}=${cookie}` } : {} });
    return GET(req);
  };
  it("signs in and goes to the games corner when that's where they came from", async () => {
    exchange.mockResolvedValue({ error: null });
    const res = await callback(encodeURIComponent("/arcade"));
    expect(res.headers.get("location")).toBe("https://th.test/arcade");
    expect(res.headers.get("set-cookie")).toContain(`${NEXT_COOKIE}=;`); // cleared
  });
  it("goes Home when there's no page to go back to, or it points elsewhere", async () => {
    exchange.mockResolvedValue({ error: null });
    expect((await callback(null)).headers.get("location")).toBe("https://th.test/");
    expect((await callback(encodeURIComponent("https://evil.com"))).headers.get("location")).toBe("https://th.test/");
    expect((await callback("%E0%A4%A")).headers.get("location")).toBe("https://th.test/"); // broken cookie
  });
  it("a failed sign-in returns to the sign-in screen, still heading to the games corner", async () => {
    exchange.mockResolvedValue({ error: new Error("nope") });
    expect((await callback(encodeURIComponent("/arcade"))).headers.get("location")).toBe("https://th.test/login?error=1&next=%2Farcade");
  });

  it("a signed-out iPad opening the games corner is sent to sign in, then back", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://x.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??= "pk";
    claims.mockResolvedValue({ data: null });
    const { proxy } = await import("@/proxy");
    const go = async (path: string) => (await proxy(new NextRequest(`https://th.test${path}`))).headers.get("location");
    expect(await go("/arcade")).toBe("https://th.test/login?next=%2Farcade");
    expect(await go("/")).toBe("https://th.test/login");
    expect(await go("/arcade/manifest.webmanifest")).toBeNull(); // the icon's details need no sign-in
    expect(await go("/room/abc")).toBeNull();
  });
});
