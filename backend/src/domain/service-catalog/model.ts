import mongoose from 'mongoose';

export const serviceCatalogSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Service name is required'],
      trim: true,
      minlength: [2, 'Service name must contain at least 2 characters'],
    },
    price: {
      type: Number,
      required: [true, 'Service price is required'],
      min: [0, 'Service price cannot be negative'],
    },
    note: {
      type: String,
      trim: true,
      default: '',
    },
    searchText: {
      type: String,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

serviceCatalogSchema.pre('validate', function updateSearchText() {
  this.searchText = [this.name, this.note].filter(Boolean).join(' ').toLowerCase();
});

export type ServiceCatalogDocument = mongoose.InferSchemaType<
  typeof serviceCatalogSchema
> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const ServiceCatalog = mongoose.model(
  'ServiceCatalog',
  serviceCatalogSchema,
);
