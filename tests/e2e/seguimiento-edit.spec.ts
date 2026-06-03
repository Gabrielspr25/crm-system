import { expect, test } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL || 'https://crmp.ss-group.cloud';
const token = process.env.E2E_TOKEN;

test.describe('Seguimiento — edicion inline persistente', () => {
  test.skip(!token, 'E2E_TOKEN requerido (JWT admin generado en server)');

  test('owner / next_action / notes / blocked persisten tras reload', async ({ page, request }) => {
    const stamp = Date.now();
    const ownerValue = `QA-Owner-${stamp}`;
    const nextActionValue = `Llamar QA ${stamp}`;
    const notesValue = `Nota QA ${stamp}`;

    // Login via ?token= (ProtectedLayout lee urlParams.token y lo guarda en localStorage)
    await page.goto(`${baseURL}/seguimiento?token=${token}`, { waitUntil: 'networkidle' });

    // Esperar a que la tabla cargue (no spinner)
    await expect(page.getByText('Cargando seguimiento')).toBeHidden({ timeout: 20_000 });

    // Tomar el primer row visible (data-testid owner-<id>)
    const firstOwnerInput = page.locator('[data-testid^="owner-"]').first();
    await expect(firstOwnerInput).toBeVisible({ timeout: 10_000 });

    const ownerTestId = await firstOwnerInput.getAttribute('data-testid');
    const rowId = String(ownerTestId || '').replace(/^owner-/, '');
    expect(rowId, 'No se pudo extraer id de la primera fila').toBeTruthy();

    // Reset estado conocido vía API antes del test UI (evita flakiness por estado heredado)
    const resetResponse = await request.patch(`${baseURL}/api/seguimiento/${rowId}`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { owner: '', next_action: '', notes: '', blocked: false },
    });
    expect(resetResponse.ok(), 'Reset PATCH debe responder 200').toBeTruthy();

    // Reload tras reset para reflejar estado limpio
    await page.goto(`${baseURL}/seguimiento`, { waitUntil: 'networkidle' });
    await expect(page.getByText('Cargando seguimiento')).toBeHidden({ timeout: 20_000 });

    const ownerInput = page.locator(`[data-testid="owner-${rowId}"]`);
    const nextActionInput = page.locator(`[data-testid="next-action-${rowId}"]`);
    const notesInput = page.locator(`[data-testid="notes-${rowId}"]`);
    const blockedInput = page.locator(`[data-testid="blocked-${rowId}"]`);

    await expect(ownerInput).toBeVisible({ timeout: 10_000 });
    await expect(blockedInput).not.toBeChecked();

    // 1) Editar owner — fill + blur dispara onBlur (PATCH)
    await ownerInput.fill(ownerValue);
    await ownerInput.blur();
    await page.waitForResponse(
      (r) => r.url().includes(`/api/seguimiento/${rowId}`) && r.request().method() === 'PATCH' && r.status() === 200,
      { timeout: 10_000 },
    );

    // 2) Editar next_action
    await nextActionInput.fill(nextActionValue);
    await nextActionInput.blur();
    await page.waitForResponse(
      (r) => r.url().includes(`/api/seguimiento/${rowId}`) && r.request().method() === 'PATCH' && r.status() === 200,
      { timeout: 10_000 },
    );

    // 3) Editar notas
    await notesInput.fill(notesValue);
    await notesInput.blur();
    await page.waitForResponse(
      (r) => r.url().includes(`/api/seguimiento/${rowId}`) && r.request().method() === 'PATCH' && r.status() === 200,
      { timeout: 10_000 },
    );

    // 4) Marcar bloqueado (onChange dispara PATCH al cambiar checkbox)
    await blockedInput.check();
    await page.waitForResponse(
      (r) => r.url().includes(`/api/seguimiento/${rowId}`) && r.request().method() === 'PATCH' && r.status() === 200,
      { timeout: 10_000 },
    );

    // 5) Refrescar (reload sin ?token=)
    await page.goto(`${baseURL}/seguimiento`, { waitUntil: 'networkidle' });
    await expect(page.getByText('Cargando seguimiento')).toBeHidden({ timeout: 20_000 });

    // 6) Verificar persistencia en la misma fila
    const ownerAfter = page.locator(`[data-testid="owner-${rowId}"]`);
    const nextActionAfter = page.locator(`[data-testid="next-action-${rowId}"]`);
    const notesAfter = page.locator(`[data-testid="notes-${rowId}"]`);
    const blockedAfter = page.locator(`[data-testid="blocked-${rowId}"]`);

    await expect(ownerAfter).toHaveValue(ownerValue);
    await expect(nextActionAfter).toHaveValue(nextActionValue);
    await expect(notesAfter).toHaveValue(notesValue);
    await expect(blockedAfter).toBeChecked();
  });
});
