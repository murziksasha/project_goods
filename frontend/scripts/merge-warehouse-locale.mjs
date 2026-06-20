import fs from 'fs';

const deepMerge = (target, source) => {
  Object.keys(source).forEach((key) => {
    const value = source[key];
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      typeof target[key] === 'object' &&
      target[key] !== null &&
      !Array.isArray(target[key])
    ) {
      deepMerge(target[key], value);
      return;
    }
    target[key] = value;
  });
  return target;
};

const enPath = 'src/shared/i18n/locales/en.json';
const ukPath = 'src/shared/i18n/locales/uk.json';
const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const uk = JSON.parse(fs.readFileSync(ukPath, 'utf8'));

en.warehouse = en.warehouse ?? {};
uk.warehouse = uk.warehouse ?? {};

deepMerge(
  en.warehouse,
  JSON.parse(fs.readFileSync('scripts/warehouse-locale-en.json', 'utf8')),
);
deepMerge(
  uk.warehouse,
  JSON.parse(fs.readFileSync('scripts/warehouse-locale-uk.json', 'utf8')),
);

fs.writeFileSync(enPath, `${JSON.stringify(en, null, 2)}\n`);
fs.writeFileSync(ukPath, `${JSON.stringify(uk, null, 2)}\n`);
console.log('Warehouse locale merged');