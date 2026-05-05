import mongoose from 'mongoose';

export const supplierSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      required: [true, 'Supplier phone is required'],
      trim: true,
      unique: true,
    },
    name: {
      type: String,
      required: [true, 'Supplier name is required'],
      trim: true,
      minlength: [2, 'Supplier name must contain at least 2 characters'],
      maxlength: [120, 'Supplier name must contain no more than 120 characters'],
    },
    note: {
      type: String,
      trim: true,
      maxlength: [500, 'Supplier note must contain no more than 500 characters'],
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    searchText: {
      type: String,
      default: '',
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

supplierSchema.pre('validate', function updateSearchText() {
  this.searchText = [this.phone, this.name, this.note]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
});

export type SupplierDocument = mongoose.InferSchemaType<typeof supplierSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const Supplier = mongoose.model('Supplier', supplierSchema);
