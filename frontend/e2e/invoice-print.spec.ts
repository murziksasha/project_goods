import { expect, test } from '@playwright/test';
import type { Sale } from '../src/entities/sale';
import { e2eEmployee, installE2eApiMocks } from './helpers/mock-api';

const iso = '2026-11-07T09:00:00.000Z';

for (const composition of ['products', 'services', 'both', 'empty'] as const) {
  test(`invoice preview and print hide empty sections: ${composition}`, async ({ page }, testInfo) => {
    const kind = composition === 'services' || composition === 'both' ? 'repair' : 'sale';
    const lines: Sale['lineItems'] = [];
    if (composition === 'products' || composition === 'both') lines.push({ id: 'goods', kind: 'product', productId: 'stock-1', name: 'Adapter', quantity: 1, price: 200, warrantyPeriod: 0, serialNumbers: ['S000001'] });
    if (composition === 'services' || composition === 'both') lines.push({ id: 'work', kind: 'service', name: 'Diagnostics', quantity: 1, price: 100, warrantyPeriod: 0 });
    const sale: Sale = {
      id: 'invoice-record', recordNumber: kind === 'repair' ? 'r000171' : 's000171', kind,
      saleDate: iso, createdAt: iso, updatedAt: iso, quantity: 1,
      salePrice: lines.reduce((total, line) => total + line.price, 0),
      status: 'new', paidAmount: 0, note: '', timeline: [], paymentHistory: [], lineItems: lines,
      product: { id: '', name: 'Device', article: '', serialNumber: '' },
      client: { id: 'client-1', name: 'Invoice customer', phone: '+380991112233', status: 'new', address: 'Customer address' },
      manager: { id: e2eEmployee.id, name: e2eEmployee.name, role: 'owner' }, master: null, issuedBy: null,
    };
    await installE2eApiMocks(page);
    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      const json = (body: unknown) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
      if (url.pathname === '/api/sales') return json(url.searchParams.has('page') ? { items: [sale], total: 1, page: 1, pageSize: 30 } : [sale]);
      if (url.pathname === '/api/sales/invoice-record') return json(sale);
      if (url.pathname === '/api/employees') return json([e2eEmployee]);
      if (url.pathname === '/api/products') return json([{ id: 'stock-1', name: 'Adapter', article: 'AD', serialNumber: 'S000001', warehouseId: 'warehouse-1', price: 200, quantity: 1, isActive: true, salePriceOptions: [], note: '', purchasePlace: '', purchaseDate: iso, warrantyPeriod: 0, reservedQuantity: 0, freeQuantity: 1, isInStock: true, createdAt: iso, updatedAt: iso }]);
      if (url.pathname === '/api/warehouse-settings') return json({ id: 'warehouse-settings', serviceCenters: [{ id: 'center-1', name: 'Repair service', phone: '+380501234567', address: '', color: '' }], warehouses: [{ id: 'warehouse-1', name: 'Main warehouse', serviceCenterId: 'center-1', isActive: true, receiptAddress: '', receiptPhone: '', locations: [] }], administrators: [], createdAt: iso, updatedAt: iso });
      await route.fallback();
    });
    await page.addInitScript((employee) => {
      localStorage.setItem('project-goods.lang', 'en');
      localStorage.setItem('project-goods.auth-token', 'e2e-token');
      localStorage.setItem('project-goods.employee-snapshot', JSON.stringify(employee));
    }, e2eEmployee);
    await page.goto(`/?page=orders&ordersTab=${kind === 'repair' ? 'orders' : 'sales'}&saleId=${sale.id}`);
    await page.locator('.order-header-print-button').click();
    const dialog = page.locator('.order-print-dialog');
    await dialog.getByRole('checkbox', { name: 'Invoice without VAT', exact: true }).check();
    const preview = dialog.locator('.order-print-preview-page');
    await expect(preview).toContainText(`Invoice #${sale.recordNumber}`);
    await expect(preview).toContainText('+380501234567');
    await expect(preview).toContainText('Invoice customer');
    await expect(preview).toContainText('Without VAT');
    await expect(preview.getByRole('heading', { name: 'Products', exact: true })).toHaveCount(composition === 'products' || composition === 'both' ? 1 : 0);
    await expect(preview.getByRole('heading', { name: 'Services', exact: true })).toHaveCount(composition === 'services' || composition === 'both' ? 1 : 0);
    await expect(preview.locator('.print-line-table')).toHaveCount(lines.length);
    if (kind === 'repair') await expect(preview).toContainText(`Repair order #${sale.recordNumber}`);
    else await expect(preview).not.toContainText('Repair order #');

    const popupPromise = page.waitForEvent('popup');
    await dialog.getByRole('button', { name: 'Preview', exact: true }).click();
    const popup = await popupPromise;
    await expect(popup.locator('body')).toContainText(`Invoice #${sale.recordNumber}`);
    await expect(popup.locator('.print-line-table')).toHaveCount(lines.length);
    await expect(popup.locator('body')).not.toContainText(/No products|No services/);
    if (composition === 'both') await popup.screenshot({ path: testInfo.outputPath('invoice-with-products-and-services.png'), fullPage: true });
    await popup.close();

    // Built-in forms share the same visibility rule.
    await dialog.getByRole('checkbox', { name: 'Completion act', exact: true }).check();
    await expect(preview.locator('.print-line-table')).toHaveCount(lines.length);
    await expect(preview.getByRole('heading', { name: 'Products', exact: true })).toHaveCount(composition === 'products' || composition === 'both' ? 1 : 0);
    await expect(preview.getByRole('heading', { name: 'Services', exact: true })).toHaveCount(composition === 'services' || composition === 'both' ? 1 : 0);

    if (composition === 'both') {
      await page.goto('/?page=settings');
      await page.locator('#settings-tab-print').click();
      await page.locator('.settings-print-document-select select').selectOption('invoice-no-vat');
      const builderPreview = page.locator('.settings-print-preview-page');
      await expect(builderPreview).toContainText('Without VAT');
      await page.getByRole('button', { name: /invoice-no-vat-title/ }).click();
      await page.locator('.print-builder-block-editor input').fill('Payment invoice #{{orderNumber}}');
      await expect(builderPreview).toContainText('Payment invoice #r000124');
      await expect(builderPreview).toContainText('+38 067 000 00 00');
    }
  });
}
