import mongoose from 'mongoose';

export const clientDeviceSchema = new mongoose.Schema(
  {
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
      required: true,
      index: true,
    },
    clientName: {
      type: String,
      required: true,
      trim: true,
    },
    clientPhone: {
      type: String,
      required: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: [2, 'Device name must contain at least 2 characters'],
      maxlength: [120, 'Device name must contain no more than 120 characters'],
    },
    serialNumber: {
      type: String,
      trim: true,
      uppercase: true,
      default: '',
      index: true,
    },
    note: {
      type: String,
      trim: true,
      default: '',
    },
    source: {
      type: String,
      enum: ['clientCard', 'repairOrder'],
      default: 'repairOrder',
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

clientDeviceSchema.pre('validate', function updateSearchText() {
  this.searchText = [
    this.clientName,
    this.clientPhone,
    this.name,
    this.serialNumber,
    this.note,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
});

export type ClientDeviceDocument = mongoose.InferSchemaType<typeof clientDeviceSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const ClientDevice = mongoose.model('ClientDevice', clientDeviceSchema);
