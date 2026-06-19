import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const source = fs.readFileSync(path.resolve("server-FINAL.js"), "utf8");

describe("subscriber-reports conserva line_kind real", () => {
  test("expone s.line_kind y lo devuelve al frontend", () => {
    expect(source).toContain("s.line_kind,");
    expect(source).toContain("const effectiveLineKind =");
    expect(source).toContain("line_kind: effectiveLineKind || null");
  });
});
