import fs from 'fs';

const enPath = 'src/shared/i18n/locales/en.json';
const ukPath = 'src/shared/i18n/locales/uk.json';
const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const uk = JSON.parse(fs.readFileSync(ukPath, 'utf8'));

en.accounting = JSON.parse(fs.readFileSync('scripts/accounting-locale-en.json', 'utf8'));
uk.accounting = JSON.parse(fs.readFileSync('scripts/accounting-locale-uk.json', 'utf8'));

fs.writeFileSync(enPath, `${JSON.stringify(en, null, 2)}\n`);
fs.writeFileSync(ukPath, `${JSON.stringify(uk, null, 2)}\n`);
console.log('Accounting locale merged');