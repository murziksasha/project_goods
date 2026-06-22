import fs from 'fs';

const enPath = 'src/shared/i18n/locales/en.json';
const ukPath = 'src/shared/i18n/locales/uk.json';
const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const uk = JSON.parse(fs.readFileSync(ukPath, 'utf8'));

const ordersEn = JSON.parse(fs.readFileSync('scripts/orders-locale-en.json', 'utf8'));
const ordersUk = JSON.parse(fs.readFileSync('scripts/orders-locale-uk.json', 'utf8'));

en.orders = ordersEn;
uk.orders = ordersUk;

fs.writeFileSync(enPath, `${JSON.stringify(en, null, 2)}\n`);
fs.writeFileSync(ukPath, `${JSON.stringify(uk, null, 2)}\n`);
console.log('Locale files updated');