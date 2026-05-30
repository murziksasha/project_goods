import mongoose from 'mongoose';

export const defaultPrintForms = [
  {
    id: 'receipt',
    title: 'Квитанція',
    type: 'receipt',
    content:
      '<div class="print-document"><div class="print-header print-header-right"><div><h2>{{company}}</h2><p>{{warehouse_address}} {{warehouse_phone}}</p></div></div><div class="print-title-row"><h1>Квитанція №{{orderNumber}} від {{date}}</h1><div>{{barcode}}</div></div><table class="print-details-table"><tbody><tr><td>Вид ремонту:</td><td><strong>{{comment}}</strong></td><td>Пристрій:</td><td><strong>{{deviceName}}</strong></td></tr><tr><td>Замовник:</td><td><strong>{{clientName}}</strong></td><td>Серійний №:</td><td><strong>{{serialNumber}}</strong></td></tr><tr><td>Контактні дані:</td><td><strong>{{clientPhone}}</strong></td><td>Артикул:</td><td><strong>{{article}}</strong></td></tr><tr><td>Заявлена несправність:</td><td><strong>{{defect}}</strong></td><td>Передплата:</td><td><strong>{{paid}}</strong></td></tr><tr><td>Орієнтована вартість:</td><td><strong>{{total}}</strong></td><td>До сплати:</td><td><strong>{{toPay}}</strong></td></tr></tbody></table><ol class="print-terms"><li>Сервісний центр не несе відповідальності за втрату даних в пам&apos;яті пристрою.</li><li>Термін діагностики - від 1 до 3-х днів.</li><li>Гарантія поширюється на виконані роботи та встановлені деталі.</li></ol><div class="print-signatures"><span>Прийняв: {{managerName}}</span><span>Клієнт: __________________</span></div></div>',
    contentFormat: 'html',
    pageSize: 'A4',
    orientation: 'portrait',
    isActive: true,
    sortOrder: 10,
  },
  {
    id: 'check',
    title: 'Чек',
    type: 'check',
    content:
      '<div class="print-document"><h1>Чек оплати</h1><table class="print-summary-table"><tbody><tr><td>Замовлення</td><td>{{orderNumber}}</td></tr><tr><td>Клієнт</td><td>{{clientName}}</td></tr><tr><td>Пристрій</td><td>{{deviceName}}</td></tr><tr><td>Сума</td><td><strong>{{total}}</strong></td></tr><tr><td>Сплачено</td><td><strong>{{paid}}</strong></td></tr><tr><td>До сплати</td><td><strong>{{toPay}}</strong></td></tr></tbody></table><div class="print-code-row">{{qrcode}}{{barcode}}</div></div>',
    contentFormat: 'html',
    pageSize: 'A4',
    orientation: 'portrait',
    isActive: true,
    sortOrder: 20,
  },
  {
    id: 'warranty',
    title: 'Гарантійний талон',
    type: 'warranty',
    content:
      '<div class="print-document"><h1>Гарантійний талон</h1><p>Замовлення №{{orderNumber}} від {{date}}</p><p><strong>Клієнт:</strong> {{clientName}}</p><p><strong>Пристрій:</strong> {{deviceName}} {{serialNumber}}</p><p><strong>Майстер:</strong> {{masterName}}</p><p>Гарантія діє за умови відсутності механічних пошкоджень та слідів стороннього втручання.</p><div class="print-signatures"><span>Сервіс: __________________</span><span>Клієнт: __________________</span></div></div>',
    contentFormat: 'html',
    pageSize: 'A4',
    orientation: 'portrait',
    isActive: true,
    sortOrder: 30,
  },
  {
    id: 'completion-act',
    title: 'Акт виконаних робіт',
    type: 'completion-act',
    content:
      '<div class="print-document"><h1>Акт виконаних робіт №{{orderNumber}}</h1><p>Дата: {{date}}</p><p><strong>Клієнт:</strong> {{clientName}}, {{clientPhone}}</p><p><strong>Пристрій:</strong> {{deviceName}} {{serialNumber}}</p><h3>Виконані роботи</h3>{{services_table}}<h3>Встановлені товари</h3>{{products_table}}<p class="print-total-line">Разом: <strong>{{total}}</strong></p><div class="print-signatures"><span>Виконавець: {{masterName}}</span><span>Замовник: __________________</span></div></div>',
    contentFormat: 'html',
    pageSize: 'A4',
    orientation: 'portrait',
    isActive: true,
    sortOrder: 40,
  },
  {
    id: 'invoice',
    title: 'Рахунок',
    type: 'invoice',
    content:
      '<div class="print-document"><div class="invoice-party"><strong>Постачальник</strong><div><b>{{company}}</b><br>Адреса: {{company_address}}<br>ЄДРПОУ або ІПН: {{company_id}}<br>не є платником податку на прибуток на загальних умовах<br><b>Р/р {{company_iban}}</b></div></div><div class="invoice-party"><strong>Одержувач</strong><div><b>{{clientName}}</b><br>ЄДРПОУ або ІПН: {{customer_reg_id}}<br>{{clientPhone}}<br>{{warehouse_address}}</div></div><div class="invoice-title"><h1>Рахунок фактура № {{orderNumber}}</h1><p>від {{date}} р.</p></div>{{invoice_items_table}}<table class="invoice-totals"><tbody><tr><td>Разом без ПДВ:</td><td>{{net_amount}}</td></tr><tr><td>ПДВ:</td><td>{{vat_amount}}</td></tr><tr><td>Всього з ПДВ:</td><td>{{total_amount}}</td></tr></tbody></table><div class="invoice-written"><p>Всього на суму: <strong>{{total_written}}</strong></p><p>ПДВ: {{vat_amount}}</p></div><div class="invoice-payable"><strong>Загальна сума до оплати:</strong><strong>{{total_amount}}</strong></div><div class="invoice-signature"><strong><em>{{seller_occupation}}</em></strong><span></span><strong><em>{{seller_name}}</em></strong></div><p class="invoice-note"><strong>{{note_label}}:</strong> {{note}}</p></div>',
    contentFormat: 'html',
    pageSize: 'A4',
    orientation: 'portrait',
    isActive: true,
    sortOrder: 50,
  },
  {
    id: 'barcode',
    title: 'Штрих-код',
    type: 'barcode',
    content:
      '<div class="print-label"><div class="print-label-code">{{barcode}}</div><strong>{{orderNumber}}</strong><span>{{clientPhone}}</span><span>{{deviceName}}</span></div>',
    contentFormat: 'html',
    pageSize: 'label',
    orientation: 'portrait',
    isActive: true,
    sortOrder: 60,
  },
];

export const legacyDefaultPrintFormTitles = new Set([
  'Receipt',
  'Check',
  'Warranty',
  'Completion act',
  'Invoice',
  'Barcode label',
]);

const printFormSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, trim: true },
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 120,
    },
    type: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
      default: 'custom',
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 30000,
    },
    contentFormat: {
      type: String,
      enum: ['html', 'text'],
      default: 'text',
    },
    pageSize: {
      type: String,
      enum: ['A4', 'label'],
      default: 'A4',
    },
    orientation: {
      type: String,
      enum: ['portrait', 'landscape'],
      default: 'portrait',
    },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { _id: false },
);

export const settingsSchema = new mongoose.Schema(
  {
    serviceName: {
      type: String,
      required: [true, 'Service name is required'],
      trim: true,
      minlength: [2, 'Service name must contain at least 2 characters'],
      maxlength: [120, 'Service name must contain no more than 120 characters'],
      default: 'Service CRM',
    },
    company: {
      type: String,
      trim: true,
      default: 'Service CRM',
    },
    companyAddress: {
      type: String,
      trim: true,
      default: '',
    },
    companyId: {
      type: String,
      trim: true,
      default: '',
    },
    companyIban: {
      type: String,
      trim: true,
      default: '',
    },
    printForms: {
      type: [printFormSchema],
      default: () => defaultPrintForms,
    },
    orderDefaults: {
      defaultRepairTermDays: { type: Number, min: 0, default: 7 },
      defaultWarrantyMonths: { type: Number, min: 0, default: 1 },
      defaultRepairStatus: { type: String, trim: true, default: 'new' },
      defaultSaleStatus: { type: String, trim: true, default: 'new' },
    },
    numbering: {
      repairPrefix: { type: String, trim: true, default: 'r' },
      salePrefix: { type: String, trim: true, default: 's' },
      supplierOrderPrefix: { type: String, trim: true, default: 'SO' },
      nextRepairNumber: { type: Number, min: 1, default: 1 },
      nextSaleNumber: { type: Number, min: 1, default: 1 },
      nextSupplierOrderNumber: { type: Number, min: 1, default: 1 },
    },
    financeDefaults: {
      currency: { type: String, trim: true, uppercase: true, default: 'UAH' },
      paymentMethod: {
        type: String,
        enum: ['cash', 'non-cash'],
        default: 'cash',
      },
    },
    notificationSettings: {
      smsEnabled: { type: Boolean, default: false },
      messengerEnabled: { type: Boolean, default: false },
      emailEnabled: { type: Boolean, default: false },
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export type SettingsDocument = mongoose.InferSchemaType<typeof settingsSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const Settings = mongoose.model('Settings', settingsSchema);
