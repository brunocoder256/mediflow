import { describe, expect, it } from "vitest";
import { csvCell, escapeHtml, formatExpenseAmount, isHttpUrl, isUuid, toCsv } from "@/lib/expenses-format";

describe("expense export and safety helpers", () => {
  it("escapes CSV cells containing separators, quotes and newlines", () => {
    expect(csvCell("Rent, July")).toBe('"Rent, July"');
    expect(csvCell('He said "paid"')).toBe('"He said ""paid"""');
    expect(csvCell("line 1\nline 2")).toBe('"line 1\nline 2"');
    expect(csvCell(1250)).toBe("1250");
  });

  it("builds CRLF separated CSV rows", () => {
    expect(toCsv([["Ref", "Amount"], ["A,1", 20]])).toBe('Ref,Amount\r\n"A,1",20');
  });

  it("escapes dynamic HTML used by the print view", () => {
    expect(escapeHtml('<script>alert("x")</script>')).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;",
    );
    expect(escapeHtml("Tom & Jerry's")).toBe("Tom &amp; Jerry&#39;s");
  });

  it("only accepts http(s) attachment URLs", () => {
    expect(isHttpUrl("https://example.com/receipt.pdf")).toBe(true);
    expect(isHttpUrl("http://example.com/receipt.pdf")).toBe(true);
    expect(isHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isHttpUrl("data:text/html,hello")).toBe(false);
    expect(isHttpUrl("")).toBe(false);
  });

  it("validates UUIDs before sending category/register identifiers", () => {
    expect(isUuid("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11")).toBe(true);
    expect(isUuid("rent")).toBe(false);
    expect(isUuid("00000000-0000-0000-0000-000000000000")).toBe(false);
  });

  it("formats amounts safely", () => {
    expect(formatExpenseAmount(1234567)).toBe("1,234,567");
    expect(formatExpenseAmount("not-a-number")).toBe("0");
  });
});
