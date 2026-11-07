import type { PrintLayoutBlock } from './types';

// Translate known system captions before inserting customer and item data.
const captions: Record<string, string> = {
  Supplier: 'Постачальник', Recipient: 'Одержувач', Customer: 'Замовник',
  Payer: 'Платник', 'Pay by': 'Сплатити до', Services: 'Послуги', Products: 'Товари',
  Order: 'Замовлення', Client: 'Клієнт', Phone: 'Телефон', Device: 'Пристрій',
  Paid: 'Сплачено', 'To pay': 'До сплати', Total: 'Разом', Manager: 'Менеджер',
  Serial: 'Серійний номер', Master: 'Майстер', Service: 'Послуга', Product: 'Товар',
  Name: 'Найменування', Qty: 'К-сть', Quantity: 'Кількість', Price: 'Ціна', Sum: 'Сума',
  Назва: 'Найменування',
  Amount: 'Сума', 'No.': '№', 'Price without VAT': 'Ціна без ПДВ',
  'VAT rate': 'Ставка ПДВ', 'Amount without VAT': 'Сума без ПДВ', 'Amount with VAT': 'Сума з ПДВ',
  Receipt: 'Квитанція', 'Payment check': 'Товарний чек', 'Warranty card': 'Гарантійний талон',
  'Receipt #{{orderNumber}} from {{date}}': 'Квитанція №{{orderNumber}} від {{date}}',
  'Order #{{orderNumber}} from {{date}}': 'Замовлення №{{orderNumber}} від {{date}}',
  'Completion act #{{orderNumber}}': 'Акт виконаних робіт №{{orderNumber}}',
  'Order {{orderNumber}}': 'Замовлення {{orderNumber}}',
  'Client {{clientName}}': 'Клієнт {{clientName}}',
  'Date: {{date}}': 'Дата: {{date}}',
  'Client: {{clientName}}, {{clientPhone}}': 'Клієнт: {{clientName}}, {{clientPhone}}',
  'Total: {{total}}': 'Разом: {{total}}',
  'Accepted by: {{managerName}}': 'Прийняв: {{managerName}}',
  'Executor: {{masterName}}': 'Виконавець: {{masterName}}',
  'Client: __________________': 'Клієнт: __________________',
  'Customer: __________________': 'Замовник: __________________',
  'Service: __________________': 'Сервіс: __________________',
  'Service center is not responsible for data loss. Diagnostics term is 1-3 days. Warranty covers completed works and installed parts.': 'Сервісний центр не несе відповідальності за втрату даних. Термін діагностики — 1–3 дні. Гарантія поширюється на виконані роботи та встановлені деталі.',
  'The service center is not responsible for data loss in the device memory.': 'Сервісний центр не несе відповідальності за втрату даних у пам’яті пристрою.',
  'Diagnostics takes 1 to 3 days. Repair starts after the cost is approved.': 'Діагностика триває від 1 до 3 днів. Ремонт починається після погодження вартості.',
  'Warranty applies only to completed work and installed parts.': 'Гарантія поширюється лише на виконані роботи та встановлені деталі.',
  'Warranty is valid if there are no mechanical damages or third-party intervention traces.': 'Гарантія діє за відсутності механічних пошкоджень і слідів стороннього втручання.',
  'Address: {{company_address}}': 'Адреса: {{company_address}}',
  'Address: {{customer_address}}': 'Адреса: {{customer_address}}',
  'Registration ID: {{company_id}}': 'ЄДРПОУ або ІПН: {{company_id}}',
  'Registration ID: {{customer_reg_id}}': 'ЄДРПОУ або ІПН: {{customer_reg_id}}',
  'ID: {{company_id}}': 'ЄДРПОУ або ІПН: {{company_id}}',
  'ID: {{customer_reg_id}}': 'ЄДРПОУ або ІПН: {{customer_reg_id}}',
  'Phone: {{service_center_phone}}': 'Телефон: {{service_center_phone}}',
  'Phone: {{clientPhone}}': 'Телефон: {{clientPhone}}',
  'Invoice #{{orderNumber}}': 'Рахунок-фактура №{{orderNumber}}',
  'from {{date}}': 'від {{date}}',
  'Amount payable: {{total_amount}}': 'Загальна сума до сплати: {{total_amount}}',
  'Without VAT': 'Без ПДВ', 'Total in words: {{total_written}}': 'Усього на суму: {{total_written}}',
  'ПДВ: {{vat_amount}}': 'ПДВ (20%): {{vat_amount}}',
  'New heading': 'Новий заголовок', 'New text {{orderNumber}}': 'Новий текст {{orderNumber}}',
  'New text': 'Новий текст', Item: 'Позиція',
};

const legacyLabels: Record<string, string> = {
  'Receipt date:': 'Дата приймання:', 'Estimated deadline:': 'Орієнтовний термін:',
  'Accepted device:': 'Прийнятий пристрій:', 'Order No.:': 'Замовлення №:',
  'Customer:': 'Замовник:', 'Serial No.:': 'Серійний №:', 'Contact details:': 'Контактні дані:',
  'Article:': 'Артикул:', 'Reported defect:': 'Заявлена несправність:', 'Prepayment:': 'Передплата:',
  'Estimated cost:': 'Орієнтовна вартість:', 'To pay:': 'До сплати:', 'Master:': 'Майстер:',
  'Client:': 'Клієнт:', 'Total:': 'Разом:', 'Total in words:': 'Усього на суму:',
  'Amount payable:': 'Загальна сума до сплати:', 'Total without VAT:': 'Разом без ПДВ:',
  'Total with VAT:': 'Разом з ПДВ:', 'VAT:': 'ПДВ:',
};

export const translatePrintText = (text: string) => text.split('\n').map((line) => {
  const label = line.trim();
  const translated = captions[label] ?? legacyLabels[label];
  return translated ? line.replace(label, translated) : line;
}).join('\n');

export const translatePrintBlock = (block: PrintLayoutBlock): PrintLayoutBlock => {
  switch (block.type) {
    case 'heading':
    case 'paragraph': return { ...block, text: translatePrintText(block.text) };
    case 'fieldRow':
    case 'fieldGrid': return { ...block, fields: block.fields.map((field) => ({ ...field, label: translatePrintText(field.label), value: translatePrintText(field.value) })) };
    case 'lineItemsTable':
    case 'invoiceItemsTable': return { ...block, title: block.title ? translatePrintText(block.title) : block.title };
    case 'signatures': return { ...block, left: translatePrintText(block.left), right: translatePrintText(block.right) };
    case 'barcode': return { ...block, label: block.label ? translatePrintText(block.label) : block.label };
    case 'customTable': return { ...block, columns: block.columns.map((column) => ({ ...column, label: translatePrintText(column.label) })), rows: block.rows.map((row) => ({ ...row, cells: Object.fromEntries(Object.entries(row.cells).map(([key, value]) => [key, translatePrintText(value)])) })) };
    case 'columns': return { ...block, columns: block.columns.map((column) => ({ ...column, blocks: column.blocks.map(translatePrintBlock) })) };
    default: return block;
  }
};

export const translatePrintSource = (source: string) => {
  const document = new DOMParser().parseFromString(source, 'text/html');
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let changed = false;
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.parentElement?.closest('script,style,svg')) continue;
    const translated = translatePrintText(node.textContent ?? '');
    if (translated !== node.textContent) {
      node.textContent = translated;
      changed = true;
    }
  }
  return changed ? document.body.innerHTML : source;
};
