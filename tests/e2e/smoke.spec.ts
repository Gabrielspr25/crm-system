import { expect, test } from '@playwright/test';

const apiURL = process.env.E2E_API_URL || 'http://localhost:3001/api';

test('backend health endpoint responds', async ({ request }) => {
  const response = await request.get(`${apiURL}/health`);
  const data = await response.json();

  expect(response.ok()).toBeTruthy();
  expect(data).toEqual(expect.objectContaining({ status: 'OK' }));
});

test('frontend renders the CRM entry screen', async ({ page }) => {
  await page.goto('/login');

  await expect(page).toHaveTitle(/Ventas|CRM|Mocha/i);
  await expect(page.getByText('VentasPro')).toBeVisible();
});
