import { Sequence } from './model';

const recordSequenceKey = 'sale-record-number';

export const formatRecordNumber = (value: number) =>
  `r${String(value).padStart(6, '0')}`;

export const getNextRecordNumber = async () => {
  const sequence = await Sequence.findOneAndUpdate(
    { key: recordSequenceKey },
    { $inc: { value: 1 } },
    { new: true, upsert: true },
  );

  return formatRecordNumber(sequence.value);
};

export const resetRecordNumberSequence = async (value: number) => {
  await Sequence.findOneAndUpdate(
    { key: recordSequenceKey },
    { value },
    { upsert: true },
  );
};
