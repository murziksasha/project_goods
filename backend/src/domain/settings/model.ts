import mongoose from 'mongoose';

export const defaultPrintForms = [
  {
    id: 'receipt',
    title: 'Receipt',
    type: 'receipt',
    content:
      'Receipt for order {{orderNumber}}\nClient: {{clientName}}\nPhone: {{clientPhone}}\nDevice: {{deviceName}}\nAmount: {{total}}',
    isActive: true,
    sortOrder: 10,
  },
  {
    id: 'check',
    title: 'Check',
    type: 'check',
    content:
      'Check\nOrder: {{orderNumber}}\nPaid: {{paid}}\nTo pay: {{toPay}}',
    isActive: true,
    sortOrder: 20,
  },
  {
    id: 'warranty',
    title: 'Warranty',
    type: 'warranty',
    content:
      'Warranty document\nDevice: {{deviceName}}\nS/N: {{serialNumber}}\nClient: {{clientName}}\nMaster: {{masterName}}',
    isActive: true,
    sortOrder: 30,
  },
  {
    id: 'completion-act',
    title: 'Completion act',
    type: 'completion-act',
    content:
      'Completion act\nOrder: {{orderNumber}}\nWork: {{note}}\nTotal: {{total}}',
    isActive: true,
    sortOrder: 40,
  },
  {
    id: 'invoice',
    title: 'Invoice',
    type: 'invoice',
    content:
      'Invoice for payment\nOrder: {{orderNumber}}\nClient: {{clientName}}\nTotal: {{total}}',
    isActive: true,
    sortOrder: 50,
  },
  {
    id: 'barcode',
    title: 'Barcode label',
    type: 'barcode',
    content: 'Barcode form\nOrder: {{orderNumber}}\nS/N: {{serialNumber}}',
    isActive: true,
    sortOrder: 60,
  },
];

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
      maxlength: 10000,
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
