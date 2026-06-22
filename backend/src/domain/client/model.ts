import mongoose from 'mongoose';
import { clientStatuses } from './constants';

export const clientSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      required: [true, 'Client phone is required'],
      trim: true,
      unique: true,
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
      enum: [...clientStatuses, ''],
      default: '',
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

clientSchema.pre('validate', function updateSearchText() {
  this.searchText = [
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
