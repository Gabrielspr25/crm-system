import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

describe("Panel General - lineas activas por vencimiento", () => {
  const dashboardController = read("src/backend/controllers/dashboardController.js");
  const dashboardRoutes = read("src/backend/routes/dashboardRoutes.js");
  const directorPage = read("src/react-app/pages/Director.tsx");

  test("expone endpoint de lineas activas filtrado por mes y anio de vencimiento", () => {
    expect(dashboardRoutes).toContain("/active-lines-expiration");
    expect(dashboardRoutes).toContain("getActiveLinesExpiration");
    expect(dashboardController).toContain("contract_end_date");
    expect(dashboardController).toContain("s.contract_end_date >= $");
    expect(dashboardController).toContain("s.contract_end_date < $");
    expect(dashboardController).toContain("mobile_active_lines");
    expect(dashboardController).toContain("fixed_active_lines");
    expect(dashboardController).toContain("monthly_revenue");
  });

  test("Panel General muestra cuatro tarjetas superiores con el mismo estilo KPI", () => {
    expect(directorPage).toContain("/api/dashboard/active-lines-expiration");
    expect(directorPage).toContain("LINEAS ACTIVAS");
    expect(directorPage).toContain("MOVIL ACTIVO");
    expect(directorPage).toContain("FIJO ACTIVO");
    expect(directorPage).toContain("TOTAL MENSUAL");
    expect(directorPage).toContain('type="month"');
    expect(directorPage).toContain("FILTRO VENCIMIENTO");
    expect(directorPage).not.toContain("Reporte de vencimientos activos");
  });
});
