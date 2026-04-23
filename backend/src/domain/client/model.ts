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
    note: {
      type: String,
      trim: true,
      maxlength: [500, 'Client note must contain no more than 500 characters'],
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

clientSchema.pre('validate', function updateSearchText() {
  this.searchText = [this.phone, this.name, this.note]
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
