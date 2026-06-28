import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UI_ROOT = path.resolve(__dirname, '../src/widgets/dashboard/ui');
const SRC_ROOT = path.resolve(__dirname, '../src');

const MOVES = {
  'AccountingCashboxesView.tsx': 'accounting/AccountingCashboxesView.tsx',
  'AccountingCashboxesView.test.tsx': 'accounting/AccountingCashboxesView.test.tsx',
  'AccountingConfirmModals.tsx': 'accounting/AccountingConfirmModals.tsx',
  'AccountingFinanceSettings.tsx': 'accounting/AccountingFinanceSettings.tsx',
  'AccountingPanel.tsx': 'accounting/AccountingPanel.tsx',
  'AccountingPanel.test.tsx': 'accounting/AccountingPanel.test.tsx',
  'AccountingReportsView.tsx': 'accounting/AccountingReportsView.tsx',
  'AccountingSupplierOrdersQueue.tsx': 'accounting/AccountingSupplierOrdersQueue.tsx',
  'AccountingTabs.tsx': 'accounting/AccountingTabs.tsx',
  'AccountingTransactionsView.tsx': 'accounting/AccountingTransactionsView.tsx',
  'useAccountingFinanceData.ts': 'accounting/useAccountingFinanceData.ts',
  'useAccountingFinanceData.test.tsx': 'accounting/useAccountingFinanceData.test.tsx',
  'useAccountingPreferences.ts': 'accounting/useAccountingPreferences.ts',
  'useAccountingPreferences.test.tsx': 'accounting/useAccountingPreferences.test.tsx',
  'useFinanceAction.ts': 'accounting/useFinanceAction.ts',
  'useTransactionFilters.ts': 'accounting/useTransactionFilters.ts',
  'useTransactionForm.ts': 'accounting/useTransactionForm.ts',

  'AnalyticsDateFilterPanel.tsx': 'analytics/AnalyticsDateFilterPanel.tsx',
  'AnalyticsHeroSection.tsx': 'analytics/AnalyticsHeroSection.tsx',
  'SalesPanel.tsx': 'analytics/SalesPanel.tsx',

  'ClientCardModal.tsx': 'clients/ClientCardModal.tsx',
  'ClientCreateModal.tsx': 'clients/ClientCreateModal.tsx',
  'ClientHistoryPanel.tsx': 'clients/ClientHistoryPanel.tsx',
  'ClientMergeModal.tsx': 'clients/ClientMergeModal.tsx',
  'ClientPanel.tsx': 'clients/ClientPanel.tsx',
  'ClientsFilterPanel.tsx': 'clients/ClientsFilterPanel.tsx',
  'ClientsSuppliersWorkspace.tsx': 'clients/ClientsSuppliersWorkspace.tsx',
  'ClientsSuppliersWorkspace.test.tsx': 'clients/ClientsSuppliersWorkspace.test.tsx',
  'ClientsTable.tsx': 'clients/ClientsTable.tsx',
  'ClientsTable.test.tsx': 'clients/ClientsTable.test.tsx',
  'ClientsToolbar.tsx': 'clients/ClientsToolbar.tsx',
  'ClientsWorkspace.tsx': 'clients/ClientsWorkspace.tsx',
  'ClientsWorkspace.test.tsx': 'clients/ClientsWorkspace.test.tsx',

  'OrdersWorkspace.tsx': 'orders/workspace/OrdersWorkspace.tsx',
  'OrdersWorkspace.test.tsx': 'orders/workspace/OrdersWorkspace.test.tsx',
  'orders-workspace-shared.ts': 'orders/workspace/orders-workspace-shared.ts',
  'orders-workspace-shared.test.tsx': 'orders/workspace/orders-workspace-shared.test.tsx',
  'SavedFiltersPanel.tsx': 'orders/workspace/SavedFiltersPanel.tsx',

  'CreateOrderCard.tsx': 'orders/create-order/CreateOrderCard.tsx',
  'CreateOrderCard.test.tsx': 'orders/create-order/CreateOrderCard.test.tsx',
  'create-order-card-shared.ts': 'orders/create-order/create-order-card-shared.ts',
  'CreateOrderDeviceModal.tsx': 'orders/create-order/CreateOrderDeviceModal.tsx',
  'CreateOrderRepairSection.tsx': 'orders/create-order/CreateOrderRepairSection.tsx',
  'CreateOrderSaleSection.tsx': 'orders/create-order/CreateOrderSaleSection.tsx',
  'CreateOrderSidePanel.tsx': 'orders/create-order/CreateOrderSidePanel.tsx',
  'RapidSaleModal.tsx': 'orders/create-order/RapidSaleModal.tsx',
  'RapidSaleModal.test.tsx': 'orders/create-order/RapidSaleModal.test.tsx',

  'OrderDetailCard.tsx': 'orders/order-detail/OrderDetailCard.tsx',
  'OrderDetailCard.test.tsx': 'orders/order-detail/OrderDetailCard.test.tsx',
  'order-detail-card-types.ts': 'orders/order-detail/order-detail-card-types.ts',
  'order-detail-shared.ts': 'orders/order-detail/order-detail-shared.ts',
  'OrderDetailCatalogServiceEditorModal.tsx': 'orders/order-detail/OrderDetailCatalogServiceEditorModal.tsx',
  'OrderDetailDeviceModal.tsx': 'orders/order-detail/OrderDetailDeviceModal.tsx',
  'OrderDetailLineItemsPanel.tsx': 'orders/order-detail/OrderDetailLineItemsPanel.tsx',

  'OrderPaymentModals.tsx': 'orders/modals/OrderPaymentModals.tsx',
  'OrderPrintDialog.tsx': 'orders/modals/OrderPrintDialog.tsx',
  'SerialBindModal.tsx': 'orders/modals/SerialBindModal.tsx',
  'SerialBindModal.test.tsx': 'orders/modals/SerialBindModal.test.tsx',
  'SupplierOrderModal.tsx': 'orders/modals/SupplierOrderModal.tsx',
  'ProductModelModal.tsx': 'orders/modals/ProductModelModal.tsx',
  'ProductModelModal.test.tsx': 'orders/modals/ProductModelModal.test.tsx',
  'PrinterIcon.tsx': 'orders/modals/PrinterIcon.tsx',

  'ProductCatalogModals.tsx': 'product-catalog/ProductCatalogModals.tsx',
  'ProductCatalogPanel.tsx': 'product-catalog/ProductCatalogPanel.tsx',
  'ProductCatalogPanel.test.tsx': 'product-catalog/ProductCatalogPanel.test.tsx',
  'product-catalog-shared.tsx': 'product-catalog/product-catalog-shared.tsx',
  'ProductCatalogTables.tsx': 'product-catalog/ProductCatalogTables.tsx',

  'SettingsPanel.tsx': 'settings/SettingsPanel.tsx',
  'SettingsPanel.test.tsx': 'settings/SettingsPanel.test.tsx',
  'PrintFormBuilder.tsx': 'settings/PrintFormBuilder.tsx',
  'EmployeeManagementPanel.tsx': 'settings/EmployeeManagementPanel.tsx',
  'EmployeeManagementPanel.test.tsx': 'settings/EmployeeManagementPanel.test.tsx',

  'SupplierOrdersWorkspace.tsx': 'supplier-orders/SupplierOrdersWorkspace.tsx',
  'SupplierOrdersWorkspaceSections.tsx': 'supplier-orders/SupplierOrdersWorkspaceSections.tsx',
  'SupplierOrdersWorkspaceSections.test.tsx': 'supplier-orders/SupplierOrdersWorkspaceSections.test.tsx',

  'WarehouseInformationPanel.tsx': 'warehouse/WarehouseInformationPanel.tsx',
  'WarehouseModalShell.tsx': 'warehouse/WarehouseModalShell.tsx',
  'WarehousePanel.tsx': 'warehouse/WarehousePanel.tsx',
  'WarehouseSelectField.tsx': 'warehouse/WarehouseSelectField.tsx',
  'WarehouseSettingsModals.tsx': 'warehouse/WarehouseSettingsModals.tsx',
  'WarehouseSettingsSection.tsx': 'warehouse/WarehouseSettingsSection.tsx',
  'WarehouseTables.tsx': 'warehouse/WarehouseTables.tsx',
  'WarehouseTables.test.tsx': 'warehouse/WarehouseTables.test.tsx',
  'WarehouseToolbar.tsx': 'warehouse/WarehouseToolbar.tsx',
  'WarehouseToolbar.test.tsx': 'warehouse/WarehouseToolbar.test.tsx',
  'WarehouseTransferWorkspace.tsx': 'warehouse/WarehouseTransferWorkspace.tsx',

  'MarketWeatherLoader.tsx': 'weather/MarketWeatherLoader.tsx',
  'MarketWeatherSettingsDrawer.tsx': 'weather/MarketWeatherSettingsDrawer.tsx',
  'MarketWeatherWidget.tsx': 'weather/MarketWeatherWidget.tsx',
  'MarketWeatherWidget.test.tsx': 'weather/MarketWeatherWidget.test.tsx',
  'WeatherAnimatedScene.tsx': 'weather/WeatherAnimatedScene.tsx',
  'WeatherAnimatedScene.test.tsx': 'weather/WeatherAnimatedScene.test.tsx',
  'WeatherSceneSkyFallback.tsx': 'weather/WeatherSceneSkyFallback.tsx',
  'WeatherSunGraphic.tsx': 'weather/WeatherSunGraphic.tsx',
  'WeatherVisual.tsx': 'weather/WeatherVisual.tsx',
  'WeatherVisual.test.tsx': 'weather/WeatherVisual.test.tsx',

  'weather-scene/WeatherSceneClouds.tsx': 'weather/scene/WeatherSceneClouds.tsx',
  'weather-scene/WeatherSceneFog.tsx': 'weather/scene/WeatherSceneFog.tsx',
  'weather-scene/WeatherSceneLightning.tsx': 'weather/scene/WeatherSceneLightning.tsx',
  'weather-scene/WeatherSceneRain.tsx': 'weather/scene/WeatherSceneRain.tsx',
  'weather-scene/WeatherSceneSky.tsx': 'weather/scene/WeatherSceneSky.tsx',
  'weather-scene/WeatherSceneSnow.tsx': 'weather/scene/WeatherSceneSnow.tsx',
  'weather-scene/WeatherSceneWindStreaks.tsx': 'weather/scene/WeatherSceneWindStreaks.tsx',

  'PhoneNumber.tsx': 'shared/PhoneNumber.tsx',
  'Notifications.tsx': 'shared/Notifications.tsx',
  'Notifications.test.tsx': 'shared/Notifications.test.tsx',
};

const MODULE_TO_PATH = new Map();
for (const [from, to] of Object.entries(MOVES)) {
  const base = path.basename(from).replace(/\.(tsx?)$/, '');
  MODULE_TO_PATH.set(base, to.replace(/\.(tsx?)$/, ''));
}

function depthUnderUi(relativePath) {
  const dir = path.dirname(relativePath);
  if (dir === '.') return 0;
  return dir.split(/[/\\]/).length;
}

function srcPrefix(relativePath) {
  return '../'.repeat(3 + depthUnderUi(relativePath));
}

function modelPrefix(relativePath) {
  return '../'.repeat(1 + depthUnderUi(relativePath));
}

function moveFiles() {
  for (const [from, to] of Object.entries(MOVES)) {
    const source = path.join(UI_ROOT, from);
    const target = path.join(UI_ROOT, to);
    if (!fs.existsSync(source)) {
      console.warn(`Skip missing: ${from}`);
      continue;
    }
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.renameSync(source, target);
    console.log(`Moved ${from} -> ${to}`);
  }
  const weatherSceneDir = path.join(UI_ROOT, 'weather-scene');
  if (fs.existsSync(weatherSceneDir)) {
    fs.rmdirSync(weatherSceneDir);
  }
}

function fixDepthImports(content, relativePath) {
  const entity = srcPrefix(relativePath) + 'entities';
  const shared = srcPrefix(relativePath) + 'shared';
  const model = modelPrefix(relativePath) + 'model';

  let next = content
    .replace(/from ['"](?:\.\.\/)+entities/g, `from '${entity}`)
    .replace(/from ['"](?:\.\.\/)+shared/g, `from '${shared}`)
    .replace(/from ['"](?:\.\.\/)+model/g, `from '${model}`);

  return next;
}

function resolveRelativeImport(fromFile, spec) {
  if (!spec.startsWith('.')) return spec;
  const fromDir = path.dirname(fromFile);
  const target = path.resolve(fromDir, spec);
  return target;
}

function toImportPath(fromFile, targetFile) {
  let rel = path.relative(path.dirname(fromFile), targetFile).replace(/\\/g, '/');
  if (!rel.startsWith('.')) rel = `./${rel}`;
  return rel.replace(/\.tsx?$/, '');
}

function fixRelativeImports(content, currentFile) {
  return content.replace(
    /from ['"](\.[^'"]+)['"]/g,
    (match, spec) => {
      if (!spec.startsWith('.')) return match;
      const resolved = resolveRelativeImport(currentFile, spec);
      const base = path.basename(resolved).replace(/\.(tsx?)$/, '');
      const mapped = MODULE_TO_PATH.get(base);
      if (!mapped) return match;
      const target = path.join(UI_ROOT, mapped);
      const extensions = ['.tsx', '.ts'];
      let targetFile = null;
      for (const ext of extensions) {
        const candidate = target + ext;
        if (fs.existsSync(candidate)) {
          targetFile = candidate;
          break;
        }
      }
      if (!targetFile) return match;
      const newSpec = toImportPath(currentFile, targetFile);
      return `from '${newSpec}'`;
    },
  );
}

function fixAbsoluteUiImports(content) {
  let next = content;
  for (const [from, to] of Object.entries(MOVES)) {
    const modulePath = from.replace(/\.(tsx?)$/, '');
    const newPath = to.replace(/\.(tsx?)$/, '');
    const patterns = [
      `widgets/dashboard/ui/${modulePath}`,
      `widgets/dashboard/ui/${modulePath.replace('weather-scene/', 'weather/scene/')}`,
    ];
    for (const pattern of patterns) {
      next = next.split(pattern).join(`widgets/dashboard/ui/${newPath}`);
    }
  }
  return next;
}

function fixWeatherSceneImports(content) {
  return content.replace(/weather-scene\//g, 'weather/scene/');
}

function processFile(filePath) {
  const rel = path.relative(UI_ROOT, filePath).replace(/\\/g, '/');
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;
  if (filePath.includes(`${path.sep}widgets${path.sep}dashboard${path.sep}ui${path.sep}`)) {
    content = fixDepthImports(content, rel);
    content = fixRelativeImports(content, filePath);
    content = fixWeatherSceneImports(content);
  }
  content = fixAbsoluteUiImports(content);
  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
  }
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(tsx?)$/.test(entry.name)) processFile(full);
  }
}

moveFiles();
walk(SRC_ROOT);
console.log('Reorganization complete.');