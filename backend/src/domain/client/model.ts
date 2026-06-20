import mongoose from 'mongoose';
import { normalizeClientPhone } from '../../shared/lib/parsers';
import { clientStatuses } from './constants';

export const clientSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      required: [true, 'Client phone is required'],
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
      required: [true, 'Client name is required'],
      trim: true,
      minlength: [2, 'Client name must contain at least 2 characters'],
      maxlength: [120, 'Client name must contain no more than 120 characters'],
    },
    email: {
      type: String,
      trim: true,
      maxlength: [160, 'Client e-mail must contain no more than 160 characters'],
      default: '',
    },
    address: {
      type: String,
      trim: true,
      maxlength: [240, 'Client address must contain no more than 240 characters'],
      default: '',
      validate: {
        validator(value: string) {
          return !value || value.trim().length >= 5;
        },
        message: 'Client address must contain at least 5 characters',
      },
    },
    registrationId: {
      type: String,
      trim: true,
      maxlength: [12, 'Client registration ID must contain no more than 12 characters'],
      default: '',
      match: [/^$|^[0-9A-Za-z-]{8,12}$/, 'Client registration ID must be 8-12 characters'],
    },
    iban: {
      type: String,
      trim: true,
      uppercase: true,
      default: '',
      match: [/^$|^UA\d{27}$/, 'Client IBAN must match UA + 27 digits'],
    },
    note: {
      type: String,
      trim: true,
      maxlength: [2000, 'Client note must contain no more than 2000 characters'],
      default: '',
    },
    status: {
      type: String,
      enum: clientStatuses,
      default: 'new',
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

clientSchema.index({ phoneIdentities: 1 }, { unique: true });

clientSchema.pre('validate', function ensurePhonesConsistency() {
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

clientSchema.pre('validate', function validateAtLeastOnePhone() {
  const list = Array.isArray(this.phones) ? this.phones.filter(Boolean) : [];
  if (list.length === 0 && !this.phone) {
    this.invalidate('phone', 'Client must have at least one valid phone');
  }
});

clientSchema.pre('validate', function updateSearchText() {
  const phonesForSearch = Array.isArray(this.phones) && this.phones.length > 0
    ? this.phones
    : this.phone ? [this.phone] : [];
  this.searchText = [
    ...phonesForSearch,
    this.phone,
    this.name,
    this.email,
    this.address,
    this.registrationId,
    this.iban,
    this.note,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
});

export type ClientDocument = mongoose.InferSchemaType<typeof clientSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const Client = mongoose.model('Client', clientSchema);
