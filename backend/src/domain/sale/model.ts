import mongoose from 'mongoose';

export const saleSchema = new mongoose.Schema(
  {
    saleDate: {
      type: Date,
      default: Date.now,
    },
    recordNumber: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
      index: true,
      match: [/^r\d{6}$/, 'Record number must match r000001 format'],
    },
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
      required: [true, 'Client is required'],
      index: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product is required'],
      index: true,
    },
    manager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: false,
      index: true,
      default: null,
    },
    master: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: false,
      index: true,
      default: null,
    },
    issuedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: false,
      index: true,
      default: null,
    },
    quantity: {
      type: Number,
      required: [true, 'Sale quantity is required'],
      min: [1, 'Sale quantity must be at least 1'],
    },
    salePrice: {
      type: Number,
      required: [true, 'Sale price is required'],
      min: [0, 'Sale price cannot be negative'],
    },
    kind: {
      type: String,
      enum: ['repair', 'sale'],
      default: 'repair',
      required: true,
    },
    status: {
      type: String,
      trim: true,
      default: 'new',
      required: true,
    },
    paidAmount: {
      type: Number,
      min: [0, 'Paid amount cannot be negative'],
      default: 0,
      required: true,
    },
    note: {
      type: String,
      trim: true,
      maxlength: [500, 'Sale note must contain no more than 500 characters'],
      default: '',
    },
    timeline: [
      {
        _id: false,
        id: { type: String, required: true },
        author: { type: String, required: true },
        message: { type: String, required: true },
        createdAt: { type: Date, required: true },
      },
    ],
    paymentHistory: [
      {
        _id: false,
        id: { type: String, required: true },
        type: {
          type: String,
          enum: ['deposit', 'refund'],
          required: true,
        },
        amount: { type: Number, required: true, min: 0 },
        cashboxId: { type: String, required: true },
        cashboxName: { type: String, required: true },
        author: { type: String, required: true },
        createdAt: { type: Date, required: true },
      },
    ],
    lineItems: [
      {
        _id: false,
        id: { type: String, required: true },
        kind: {
          type: String,
          enum: ['product', 'service'],
          required: true,
        },
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Product',
          required: false,
          default: null,
        },
        serviceId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'ServiceCatalog',
          required: false,
          default: null,
        },
        name: { type: String, required: true },
        price: { type: Number, required: true, min: 0 },
        quantity: { type: Number, required: true, min: 1 },
        warrantyPeriod: { type: Number, min: 0, default: 0 },
      },
    ],
    productSnapshot: {
      article: { type: String, required: true },
      name: { type: String, required: true },
      serialNumber: { type: String, required: true },
    },
    clientSnapshot: {
      name: { type: String, required: true },
      phone: { type: String, required: true },
      status: { type: String, required: true },
    },
    managerSnapshot: {
      name: { type: String, required: false },
      role: { type: String, required: false },
    },
    masterSnapshot: {
      name: { type: String, required: false },
      role: { type: String, required: false },
    },
    issuedBySnapshot: {
      name: { type: String, required: false },
      role: { type: String, required: false },
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export type SaleDocument = mongoose.InferSchemaType<typeof saleSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const Sale = mongoose.model('Sale', saleSchema);
