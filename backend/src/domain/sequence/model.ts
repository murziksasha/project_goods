import mongoose from 'mongoose';

const sequenceSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    value: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export type SequenceDocument = mongoose.InferSchemaType<typeof sequenceSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Sequence = mongoose.model('Sequence', sequenceSchema);
