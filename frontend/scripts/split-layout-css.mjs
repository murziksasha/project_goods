import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const stylesDir = path.resolve(__dirname, '../src/shared/styles');
const layoutPath = path.join(stylesDir, 'layout.css');

const DOMAIN_RULES = [
  {
    file: 'domains/sidebar.css',
    test: (selector) =>
      /\.(app-sidebar|sidebar-|dashboard-shell-collapsed)\b/.test(selector),
  },
  {
    file: 'domains/warehouse.css',
    test: (selector) => /\.warehouse-/.test(selector),
  },
  {
    file: 'domains/orders.css',
    test: (selector) =>
      /\.(order-|orders-|create-order-|rapid-sale-|receipt-status)/.test(
        selector,
      ),
  },
  {
    file: 'domains/accounting.css',
    test: (selector) =>
      /\.(finance-|accounting-|backup-)/.test(selector),
  },
];

const classifyBlock = (block) => {
  const head = block.split('{')[0] ?? '';
  const selectors = head
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  for (const rule of DOMAIN_RULES) {
    if (selectors.some((selector) => rule.test(selector))) {
      return rule.file;
    }
  }

  return 'layout.css';
};

const parseBlocks = (css) => {
  const blocks = [];
  let index = 0;

  while (index < css.length) {
    while (index < css.length && /\s/.test(css[index])) {
      index += 1;
    }

    if (index >= css.length) break;

    if (css.startsWith('/*', index)) {
      const end = css.indexOf('*/', index);
      if (end === -1) break;
      index = end + 2;
      continue;
    }

    const braceStart = css.indexOf('{', index);
    if (braceStart === -1) break;

    let depth = 0;
    let cursor = braceStart;
    while (cursor < css.length) {
      const char = css[cursor];
      if (char === '{') depth += 1;
      if (char === '}') {
        depth -= 1;
        if (depth === 0) {
          cursor += 1;
          break;
        }
      }
      cursor += 1;
    }

    const block = css.slice(index, cursor).trim();
    if (block) blocks.push(block);
    index = cursor;
  }

  return blocks;
};

const css = fs.readFileSync(layoutPath, 'utf8');
const blocks = parseBlocks(css);
const grouped = new Map([
  ['layout.css', []],
  ...DOMAIN_RULES.map((rule) => [rule.file, []]),
]);

for (const block of blocks) {
  const target = classifyBlock(block);
  grouped.get(target).push(block);
}

const domainsDir = path.join(stylesDir, 'domains');
fs.mkdirSync(domainsDir, { recursive: true });

for (const [fileName, fileBlocks] of grouped.entries()) {
  const targetPath =
    fileName === 'layout.css'
      ? layoutPath
      : path.join(stylesDir, fileName);
  const header =
    fileName === 'layout.css'
      ? ''
      : `/* Domain styles extracted from layout.css */\n\n`;
  fs.writeFileSync(
    targetPath,
    `${header}${fileBlocks.join('\n\n')}\n`,
    'utf8',
  );
}

for (const [fileName, fileBlocks] of grouped.entries()) {
  console.log(`${fileName}: ${fileBlocks.length} blocks`);
}