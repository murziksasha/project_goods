import mongoose from 'mongoose';

const serviceCenterSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    color: { type: String, required: true, trim: true, default: '#000000' },
    address: { type: String, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
  },
  { _id: false, versionKey: false },
);

const warehouseLocationSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
  },
  { _id: false, versionKey: false },
);

const warehouseItemSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    isActive: { type: Boolean, default: true },
    serviceCenterId: { type: String, required: true, trim: true },
    receiptAddress: { type: String, trim: true, default: '' },
    receiptPhone: { type: String, trim: true, default: '' },
    locations: { type: [warehouseLocationSchema], default: [] },
  },
  { _id: false, versionKey: false },
);

const warehouseAdministratorSchema = new mongoose.Schema(
  {
    employeeId: { type: String, required: true, trim: true },
    warehouseIds: { type: [String], default: [] },
    defaultWarehouseId: { type: String, trim: true, default: '' },
    defaultLocationId: { type: String, trim: true, default: '' },
  },
  { _id: false, versionKey: false },
);

export const warehouseSettingsSchema = new mongoose.Schema(
  {
    serviceCenters: { type: [serviceCenterSchema], default: [] },
    warehouses: { type: [warehouseItemSchema], default: [] },
    administrators: { type: [warehouseAdministratorSchema], default: [] },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export type WarehouseSettingsDocument = mongoose.InferSchemaType<
  typeof warehouseSettingsSchema
> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const WarehouseSettings = mongoose.model(
  'WarehouseSettings',
  warehouseSettingsSchema,
);
