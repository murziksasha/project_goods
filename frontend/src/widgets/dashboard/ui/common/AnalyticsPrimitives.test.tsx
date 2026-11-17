import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AnalyticsSectionCard, AnalyticsSortableTable } from './AnalyticsPrimitives';

type TestRow = {
  id: string;
  name: string;
  count: number;
};

const testColumns = [
  { key: 'name', label: 'Name', render: (r: TestRow) => r.name },
  { key: 'count', label: 'Count', render: (r: TestRow) => r.count },
];

const sampleRows: TestRow[] = [
  { id: '1', name: 'Item 1', count: 10 },
  { id: '2', name: 'Item 2', count: 20 },
];

describe('AnalyticsSortableTable pagination integration', () => {
  it('renders PaginationPanel with selector, total, and page numbers when full pagination props are provided', () => {
    const handlePageChange = vi.fn();
    const handlePageSizeChange = vi.fn();

    render(
      <AnalyticsSortableTable<TestRow>
        columns={testColumns}
        rows={sampleRows}
        getRowKey={(r) => r.id}
        page={1}
        pageSize={30}
        total={45}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
      />,
    );

    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();

    // Select with rows per page
    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();
    expect(select).toHaveValue('30');

    // Total records
    expect(screen.getByText(/45 records/i)).toBeInTheDocument();

    // Page buttons and navigation
    expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '2' })).toBeInTheDocument();
    const nextBtn = screen.getByRole('button', { name: /next/i });
    expect(nextBtn).toBeInTheDocument();
    expect(nextBtn).not.toBeDisabled();

    // Trigger page size change
    fireEvent.change(select, { target: { value: '50' } });
    expect(handlePageSizeChange).toHaveBeenCalledWith(50);

    // Trigger page navigation
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    expect(handlePageChange).toHaveBeenCalledWith(2);
  });

  it('renders PaginationPanel even when there is only a single non-empty page', () => {
    const handlePageChange = vi.fn();
    const handlePageSizeChange = vi.fn();

    render(
      <AnalyticsSortableTable<TestRow>
        columns={testColumns}
        rows={sampleRows}
        getRowKey={(r) => r.id}
        page={1}
        pageSize={30}
        total={2}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
      />,
    );

    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByText(/2 records/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument();
  });

  it('hides PaginationPanel when loading is true', () => {
    const { container } = render(
      <AnalyticsSortableTable<TestRow>
        columns={testColumns}
        rows={sampleRows}
        getRowKey={(r) => r.id}
        loading={true}
        page={1}
        pageSize={30}
        total={45}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />,
    );

    expect(screen.getByText('Loading records...')).toBeInTheDocument();
    expect(container.querySelector('.pagination-panel')).not.toBeInTheDocument();
  });

  it('hides PaginationPanel when error is present', () => {
    const { container } = render(
      <AnalyticsSortableTable<TestRow>
        columns={testColumns}
        rows={sampleRows}
        getRowKey={(r) => r.id}
        error="Failed to load data"
        page={1}
        pageSize={30}
        total={45}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Failed to load data');
    expect(container.querySelector('.pagination-panel')).not.toBeInTheDocument();
  });

  it('hides PaginationPanel when rows are empty', () => {
    const { container } = render(
      <AnalyticsSortableTable<TestRow>
        columns={testColumns}
        rows={[]}
        getRowKey={(r) => r.id}
        page={1}
        pageSize={30}
        total={0}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />,
    );

    expect(container.querySelector('.pagination-panel')).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('does not render PaginationPanel if onPageSizeChange is not provided', () => {
    const { container } = render(
      <AnalyticsSortableTable<TestRow>
        columns={testColumns}
        rows={sampleRows}
        getRowKey={(r) => r.id}
        page={1}
        pageSize={30}
        total={45}
        onPageChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(container.querySelector('.pagination-panel')).not.toBeInTheDocument();
  });
});

describe('AnalyticsSectionCard collapsible functionality', () => {
  it('opt-in behavior: renders standard non-collapsible card when collapsible is omitted', () => {
    const { container } = render(
      <AnalyticsSectionCard
        title="Standard Card"
        subtitle="Standard Subtitle"
        actions={<button type="button">Action</button>}
      >
        <p>Standard Body Content</p>
      </AnalyticsSectionCard>,
    );

    const heading = screen.getByRole('heading', { level: 3 });
    expect(heading).toHaveTextContent('Standard Card');
    expect(screen.queryByRole('button', { name: /Standard Card/i })).not.toBeInTheDocument();
    expect(screen.getByText('Standard Subtitle')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument();
    expect(screen.getByText('Standard Body Content')).toBeInTheDocument();
    expect(container.querySelector('.report-section-card-body')).not.toBeInTheDocument();
  });

  it('renders title button with ARIA attributes and right chevron when collapsible', () => {
    const { container } = render(
      <AnalyticsSectionCard
        id="test-card"
        title="Collapsible Section"
        subtitle="Detailed metrics"
        actions={<button type="button">Export</button>}
        collapsible={true}
        isCollapsed={false}
        onCollapsedChange={vi.fn()}
      >
        <div>Content block</div>
      </AnalyticsSectionCard>,
    );

    const toggleBtn = screen.getByRole('button', { name: /Collapsible Section/i });
    expect(toggleBtn).toBeInTheDocument();
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');
    expect(toggleBtn).toHaveAttribute('aria-controls', 'test-card-content');

    const contentBody = container.querySelector('#test-card-content');
    expect(contentBody).toBeInTheDocument();
    expect(contentBody).not.toHaveAttribute('hidden');

    const chevron = container.querySelector('.report-section-chevron');
    expect(chevron).toBeInTheDocument();
    expect(chevron).not.toHaveClass('is-collapsed');
  });

  it('title-only collapsed state: conceals subtitle, eyebrow, actions, and marks body hidden while preserving DOM mount', () => {
    const { container } = render(
      <AnalyticsSectionCard
        id="test-card"
        title="Collapsible Section"
        eyebrow="Key Performance"
        subtitle="Detailed metrics"
        actions={<button type="button">Export</button>}
        collapsible={true}
        isCollapsed={true}
        onCollapsedChange={vi.fn()}
      >
        <div>Preserved Query Output</div>
      </AnalyticsSectionCard>,
    );

    // Only title and chevron visible in header; subtitle, eyebrow and actions are hidden
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Collapsible Section');
    expect(screen.getByText('Key Performance')).toHaveAttribute('hidden');
    expect(screen.getByText('Detailed metrics')).toHaveAttribute('hidden');
    // Button is hidden from accessible tree
    expect(screen.queryByRole('button', { name: 'Export' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export', hidden: true })).toBeInTheDocument();

    const toggleBtn = screen.getByRole('button', { name: /Collapsible Section/i });
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');

    const chevron = container.querySelector('.report-section-chevron');
    expect(chevron).toHaveClass('is-collapsed');

    // Body is hidden via attribute but preserved in DOM (for query/state persistence)
    const contentBody = container.querySelector('#test-card-content');
    expect(contentBody).toHaveAttribute('hidden');
    expect(contentBody).toContainHTML('Preserved Query Output');
  });

  it('supports finance variant, eyebrow, and custom className', () => {
    const { container } = render(
      <AnalyticsSectionCard
        id="finance-card"
        variant="finance"
        className="finance-info-panel-wide custom-chart-class"
        eyebrow="Financial Overview"
        title="Daily Inflows"
        subtitle="Observed trend"
        actions={<button type="button">Filter</button>}
        collapsible={true}
        isCollapsed={false}
      >
        <div>Finance Body Content</div>
      </AnalyticsSectionCard>,
    );

    const section = container.querySelector('section');
    expect(section).toHaveClass('finance-info-panel');
    expect(section).toHaveClass('finance-info-panel-wide');
    expect(section).toHaveClass('custom-chart-class');
    expect(section).toHaveClass('is-collapsible');

    expect(container.querySelector('.analytics-panel-header')).toBeInTheDocument();
    expect(screen.getByText('Financial Overview')).toBeInTheDocument();
    expect(screen.getByText('Financial Overview')).not.toHaveAttribute('hidden');
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Daily Inflows');
    expect(screen.getByRole('button', { name: 'Filter' })).toBeInTheDocument();
  });

  it('handles mouse click and keyboard activation (Enter / Space)', () => {
    const handleCollapsedChange = vi.fn();

    render(
      <AnalyticsSectionCard
        title="Keyboard Test"
        collapsible={true}
        isCollapsed={false}
        onCollapsedChange={handleCollapsedChange}
      >
        <div>Inner content</div>
      </AnalyticsSectionCard>,
    );

    const toggleBtn = screen.getByRole('button', { name: /Keyboard Test/i });

    // Mouse click toggles from expanded to collapsed
    fireEvent.click(toggleBtn);
    expect(handleCollapsedChange).toHaveBeenCalledWith(true);

    // Enter key toggle
    fireEvent.keyDown(toggleBtn, { key: 'Enter', code: 'Enter' });
    // Native buttons dispatch click on Enter in browsers, or fireEvent.click
    fireEvent.click(toggleBtn);
    expect(handleCollapsedChange).toHaveBeenCalledWith(true);

    // Space key toggle
    fireEvent.keyDown(toggleBtn, { key: ' ', code: 'Space' });
    fireEvent.click(toggleBtn);
    expect(handleCollapsedChange).toHaveBeenCalledWith(true);
  });
});
