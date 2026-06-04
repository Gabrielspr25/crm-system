import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();

const read = (path) => readFileSync(resolve(root, path), "utf8");

describe("SOV2 contrato operativo", () => {
  test("backend replica el universo valido del tab Seguimiento", () => {
    const controller = read("src/backend/controllers/sov2Controller.js");

    expect(controller).toContain("COALESCE(NULLIF(TRIM(c.name), ''), NULLIF(TRIM(c.business_name), '')) IS NOT NULL");
    expect(controller).toContain("follow_up_prospects");
    expect(controller).toContain("f.completed_date IS NULL");
    expect(controller).toContain("COALESCE(f.is_active::text, 'true') IN ('true', '1', 't')");
    expect(controller).toContain("EXISTS (SELECT 1 FROM bans b WHERE b.client_id = c.id)");
    expect(controller).toContain("crm_product_task_templates");
    expect(controller).not.toContain("FROM opportunity_step_templates");
  });

  test("tabla SOV2 abre modal para pasos por producto y no usa desplegable en celda", () => {
    const page = read("src/react-app/pages/SeguimientoOperativo.tsx");

    expect(page).not.toContain("<th className=\"w-28 border-b border-r border-slate-800 px-3 py-3\">Bloqueado</th>");
    expect(page).not.toContain("<BlockedToggle");
    expect(page).not.toContain("<StepSelect");
    expect(page).not.toContain("lg:basis-full");
    expect(page).not.toContain("data-testid={`sov2-step-menu-${productKey}-${opportunity.id}`}");
    expect(page).toContain("function ProductStepsModal");
    expect(page).toContain("data-testid=\"sov2-product-steps-modal\"");
    expect(page).toContain("onOpenSteps");
    expect(page).toContain("type=\"checkbox\"");
  });

  test("categorias queda limpio y no administra pasos operativos", () => {
    const app = read("src/react-app/App.tsx");
    const categories = read("src/react-app/pages/Categories.tsx");

    expect(app).toContain('import CategoriesPage from "@/react-app/pages/Categories"');
    expect(app).toContain('<Route path="/categorias" element={<CategoriesPage />} />');
    expect(app).not.toContain('<Route path="/categorias" element={<Navigate to="/productos" replace />} />');
    expect(categories).not.toContain("/api/categories/${catId}/steps");
    expect(categories).not.toContain("/api/category-steps");
    expect(categories).not.toContain("Reorder");
    expect(categories).not.toContain("/api/task-product-templates");
    expect(categories).not.toContain("Guardar pasos");
    expect(categories).toContain("/api/products");
  });

  test("SOV2 administra pasos operativos desde crm_product_task_templates", () => {
    const seguimiento = read("src/react-app/pages/SeguimientoOperativo.tsx");

    expect(seguimiento).toContain("Configurar pasos");
    expect(seguimiento).toContain("function StepConfigModal");
    expect(seguimiento).toContain("/api/task-product-templates?include_inactive=1");
    expect(seguimiento).toContain("crm_product_task_templates");
    expect(seguimiento).toContain("is_active");
  });

  test("SOV2 mantiene tarjetas superiores completas y responsive", () => {
    const seguimiento = read("src/react-app/pages/SeguimientoOperativo.tsx");

    [
      "Clientes visibles",
      "Total lÃ­neas",
      "Total $",
      "ProyecciÃ³n $",
      "ProyecciÃ³n lÃ­neas",
      "Meta Dinero",
      "Falta Dinero",
      "Diario Dinero",
      "Cantidad vendida",
      "Meta Cantidad",
      "Falta Cantidad",
      "Diario Cantidad",
    ].forEach((label) => expect(seguimiento).toContain(`label: "${label}"`));

    expect(seguimiento).toContain("sub:");
    expect(seguimiento).toContain("progress:");
    expect(seguimiento).toContain("sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-9");
  });

  test("SOV2 separa vendido real de proyeccion en metricas superiores", () => {
    const controller = read("src/backend/controllers/sov2Controller.js");
    const seguimiento = read("src/react-app/pages/SeguimientoOperativo.tsx");

    expect(controller).toContain("real_sold_money");
    expect(controller).toContain("real_sold_quantity");
    expect(controller).toContain("projection_money");
    expect(controller).toContain("projection_quantity");
    expect(controller).toContain("FROM subscriber_reports sr");
    expect(controller).toContain("COALESCE(sr.validation_status, '') = 'confirmed'");
    expect(controller).toContain("so.status NOT IN ('ganada', 'perdida', 'cerrada_no_trabajar')");

    expect(seguimiento).toContain("metrics?.real_sold_money");
    expect(seguimiento).toContain("metrics?.real_sold_quantity");
    expect(seguimiento).toContain("metrics?.projection_money");
    expect(seguimiento).toContain("metrics?.projection_quantity");
  });

  test("SOV2 resuelve metas por description cuando product_id es legacy", () => {
    const controller = read("src/backend/controllers/sov2Controller.js");

    expect(controller).toContain("LEFT JOIN products p_by_product_id ON p_by_product_id.id::text = pg.product_id::text");
    expect(controller).toContain("LEFT JOIN products p_by_description ON p_by_description.id::text = pg.description");
    expect(controller).toContain("COALESCE(p_by_product_id.name, p_by_description.name) AS product_name");
    expect(controller).toContain("metaMoney += targetRevenue");
    expect(controller).toContain("metaQuantity += targetUnits");
    expect(controller).not.toContain("LEFT JOIN products p ON p.id::text = COALESCE(pg.product_id::text, pg.description)");
    expect(controller).not.toContain("fallbackAmount");
  });

  test("productos no muestra comisiones en pantalla", () => {
    const productsPage = read("src/react-app/pages/Products.tsx");

    expect(productsPage).not.toContain("Comision");
    expect(productsPage).not.toContain("Comisión");
    expect(productsPage).not.toContain("Tiers de Comisi");
    expect(productsPage).not.toContain("commission_percentage");
    expect(productsPage).not.toContain("/api/products/tiers");

  });

});
