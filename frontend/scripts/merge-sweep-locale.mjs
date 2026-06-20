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
const mergeSweepFile = (targetEn, targetUk, fileName) => {
  deepMerge(targetEn, JSON.parse(fs.readFileSync(`scripts/${fileName}`, 'utf8')));
  deepMerge(targetUk, JSON.parse(fs.readFileSync(`scripts/${fileName.replace('-en', '-uk')}`, 'utf8')));
};

mergeSweepFile(en, uk, 'sweep-locale-en.json');
mergeSweepFile(en, uk, 'sweep-pass2-locale-en.json');
mergeSweepFile(en, uk, 'sweep-pass3-locale-en.json');
mergeSweepFile(en, uk, 'sweep-pass4-locale-en.json');

fs.writeFileSync(enPath, `${JSON.stringify(en, null, 2)}\n`);
fs.writeFileSync(ukPath, `${JSON.stringify(uk, null, 2)}\n`);
console.log('Sweep locale merged');