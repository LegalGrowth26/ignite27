import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";

interface Row {
  a: string;
  b: string | null;
  n: number;
}

const COLS = [
  { header: "A", value: (r: Row) => r.a },
  { header: "B", value: (r: Row) => r.b },
  { header: "N", value: (r: Row) => r.n },
];

describe("toCsv", () => {
  it("prepends a UTF-8 BOM and CRLF-joins rows", () => {
    const csv = toCsv<Row>([{ a: "x", b: "y", n: 1 }], COLS);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain("A,B,N\r\nx,y,1\r\n");
  });

  it("quotes fields containing commas and doubles embedded quotes", () => {
    const csv = toCsv<Row>([{ a: 'Say "hi", now', b: "plain", n: 2 }], COLS);
    expect(csv).toContain('"Say ""hi"", now",plain,2');
  });

  it("quotes fields containing newlines", () => {
    const csv = toCsv<Row>([{ a: "line1\nline2", b: "", n: 3 }], COLS);
    expect(csv).toContain('"line1\nline2"');
  });

  it("renders null/undefined as empty fields", () => {
    const csv = toCsv<Row>([{ a: "x", b: null, n: 0 }], COLS);
    expect(csv).toContain("x,,0");
  });

  it("handles zero rows (header only)", () => {
    const csv = toCsv<Row>([], COLS);
    expect(csv).toBe("﻿A,B,N\r\n");
  });
});
