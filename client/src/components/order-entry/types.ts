import type { FormEvent } from 'react';
import type {
  DraftItem,
  FulfillmentType,
  MenuBundle,
  MenuItem,
  OrderSource,
  RestaurantTable,
  UserRole
} from '../../types';
import type { OrderFormErrors } from '../../utils/orderFormValidation';

export type StaffOrderStep = 'service' | 'table' | 'party' | 'phone' | 'menu';

export type OrderEntryPanelProps = {
  role: UserRole;
  editingOrderId: string | null;
  staffOrderStep: StaffOrderStep;
  orderSource: OrderSource;
  fulfillmentType: FulfillmentType;
  tableNumber: string;
  partySize: string;
  phoneNumber: string;
  serverName: string;
  notes: string;
  selectedCategory: string;
  selectedItems: Record<string, number>;
  selectedBundles: Record<string, number>;
  categories: string[];
  menuItems: MenuItem[];
  menuBundles: MenuBundle[];
  restaurantTables: RestaurantTable[];
  selectedTable: RestaurantTable | undefined;
  tableStatusLabels: Record<RestaurantTable['status'], string>;
  draftItems: DraftItem[];
  draftTotal: number;
  maxPartySize: number;
  formErrors: OrderFormErrors;
  isSubmitting: boolean;
  formatMoney: (cents: number) => string;
  formatMenuVariantLabel: (menuItem: MenuItem, variant: MenuItem['variants'][number]) => string;
  getMenuItemVariantById: (menuItems: MenuItem[], variantId: string) => MenuItem['variants'][number] | undefined;
  getOrderFlowLabel: (
    orderSource: OrderSource,
    fulfillmentType: FulfillmentType,
    tableNumber: string,
    partySize: string,
    phoneNumber: string
  ) => string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onStartStaffOrder: (source: OrderSource, fulfillment: FulfillmentType) => void;
  onOrderSourceChange: (source: OrderSource) => void;
  onFulfillmentTypeChange: (fulfillmentType: FulfillmentType) => void;
  onTableSelect: (table: RestaurantTable) => void;
  onTableCleaned: (table: RestaurantTable) => void;
  onOpenTablePicker: () => void;
  onPartySizeChange: (value: string) => void;
  onPhoneNumberChange: (value: string) => void;
  onServerNameChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onSelectedCategoryChange: (category: string) => void;
  onStaffOrderStepChange: (step: StaffOrderStep) => void;
  onResetOrderDraft: () => void;
  onGoToStaffPartyStep: () => void;
  onGoToStaffMenuStep: () => void;
  onMenuQuantityChange: (menuItemVariantId: string, quantity: number) => void;
  onBundleQuantityChange: (bundleId: string, quantity: number) => void;
  onCancelEdit: () => void;
};
