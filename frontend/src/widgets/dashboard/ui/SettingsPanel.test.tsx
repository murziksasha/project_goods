import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultSettingsForm } from '../../../entities/settings/model/printForms';
import type { AppSettingsFormValues } from '../../../entities/settings/model/types';
import * as backupApi from '../../../entities/backup/api/backupApi';
import { persistPrintFormLayoutOverrides } from '../model/print-form-local-overrides';
import { SettingsPanel } from './SettingsPanel';
import { useRef, useState } from 'react';
import { cleanup } from '@testing-library/react';

const defaultBackups = [
  {
    id: 'project-goods-20260607-100000',
    createdAt: '2026-06-07T10:00:00.000Z',
    updatedAt: '2026-06-07T10:00:01.000Z',
    status: 'completed' as const,
    type: 'manual' as const,
    archiveFile: 'project-goods-20260607-100000.archive.gz',
    sizeBytes: 7,
    author: 'Owner',
    durationMs: 1000,
    error: '',
  },
];

beforeEach(() => {
  vi.spyOn(backupApi, 'listBackups').mockResolvedValue(defaultBackups);
  vi.spyOn(backupApi, 'createBackup').mockResolvedValue(defaultBackups[0]);
  vi.spyOn(backupApi, 'deleteBackup').mockResolvedValue({
    id: 'project-goods-20260607-100000',
    deleted: true,
  });
  vi.spyOn(backupApi, 'downloadBackup').mockResolvedValue({
    blob: new Blob(),
    filename: 'project-goods-20260607-100000.archive.gz',
  });
  vi.spyOn(backupApi, 'restoreBackup').mockResolvedValue({
    restoredBackupId: 'project-goods-20260607-100000',
    safetyBackupId: 'project-goods-20260607-100100-safety',
    success: true,
  });
  vi.spyOn(backupApi, 'restoreBackupFromFile').mockResolvedValue({
    restoredArchiveFile: 'project-goods-20260607-100000.archive.gz',
    safetyBackupId: 'project-goods-20260607-100100-safety',
    success: true,
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.localStorage.clear();
});

const SettingsPanelHarness = () => {
  const [form, setForm] = useState<AppSettingsFormValues>(
    createDefaultSettingsForm,
  );
  const latestFormRef = useRef(form);
  latestFormRef.current = form;

  return (
    <SettingsPanel
      form={form}
      isSaving={false}
      canEditSettings={true}
      canManageBackups={true}
      onChange={(field, value) =>
        setForm((current) => ({ ...current, [field]: value }))
      }
      onSubmit={() => {
        persistPrintFormLayoutOverrides(
          'employee-test',
          latestFormRef.current.printForms,
        );
      }}
    />
  );
};

const BackupOnlySettingsPanelHarness = () => {
  const [form, setForm] = useState<AppSettingsFormValues>(
    createDefaultSettingsForm,
  );

  return (
    <SettingsPanel
      form={form}
      isSaving={false}
      canEditSettings={false}
      canManageBackups={true}
      onChange={(field, value) =>
        setForm((current) => ({ ...current, [field]: value }))
      }
      onSubmit={() => undefined}
    />
  );
};

describe('SettingsPanel', () => {
  it('shows company, print form and backup settings tabs', async () => {
    render(<SettingsPanelHarness />);

    expect(screen.getByRole('button', { name: 'Company' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Print forms' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Backups' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Orders' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Numbering' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Finance' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Notifications' })).not.toBeInTheDocument();
  });

  it('allows saving default optional company print fields', async () => {
    render(<SettingsPanelHarness />);

    expect(screen.getByLabelText('Company address ({{company_address}})')).toHaveValue('');
    expect(screen.getByLabelText('Company ID ({{company_id}})')).toHaveValue('');
    expect(screen.getByLabelText('Company IBAN ({{company_iban}})')).toHaveValue('');
    expect(screen.getByLabelText('Company e-mail ({{company_email}})')).toHaveValue('');
    expect(screen.getByLabelText('Company site ({{company_site}})')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Save settings' })).toBeEnabled();
  });

  it('disables save when an optional company field is filled with an invalid value', async () => {
    render(<SettingsPanelHarness />);

    fireEvent.change(screen.getByLabelText('Company IBAN ({{company_iban}})'), {
      target: { value: 'bad-iban' },
    });

    expect(screen.getByRole('button', { name: 'Save settings' })).toBeDisabled();
  });

  it('keeps valid company print fields in form state', async () => {
    render(<SettingsPanelHarness />);

    fireEvent.change(screen.getByLabelText('Company address ({{company_address}})'), {
      target: { value: 'Kyiv, Main street 1' },
    });
    fireEvent.change(screen.getByLabelText('Company ID ({{company_id}})'), {
      target: { value: '12345678' },
    });
    fireEvent.change(screen.getByLabelText('Company IBAN ({{company_iban}})'), {
      target: { value: 'UA123456789123456789123456789' },
    });
    fireEvent.change(screen.getByLabelText('Company e-mail ({{company_email}})'), {
      target: { value: 'billing@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Company site ({{company_site}})'), {
      target: { value: 'https://example.com' },
    });

    expect(screen.getByLabelText('Company address ({{company_address}})')).toHaveValue('Kyiv, Main street 1');
    expect(screen.getByLabelText('Company ID ({{company_id}})')).toHaveValue('12345678');
    expect(screen.getByLabelText('Company IBAN ({{company_iban}})')).toHaveValue('UA123456789123456789123456789');
    expect(screen.getByLabelText('Company e-mail ({{company_email}})')).toHaveValue('billing@example.com');
    expect(screen.getByLabelText('Company site ({{company_site}})')).toHaveValue('https://example.com');
    expect(screen.getByRole('button', { name: 'Save settings' })).toBeEnabled();
  });

  it('supports print form add, duplicate, delete and live preview', async () => {
    render(<SettingsPanelHarness />);

    fireEvent.click(screen.getByRole('button', { name: 'Print forms' }));
    expect(screen.getByLabelText('Document template')).toHaveValue('receipt');
    expect(document.body.textContent).toContain('Receipt');
    expect(document.body.textContent).toContain('Services');
    expect(document.body.textContent).toContain('Products');
    expect(document.body.textContent).not.toContain('Р');

    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByLabelText('Template name')).toHaveValue('New template');
    expect((screen.getByLabelText('Document template') as HTMLSelectElement).value).toMatch(
      /^form-/,
    );
    expect(screen.getByRole('button', { name: 'Heading' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Editable table' }));
    expect(screen.getAllByText('Editable table').length).toBeGreaterThan(1);
    fireEvent.click(screen.getByRole('button', { name: 'Add row' }));

    fireEvent.click(screen.getAllByRole('button', { name: 'Duplicate' })[0]);
    expect(screen.getByLabelText('Template name')).toHaveValue('New template copy');

    fireEvent.click(screen.getByRole('button', { name: 'Delete template' }));
    expect(screen.getByText('New template')).toBeInTheDocument();
  }, 20000);

  it('persists print layout overrides only after Save settings', async () => {
    render(<SettingsPanelHarness />);

    fireEvent.click(screen.getByRole('button', { name: 'Print forms' }));
    fireEvent.change(screen.getByLabelText('Document template'), {
      target: { value: 'barcode' },
    });

    const topMarginInput = screen.getByLabelText('Top, mm');
    fireEvent.change(topMarginInput, { target: { value: '2.5' } });

    expect(
      window.localStorage.getItem(
        'project-goods.print-form-overrides.employee-test',
      ),
    ).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));

    const stored = JSON.parse(
      window.localStorage.getItem(
        'project-goods.print-form-overrides.employee-test',
      ) ?? '{}',
    );

    expect(stored.barcode?.contentMargins?.topMm).toBe(2.5);
  });

  it('switches between built-in print templates in the builder', async () => {
    render(<SettingsPanelHarness />);

    fireEvent.click(screen.getByRole('button', { name: 'Print forms' }));
    const templateSelect = screen.getByLabelText('Document template');

    expect(templateSelect).toHaveValue('receipt');
    expect(screen.getByLabelText('Template name')).toHaveValue('Receipt');
    expect(screen.getByRole('button', { name: /1\. Text/ })).toBeInTheDocument();

    fireEvent.change(templateSelect, { target: { value: 'barcode' } });

    expect(screen.getByLabelText('Document template')).toHaveValue('barcode');
    expect(screen.getByLabelText('Template name')).toHaveValue('Barcode');
    expect(screen.getByLabelText('Page size')).toHaveValue('label');
    expect(screen.getByLabelText('Orientation')).toHaveValue('landscape');
    expect(screen.getByRole('button', { name: /1\. Barcode/ })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Document template'), {
      target: { value: 'check' },
    });

    expect(screen.getByLabelText('Document template')).toHaveValue('check');
    expect(screen.getByLabelText('Template name')).toHaveValue('Check');
    expect(screen.getByLabelText('Page size')).toHaveValue('A4');
    expect(screen.getByRole('button', { name: /1\. Heading/ })).toBeInTheDocument();
  });

  it('disables save while service name is invalid', async () => {
    render(<SettingsPanelHarness />);

    const serviceName = screen.getByLabelText('Service name in header');
    fireEvent.change(serviceName, { target: { value: '' } });

    expect(screen.getByRole('button', { name: 'Save settings' })).toBeDisabled();
  });

  it('shows only backups to a backup-only employee', async () => {
    render(<BackupOnlySettingsPanelHarness />);

    expect(screen.queryByRole('button', { name: 'Company' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Print forms' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Backups' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save settings' })).not.toBeInTheDocument();
    expect(await screen.findByText('project-goods-20260607-100000')).toBeInTheDocument();
  });

  it('shows backup restore, restore from file, and delete actions', async () => {
    render(<BackupOnlySettingsPanelHarness />);

    expect(
      screen.getByText(
        'Automatic backup: daily at 15:00 UTC / 18:00 Kyiv time, scheduled copies kept for 14 days.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restore from file' })).toHaveClass(
      'success-button',
    );
    expect(await screen.findByRole('button', { name: 'Restore' })).toHaveClass(
      'warning-button',
    );
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveClass(
      'danger-button',
    );
    expect(screen.queryByRole('button', { name: 'Open in folder' })).not.toBeInTheDocument();
  });

  it('shows failed backup errors in a separate card panel', async () => {
    const longError =
      'mongodump was not found. Install MongoDB Database Tools on the backend host or configure BACKUP_CREATE_COMMAND/BACKUP_RESTORE_COMMAND.';

    vi.mocked(backupApi.listBackups).mockResolvedValueOnce([
      {
        id: 'project-goods-20260607-123001',
        createdAt: '2026-06-07T12:30:01.000Z',
        updatedAt: '2026-06-07T12:30:01.000Z',
        status: 'failed',
        type: 'manual',
        archiveFile: 'project-goods-20260607-123001.archive.gz',
        sizeBytes: 0,
        author: 'Temporary Admin',
        durationMs: 0,
        error: longError,
      },
    ]);

    render(<BackupOnlySettingsPanelHarness />);

    expect(await screen.findByText('project-goods-20260607-123001')).toBeInTheDocument();
    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.getByText(longError)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('requires delete confirmation before deleting a backup', async () => {
    render(<BackupOnlySettingsPanelHarness />);

    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    expect(backupApi.deleteBackup).not.toHaveBeenCalled();

    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' }).at(-1)!);

    expect(backupApi.deleteBackup).toHaveBeenCalledWith('project-goods-20260607-100000');
    expect(await screen.findByText('Backup deleted.')).toBeInTheDocument();
  });

  it('requires RESTORE before enabling restore confirmation', async () => {
    render(<BackupOnlySettingsPanelHarness />);

    fireEvent.click(await screen.findByRole('button', { name: 'Restore' }));
    expect(screen.getAllByRole('button', { name: 'Restore' }).at(-1)).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Type RESTORE to confirm'), {
      target: { value: 'RESTORE' },
    });

    expect(screen.getAllByRole('button', { name: 'Restore' }).at(-1)).toBeEnabled();
  });

  it('restores a backup from a selected file after confirmation', async () => {
    render(<BackupOnlySettingsPanelHarness />);

    fireEvent.click(screen.getByRole('button', { name: 'Restore from file' }));

    const confirmButton = screen.getAllByRole('button', {
      name: 'Restore from file',
    }).at(-1)!;
    expect(confirmButton).toBeDisabled();

    const file = new File(['archive'], 'project-goods-20260607-100000.archive.gz', {
      type: 'application/gzip',
    });
    fireEvent.change(screen.getByLabelText('Backup archive file'), {
      target: { files: [file] },
    });
    expect(screen.getByText('project-goods-20260607-100000.archive.gz')).toBeInTheDocument();
    expect(confirmButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Type RESTORE to confirm'), {
      target: { value: 'RESTORE' },
    });
    expect(confirmButton).toBeEnabled();

    fireEvent.click(confirmButton);

    expect(backupApi.restoreBackupFromFile).toHaveBeenCalledWith(file, 'RESTORE');
    expect(await screen.findByText('Backup file restored. Safety backup: project-goods-20260607-100100-safety.')).toBeInTheDocument();
  });
});
