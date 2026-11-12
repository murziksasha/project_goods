import mongoose from 'mongoose';

export const scenarioDomains = ['warehouse', 'cashflow', 'ordersReport'] as const;
export type ScenarioDomain = (typeof scenarioDomains)[number];

export const scenarioSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    domain: {
      type: String,
      enum: scenarioDomains,
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: [1, 'Scenario name is required'],
      maxlength: [100, 'Scenario name must be at most 100 characters'],
    },
    horizonDays: {
      type: Number,
      enum: [30, 60, 90],
      default: 30,
    },
    assumptions: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    filters: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

scenarioSchema.index({ employeeId: 1, domain: 1, name: 1 }, { unique: true });

export type ScenarioDocument = mongoose.InferSchemaType<typeof scenarioSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const Scenario = mongoose.model('Scenario', scenarioSchema);
