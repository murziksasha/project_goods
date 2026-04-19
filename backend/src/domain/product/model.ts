import mongoose from 'mongoose';

export const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      minlength: [2, 'Product name must contain at least 2 characters'],
      maxlength: [120, 'Product name must contain no more than 120 characters'],
    },
    article: {
      type: String,
      required: [true, 'Article is required'],
      trim: true,
      uppercase: true,
      maxlength: [50, 'Article must contain no more than 50 characters'],
      unique: true,
    },
    serialNumber: {
      type: String,
      required: [true, 'Serial number is required'],
      trim: true,
      uppercase: true,
      maxlength: [80, 'Serial number must contain no more than 80 characters'],
      unique: true,
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
    },
    salePriceOptions: {
      type: [Number],
      default: [],
      validate: {
        validator: (values: number[]) =>
          Array.isArray(values) &&
          values.every((value) => Number.isFinite(value) && value >= 0),
        message: 'Sale price options must contain only valid non-negative numbers.',
      },
    },
    note: {
      type: String,
      trim: true,
      maxlength: [500, 'Product note must contain no more than 500 characters'],
      default: '',
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [0, 'Quantity cannot be negative'],
    },
    reservedQuantity: {
      type: Number,
      min: [0, 'Reserved quantity cannot be negative'],
      default: 0,
    },
    purchasePlace: {
      type: String,
      trim: true,
      maxlength: [120, 'Purchase place must contain no more than 120 characters'],
      default: '',
    },
    purchaseDate: {
      type: Date,
      default: null,
    },
    warrantyPeriod: {
      type: Number,
      min: [0, 'Warranty period cannot be negative'],
      default: 0,
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

productSchema.pre('validate', function updateSearchText() {
  this.searchText = [
    this.name,
    this.article,
    this.serialNumber,
    this.note,
    this.purchasePlace,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
});

export type ProductDocument = mongoose.InferSchemaType<typeof productSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const Product = mongoose.model('Product', productSchema);
