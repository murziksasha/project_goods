import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const layoutPath = path.resolve(
  __dirname,
  '../src/shared/styles/layout.css',
);

const REPLACEMENTS = [
  ['#2d8ae3', 'var(--color-primary)'],
  ['#0f6fc6', 'var(--color-primary-hover)'],
  ['#2d7dca', 'var(--color-primary-hover)'],
  ['#2d7fca', 'var(--color-primary-hover)'],
  ['#226db5', 'var(--color-primary-strong)'],
  ['#2d6ea8', 'var(--color-primary-strong)'],
  ['#10b981', 'var(--color-success)'],
  ['#16a34a', 'var(--color-success-strong)'],
  ['#00a98f', 'var(--color-success-accent)'],
  ['#0ea47d', 'var(--color-success-accent)'],
  ['#dc3545', 'var(--color-danger)'],
  ['#dc2626', 'var(--color-danger)'],
  ['#EF4444', 'var(--color-danger)'],
  ['#991b1b', 'var(--color-danger-soft)'],
  ['#f59e0b', 'var(--color-warning)'],
  ['#F59E0B', 'var(--color-warning)'],
  ['#d97706', 'var(--color-warning-strong)'],
  ['#3B82F6', 'var(--color-info)'],
  ['#6B7280', 'var(--color-muted)'],
  ['#6b7280', 'var(--color-muted)'],
  ['#eef2f6', 'var(--bg-panel-muted)'],
  ['#f7f9fb', 'var(--bg-panel-elevated)'],
  ['#f8fafc', 'var(--bg-surface-subtle)'],
  ['#f8fafd', 'var(--bg-surface-subtle)'],
  ['#f6f8fb', 'var(--bg-panel-elevated)'],
  ['#f1f4f8', 'var(--bg-workspace)'],
  ['#dbe3ee', 'var(--color-line-strong)'],
  ['#d4dbe5', 'var(--color-line)'],
  ['#d3dbe6', 'var(--color-line)'],
  ['#cfd8e3', 'var(--color-line-panel)'],
  ['#d6dee8', 'var(--color-line-panel)'],
  ['#d7dfe8', 'var(--color-line-section)'],
  ['#cbd5e1', 'var(--color-line-input)'],
  ['#53677d', 'var(--color-text-label)'],
  ['#4d637a', 'var(--color-text-body)'],
  ['#38506b', 'var(--color-text-body-strong)'],
  ['#ffffff', 'var(--bg-card)'],
  ['#fff', 'var(--bg-card)'],
];

let css = fs.readFileSync(layoutPath, 'utf8');
let total = 0;

for (const [from, to] of REPLACEMENTS) {
  const matches = css.split(from).length - 1;
  if (matches > 0) {
    css = css.split(from).join(to);
    total += matches;
  }
}

css = css.replace(
  /grid-template-columns:\s*250px/g,
  'grid-template-columns: var(--sidebar-width)',
);

fs.writeFileSync(layoutPath, css, 'utf8');
console.log(`Replaced ${total} token references in layout.css`);