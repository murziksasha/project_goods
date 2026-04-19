import mongoose from 'mongoose';

export const saleSchema = new mongoose.Schema(
  {
    saleDate: {
      type: Date,
      default: Date.now,
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
    note: {
      type: String,
      trim: true,
      maxlength: [500, 'Sale note must contain no more than 500 characters'],
      default: '',
    },
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
