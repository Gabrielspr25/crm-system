import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const source = fs.readFileSync(path.resolve("src/react-app/pages/Reports.tsx"), "utf8");

function bodyOf(functionName) {
  const start = source.indexOf(`function ${functionName}`);
  expect(start).toBeGreaterThanOrEqual(0);
  const nextFunction = source.indexOf("\nfunction ", start + 1);
  return source.slice(start, nextFunction === -1 ? undefined : nextFunction);
}

describe("Reports prioriza line_kind sobre sale_type historico", () => {
  test("la etiqueta de tipo usa line_kind antes de sale_type", () => {
    const body = bodyOf("formatSaleTypeLabel");
    expect(body.indexOf("const kind = String(lineKind")).toBeLessThan(
      body.indexOf("const exact = String(saleType")
    );
  });

  test("el conteo de productos usa line_kind antes de sale_type", () => {
    const body = bodyOf("resolveLineProducts");
    expect(body.indexOf("const kind = String(row.line_kind")).toBeLessThan(
      body.indexOf("const saleType = String(row.sale_type")
    );
  });
});
