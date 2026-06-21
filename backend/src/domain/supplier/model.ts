import mongoose from 'mongoose';
import { normalizeClientPhone } from '../../shared/lib/parsers';

export const supplierSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      required: [true, 'Supplier phone is required'],
      trim: true,
    },
    phones: {
      type: [String],
      default: [],
    },
    phoneIdentities: {
      type: [String],
      default: [],
      index: true,
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
    supplierOrder: {
      type: String,
      trim: true,
      maxlength: [120, 'Supplier order must contain no more than 120 characters'],
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

supplierSchema.index({ phoneIdentities: 1 }, { unique: true });

supplierSchema.pre('validate', function ensurePhonesConsistency() {
  const currentPhones: string[] = Array.isArray(this.phones) ? this.phones.filter(Boolean) : [];
  if (this.phone) {
    if (currentPhones.length === 0 || currentPhones[0] !== this.phone) {
      this.phones = [this.phone, ...currentPhones.filter((p) => p !== this.phone)];
    }
  } else if (currentPhones.length > 0) {
    this.phone = currentPhones[0]!;
  }
  const base = Array.isArray(this.phones) ? this.phones : [];
  const identities = base
    .map((value) => normalizeClientPhone(value))
    .filter((p: string) => p.length > 0);
  const deduped = Array.from(new Set(identities));
  this.phoneIdentities =
    deduped.length > 0
      ? deduped
      : this.phone
        ? [normalizeClientPhone(this.phone)]
        : [];
});

supplierSchema.pre('validate', function validateAtLeastOnePhone() {
  const list = Array.isArray(this.phones) ? this.phones.filter(Boolean) : [];
  if (list.length === 0 && !this.phone) {
    this.invalidate('phone', 'Supplier must have at least one valid phone');
  }
});

supplierSchema.pre('validate', function updateSearchText() {
  const phonesForSearch = Array.isArray(this.phones) && this.phones.length > 0
    ? this.phones
    : this.phone ? [this.phone] : [];
  this.searchText = [
    ...phonesForSearch,
    this.phone,
    this.name,
    this.note,
    this.supplierOrder,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
});

supplierSchema.index(
  { name: 1 },
  { unique: true, collation: { locale: 'en', strength: 2 } },
);

export type SupplierDocument = mongoose.InferSchemaType<typeof supplierSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const Supplier = mongoose.model('Supplier', supplierSchema);
