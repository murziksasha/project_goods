import { useState } from 'react';
import type { Employee } from '../../../entities/employee/model/types';
import type { CreateOrderRequestPayload } from '../model/order-request';

type CreateOrderCardProps = {
  isSaving: boolean;
  employees: Employee[];
  initialTab?: CreateOrderRequestPayload['sourceTab'];
  onClose: () => void;
  onSave: (payload: CreateOrderRequestPayload) => Promise<boolean>;
};

const topTabs: Array<{ key: CreateOrderRequestPayload['sourceTab']; label: string }> = [
  { key: 'repair', label: 'Repair order' },
  { key: 'sale', label: 'Sales order' },
];

const extraOptionsLeft = [
  'Device stays with client',
  'Urgent repair',
  'Accepted by post',
  'Start work without confirmation',
  'Client can wait for parts',
];

const extraOptionsRight = [
  'Courier took device',
  'Replacement device issued',
  'Home master call',
];

const formatPhone = (input: string) => {
  const digitsOnly = input.replace(/\D/g, '');
  const localDigits = (digitsOnly.startsWith('380') ? digitsOnly.slice(3) : digitsOnly).slice(0, 9);

  let result = '+380';
  if (localDigits.length > 0) result += ` ${localDigits.slice(0, 2)}`;
  if (localDigits.length > 2) result += ` ${localDigits.slice(2, 5)}`;
  if (localDigits.length > 5) result += ` ${localDigits.slice(5, 7)}`;
  if (localDigits.length > 7) result += ` ${localDigits.slice(7, 9)}`;
  return result;
};

export const CreateOrderCard = ({
  isSaving,
  employees,
  initialTab = 'repair',
  onClose,
  onSave,
}: CreateOrderCardProps) => {
  const [activeTab, setActiveTab] = useState<CreateOrderRequestPayload['sourceTab']>(initialTab);
  const [clientPhone, setClientPhone] = useState('+380');
  const [clientName, setClientName] = useState('');
  const [discountCode, setDiscountCode] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [deviceSerialNumber, setDeviceSerialNumber] = useState('');
  const [deviceColor, setDeviceColor] = useState('');
  const [deviceKit, setDeviceKit] = useState('');
  const [repairType, setRepairType] = useState('Paid');
  const [issueFromClient, setIssueFromClient] = useState('');
  const [externalView, setExternalView] = useState('');
  const [estimatedCost, setEstimatedCost] = useState('');
  const [prepayment, setPrepayment] = useState('');
  const [prepaymentComment, setPrepaymentComment] = useState('');
  const [readyDate, setReadyDate] = useState(new Date().toISOString().slice(0, 10));
  const [readyTime, setReadyTime] = useState('');
  const [managerId, setManagerId] = useState('');
  const [masterId, setMasterId] = useState('');
  const [selectedFlags, setSelectedFlags] = useState<string[]>([]);

  const managers = employees.filter(
    (employee) =>
      employee.isActive &&
      (employee.role === 'owner' ||
        employee.role === 'manager' ||
        employee.permissions.includes('orders.manage')),
  );
  const masters = employees.filter(
    (employee) =>
      employee.isActive &&
      (employee.role === 'owner' ||
        employee.role === 'master' ||
        employee.permissions.includes('repairs.execute')),
  );

  const toggleFlag = (flag: string) => {
    setSelectedFlags((current) =>
      current.includes(flag)
        ? current.filter((item) => item !== flag)
        : [...current, flag],
    );
  };

  const fillRepairDemo = () => {
    const suffix = Date.now().toString().slice(-6);
    setActiveTab('repair');
    setClientPhone('+380 67 111 22 33');
    setClientName('Ivan Petrenko');
    setDiscountCode('');
    setDeviceName('Laptop Lenovo IdeaPad 5');
    setDeviceSerialNumber(`RPR-${suffix}`);
    setDeviceColor('Silver');
    setDeviceKit('Laptop, charger');
    setRepairType('Paid');
    setIssueFromClient('Does not charge and shuts down after a few minutes.');
    setExternalView('Small scratches on the top cover, no liquid marks.');
    setEstimatedCost('1800');
    setPrepayment('300');
    setPrepaymentComment('Cash prepayment');
    setReadyDate(new Date().toISOString().slice(0, 10));
    setReadyTime('17:30');
    setSelectedFlags(['Urgent repair', 'Start work without confirmation']);
  };

  const fillSaleDemo = () => {
    const suffix = Date.now().toString().slice(-6);
    setActiveTab('sale');
    setClientPhone('+380 50 101 01 01');
    setClientName('Maxim Bondar');
    setDiscountCode('VIP');
    setDeviceName('Portable SSD Samsung T7 1TB');
    setDeviceSerialNumber(`SAL-${suffix}`);
    setDeviceColor('Blue');
    setDeviceKit('Box, cable, warranty card');
    setRepairType('Paid');
    setIssueFromClient('Client buys a new device from stock.');
    setExternalView('New sealed package.');
    setEstimatedCost('3899');
    setPrepayment('3899');
    setPrepaymentComment('Full payment');
    setReadyDate(new Date().toISOString().slice(0, 10));
    setReadyTime('15:00');
    setSelectedFlags(['Device stays with client']);
  };

  const handleSave = async () => {
    const success = await onSave({
      clientPhone,
      clientName,
      discountCode,
      deviceName,
      deviceSerialNumber,
      deviceColor,
      deviceKit,
      repairType,
      issueFromClient,
      externalView,
      estimatedCost,
      prepayment,
      prepaymentComment,
      readyDate,
      readyTime,
      managerId,
      masterId,
      extraFlags: selectedFlags,
      sourceTab: activeTab,
    });

    if (success) {
      onClose();
    }
  };

  return (
    <section className="create-order-page">
      <header className="create-order-header">
        <h2>Create order</h2>
        <button type="button" className="create-order-close" aria-label="Close create form" onClick={onClose}>
          x
        </button>
      </header>

      <div className="create-order-body">
        <div className="create-order-tabs" role="tablist" aria-label="Order type tabs">
          {topTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={tab.key === activeTab ? 'create-order-tab create-order-tab-active' : 'create-order-tab'}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="create-order-test-actions">
          <button type="button" className="toolbar-filter-button" onClick={fillRepairDemo}>
            Autofill repair
          </button>
          <button type="button" className="toolbar-filter-button" onClick={fillSaleDemo}>
            Autofill sale
          </button>
        </div>

        <div className="create-order-grid">
          <div className="create-order-left">
            <label className="field">
              <span>Order number</span>
              <input placeholder="Automatic r000001" readOnly />
            </label>

            <h3 className="create-section-title">Client</h3>
            <div className="create-row-3">
              <label className="field">
                <span>Client data *</span>
                <input
                  value={clientPhone}
                  onChange={(event) => setClientPhone(formatPhone(event.target.value))}
                  onFocus={() => setClientPhone((current) => current || '+380')}
                  placeholder="+380"
                />
              </label>
              <label className="field">
                <span>&nbsp;</span>
                <input
                  value={clientName}
                  onChange={(event) => setClientName(event.target.value)}
                  placeholder="Full name"
                />
              </label>
              <label className="field">
                <span>&nbsp;</span>
                <select defaultValue="Individual">
                  <option>Individual</option>
                  <option>Business</option>
                </select>
              </label>
            </div>

            <label className="field">
              <span>Discount code</span>
              <input value={discountCode} onChange={(event) => setDiscountCode(event.target.value)} />
            </label>

            <h3 className="create-section-title">Device</h3>
            <div className="create-device-search">
              <label className="field">
                <span>Device #1 *</span>
                <input
                  value={deviceName}
                  onChange={(event) => setDeviceName(event.target.value)}
                  placeholder="Enter device name"
                />
              </label>
              <button type="button" className="secondary-button">Create new</button>
            </div>

            <div className="create-row-2">
              <label className="field">
                <span>&nbsp;</span>
                <input
                  value={deviceColor}
                  onChange={(event) => setDeviceColor(event.target.value)}
                  placeholder="Device color"
                />
              </label>
              <label className="field">
                <span>&nbsp;</span>
                <input
                  value={deviceSerialNumber}
                  onChange={(event) => setDeviceSerialNumber(event.target.value)}
                  placeholder="Serial number"
                />
              </label>
            </div>

            <label className="field">
              <span>Kit</span>
              <input
                value={deviceKit}
                onChange={(event) => setDeviceKit(event.target.value)}
                placeholder="Describe accessories"
              />
            </label>

            <label className="field">
              <span>Repair type</span>
              <select value={repairType} onChange={(event) => setRepairType(event.target.value)}>
                <option>Paid</option>
                <option>Warranty</option>
              </select>
            </label>

            <label className="field">
              <span>Issue from client</span>
              <textarea
                rows={3}
                value={issueFromClient}
                onChange={(event) => setIssueFromClient(event.target.value)}
              />
            </label>

            <label className="field">
              <span>External condition</span>
              <textarea
                rows={3}
                value={externalView}
                onChange={(event) => setExternalView(event.target.value)}
                placeholder="Scratches, dents..."
              />
            </label>

            <h3 className="create-section-title">Cost</h3>
            <div className="create-cost-row">
              <label className="field">
                <span>Estimated cost</span>
                <input
                  type="number"
                  min="0"
                  value={estimatedCost}
                  onChange={(event) => setEstimatedCost(event.target.value)}
                />
              </label>
              <div className="create-currency-tag">UAH</div>
              <button type="button" className="secondary-button">Cash</button>
            </div>

            <label className="create-inline-checkbox">
              <input type="checkbox" defaultChecked />
              <span>"Total" equals "Repair cost"</span>
            </label>

            <div className="create-prepay-row">
              <label className="field">
                <span>Prepayment</span>
                <input
                  type="number"
                  min="0"
                  value={prepayment}
                  onChange={(event) => setPrepayment(event.target.value)}
                  placeholder="Enter amount"
                />
              </label>
              <div className="create-currency-tag">UAH</div>
              <label className="field">
                <span>&nbsp;</span>
                <input
                  value={prepaymentComment}
                  onChange={(event) => setPrepaymentComment(event.target.value)}
                  placeholder="Prepayment comment"
                />
              </label>
            </div>

            <div className="create-prepay-row">
              <label className="field">
                <span>Estimated ready date</span>
                <input type="date" value={readyDate} onChange={(event) => setReadyDate(event.target.value)} />
              </label>
              <label className="field">
                <span>&nbsp;</span>
                <input type="time" value={readyTime} onChange={(event) => setReadyTime(event.target.value)} />
              </label>
            </div>

            <h4 className="create-subtitle">Additional information</h4>
            <div className="create-checks-grid">
              <div className="create-checks-col">
                {extraOptionsLeft.map((option) => (
                  <label key={option} className="create-inline-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedFlags.includes(option)}
                      onChange={() => toggleFlag(option)}
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
              <div className="create-checks-col">
                {extraOptionsRight.map((option) => (
                  <label key={option} className="create-inline-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedFlags.includes(option)}
                      onChange={() => toggleFlag(option)}
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
            </div>

            <h3 className="create-section-title">Responsible</h3>
            <div className="create-row-2">
              <label className="field">
                <span>Manager</span>
                <select value={managerId} onChange={(event) => setManagerId(event.target.value)}>
                  <option value="">Select manager</option>
                  {managers.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Master</span>
                <select value={masterId} onChange={(event) => setMasterId(event.target.value)}>
                  <option value="">Select master</option>
                  {masters.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="create-order-actions">
              <button type="button" className="secondary-button" onClick={onClose}>
                Cancel
              </button>
              <button type="button" className="primary-button" onClick={handleSave} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save order'}
              </button>
            </div>
          </div>

          <aside className="create-order-right">
            <section className="create-side-box">
              <h4>Client requests</h4>
              <p>Select client or device to view previous requests.</p>
            </section>

            <section className="create-side-box">
              <h4>Client devices</h4>
              <p>Select client to view devices that were already in service.</p>
            </section>

            <section className="create-side-box">
              <h4>Selected flags</h4>
              <p>{selectedFlags.length > 0 ? selectedFlags.join(', ') : 'No flags selected.'}</p>
            </section>
          </aside>
        </div>
      </div>
    </section>
  );
};
