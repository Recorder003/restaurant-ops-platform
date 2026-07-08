import type { FulfillmentType, OrderSource } from '../types';

export const menuCategories = ['Combos', 'Entrees', 'Vegetables', 'Small Plates', 'Drinks', 'Desserts'];

export const orderSourceLabels: Record<OrderSource, string> = {
  in_person: 'In-person',
  phone: 'Phone'
};

export const fulfillmentLabels: Record<FulfillmentType, string> = {
  dine_in: 'Dine-in',
  to_go: 'To-go',
  pickup: 'Pickup',
  delivery: 'Delivery'
};

export const tableStatusLabels = {
  available: 'Available',
  occupied: 'Occupied',
  needs_cleaning: 'Needs cleaning'
};

export const tipPresetOptions = [10, 15, 20];

export const extraChairsAllowed = 2;

export const taxRate = 0.086;
