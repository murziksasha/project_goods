import mongoose from 'mongoose';
import { employeePermissions, employeeRoles } from './constants';

export const employeeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Employee name is required'],
      trim: true,
      minlength: [2, 'Employee name must contain at least 2 characters'],
      maxlength: [120, 'Employee name must contain no more than 120 characters'],
    },
    phone: {
      type: String,
      trim: true,
      default: '',
      maxlength: [30, 'Employee phone must contain no more than 30 characters'],
    },
    username: {
      type: String,
      required: [true, 'Username is required'],
      trim: true,
      lowercase: true,
      minlength: [3, 'Username must contain at least 3 characters'],
      maxlength: [60, 'Username must contain no more than 60 characters'],
      unique: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: [true, 'Password is required'],
      default: '',
      select: false,
    },
    authToken: {
      type: String,
      default: '',
      select: false,
      index: true,
    },
    role: {
      type: String,
      required: [true, 'Employee role is required'],
      enum: employeeRoles,
      default: 'manager',
      index: true,
    },
    permissions: {
      type: [String],
      enum: employeePermissions,
      default: ['orders.view'],
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    note: {
      type: String,
      trim: true,
      maxlength: [500, 'Employee note must contain no more than 500 characters'],
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

employeeSchema.pre('validate', function updateSearchText() {
  this.searchText = [this.name, this.phone, this.username, this.role, this.note]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
});

export type EmployeeDocument = mongoose.InferSchemaType<typeof employeeSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const Employee = mongoose.model('Employee', employeeSchema);
