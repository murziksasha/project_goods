import mongoose from 'mongoose';

export const baseFinanceCurrency = 'UAH';
export const seededFinanceCurrencies = ['UAH', 'USD'] as const;
export type FinanceCurrency = string;

export const transactionTypes = ['deposit', 'withdraw', 'transfer'] as const;
export type TransactionType = (typeof transactionTypes)[number];
export const transactionStatuses = ['active', 'cancelled'] as const;
export type TransactionStatus = (typeof transactionStatuses)[number];
export const financeTransactionCategories = [
  'client_payment',
  'client_refund',
  'supplier_payment',
  'rent',
  'salary',
  'utilities',
  'tax',
  'owner_draw',
  'other',
] as const;
export type FinanceTransactionCategory =
  (typeof financeTransactionCategories)[number];
export const financeCategoryKinds = [
  'system_auto',
  'system_opex',
  'custom_opex',
] as const;
export type FinanceCategoryKind = (typeof financeCategoryKinds)[number];
export const OTHER_CATEGORY_SLUG = 'other';
export const customFinanceCategorySlugPattern = /^c_[a-f0-9]{24}$/i;

export const serviceProfitModes = ['full', 'revenue_only', 'exclude'] as const;
export type ServiceProfitMode = (typeof serviceProfitModes)[number];

export const financePolicyReportPeriods = [
  'last30',
  'whole',
  'day',
  'week',
  'month',
  'year',
] as const;
export type FinancePolicyReportPeriod =
  (typeof financePolicyReportPeriods)[number];

export const financePolicyReportSources = ['all', 'sales', 'services'] as const;
export type FinancePolicyReportSource =
  (typeof financePolicyReportSources)[number];

const defaultBalances = () => ({ UAH: 0, USD: 0 });
const defaultEnabledCurrencies = () => ({ UAH: true, USD: false });

export const financeCategorySchema = new mongoose.Schema(
  {
    slug: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: [80, 'Category name must contain no more than 80 characters'],
    },
    isSystem: {
      type: Boolean,
      required: true,
      default: false,
    },
    kind: {
      type: String,
      enum: financeCategoryKinds,
      required: true,
      index: true,
    },
    isActive: {
      type: Boolean,
      required: true,
      default: true,
      index: true,
    },
    sortOrder: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export const financeCurrencyConfigSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      minlength: 3,
      maxlength: 6,
      unique: true,
      index: true,
    },
    isSystem: {
      type: Boolean,
      required: true,
      default: false,
    },
    isArchived: {
      type: Boolean,
      required: true,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export const cashboxSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Cashbox name is required'],
      trim: true,
      maxlength: [80, 'Cashbox name must contain no more than 80 characters'],
      unique: true,
    },
    balances: {
      type: Map,
      of: { type: Number, min: 0 },
      required: true,
      default: defaultBalances,
    },
    enabledCurrencies: {
      type: Map,
      of: Boolean,
      required: true,
      default: defaultEnabledCurrencies,
    },
    isDefault: {
      type: Boolean,
      required: true,
      default: false,
      index: true,
    },
    isNonCash: {
      type: Boolean,
      required: true,
      default: false,
      index: true,
    },
    isArchived: {
      type: Boolean,
      required: true,
      default: false,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export const financeTransactionSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: transactionTypes,
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [0.01, 'Transaction amount must be greater than 0'],
    },
    currency: {
      type: String,
      trim: true,
      uppercase: true,
      required: true,
    },
    fromCashbox: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Cashbox',
      default: null,
      index: true,
    },
    toCashbox: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Cashbox',
      default: null,
      index: true,
    },
    note: {
      type: String,
      trim: true,
      maxlength: [300, 'Transaction note must contain no more than 300 characters'],
      default: '',
    },
    category: {
      type: String,
      required: false,
      default: undefined,
      index: true,
      trim: true,
    },
    transactionDate: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    fromSnapshot: {
      name: { type: String, required: false },
    },
    toSnapshot: {
      name: { type: String, required: false },
    },
    status: {
      type: String,
      enum: transactionStatuses,
      required: true,
      default: 'active',
      index: true,
    },
    isCancellation: {
      type: Boolean,
      required: true,
      default: false,
      index: true,
    },
    cancelsTransaction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FinanceTransaction',
      default: null,
      index: true,
    },
    cancellationTransaction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FinanceTransaction',
      default: null,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    idempotencyKey: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// Unique partial index: prevents duplicate submissions for the same non-empty idempotencyKey
// while allowing many docs with empty/default key.
financeTransactionSchema.index(
  { idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: { idempotencyKey: { $gt: '' } },
    name: 'idempotencyKey_unique_partial',
  },
);

financeTransactionSchema.index(
  { cancelsTransaction: 1 },
  {
    unique: true,
    partialFilterExpression: { cancelsTransaction: { $ne: null } },
    name: 'cancelsTransaction_unique_partial',
  },
);

financeTransactionSchema.index({ category: 1, transactionDate: 1 });

export const financePolicySchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      default: 'default',
      unique: true,
      index: true,
    },
    serviceAuditEnabled: {
      type: Boolean,
      required: true,
      default: false,
    },
    serviceProfitMode: {
      type: String,
      enum: serviceProfitModes,
      required: true,
      default: 'full',
    },
    reportDefaults: {
      type: new mongoose.Schema(
        {
          period: {
            type: String,
            enum: financePolicyReportPeriods,
            required: true,
            default: 'last30',
          },
          source: {
            type: String,
            enum: financePolicyReportSources,
            required: true,
            default: 'all',
          },
          showCharts: {
            type: Boolean,
            required: true,
            default: true,
          },
          showTable: {
            type: Boolean,
            required: true,
            default: true,
          },
        },
        { _id: false },
      ),
      required: true,
      default: () => ({
        period: 'last30',
        source: 'all',
        showCharts: true,
        showTable: true,
      }),
    },
    version: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
    },
    updatedById: {
      type: String,
      required: false,
      default: null,
    },
    updatedByName: {
      type: String,
      required: false,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

const financePolicySnapshotSchema = new mongoose.Schema(
  {
    serviceAuditEnabled: { type: Boolean, required: true },
    serviceProfitMode: {
      type: String,
      enum: serviceProfitModes,
      required: true,
    },
    reportDefaults: {
      type: new mongoose.Schema(
        {
          period: {
            type: String,
            enum: financePolicyReportPeriods,
            required: true,
          },
          source: {
            type: String,
            enum: financePolicyReportSources,
            required: true,
          },
          showCharts: { type: Boolean, required: true },
          showTable: { type: Boolean, required: true },
        },
        { _id: false },
      ),
      required: true,
    },
  },
  { _id: false },
);

export const financePolicyAuditLogSchema = new mongoose.Schema(
  {
    policyKey: {
      type: String,
      required: true,
      default: 'default',
      index: true,
    },
    previousVersion: {
      type: Number,
      required: true,
      min: 1,
    },
    version: {
      type: Number,
      required: true,
      min: 1,
      index: true,
    },
    changedFields: {
      type: [String],
      required: true,
      default: [],
    },
    previous: {
      type: financePolicySnapshotSchema,
      required: true,
    },
    next: {
      type: financePolicySnapshotSchema,
      required: true,
    },
    reason: {
      type: String,
      trim: true,
      maxlength: [300, 'Policy change reason must contain no more than 300 characters'],
      default: '',
    },
    authorId: {
      type: String,
      required: false,
      default: null,
    },
    authorName: {
      type: String,
      required: true,
      default: 'System',
    },
    changedAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false,
    versionKey: false,
  },
);

financePolicyAuditLogSchema.index({ policyKey: 1, changedAt: -1, version: -1 });

for (const hook of [
  'updateOne',
  'updateMany',
  'findOneAndUpdate',
  'deleteOne',
  'deleteMany',
  'findOneAndDelete',
] as const) {
  financePolicyAuditLogSchema.pre(hook, function () {
    throw new Error('FinancePolicyAuditLog is immutable and cannot be modified or deleted.');
  });
}

export type CashboxDocument = mongoose.InferSchemaType<typeof cashboxSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export type FinanceCurrencyConfigDocument = mongoose.InferSchemaType<
  typeof financeCurrencyConfigSchema
> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export type FinanceCategoryDocument = mongoose.InferSchemaType<
  typeof financeCategorySchema
> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export type FinanceTransactionDocument = mongoose.InferSchemaType<
  typeof financeTransactionSchema
> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export type FinancePolicyDocument = mongoose.InferSchemaType<
  typeof financePolicySchema
> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export type FinancePolicyAuditLogDocument = mongoose.InferSchemaType<
  typeof financePolicyAuditLogSchema
> & {
  _id: mongoose.Types.ObjectId;
};

export const Cashbox = mongoose.model('Cashbox', cashboxSchema);
export const FinanceCurrencyConfig = mongoose.model(
  'FinanceCurrencyConfig',
  financeCurrencyConfigSchema,
);
export const FinanceCategory = mongoose.model(
  'FinanceCategory',
  financeCategorySchema,
);
export const FinanceTransaction = mongoose.model(
  'FinanceTransaction',
  financeTransactionSchema,
);
export const FinancePolicy = mongoose.model(
  'FinancePolicy',
  financePolicySchema,
);
export const FinancePolicyAuditLog = mongoose.model(
  'FinancePolicyAuditLog',
  financePolicyAuditLogSchema,
);
