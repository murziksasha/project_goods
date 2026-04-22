import mongoose from 'mongoose';

export const settingsSchema = new mongoose.Schema(
  {
    serviceName: {
      type: String,
      required: [true, 'Service name is required'],
      trim: true,
      minlength: [2, 'Service name must contain at least 2 characters'],
      maxlength: [120, 'Service name must contain no more than 120 characters'],
      default: 'Service CRM',
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export type SettingsDocument = mongoose.InferSchemaType<typeof settingsSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const Settings = mongoose.model('Settings', settingsSchema);
