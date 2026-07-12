import mongoose from 'mongoose';
import { applySupplierOrderFinancialTotals } from './totals';

export const supplierOrderStatuses = [
  'request',
  'ordered',
  'approved',
  'partially_stocked',
  'partially_completed',
  'stocked',
  'overdue',
  'cancelled',
  'unavailable',
] as const;

export const supplierPaymentStatuses = ['pending', 'paid', 'without_payment', 'cancelled'] as const;
export const receiptStatuses = ['new', 'approved', 'received', 'cancelled'] as const;

const supplierOrderItemSchema = new mongoose.Schema(
  {
    lineId: { type: String, required: true, trim: true },
    itemIndex: { type: Number, required: true, min: 0 },
    catalogProductId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CatalogProduct',
      required: false,
      default: null,
    },
    productName: { type: String, required: true, trim: true, minlength: 2, maxlength: 200 },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 },
    receiptStatus: {
      type: String,
      enum: receiptStatuses,
      default: 'new',
    },
  },
  { _id: false },
);

export const supplierOrderSchema = new mongoose.Schema(
  {
    orderBaseId: {
      type: String,
      required: true,
      trim: true,
    },
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
      required: true,
      index: true,
    },
    deliveryDate: {
      type: Date,
      required: true,
    },
    supplyType: {
      type: String,
      trim: true,
      default: 'Локально',
    },
    number: {
      type: String,
      trim: true,
      default: '',
    },
    note: {
      type: String,
      trim: true,
      default: '',
    },
    createdBy: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: supplierOrderStatuses,
      default: 'request',
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: supplierPaymentStatuses,
      default: 'pending',
      index: true,
    },
    receiptStatus: {
      type: String,
      enum: receiptStatuses,
      default: 'new',
      index: true,
    },
    items: {
      type: [supplierOrderItemSchema],
      default: [],
    },
    total: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    paid: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    isFavorite: {
      type: Boolean,
      default: false,
      index: true,
    },
    searchText: {
      type: String,
      default: '',
      index: true,
    },
  },
  { timestamps: true, versionKey: false },
);

supplierOrderSchema.pre('validate', function updateSearchText() {
  const { total, paid } = applySupplierOrderFinancialTotals({
    items: this.items ?? [],
    paymentStatus: this.paymentStatus,
    paid: this.paid ?? 0,
    isPaymentStatusModified: this.isModified('paymentStatus'),
  });
  this.total = total;
  this.paid = paid;
  this.searchText = [
    this.orderBaseId,
    this.number,
    this.note,
    this.supplyType,
    ...(this.items ?? []).map((item) => item.productName),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
});

supplierOrderSchema.index({ orderBaseId: 1 }, { unique: true });
supplierOrderSchema.index({ deliveryDate: 1, status: 1 });
supplierOrderSchema.index({ createdAt: -1 });

export type SupplierOrderDocument = mongoose.InferSchemaType<typeof supplierOrderSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const SupplierOrder = mongoose.model('SupplierOrder', supplierOrderSchema);
