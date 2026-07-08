import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { OrderCard } from './OrderCard';
import { createOrder, createOrderItem } from '../test/factories';
import type { Order, UserRole } from '../types';

const firstItem = createOrderItem({
  id: 'item-a',
  menuItemId: 'menu-a',
  menuItemVariantId: 'variant-a',
  menuItemName: 'Noodles',
  status: 'pending'
});

const secondItem = createOrderItem({
  id: 'item-b',
  menuItemId: 'menu-b',
  menuItemVariantId: 'variant-b',
  menuItemName: 'Fried Rice',
  status: 'preparing'
});

const drinkItem = createOrderItem({
  id: 'item-c',
  menuItemId: 'menu-c',
  menuItemVariantId: 'variant-c',
  menuItemName: 'Lemon Iced Tea',
  menuItemCategory: 'Drinks',
  status: 'pending',
  isKitchenItem: false
});

const order = createOrder({
  status: 'preparing',
  totalCents: 2400,
  items: [firstItem, secondItem]
});

describe('OrderCard', () => {
  it('keeps the item order supplied by the API', () => {
    const { rerender } = renderOrderCard(order);
    expect(getRenderedItemNames()).toEqual(['Noodles', 'Fried Rice']);

    rerender(createOrderCard({
      ...order,
      items: [{ ...firstItem, status: 'preparing' }, secondItem]
    }));

    expect(getRenderedItemNames()).toEqual(['Noodles', 'Fried Rice']);
  });

  it('lets chefs advance kitchen items without showing staff-only controls', async () => {
    const user = userEvent.setup();
    const onItemStatusChange = vi.fn();
    const onOrderStatusChange = vi.fn();

    renderOrderCard(
      { ...order, status: 'pending', items: [firstItem, drinkItem] },
      { role: 'chef', onItemStatusChange, onOrderStatusChange }
    );

    expect(screen.getByText('Noodles')).toBeInTheDocument();
    expect(screen.queryByText('Lemon Iced Tea')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Checkout' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Prepare' }));
    await user.click(screen.getByRole('button', { name: 'Start' }));

    expect(onItemStatusChange).toHaveBeenCalledWith(expect.objectContaining({ id: 'order-1' }), firstItem, 'preparing');
    expect(onOrderStatusChange).toHaveBeenCalledWith(expect.objectContaining({ id: 'order-1' }), 'preparing');
  });

  it('lets staff serve ready items and checkout served unpaid orders', async () => {
    const user = userEvent.setup();
    const readyItem = { ...firstItem, status: 'ready' as const };
    const readyOrder = { ...order, status: 'ready' as const, items: [readyItem], totalCents: 1200 };
    const onItemStatusChange = vi.fn();
    const onOrderStatusChange = vi.fn();
    const onCheckout = vi.fn();
    const { rerender } = renderOrderCard(readyOrder, {
      role: 'staff',
      onItemStatusChange,
      onOrderStatusChange,
      onCheckout
    });

    const servedButtons = screen.getAllByRole('button', { name: 'Served' });
    await user.click(servedButtons[0]);
    await user.click(servedButtons[1]);

    expect(onItemStatusChange).toHaveBeenCalledWith(expect.objectContaining({ id: 'order-1' }), readyItem, 'served');
    expect(onOrderStatusChange).toHaveBeenCalledWith(expect.objectContaining({ id: 'order-1' }), 'served');

    rerender(createOrderCard({
      ...readyOrder,
      status: 'served',
      items: [{ ...readyItem, status: 'served' }]
    }, { role: 'staff', onCheckout }));

    await user.click(screen.getByRole('button', { name: 'Checkout' }));

    expect(onCheckout).toHaveBeenCalledWith(expect.objectContaining({ status: 'served' }));
  });

  it('shows admin history and edit controls for pending orders', async () => {
    const user = userEvent.setup();
    const pendingOrder = { ...order, status: 'pending' as const, items: [firstItem] };
    const onHistory = vi.fn();
    const onEdit = vi.fn();
    const onOrderStatusChange = vi.fn();

    renderOrderCard(pendingOrder, { role: 'admin', onHistory, onEdit, onOrderStatusChange });

    await user.click(screen.getByRole('button', { name: 'History' }));
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onHistory).toHaveBeenCalledWith(pendingOrder);
    expect(onEdit).toHaveBeenCalledWith(pendingOrder);
    expect(onOrderStatusChange).toHaveBeenCalledWith(pendingOrder, 'cancelled');
  });

  it('disables buttons for actions currently being processed', () => {
    renderOrderCard(
      { ...order, status: 'pending', items: [firstItem] },
      {
        role: 'chef',
        processingOrderActionId: 'order-1:preparing',
        processingItemActionId: 'item-a:preparing'
      }
    );

    expect(screen.getByRole('button', { name: 'Prepare' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Start' })).toBeDisabled();
  });

  it('reserves item action space when an item has no next action', () => {
    renderOrderCard(
      { ...order, status: 'preparing', items: [{ ...firstItem, status: 'ready' }] },
      { role: 'chef' }
    );

    const itemRow = screen.getByText('Noodles').closest('li')!;

    expect(itemRow).toHaveClass('order-item-row');
    expect(itemRow.querySelector('.order-item-details')).not.toBeNull();
    expect(itemRow.querySelector('.item-action-spacer')).not.toBeNull();
  });
});

type OrderCardOverrides = Partial<Parameters<typeof OrderCard>[0]>;

function renderOrderCard(value: Order, overrides: OrderCardOverrides = {}) {
  return render(createOrderCard(value, overrides));
}

function createOrderCard(value: Order, overrides: OrderCardOverrides = {}) {
  const role: UserRole = overrides.role ?? 'chef';

  return (
    <OrderCard
      order={value}
      role={role}
      processingOrderActionId={null}
      processingItemActionId={null}
      formatMoney={(cents) => `$${(cents / 100).toFixed(2)}`}
      formatOrderItemName={(item) => item.menuItemName}
      getOrderTitle={() => 'Table T1 / 2 guests'}
      onReceipt={() => {}}
      onHistory={() => {}}
      onEdit={() => {}}
      onOrderStatusChange={() => {}}
      onItemStatusChange={() => {}}
      onCheckout={() => {}}
      {...overrides}
    />
  );
}

function getRenderedItemNames() {
  return screen.getAllByRole('listitem').map((item) => item.querySelector('span')?.textContent);
}
