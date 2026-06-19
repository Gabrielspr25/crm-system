import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const source = fs.readFileSync(path.resolve("src/react-app/pages/Reports.tsx"), "utf8");

describe("Reports exige vendedor en vista vendedor", () => {
  test("admin en vista vendedor no ve todos por defecto", () => {
    expect(source).toContain("requiresVendorSelection");
    expect(source).toContain("Seleccionar vendedor");
    expect(source).toContain("Selecciona un vendedor para ver su reporte.");
    expect(source).toContain("if (requiresVendorSelection && !selectedVendor) return false;");
  });
});
