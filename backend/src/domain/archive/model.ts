import mongoose from 'mongoose';

export const yearlyArchiveKinds = ['sales', 'finance'] as const;
export type YearlyArchiveKind = (typeof yearlyArchiveKinds)[number];

export const yearlyArchiveSchema = new mongoose.Schema(
  {
    year: {
      type: Number,
      required: true,
      min: 2000,
      max: 2100,
      index: true,
    },
    kind: {
      type: String,
      enum: yearlyArchiveKinds,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['completed', 'failed', 'running'],
      required: true,
      default: 'running',
      index: true,
    },
    archiveFile: {
      type: String,
      required: true,
      trim: true,
    },
    sizeBytes: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    documentCount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    deletedFromLive: {
      type: Boolean,
      required: true,
      default: false,
    },
    author: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    error: {
      type: String,
      default: '',
      trim: true,
    },
    query: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

yearlyArchiveSchema.index({ kind: 1, year: 1 }, { unique: true });

export type YearlyArchiveDocument = mongoose.InferSchemaType<typeof yearlyArchiveSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const YearlyArchive = mongoose.model('YearlyArchive', yearlyArchiveSchema);
