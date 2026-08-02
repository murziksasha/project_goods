import mongoose from 'mongoose';

export const savedFilterScopes = [
  'orders',
  'warehouse',
  'clients',
  'catalog',
] as const;

export type SavedFilterScope = (typeof savedFilterScopes)[number];

export const savedFilterSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    scope: {
      type: String,
      required: true,
      enum: savedFilterScopes,
      index: true,
    },
    tab: {
      type: String,
      required: true,
      trim: true,
      maxlength: [80, 'Filter tab must contain no more than 80 characters'],
    },
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: [1, 'Filter name is required'],
      maxlength: [80, 'Filter name must contain no more than 80 characters'],
    },
    icon: {
      type: String,
      required: true,
      trim: true,
      maxlength: [16, 'Filter icon must contain no more than 16 characters'],
      default: '?',
    },
    filters: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      default: {},
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

savedFilterSchema.index({ employeeId: 1, scope: 1, createdAt: -1 });

export type SavedFilterDocument = mongoose.InferSchemaType<
  typeof savedFilterSchema
> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const SavedFilter = mongoose.model(
  'SavedFilter',
  savedFilterSchema,
  'saved_filters',
);
