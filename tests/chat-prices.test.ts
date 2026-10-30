import { describe, expect, it } from "vitest";
import { chatLink, waNumber } from "@/lib/chat";
import { cleanPriceOptions, optionText } from "@/lib/prices";

describe("send on WhatsApp / LINE", () => {
  it("turns Thai numbers into WhatsApp numbers", () => {
    expect(waNumber("081-234-5678")).toBe("66812345678");
    expect(waNumber("+41 79 123 45 67")).toBe("41791234567");
    expect(waNumber("")).toBeNull();
  });
  it("makes links with the message filled in", () => {
    expect(chatLink("whatsapp", "0812345678", "Hi & bye")?.href).toBe("https://wa.me/66812345678?text=Hi%20%26%20bye");
    expect(chatLink("line", "ken", "Hi")?.href).toBe("https://line.me/R/share?text=Hi");
    expect(chatLink("wechat", "x", "Hi")).toBeNull();
  });
});

describe("price list", () => {
  it("keeps only sensible options", () => {
    const o = cleanPriceOptions([{ id: "a", label: "Onsite", hours: 12, price: 33600 }, { hours: -1, price: 5 }, "junk"]);
    expect(o).toHaveLength(1);
    expect(optionText(o[0])).toBe("Onsite: 12 hours for ฿33,600");
  });
});
