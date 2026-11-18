import { beforeAll, describe, expect, it } from 'vitest';

// Read the source file: Vitest does not process CSS, so `?raw` imports are empty.
// The app tsconfig has no Node types, so Node built-ins are loaded untyped.
type NodeFs = { readFileSync: (path: string, encoding: 'utf8') => string };
const nodeFsModule = 'node:fs';
let layoutCss = '';

beforeAll(async () => {
  const { readFileSync } = (await import(/* @vite-ignore */ nodeFsModule)) as NodeFs;
  const cwd = (globalThis as unknown as { process: { cwd: () => string } }).process.cwd();
  layoutCss = readFileSync(`${cwd}/src/shared/styles/layout.css`, 'utf8');
});

const mediaBlocksWithCopyIcon = () =>
  [...layoutCss.matchAll(/@media([^{]+)\{((?:[^{}]*\{[^{}]*\})*)[^{}]*\}/g)]
    .filter((match) => match[2].includes('.copyable-value-copy'))
    .map((match) => match[1].trim());

describe('copy icon visibility CSS', () => {
  it('hides the copy icon by default (no hover)', () => {
    const base = /\.copyable-value-copy,\s*\.catalog-name-copy-button\s*\{([^}]*)\}/.exec(layoutCss)?.[1] ?? '';
    expect(base).toMatch(/opacity:\s*0;/);
    expect(base).toMatch(/width:\s*0;/);
    expect(base).toMatch(/pointer-events:\s*none;/);
  });

  it('reveals it on hover, focus-within and keyboard focus', () => {
    expect(layoutCss).toContain('.copyable-value:hover .copyable-value-copy');
    expect(layoutCss).toContain('.copyable-value:focus-within .copyable-value-copy');
    expect(layoutCss).toContain('.copyable-value-copy:focus-visible');
  });

  it('keeps it always visible only on touch-only devices, not on hybrids with a mouse', () => {
    expect(mediaBlocksWithCopyIcon()).toEqual(['(hover: none) and (any-hover: none)']);
  });
});
