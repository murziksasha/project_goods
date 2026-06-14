import type { ClientDevice } from '../../../entities/client-device/model/types';

type CreateOrderRepairSectionProps = {
  deviceName: string;
  deviceSerialNumber: string;
  deviceColor: string;
  deviceKit: string;
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
  onDeviceKitChange: (value: string) => void;
  onRepairTypeChange: (value: string) => void;
  onIssueFromClientChange: (value: string) => void;
  onExternalViewChange: (value: string) => void;
  onClearSelectedDeviceSuggestion: () => void;
  onEnsureClientForDevice: () => Promise<unknown>;
  onOpenCreateDevice: () => Promise<void>;
  onApplyDevice: (device: ClientDevice) => void;
};

export const CreateOrderRepairSection = ({
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
}: CreateOrderRepairSectionProps) => (
  <>
    <h3 className="create-section-title">Device</h3>
    <div className="create-device-search">
      <label className="field">
        <span>Device #1 *</span>
        <input
          value={deviceName}
          onFocus={() => {
            void onEnsureClientForDevice();
          }}
          onChange={(event) => {
            onClearSelectedDeviceSuggestion();
            onDeviceNameChange(event.target.value);
          }}
          placeholder="Enter device name"
        />
      </label>
      <button
        type="button"
        className="secondary-button"
        disabled={!canCreateClientDevice || isClientEnsuring}
        title={
          selectedDeviceSuggestionId
            ? 'Selected existing device'
            : hasExactDeviceMatch
              ? 'Device already exists'
              : undefined
        }
        onClick={() => void onOpenCreateDevice()}
      >
        Create new
      </button>
    </div>
    {hasExactDeviceMatch ? <p>Found existing device with this name.</p> : null}
    {visibleDeviceSuggestions.length > 0 || isDeviceLookupLoading ? (
      <div className="create-suggestions create-suggestions-compact create-device-suggestions">
        {isDeviceLookupLoading ? <p>Searching devices...</p> : null}
        {visibleDeviceSuggestions.map((device) => (
          <button
            key={device.id}
            type="button"
            className="create-suggestion-item create-suggestion-item-compact"
            onClick={() => onApplyDevice(device)}
          >
            <strong>{device.name}</strong>
            <span>{device.serialNumber || '-'}</span>
          </button>
        ))}
      </div>
    ) : null}

    <div className="create-row-2">
      <label className="field">
        <span>&nbsp;</span>
        <input
          value={deviceColor}
          onChange={(event) => onDeviceColorChange(event.target.value)}
          placeholder="Device color"
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
          placeholder="Serial number"
        />
      </label>
    </div>

    <label className="field">
      <span>Kit</span>
      <input
        value={deviceKit}
        onChange={(event) => onDeviceKitChange(event.target.value)}
        placeholder="Describe accessories"
      />
    </label>

    <label className="field">
      <span>Repair type</span>
      <select
        value={repairType}
        onChange={(event) => onRepairTypeChange(event.target.value)}
      >
        <option>Paid</option>
        <option>Warranty</option>
      </select>
    </label>

    <label className="field">
      <span>Issue from client</span>
      <textarea
        rows={3}
        value={issueFromClient}
        onChange={(event) => onIssueFromClientChange(event.target.value)}
      />
    </label>

    <label className="field">
      <span>External condition</span>
      <textarea
        rows={3}
        value={externalView}
        onChange={(event) => onExternalViewChange(event.target.value)}
        placeholder="Scratches, dents..."
      />
    </label>
  </>
);
