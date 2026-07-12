/**
 * Safe hex → design-token replacement across shared CSS modules.
 * Longer hex must be replaced before shorter ones (#ffffff before #fff).
 * Never touches property names or partial hex fragments.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const stylesRoot = path.resolve(__dirname, '../src/shared/styles');

/** @type {[string, string][]} — order: longer / more specific first */
const REPLACEMENTS = [
  // Corrupted partial #fff replacements from older script
  ['var(--bg-card)0f1', 'var(--bg-soft-danger)'],
  ['var(--bg-card)beb', 'var(--bg-soft-warning)'],
  ['var(--bg-card)3f3', 'var(--bg-soft-danger)'],
  ['var(--bg-card)7f7', 'var(--bg-soft-danger)'],
  ['var(--bg-card)5f5', 'var(--bg-soft-danger)'],

  // Soft fills / zebra / surfaces (6-digit first)
  ['#ffffff', 'var(--bg-card)'],
  ['#fafbfd', 'var(--bg-surface-subtle)'],
  ['#f9fafb', 'var(--bg-surface-subtle)'],
  ['#f8fbff', 'var(--bg-soft-primary)'],
  ['#f8fafd', 'var(--bg-surface-subtle)'],
  ['#f8fafc', 'var(--bg-surface-subtle)'],
  ['#f8fbff', 'var(--bg-soft-primary)'],
  ['#f7f9fc', 'var(--bg-panel-elevated)'],
  ['#f7f9fb', 'var(--bg-panel-elevated)'],
  ['#f7f7f7', 'var(--bg-zebra)'],
  ['#f6f8fb', 'var(--bg-panel-elevated)'],
  ['#f5f8fc', 'var(--bg-panel-elevated)'],
  ['#f5f7fa', 'var(--bg-panel-elevated)'],
  ['#f4f7fb', 'var(--bg-panel-muted)'],
  ['#f4f6f9', 'var(--bg-panel)'],
  ['#f4f9ff', 'var(--bg-soft-primary)'],
  ['#f3f6fa', 'var(--bg-panel-muted)'],
  ['#f3f7fb', 'var(--bg-panel-elevated)'],
  ['#f3f4f6', 'var(--bg-soft-muted)'],
  ['#f1f4f8', 'var(--bg-workspace)'],
  ['#f0f5fb', 'var(--bg-soft-primary)'],
  ['#f0f7ff', 'var(--bg-soft-primary)'],
  ['#eff6ff', 'var(--bg-soft-primary)'],
  ['#eef6ff', 'var(--bg-soft-primary)'],
  ['#eef5ff', 'var(--bg-soft-primary)'],
  ['#eef4fb', 'var(--bg-soft-primary)'],
  ['#eef3f9', 'var(--bg-surface-subtle)'],
  ['#eef3f8', 'var(--bg-soft-muted)'],
  ['#eef2f7', 'var(--bg-soft-muted)'],
  ['#eef2f6', 'var(--bg-panel-muted)'],
  ['#eef1f5', 'var(--bg-soft-muted)'],
  ['#edf8f2', 'var(--bg-soft-success)'],
  ['#edf5ff', 'var(--bg-soft-primary)'],
  ['#edf6ff', 'var(--bg-soft-primary)'],
  ['#edf5ff', 'var(--bg-soft-primary)'],
  ['#ecfeff', 'var(--bg-soft-info)'],
  ['#ecf5ff', 'var(--bg-soft-primary)'],
  ['#ebf4ff', 'var(--bg-soft-primary)'],
  ['#eaf0f7', 'var(--bg-button-ghost)'],
  ['#e9f3ff', 'var(--bg-soft-primary-strong)'],
  ['#e9f1fb', 'var(--bg-soft-primary)'],
  ['#e9eef5', 'var(--bg-soft-muted)'],
  ['#e8f4ff', 'var(--bg-soft-primary)'],
  ['#e8f1fb', 'var(--bg-soft-primary)'],
  ['#e8f1ff', 'var(--bg-soft-info)'],
  ['#e8edf4', 'var(--bg-surface-subtle)'],
  ['#e8eef6', 'var(--bg-soft-muted)'],
  ['#e8eef5', 'var(--bg-soft-muted)'],
  ['#e7f1ff', 'var(--bg-soft-primary)'],
  ['#e6f7f5', 'var(--bg-soft-success)'],
  ['#e5edf8', 'var(--bg-button-secondary)'],
  ['#e5e7eb', 'var(--bg-soft-muted)'],
  ['#e4f4ec', 'var(--bg-soft-success)'],
  ['#e2e8f0', 'var(--color-line-strong)'],
  ['#e1f1ff', 'var(--bg-soft-primary-strong)'],
  ['#e0e6ee', 'var(--color-line-strong)'],
  ['#dfe6ef', 'var(--color-line-panel)'],
  ['#dbe3ee', 'var(--color-line-strong)'],
  ['#dbe3ec', 'var(--color-line-strong)'],
  ['#dce2ea', 'var(--bg-shell-to)'],
  ['#dcecff', 'var(--bg-button-secondary-hover)'],
  ['#d9e8fa', 'var(--color-line-panel)'],
  ['#d8e1ec', 'var(--color-line-panel)'],
  ['#d7e1ec', 'var(--color-line-panel)'],
  ['#d7e0eb', 'var(--color-line-panel)'],
  ['#d7dfe8', 'var(--color-line-section)'],
  ['#d7dde5', 'var(--bg-app)'],
  ['#d6dee8', 'var(--color-line-panel)'],
  ['#d5dde7', 'var(--color-line)'],
  ['#d5deea', 'var(--color-line-panel)'],
  ['#d4dce7', 'var(--color-line)'],
  ['#d4dbe5', 'var(--color-line)'],
  ['#d4dae2', 'var(--bg-shell-from)'],
  ['#d3dbe6', 'var(--color-line)'],
  ['#d2dce7', 'var(--color-line-panel)'],
  ['#d2dae4', 'var(--color-line-panel)'],
  ['#cfd8e3', 'var(--color-line-panel)'],
  ['#cfe3f8', 'var(--color-line-panel)'],
  ['#ccd6e2', 'var(--color-line-panel)'],
  ['#ccd5df', 'var(--color-line-panel)'],
  ['#c8d9ef', 'var(--color-line-panel)'],
  ['#c8d2df', 'var(--color-line-input)'],
  ['#c7d5e4', 'var(--color-line-panel)'],
  ['#c7d4e4', 'var(--color-line-panel)'],
  ['#c2cfde', 'var(--color-line-panel)'],
  ['#cbd5e1', 'var(--color-line-input)'],

  // Soft danger / warning backgrounds
  ['#fff8e7', 'var(--bg-soft-warning)'],
  ['#fff8f9', 'var(--bg-soft-danger)'],
  ['#fff7f7', 'var(--bg-soft-danger)'],
  ['#fff5f5', 'var(--bg-soft-danger)'],
  ['#fff4d8', 'var(--bg-soft-warning)'],
  ['#fff3f3', 'var(--bg-soft-danger)'],
  ['#fff0f1', 'var(--bg-soft-danger)'],
  ['#ffefef', 'var(--bg-soft-danger)'],
  ['#ffeded', 'var(--bg-soft-danger)'],
  ['#ffecec', 'var(--bg-soft-danger)'],
  ['#ffe8e8', 'var(--bg-soft-danger)'],
  ['#ffeef1', 'var(--bg-soft-danger)'],
  ['#fef3c7', 'var(--bg-soft-warning)'],
  ['#f6c8c8', 'var(--bg-soft-danger)'],

  // Brand / semantic solids
  ['#2d8ae3', 'var(--color-primary)'],
  ['#0f6fc6', 'var(--color-primary-hover)'],
  ['#2d7dca', 'var(--color-primary-hover)'],
  ['#2d7fca', 'var(--color-primary-hover)'],
  ['#226db5', 'var(--color-primary-strong)'],
  ['#2d6ea8', 'var(--color-primary-strong)'],
  ['#10b981', 'var(--color-success)'],
  ['#16a34a', 'var(--color-success-strong)'],
  ['#00a98f', 'var(--color-success-accent)'],
  ['#18b8b0', 'var(--accent-cyan)'],
  ['#0ea47d', 'var(--color-success-accent)'],
  ['#dc3545', 'var(--color-danger)'],
  ['#dc2626', 'var(--color-danger)'],
  ['#ef4444', 'var(--color-danger)'],
  ['#EF4444', 'var(--color-danger)'],
  ['#991b1b', 'var(--color-danger-soft)'],
  ['#f59e0b', 'var(--color-warning)'],
  ['#F59E0B', 'var(--color-warning)'],
  ['#d97706', 'var(--color-warning-strong)'],
  ['#3b82f6', 'var(--color-info)'],
  ['#3B82F6', 'var(--color-info)'],
  ['#6b7280', 'var(--color-muted)'],
  ['#6B7280', 'var(--color-muted)'],

  // Text colors (common body/heading)
  ['#53677d', 'var(--color-text-label)'],
  ['#4d637a', 'var(--color-text-body)'],
  ['#38506b', 'var(--color-text-body-strong)'],
  ['#3f5268', 'var(--color-text-heading)'],
  ['#2b3b4f', 'var(--text-main)'],
  ['#667992', 'var(--text-soft)'],
  ['#41566d', 'var(--text-button-secondary)'],
  ['#4f6279', 'var(--text-button-ghost)'],
  ['#52667d', 'var(--color-text-body)'],
  ['#43566e', 'var(--color-text-body-strong)'],
  ['#4d6078', 'var(--color-text-body-strong)'],
  ['#4b5d73', 'var(--color-text-heading)'],
  ['#425974', 'var(--color-text-body-strong)'],
  ['#485c73', 'var(--color-text-body)'],
  ['#475b72', 'var(--color-text-body)'],
  ['#4a5f76', 'var(--color-text-body)'],
  ['#4a5e74', 'var(--color-text-body)'],
  ['#4d627a', 'var(--color-text-body)'],
  ['#4f647b', 'var(--color-text-body)'],
  ['#3f5670', 'var(--color-text-body-strong)'],
  ['#2f4966', 'var(--color-text-body-strong)'],
  ['#2f4358', 'var(--color-text-body-strong)'],
  ['#24415f', 'var(--color-text-body-strong)'],
  ['#244869', 'var(--color-text-body-strong)'],
  ['#243f60', 'var(--color-text-body-strong)'],
  ['#284f78', 'var(--color-text-body-strong)'],
  ['#1f6fb8', 'var(--color-primary-hover)'],
  ['#0f5fad', 'var(--color-primary-strong)'],
  ['#123b64', 'var(--color-text-body-strong)'],
  ['#1f2937', 'var(--color-text-heading)'],
  ['#111827', 'var(--color-text-heading)'],
  ['#334155', 'var(--color-text-heading)'],
  ['#35506c', 'var(--color-text-body)'],
  ['#405773', 'var(--color-text-body)'],
  ['#406384', 'var(--color-text-body-strong)'],
  ['#435a72', 'var(--color-text-body)'],
  ['#51687f', 'var(--color-text-body)'],
  ['#54697f', 'var(--color-text-body)'],
  ['#576e86', 'var(--color-text-label)'],
  ['#596f86', 'var(--color-text-label)'],
  ['#596879', 'var(--color-text-label)'],
  ['#5a6f86', 'var(--color-text-label)'],
  ['#5a6878', 'var(--color-text-label)'],
  ['#637083', 'var(--color-text-label)'],
  ['#63778f', 'var(--color-text-label)'],
  ['#64748b', 'var(--color-muted)'],
  ['#65707c', 'var(--color-text-label)'],
  ['#687282', 'var(--color-text-label)'],
  ['#687789', 'var(--color-text-label)'],
  ['#6a7280', 'var(--color-muted)'],
  ['#6c7f94', 'var(--color-text-label)'],
  ['#6b7e95', 'var(--color-text-label)'],
  ['#6f8399', 'var(--text-soft)'],
  ['#6f839a', 'var(--text-soft)'],
  ['#71849a', 'var(--text-soft)'],
  ['#71869e', 'var(--text-soft)'],
  ['#73859a', 'var(--text-soft)'],
  ['#73869e', 'var(--text-soft)'],
  ['#74889f', 'var(--text-soft)'],
  ['#7a8da3', 'var(--text-soft)'],
  ['#7a8ea5', 'var(--text-soft)'],
  ['#7b8796', 'var(--text-soft)'],
  ['#7d90a6', 'var(--text-soft)'],
  ['#7f90a4', 'var(--text-soft)'],
  ['#8294a9', 'var(--text-soft)'],
  ['#8396ab', 'var(--text-soft)'],
  ['#93a5b9', 'var(--text-soft)'],
  ['#94a3b8', 'var(--text-soft)'],
  ['#9f1239', 'var(--color-danger-soft)'],
  ['#92400e', 'var(--text-on-warning)'],
  ['#8c2d2d', 'var(--color-danger-soft)'],
  ['#b02a37', 'var(--color-danger)'],
  ['#c35a5a', 'var(--color-danger)'],
  ['#047857', 'var(--color-success-strong)'],
  ['#0f766e', 'var(--color-success-accent)'],
  ['#168881', 'var(--color-success-accent)'],
  ['#0284c7', 'var(--color-info)'],
  ['#2d5f91', 'var(--color-primary-strong)'],

  // 3-digit white last
  ['#fff', 'var(--bg-card)'],
];

function walkCssFiles(dir) {
  /** @type {string[]} */
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkCssFiles(full));
    // Never rewrite token definitions in base.css
    else if (entry.name.endsWith('.css') && entry.name !== 'base.css') out.push(full);
  }
  return out;
}

/**
 * Replace only whole hex tokens (not substrings of longer hex).
 * Uses case-insensitive match with word-ish boundaries via (?![0-9a-fA-F]).
 */
function replaceHex(css, from, to) {
  if (from.startsWith('var(')) {
    if (!css.includes(from)) return { css, count: 0 };
    const parts = css.split(from);
    return { css: parts.join(to), count: parts.length - 1 };
  }
  if (!from.startsWith('#')) {
    if (!css.includes(from)) return { css, count: 0 };
    const parts = css.split(from);
    return { css: parts.join(to), count: parts.length - 1 };
  }
  const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Do not match if more hex digits follow (protect #ffffff when replacing #fff)
  const re = new RegExp(`${escaped}(?![0-9a-fA-F])`, 'gi');
  let count = 0;
  const next = css.replace(re, () => {
    count += 1;
    return to;
  });
  return { css: next, count };
}

function processFile(filePath) {
  let css = fs.readFileSync(filePath, 'utf8');
  let total = 0;
  for (const [from, to] of REPLACEMENTS) {
    const result = replaceHex(css, from, to);
    css = result.css;
    total += result.count;
  }

  // Prefer on-accent for ink on solid brand surfaces (not backgrounds)
  // Only replace color: var(--bg-card) patterns that are clearly button/badge ink.
  // Leave background: var(--bg-card) alone.
  // Done separately after bulk replace for color: var(--bg-card)

  if (total > 0) {
    fs.writeFileSync(filePath, css, 'utf8');
  }
  return total;
}

const files = walkCssFiles(stylesRoot);
let grand = 0;
for (const file of files) {
  const n = processFile(file);
  if (n > 0) {
    console.log(`${path.relative(stylesRoot, file)}: ${n}`);
    grand += n;
  }
}
console.log(`Total replacements: ${grand} across ${files.length} files`);
