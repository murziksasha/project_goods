import type React from 'react';
import { useTranslation } from 'react-i18next';
import type { ClientDevice } from '../../../../../entities/client-device';
import { useDismissibleSuggestions } from '../../../../../shared/lib/useDismissibleSuggestions';
import { StringListInput } from '../../../../../shared/ui/StringListInput';
import { saleKitMaxItemLength, saleKitMaxItems } from '../../../../../entities/sale';

export interface CreateOrderRepairSectionProps {
  deviceName: string;
  deviceSerialNumber: string;
  deviceColor: string;
  deviceKit: string[];
  repairType: string;
  issueFromClient: string;
  externalView: string;
  canCreateClientDevice: boolean;
  isClientEnsuring: boolean;
  selectedDeviceSuggestionId: string | null;
  hasExactDeviceMatch: boolean;
  visibleDeviceSuggestions: ClientDevice[];
  isDeviceLookupLoading: boolean;
  onDeviceNameChange: (value: string) => void;
  onDeviceSerialNumberChange: (value: string) => void;
  onDeviceColorChange: (value: string) => void;
  onDeviceKitChange: (value: string[]) => void;
  onRepairTypeChange: (value: string) => void;
  onIssueFromClientChange: (value: string) => void;
  onExternalViewChange: (value: string) => void;
  onClearSelectedDeviceSuggestion: () => void;
  onEnsureClientForDevice: () => Promise<unknown>;
  onOpenCreateDevice: () => Promise<void>;
  onApplyDevice: (device: ClientDevice) => void;
};

export const CreateOrderRepairSection: React.FC<CreateOrderRepairSectionProps> = ({
  deviceName,
  deviceSerialNumber,
  deviceColor,
  deviceKit,
  repairType,
  issueFromClient,
  externalView,
  canCreateClientDevice,
  isClientEnsuring,
  selectedDeviceSuggestionId,
  hasExactDeviceMatch,
  visibleDeviceSuggestions,
  isDeviceLookupLoading,
  onDeviceNameChange,
  onDeviceSerialNumberChange,
  onDeviceColorChange,
  onDeviceKitChange,
  onRepairTypeChange,
  onIssueFromClientChange,
  onExternalViewChange,
  onClearSelectedDeviceSuggestion,
  onEnsureClientForDevice,
  onOpenCreateDevice,
  onApplyDevice,
}) => {
  const { t } = useTranslation();
  const { rootRef: deviceSuggestionsRootRef, isVisible: showDeviceSuggestions } =
    useDismissibleSuggestions({
      query: deviceName,
      isActive:
        visibleDeviceSuggestions.length > 0 || isDeviceLookupLoading,
    });

  return (
    <>
      <h3 className="create-section-title">{t('orders.create.device')}</h3>
      <div className="create-device-search">
        <div
          ref={deviceSuggestionsRootRef}
          className="create-device-search-field modal-suggestions-anchor"
        >
          <label className="field">
            <span>{t('orders.create.deviceNumber', { number: 1 })}</span>
            <input
              value={deviceName}
              onFocus={() => {
                void onEnsureClientForDevice();
              }}
              onChange={(event) => {
                onClearSelectedDeviceSuggestion();
                onDeviceNameChange(event.target.value);
              }}
              placeholder={t('orders.create.enterDeviceName')}
              autoComplete="off"
            />
          </label>
          {showDeviceSuggestions ? (
            <div
              className="create-suggestions create-suggestions-compact create-device-suggestions"
              role="listbox"
              aria-label={t('orders.create.device')}
            >
              {isDeviceLookupLoading ? (
                <p className="create-device-suggestions-status">
                  {t('orders.create.searchingDevices')}
                </p>
              ) : null}
              {visibleDeviceSuggestions.map((device) => {
                const serial = device.serialNumber.trim();
                return (
                  <button
                    key={device.id}
                    type="button"
                    role="option"
                    className="create-suggestion-item create-suggestion-item-compact create-device-suggestion-item"
                    onClick={() => onApplyDevice(device)}
                  >
                    <strong className="create-device-suggestion-name">
                      {device.name}
                    </strong>
                    {serial ? (
                      <span className="create-device-suggestion-serial">
                        {serial}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          className="secondary-button"
          disabled={!canCreateClientDevice || isClientEnsuring}
          title={
            selectedDeviceSuggestionId
              ? t('orders.create.selectedExistingDevice')
              : hasExactDeviceMatch
                ? t('orders.create.deviceAlreadyExists')
                : undefined
          }
          onClick={() => void onOpenCreateDevice()}
        >
          {t('orders.create.createNew')}
        </button>
      </div>
      {hasExactDeviceMatch ? (
        <p className="create-device-exact-match-hint">
          {t('orders.create.foundExistingDevice')}
        </p>
      ) : null}

      <div className="create-row-2">
        <label className="field">
          <span>&nbsp;</span>
          <input
            value={deviceColor}
            onChange={(event) => onDeviceColorChange(event.target.value)}
            placeholder={t('orders.create.deviceColor')}
          />
        </label>
        <label className="field">
          <span>&nbsp;</span>
          <input
            value={deviceSerialNumber}
            onChange={(event) => {
              onClearSelectedDeviceSuggestion();
              onDeviceSerialNumberChange(event.target.value);
            }}
            placeholder={t('orders.create.serialNumber')}
          />
        </label>
      </div>

      <StringListInput
        className="create-order-kit-field"
        label={t('orders.create.kit')}
        items={deviceKit}
        onChange={onDeviceKitChange}
        placeholder={t('orders.create.kitItemPlaceholder')}
        addLabel={t('orders.create.addKitItem')}
        getRemoveLabel={(item) => t('orders.create.removeKitItem', { item })}
        maxItems={saleKitMaxItems}
        maxItemLength={saleKitMaxItemLength}
      />

      <label className="field">
        <span>{t('orders.filters.repairType')}</span>
        <select
          value={repairType}
          onChange={(event) => onRepairTypeChange(event.target.value)}
        >
          <option value="Paid">{t('orders.filters.repairTypePaid')}</option>
          <option value="Warranty">{t('orders.filters.repairTypeWarranty')}</option>
        </select>
      </label>

      <label className="field">
        <span>{t('orders.create.issueFromClient')}</span>
        <textarea
          rows={3}
          value={issueFromClient}
          onChange={(event) => onIssueFromClientChange(event.target.value)}
        />
      </label>

      <label className="field">
        <span>{t('orders.create.externalCondition')}</span>
        <textarea
          rows={3}
          value={externalView}
          onChange={(event) => onExternalViewChange(event.target.value)}
          placeholder={t('orders.create.externalConditionPlaceholder')}
        />
      </label>
    </>
  );
};