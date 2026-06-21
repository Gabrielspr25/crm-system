import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

describe("Clientes - filtro real por vencimiento de suscriptor", () => {
  const clientController = read("src/backend/controllers/clientController.js");
  const clientsPage = read("src/react-app/pages/Clients.tsx");

  test("/api/clients acepta expiration_year/month y filtra con EXISTS por subscribers activos", () => {
    expect(clientController).toContain("expiration_year");
    expect(clientController).toContain("expiration_month");
    expect(clientController).toContain("EXISTS (");
    expect(clientController).toContain("JOIN bans b_exp ON b_exp.id = s_exp.ban_id");
    expect(clientController).toContain("b_exp.client_id = c.id");
    expect(clientController).toContain("s_exp.contract_end_date >= $");
    expect(clientController).toContain("s_exp.contract_end_date < $");
    expect(clientController).toContain("COALESCE(LOWER(s_exp.status::text), 'activo')");
  });

  test("Clientes envia expiration_year/month al backend y no usa lastActivity/createdAt para vencimiento", () => {
    expect(clientsPage).toContain("expiration_year");
    expect(clientsPage).toContain("expiration_month");
    expect(clientsPage).toContain("selectedMonth.split");
    expect(clientsPage).not.toContain("item.primaryContractEndDate || item.primarySubscriberCreatedAt || item.lastActivity");
  });
});
