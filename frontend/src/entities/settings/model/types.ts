import type {
  PrintContentMargins,
  PrintForm,
  PrintFormType,
  PrintLayoutBlock,
  PrintLayoutField,
  PrintLayoutTableColumn,
  PrintLayoutTableRow,
  PrintLayoutTextAlign,
  PrintLayoutTextWeight,
  RateProvider,
  WeatherProvider,
} from '../../../shared/types/domain';

export type {
  PrintContentMargins,
  PrintForm,
  PrintFormType,
  PrintLayoutBlock,
  PrintLayoutField,
  PrintLayoutTableColumn,
  PrintLayoutTableRow,
  PrintLayoutTextAlign,
  PrintLayoutTextWeight,
  RateProvider,
  WeatherProvider,
};

export type OrderDefaults = {
  defaultRepairTermDays: number;
  defaultWarrantyMonths: number;
  defaultRepairStatus: string;
  defaultSaleStatus: string;
};

export type NumberingSettings = {
  repairPrefix: string;
  salePrefix: string;
  supplierOrderPrefix: string;
  nextRepairNumber: number;
  nextSaleNumber: number;
  nextSupplierOrderNumber: number;
};

export type FinanceDefaults = {
  currency: string;
  paymentMethod: 'cash' | 'non-cash';
};

export type NotificationSettings = {
  smsEnabled: boolean;
  messengerEnabled: boolean;
  emailEnabled: boolean;
};


export type ForecastView = 'today' | 'tomorrow' | 'fiveDay';

export type WeatherLocationPreset = 'chornomorsk' | 'odesa';

export type DashboardPreferences = {
  marketWeatherEnabled: boolean;
  exchangeRatesEnabled: boolean;
  weatherEnabled: boolean;
  weatherAnimationEnabled: boolean;
  weatherProvider: WeatherProvider;
  /** Always empty from API; kept for form shape / legacy. Key is server env only. */
  openWeatherApiKey: string;
  /** True when backend has OPENWEATHER_API_KEY configured. */
  hasOpenWeatherApiKey?: boolean;
  defaultWeatherLocation: WeatherLocationPreset;
  currencies: string[];
  rateProviders: RateProvider[];
  defaultForecastView: ForecastView;
};

export type AppSettings = {
  id: string;
  serviceName: string;
  company: string;
  companyAddress: string;
  companyId: string;
  companyIban: string;
  companyEmail: string;
  companySite: string;
  printForms: PrintForm[];
  orderDefaults: OrderDefaults;
  numbering: NumberingSettings;
  financeDefaults: FinanceDefaults;
  notificationSettings: NotificationSettings;
  dashboardPreferences: DashboardPreferences;
  createdAt: string;
  updatedAt: string;
};

export type AppSettingsFormValues = {
  serviceName: string;
  company: string;
  companyAddress: string;
  companyId: string;
  companyIban: string;
  companyEmail: string;
  companySite: string;
  printForms: PrintForm[];
  orderDefaults: OrderDefaults;
  numbering: NumberingSettings;
  financeDefaults: FinanceDefaults;
  notificationSettings: NotificationSettings;
  dashboardPreferences: DashboardPreferences;
};
