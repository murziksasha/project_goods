import mongoose from 'mongoose';

export const saleSchema = new mongoose.Schema(
  {
    saleDate: {
      type: Date,
      default: Date.now,
      index: true,
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
      required: false,
      default: null,
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
      index: true,
    },
    status: {
      type: String,
      trim: true,
      default: 'new',
      required: true,
      index: true,
    },
    paidAmount: {
      type: Number,
      min: [0, 'Paid amount cannot be negative'],
      default: 0,
      required: true,
    },
    isFavorite: {
      type: Boolean,
      default: false,
      required: true,
    },
    isRapidSale: {
      type: Boolean,
      default: false,
      required: true,
    },
    note: {
      type: String,
      trim: true,
      maxlength: [
        500,
        'Sale note must contain no more than 500 characters',
      ],
      default: '',
    },
    userNote: {
      type: String,
      trim: true,
      maxlength: [
        500,
        'Sale user note must contain no more than 500 characters',
      ],
      default: '',
    },
    timeline: [
      {
        _id: false,
        id: { type: String, required: true },
        kind: {
          type: String,
          enum: ['manual', 'system'],
          required: false,
        },
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
        paymentMethod: {
          type: String,
          enum: ['cash', 'non-cash'],
          required: true,
          default: 'cash',
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
        catalogProductId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'CatalogProduct',
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
        serialNumbers: [
          { type: String, trim: true, uppercase: true },
        ],
        costMethod: {
          type: String,
          enum: ['fixed', 'time_rate'],
          required: false,
          default: null,
        },
        recordedMinutes: { type: Number, required: false, min: 0, default: null },
        fixedCost: { type: Number, required: false, min: 0, default: null },
        hourlyCost: { type: Number, required: false, min: 0, default: null },
        directExpenses: { type: Number, required: false, min: 0, default: null },
        unitCostOverride: { type: Number, required: false, min: 0, default: null },
        isCostOverridden: { type: Boolean, required: false, default: false },
        requiresCostAudit: { type: Boolean, required: false, default: undefined },
        costSnapshot: {
          type: new mongoose.Schema(
            {
              status: {
                type: String,
                enum: ['known', 'unknown'],
                required: true,
              },
              unitCost: { type: Number, required: false, default: null, min: 0 },
              totalCost: { type: Number, required: false, default: null, min: 0 },
              method: {
                type: String,
                enum: ['stock', 'fixed', 'time_rate', 'manual', 'zero', 'unknown'],
                required: true,
              },
              laborCost: { type: Number, required: false, default: null, min: 0 },
              directExpenses: { type: Number, required: false, default: null, min: 0 },
              recordedMinutes: { type: Number, required: false, default: null, min: 0 },
              hourlyCost: { type: Number, required: false, default: null, min: 0 },
              fixedCost: { type: Number, required: false, default: null, min: 0 },
              capturedAt: { type: Date, required: true },
              capturedById: { type: String, required: false, default: null },
              capturedByName: { type: String, required: false, default: null },
            },
            { _id: false },
          ),
          required: false,
          default: null,
        },
        auditedCost: {
          type: new mongoose.Schema(
            {
              status: {
                type: String,
                enum: ['known', 'unknown'],
                required: true,
              },
              unitCost: { type: Number, required: false, default: null, min: 0 },
              totalCost: { type: Number, required: false, default: null, min: 0 },
              method: {
                type: String,
                enum: ['stock', 'fixed', 'time_rate', 'manual', 'zero', 'unknown'],
                required: true,
              },
              laborCost: { type: Number, required: false, default: null, min: 0 },
              directExpenses: { type: Number, required: false, default: null, min: 0 },
              recordedMinutes: { type: Number, required: false, default: null, min: 0 },
              hourlyCost: { type: Number, required: false, default: null, min: 0 },
              fixedCost: { type: Number, required: false, default: null, min: 0 },
              capturedAt: { type: Date, required: true },
              capturedById: { type: String, required: false, default: null },
              capturedByName: { type: String, required: false, default: null },
            },
            { _id: false },
          ),
          required: false,
          default: null,
        },
        costAuditLog: [
          {
            _id: false,
            id: { type: String, required: true },
            previousStatus: {
              type: String,
              enum: ['known', 'unknown'],
              required: true,
            },
            previousUnitCost: { type: Number, required: false, default: null, min: 0 },
            previousTotalCost: { type: Number, required: false, default: null, min: 0 },
            newStatus: {
              type: String,
              enum: ['known', 'unknown'],
              required: true,
            },
            newUnitCost: { type: Number, required: false, default: null, min: 0 },
            newTotalCost: { type: Number, required: false, default: null, min: 0 },
            method: {
              type: String,
              enum: ['stock', 'fixed', 'time_rate', 'manual', 'zero', 'unknown'],
              required: true,
            },
            directExpenses: { type: Number, required: false, default: null, min: 0 },
            recordedMinutes: { type: Number, required: false, default: null, min: 0 },
            hourlyCost: { type: Number, required: false, default: null, min: 0 },
            fixedCost: { type: Number, required: false, default: null, min: 0 },
            reason: { type: String, required: true, trim: true },
            authorId: { type: String, required: false, default: null },
            authorName: { type: String, required: true },
            changedAt: { type: Date, required: true },
          },
        ],
      },
    ],
    discount: {
      mode: {
        type: String,
        enum: ['percent', 'amount'],
        default: 'percent',
      },
      value: {
        type: Number,
        min: [0, 'Discount cannot be negative'],
        default: 0,
      },
    },
    productSnapshot: {
      article: { type: String, required: true },
      name: { type: String, required: true },
      serialNumber: { type: String, required: false, default: '' },
    },
    clientSnapshot: {
      name: { type: String, required: true },
      phone: { type: String, required: true },
      phones: { type: [String], default: [] },
      status: { type: String, required: true },
      email: { type: String, required: false, default: '' },
      address: { type: String, required: false, default: '' },
      registrationId: { type: String, required: false, default: '' },
      iban: { type: String, required: false, default: '' },
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
    kanbanRank: {
      type: Number,
      required: false,
      default: undefined,
    },
    firstStockCommittedAt: {
      type: Date,
      required: false,
      default: null,
      index: true,
    },
    completedAt: {
      type: Date,
      required: false,
      default: null,
      index: true,
    },
    statusTransitions: [
      {
        _id: false,
        id: { type: String, required: true },
        fromStatus: { type: String, required: false, default: null },
        toStatus: { type: String, required: true },
        changedById: { type: String, required: false, default: null },
        changedByName: { type: String, required: false, default: null },
        changedAt: { type: Date, required: true },
      },
    ],
    returnEvents: [
      {
        _id: false,
        id: { type: String, required: true },
        lineItemId: { type: String, required: false, default: null },
        name: { type: String, required: true },
        productId: { type: String, required: false, default: null },
        catalogProductId: { type: String, required: false, default: null },
        quantity: { type: Number, required: true, min: 1 },
        grossAmount: { type: Number, required: true, min: 0 },
        refundAmount: { type: Number, required: true, min: 0 },
        unitCost: { type: Number, required: false, default: null, min: 0 },
        returnedAt: { type: Date, required: true },
        returnedById: { type: String, required: false, default: null },
        returnedByName: { type: String, required: false, default: null },
      },
    ],
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// Hot list paths: filter by kind (+ status) and sort by saleDate/created recency.
saleSchema.index({ kind: 1, saleDate: -1 });
saleSchema.index({ kind: 1, status: 1, saleDate: -1 });
saleSchema.index({ client: 1, saleDate: -1 });

export type SaleDocument = mongoose.InferSchemaType<
  typeof saleSchema
> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const Sale = mongoose.model('Sale', saleSchema);
