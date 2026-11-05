import { describe, expect, it } from "vitest";
import { NET_ERROR, netFail } from "@/lib/netFail";

describe("buttons when the internet drops", () => {
  it("a failed server call becomes a 'Couldn't save' answer instead of an error", async () => {
    const r = await Promise.reject(new Error("Failed to fetch")).catch(netFail);
    expect(r).toEqual({ error: NET_ERROR });
    expect(r.ok).toBeUndefined(); // so `if (r.ok)` treats it as not saved
  });
  it("a call that works is unchanged", async () => {
    expect(await Promise.resolve({ ok: true }).catch(netFail)).toEqual({ ok: true });
  });
});
