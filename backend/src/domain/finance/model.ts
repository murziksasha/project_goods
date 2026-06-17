import mongoose from 'mongoose';

export const baseFinanceCurrency = 'UAH';
export const seededFinanceCurrencies = ['UAH', 'USD'] as const;
export type FinanceCurrency = string;

export const transactionTypes = ['deposit', 'withdraw', 'transfer'] as const;
export type TransactionType = (typeof transactionTypes)[number];
export const transactionStatuses = ['active', 'cancelled'] as const;
export type TransactionStatus = (typeof transactionStatuses)[number];

const defaultBalances = () => ({ UAH: 0, USD: 0 });
const defaultEnabledCurrencies = () => ({ UAH: true, USD: false });

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

export type FinanceTransactionDocument = mongoose.InferSchemaType<
  typeof financeTransactionSchema
> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const Cashbox = mongoose.model('Cashbox', cashboxSchema);
export const FinanceCurrencyConfig = mongoose.model(
  'FinanceCurrencyConfig',
  financeCurrencyConfigSchema,
);
export const FinanceTransaction = mongoose.model(
  'FinanceTransaction',
  financeTransactionSchema,
);
