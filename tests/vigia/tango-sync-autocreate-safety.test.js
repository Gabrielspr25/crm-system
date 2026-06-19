import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const tangoRoutes = fs.readFileSync(path.resolve("src/backend/routes/tangoRoutes.js"), "utf8");
const reportsPage = fs.readFileSync(path.resolve("src/react-app/pages/Reports.tsx"), "utf8");
const serverFinal = fs.readFileSync(path.resolve("server-FINAL.js"), "utf8");

describe("sync Tango V2 no fabrica clientes ni pierde clasificacion", () => {
  test("auto-create no crea nombres placeholder TANGO BAN", () => {
    expect(tangoRoutes).not.toContain("TANGO BAN ${banNum}");
    expect(tangoRoutes).toContain("cliente_tango_sin_nombre");
  });

  test("raw_payload conserva ventatipo_nombre para reconstruir BA como movil", () => {
    const reportSourceStart = tangoRoutes.indexOf("const reportSource =");
    expect(reportSourceStart).toBeGreaterThanOrEqual(0);
    const rawPayloadStart = tangoRoutes.indexOf("const rawPayload = {", reportSourceStart);
    expect(rawPayloadStart).toBeGreaterThanOrEqual(0);
    const rawPayloadBody = tangoRoutes.slice(rawPayloadStart, tangoRoutes.indexOf("};", rawPayloadStart));
    expect(rawPayloadBody).toContain("ventatipo_nombre");
  });

  test("la pantalla muestra popup cuando Tango V2 trae datos incompletos", () => {
    expect(reportsPage).toContain("cliente_tango_sin_nombre");
    expect(reportsPage).toContain("Revisar Tango");
  });

  test("server-FINAL tambien acepta BA por nombre o plan en filtros PyMES inline", () => {
    expect(serverFinal).toContain("function _isPymesTipoRow(row)");
    expect(serverFinal).toContain("/^BA/.test(planCode)");
    expect(serverFinal).toContain("/ba corp|banda/.test");
  });
});
