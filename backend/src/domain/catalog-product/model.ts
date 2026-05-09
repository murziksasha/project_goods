import mongoose from 'mongoose';

export const catalogProductSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      minlength: [2, 'Product name must contain at least 2 characters'],
      maxlength: [160, 'Product name must contain no more than 160 characters'],
    },
    note: {
      type: String,
      trim: true,
      maxlength: [500, 'Product note must contain no more than 500 characters'],
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
    sourceTags: {
      type: [String],
      default: [],
    },
    lastSeenAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

catalogProductSchema.pre('validate', function updateSearchText() {
  this.searchText = [this.name, this.note].filter(Boolean).join(' ').toLowerCase();
});

catalogProductSchema.index(
  { name: 1 },
  { unique: true, collation: { locale: 'en', strength: 2 } },
);

export type CatalogProductDocument = mongoose.InferSchemaType<typeof catalogProductSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const CatalogProduct = mongoose.model('CatalogProduct', catalogProductSchema);
