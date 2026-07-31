import mongoose from 'mongoose';

export const financePeriodSnapshotSchema = new mongoose.Schema(
  {
    periodEnd: {
      type: Date,
      required: true,
      index: true,
    },
    balances: [
      {
        _id: false,
        cashboxId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Cashbox',
          required: true,
        },
        currency: {
          type: String,
          required: true,
          trim: true,
          uppercase: true,
        },
        amount: {
          type: Number,
          required: true,
          // Raw audit amount at period end; may be negative if ledger walked inconsistent.
        },
      },
    ],
    sealedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    sealedBy: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    sourceTxCount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    purgedTxCount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    status: {
      type: String,
      enum: ['active', 'superseded'],
      required: true,
      default: 'active',
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

financePeriodSnapshotSchema.index({ status: 1, periodEnd: -1 });

export type FinancePeriodSnapshotDocument = mongoose.InferSchemaType<
  typeof financePeriodSnapshotSchema
> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const FinancePeriodSnapshot = mongoose.model(
  'FinancePeriodSnapshot',
  financePeriodSnapshotSchema,
);
