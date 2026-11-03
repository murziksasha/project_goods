import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { Client, ClientFormValues, ClientStatus } from '../../../../entities/client';
import { getClientHistory } from '../../../../entities/client';
import type {
  ClientDevice,
  ClientDeviceFormValues,
} from '../../../../entities/client-device';
import type { Sale } from '../../../../entities/sale';
import { queryKeys } from '../../../../shared/api/queryClient';
import { isValidUkrainianPhone } from '../../../../shared/lib/phoneFormatter';
import {
  getClientSaleIncome,
  getClientStatsMap,
  getLegacyClientEmail,
  getPlainNote,
  mapClientDraftToPayload,
  type ClientCardTab,
  type ClientMainForm,
} from '../../model/clients-workspace';
import { ClientCardModal } from './ClientCardModal';

const getLegacyClientAddress = (client: Client) => {
  if (client.address) return client.address;
  const line = client.note
    .split('\n')
    .find((item) => item.startsWith('Address:'));
  return line ? line.slice('Address:'.length).trim() : '';
};

const emptyMainTabForm = (): ClientMainForm => ({
  name: '',
  phone: '',
  phones: [''],
  email: '',
  address: '',
  registrationId: '',
  iban: '',
  note: '',
  status: '',
});

export interface ClientCardOverlayProps {
  clientId: string;
  client: Client | null;
  sales: Sale[];
  clientDevices: ClientDevice[];
  isSaving: boolean;
  saleLinkMode: 'in-app' | 'new-tab';
  onClose: () => void;
  onOpenSaleCard: (sale: Sale) => void;
  onOpenClientList: (clientId: string) => void;
  onUpdateClient: (
    clientId: string,
    payload: ClientFormValues,
  ) => Promise<boolean>;
  onUpdateClientDevice: (
    deviceId: string,
    payload: ClientDeviceFormValues,
  ) => Promise<boolean>;
  onDeleteClientDevice: (deviceId: string) => Promise<boolean>;
}

export const ClientCardOverlay: React.FC<ClientCardOverlayProps> = ({
  clientId,
  client,
  sales,
  clientDevices,
  isSaving,
  saleLinkMode,
  onClose,
  onOpenSaleCard,
  onOpenClientList,
  onUpdateClient,
  onUpdateClientDevice,
  onDeleteClientDevice,
}) => {
  const { t } = useTranslation();
  const [clientCardTab, setClientCardTab] = useState<ClientCardTab>('main');
  const [mainTabForm, setMainTabForm] = useState<ClientMainForm>(
    emptyMainTabForm,
  );
  const [mainTabPhoneError, setMainTabPhoneError] = useState<string | null>(
    null,
  );
  const isMainTabDirtyRef = useRef(false);
  const hydratedClientIdRef = useRef<string | null>(null);
  const hydratedUpdatedAtRef = useRef<string | null>(null);
  const historyQuery = useQuery({
    queryKey: queryKeys.clientHistory(clientId),
    queryFn: () => getClientHistory(clientId),
    enabled: Boolean(clientId),
  });

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    if (!client || client.id !== clientId) return;

    const clientChanged = hydratedClientIdRef.current !== clientId;
    const serverChanged = hydratedUpdatedAtRef.current !== client.updatedAt;
    if (!clientChanged && !serverChanged) return;
    if (!clientChanged && isMainTabDirtyRef.current) return;

    const phones = client.phones?.length
      ? [...client.phones]
      : [client.phone || ''];
    setMainTabForm({
      name: client.name,
      phone: phones[0] || client.phone || '',
      phones,
      email: getLegacyClientEmail(client),
      address: getLegacyClientAddress(client),
      registrationId: client.registrationId,
      iban: client.iban,
      note: getPlainNote(client.note),
      status: client.status || '',
    });
    hydratedClientIdRef.current = clientId;
    hydratedUpdatedAtRef.current = client.updatedAt;
    isMainTabDirtyRef.current = false;
  }, [client, clientId]);

  const historySales =
    historyQuery.data?.client.id === clientId ? historyQuery.data.sales : [];
  const ordersHistory = useMemo(
    () => historySales.filter((sale) => sale.kind === 'repair'),
    [historySales],
  );
  const salesHistory = useMemo(
    () => historySales.filter((sale) => sale.kind === 'sale'),
    [historySales],
  );
  const activeHistoryRows =
    clientCardTab === 'orders' ? ordersHistory : salesHistory;
  const visitCount =
    getClientStatsMap(sales).get(clientId)?.visits ?? historySales.length;

  const validatePhone = (phone: string) => {
    if (!isValidUkrainianPhone(phone)) {
      setMainTabPhoneError(t('clients.messages.errors.invalidPhoneFormat'));
      return false;
    }
    setMainTabPhoneError(null);
    return true;
  };

  const handleMainTabSave = async () => {
    if (!client) return;
    const payload = {
      ...mapClientDraftToPayload(
        mainTabForm,
        mainTabForm.status as ClientStatus | '',
      ),
      expectedUpdatedAt: client.updatedAt,
    };
    const isSuccess = await onUpdateClient(clientId, payload);
    if (!isSuccess) return;
    isMainTabDirtyRef.current = false;
    await historyQuery.refetch();
  };

  if (!client) return null;

  return (
    <ClientCardModal
      activeHistoryRows={activeHistoryRows}
      historySales={historySales}
      clientCardTab={clientCardTab}
      historyClient={historyQuery.data?.client ?? null}
      isHistoryLoading={historyQuery.isLoading}
      isSaving={isSaving}
      clientVisitCount={visitCount}
      clientTotalRevenue={
        clientCardTab === 'orders'
          ? ordersHistory.reduce(
              (sum, sale) => sum + getClientSaleIncome(sale),
              0,
            )
          : clientCardTab === 'sales'
            ? salesHistory.reduce(
                (sum, sale) => sum + getClientSaleIncome(sale),
                0,
              )
            : historySales.reduce(
                (sum, sale) => sum + getClientSaleIncome(sale),
                0,
              )
      }
      mainTabForm={mainTabForm}
      mainTabPhoneError={mainTabPhoneError}
      selectedClient={client}
      selectedClientId={clientId}
      showClientListButton
      usePortal
      saleLinkMode={saleLinkMode}
      onClearPhoneError={() => setMainTabPhoneError(null)}
      onClose={onClose}
      onMainTabFormChange={(value) => {
        isMainTabDirtyRef.current = true;
        setMainTabForm(value);
      }}
      onOpenClientList={() => onOpenClientList(clientId)}
      onOpenSaleCard={onOpenSaleCard}
      onSaveMainTab={() => {
        void handleMainTabSave();
      }}
      onTabChange={setClientCardTab}
      onValidatePhone={validatePhone}
      clientDevices={clientDevices}
      onUpdateClientDevice={onUpdateClientDevice}
      onDeleteClientDevice={onDeleteClientDevice}
    />
  );
};
