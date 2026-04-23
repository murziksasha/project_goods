import mongoose from 'mongoose';

export const financeCurrencies = ['UAH', 'USD'] as const;
export type FinanceCurrency = (typeof financeCurrencies)[number];

export const transactionTypes = ['deposit', 'withdraw', 'transfer'] as const;
export type TransactionType = (typeof transactionTypes)[number];

const balancesSchema = new mongoose.Schema(
  {
    UAH: { type: Number, required: true, default: 0, min: 0 },
    USD: { type: Number, required: true, default: 0, min: 0 },
  },
  { _id: false },
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
      type: balancesSchema,
      required: true,
      default: () => ({ UAH: 0, USD: 0 }),
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
      enum: financeCurrencies,
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
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export type CashboxDocument = mongoose.InferSchemaType<typeof cashboxSchema> & {
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
export const FinanceTransaction = mongoose.model(
  'FinanceTransaction',
  financeTransactionSchema,
);
