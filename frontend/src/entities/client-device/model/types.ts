export type ClientDevice = {
  id: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  name: string;
  serialNumber: string;
  note: string;
  source: 'clientCard' | 'repairOrder';
  isActive: boolean;
  canRemove?: boolean;
  usageCount?: number;
  createdAt: string;
  updatedAt: string;
};

export type ClientDeviceFormValues = {
  clientId: string;
  clientName: string;
  clientPhone: string;
  name: string;
  serialNumber: string;
  note: string;
  source?: 'clientCard' | 'repairOrder';
  isActive?: boolean;
  expectedUpdatedAt?: string;
};

