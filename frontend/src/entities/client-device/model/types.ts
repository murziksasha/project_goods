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
};
