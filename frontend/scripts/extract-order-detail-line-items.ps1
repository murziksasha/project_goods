$base = "f:\SSD PROJECT\project_goods\frontend\src\widgets\dashboard\ui"
$lines = Get-Content "$base\OrderDetailCard.tsx"
$header = @'
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Sale } from '../../../entities/sale/model/types';
import {
  createServiceCatalogItem,
  getServiceCatalogItems,
  updateServiceCatalogItem,
} from '../../../entities/service-catalog/api/serviceCatalogApi';
import type { ServiceCatalogItem } from '../../../entities/service-catalog/model/types';
import {
  initialServiceCatalogForm,
  toServiceCatalogForm,
} from '../../../entities/service-catalog/model/forms';
import { getProducts } from '../../../entities/product/api/productApi';
import { createSupplier, getSuppliers } from '../../../entities/supplier/api/supplierApi';
import type { Supplier, SupplierFormValues } from '../../../entities/supplier/model/types';
import type { SupplierOrderFormValues } from '../../../entities/supplier-order/model/types';
import { createSupplierOrder } from '../../../entities/supplier-order/api/supplierOrderApi';
import type { Product, ProductModelUpdatePayload } from '../../../entities/product/model/types';
import type { CatalogProduct } from '../../../entities/catalog-product/model/types';
import { getWarehouseSettings } from '../../../entities/warehouse-settings/api/warehouseSettingsApi';
import type { WarehouseItem } from '../../../entities/warehouse-settings/model/types';
import { NumberStepper } from '../../../shared/ui/NumberStepper';
import { parseDecimal } from '../../../shared/lib/decimal';
import { formatCurrency } from '../../../shared/lib/format';
import type { PrintForm } from '../../../entities/settings/model/types';
import { SupplierOrderModal, type SupplierOrderModalSubmitPayload } from './SupplierOrderModal';
import { ProductModelModal } from './ProductModelModal';
import { SerialBindModal } from './SerialBindModal';
import { buildCreateOrderProductSuggestions } from '../model/create-order-products';
import { buildMissingServicePayload, shouldCreateMissingServiceOnSubmit } from '../model/missingService';
import { canRemoveLineItemAfterPayment } from '../model/line-item-ops';
import {
  buildSerializedProductLineItem,
  getProductSerialAvailability,
  getSaleSerialUsage,
  normalizeSerialNumber,
  type ProductSerialAvailability,
  type SerialUsage,
} from '../model/order-line-serials';
import {
  getDiscount,
  getWarrantyOptions,
  isProductAvailableForOrder,
  normalizeProductLookupValue,
  stockLockedRepairStatuses,
  withSupplierOrderLinkNote,
  type OrderLineItem,
  type OrderLineItemKind,
  type OrderStatus,
  type RepairStatus,
} from './orders-workspace-shared';
import { OrderDetailCatalogServiceEditorModal } from './OrderDetailCatalogServiceEditorModal';

'@
$body = $lines[1684..3083]
$body = $body -replace '^type LineItemsPanelProps', 'export type OrderDetailLineItemsPanelProps'
$body = $body -replace '^const LineItemsPanel =', 'export const OrderDetailLineItemsPanel ='
$body = $body -replace 'CatalogServiceEditorModal', 'OrderDetailCatalogServiceEditorModal'
$content = $header + ($body -join "`n")
Set-Content -Path "$base\OrderDetailLineItemsPanel.tsx" -Value $content -Encoding UTF8
Write-Output "Wrote OrderDetailLineItemsPanel.tsx"