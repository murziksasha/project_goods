import { Sequence } from './model';

const recordSequenceKey = 'sale-record-number';
const productSerialSequenceKey = 'product-serial-number';
const productArticleSequenceKey = 'product-article-number';

export const formatRecordNumber = (value: number) =>
  `r${String(value).padStart(6, '0')}`;

export const formatProductSerialNumber = (value: number) =>
  `S${String(Math.max(1, value)).padStart(6, '0')}`;

export const formatProductArticle = (value: number) =>
  `A${String(Math.max(1, value)).padStart(6, '0')}`;

export const getNextRecordNumber = async () => {
  const sequence = await Sequence.findOneAndUpdate(
    { key: recordSequenceKey },
    { $inc: { value: 1 } },
    { returnDocument: 'after', upsert: true },
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

export const getNextProductSerialNumberValue = async () => {
  const sequence = await Sequence.findOneAndUpdate(
    { key: productSerialSequenceKey },
    { $inc: { value: 1 } },
    {
      returnDocument: 'after',
      upsert: true,
      setDefaultsOnInsert: true,
    },
  );

  return Math.max(sequence.value, 1);
};

export const getNextProductArticleValue = async () => {
  const sequence = await Sequence.findOneAndUpdate(
    { key: productArticleSequenceKey },
    { $inc: { value: 1 } },
    {
      returnDocument: 'after',
      upsert: true,
      setDefaultsOnInsert: true,
    },
  );

  return Math.max(sequence.value, 1);
};
