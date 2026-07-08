import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { StaffManagementPanel } from './StaffManagementPanel';
import { TableManagementPanel } from './TableManagementPanel';
import { OrderHistoryModal } from './OrderHistoryModal';
import { ReceiptModal } from './ReceiptModal';
import { createAdminUser, createChefUser, createOrder, createOrderItem, createRestaurantTable, createStaffUser } from '../test/factories';
import type { Order, OrderEvent } from '../types';

const admin = createAdminUser({ id: 'a1' });
const staff = createStaffUser({ id: 's1', name: 'Taylor', email: 'taylor@example.com' });
const protectedChef = createChefUser({ id: 'c1' });
const table = createRestaurantTable({ id: 't13', name: 'T13' });
const order = createOrder({
  id: 'order-123456',
  status: 'served',
  paymentStatus: 'paid',
  paymentMethod: 'card',
  paymentSubtotalCents: 1200,
  paymentTaxCents: 103,
  paymentTipCents: 120,
  paymentTotalCents: 1423,
  paidAt: '2026-01-01T01:00:00Z',
  items: []
});
const event: OrderEvent = {
  id: 'e1', orderId: order.id, eventType: 'order_created', fromStatus: null, toStatus: null,
  paymentMethod: null, paymentTotalCents: null, actorUserId: admin.id, actorName: 'Mitch', actorRole: 'admin',
  createdAt: '2026-01-01T00:00:00Z'
};

describe('admin and document panels', () => {
  it('forwards staff form edits and submission', async () => {
    const onName = vi.fn();
    const onCreate = vi.fn((event) => event.preventDefault());
    render(<StaffManagementPanel currentUser={admin} staffUsers={[]} newStaffName="" newStaffEmail="test@example.com"
      newStaffPassword="" newStaffRole="staff" errors={{ name: 'Enter the employee name.' }} isCreatingStaff={false}
      isProtectedDefaultUser={() => false} onCreateStaff={onCreate} onNewStaffNameChange={onName}
      onNewStaffEmailChange={vi.fn()} onNewStaffPasswordChange={vi.fn()} onNewStaffRoleChange={vi.fn()}
      onStaffRoleChange={vi.fn()} onStaffActiveChange={vi.fn()} onDeleteStaff={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(/Name/), 'Sam');
    await userEvent.click(screen.getByRole('button', { name: 'Create User' }));
    expect(onName).toHaveBeenCalled();
    expect(onCreate).toHaveBeenCalledOnce();
    expect(screen.getByText('Enter the employee name.')).toBeInTheDocument();
  });

  it('forwards table edits on blur', async () => {
    const onTableUpdate = vi.fn();
    render(<TableManagementPanel tables={[table]} newTableName="T14" newTableCapacity="4" errors={{}}
      isCreatingTable={false} isProtectedDefaultTable={() => false} onCreateTable={vi.fn()}
      onNewTableNameChange={vi.fn()} onNewTableCapacityChange={vi.fn()} onTableUpdate={onTableUpdate} onDeleteTable={vi.fn()} />);

    const name = screen.getByLabelText('T13 name');
    await userEvent.clear(name);
    await userEvent.type(name, 'Patio');
    await userEvent.tab();
    expect(onTableUpdate).toHaveBeenCalledWith(table, { name: 'Patio' });
  });

  it('updates staff role and active state and forwards deletion', async () => {
    const onStaffRoleChange = vi.fn();
    const onStaffActiveChange = vi.fn();
    const onDeleteStaff = vi.fn();
    render(<StaffManagementPanel currentUser={admin} staffUsers={[staff]} newStaffName="" newStaffEmail="test@example.com"
      newStaffPassword="" newStaffRole="staff" errors={{}} isCreatingStaff={false}
      isProtectedDefaultUser={() => false} onCreateStaff={vi.fn()} onNewStaffNameChange={vi.fn()}
      onNewStaffEmailChange={vi.fn()} onNewStaffPasswordChange={vi.fn()} onNewStaffRoleChange={vi.fn()}
      onStaffRoleChange={onStaffRoleChange} onStaffActiveChange={onStaffActiveChange} onDeleteStaff={onDeleteStaff} />);

    await userEvent.selectOptions(screen.getAllByRole('combobox')[1], 'chef');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Active' }));
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(onStaffRoleChange).toHaveBeenCalledWith(staff, 'chef');
    expect(onStaffActiveChange).toHaveBeenCalledWith(staff, false);
    expect(onDeleteStaff).toHaveBeenCalledWith(staff);
  });

  it('does not expose destructive controls for protected demo users', () => {
    render(<StaffManagementPanel currentUser={admin} staffUsers={[protectedChef]} newStaffName="" newStaffEmail="test@example.com"
      newStaffPassword="" newStaffRole="staff" errors={{}} isCreatingStaff={false}
      isProtectedDefaultUser={() => true} onCreateStaff={vi.fn()} onNewStaffNameChange={vi.fn()}
      onNewStaffEmailChange={vi.fn()} onNewStaffPasswordChange={vi.fn()} onNewStaffRoleChange={vi.fn()}
      onStaffRoleChange={vi.fn()} onStaffActiveChange={vi.fn()} onDeleteStaff={vi.fn()} />);

    expect(screen.getByText('Protected')).toBeInTheDocument();
    expect(screen.getAllByRole('combobox')[1]).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  });

  it('creates and updates table capacity and status before deleting', async () => {
    const onCreateTable = vi.fn((event) => event.preventDefault());
    const onTableUpdate = vi.fn();
    const onDeleteTable = vi.fn();
    render(<TableManagementPanel tables={[table]} newTableName="T14" newTableCapacity="4" errors={{}}
      isCreatingTable={false} isProtectedDefaultTable={() => false} onCreateTable={onCreateTable}
      onNewTableNameChange={vi.fn()} onNewTableCapacityChange={vi.fn()} onTableUpdate={onTableUpdate} onDeleteTable={onDeleteTable} />);

    const capacity = screen.getByLabelText('T13 capacity');
    await userEvent.clear(capacity);
    await userEvent.type(capacity, '6');
    await userEvent.tab();
    await userEvent.selectOptions(screen.getByLabelText('T13 status'), 'needs_cleaning');
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await userEvent.click(screen.getByRole('button', { name: 'Create Table' }));

    expect(onTableUpdate).toHaveBeenCalledWith(table, { capacity: 6 });
    expect(onTableUpdate).toHaveBeenCalledWith(table, { status: 'needs_cleaning' });
    expect(onDeleteTable).toHaveBeenCalledWith(table);
    expect(onCreateTable).toHaveBeenCalledOnce();
  });

  it('prevents deleting occupied tables and hides deletion for protected tables', () => {
    const occupied = { ...table, status: 'occupied' as const };
    const { rerender } = render(<TableManagementPanel tables={[occupied]} newTableName="T14" newTableCapacity="4" errors={{}}
      isCreatingTable={false} isProtectedDefaultTable={() => false} onCreateTable={vi.fn()}
      onNewTableNameChange={vi.fn()} onNewTableCapacityChange={vi.fn()} onTableUpdate={vi.fn()} onDeleteTable={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();

    rerender(<TableManagementPanel tables={[table]} newTableName="T14" newTableCapacity="4" errors={{}}
      isCreatingTable={false} isProtectedDefaultTable={() => true} onCreateTable={vi.fn()}
      onNewTableNameChange={vi.fn()} onNewTableCapacityChange={vi.fn()} onTableUpdate={vi.fn()} onDeleteTable={vi.fn()} />);
    expect(screen.getByText('Protected')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  });

  it('renders history events and closes the history dialog', async () => {
    const onClose = vi.fn();
    render(<OrderHistoryModal order={order} events={[event]} isLoading={false} getOrderTitle={() => 'Table T1'}
      formatOrderEvent={() => 'Order created'} formatDateTime={() => 'Jan 1'} onClose={onClose} />);
    expect(screen.getByText('Order created')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('exposes print and close commands from the receipt', async () => {
    const onPrint = vi.fn(); const onClose = vi.fn();
    render(<ReceiptModal order={order} orderSourceLabels={{ in_person: 'In-person', phone: 'Phone' }}
      fulfillmentLabels={{ dine_in: 'Dine-in', to_go: 'To-go', pickup: 'Pickup', delivery: 'Delivery' }}
      formatMoney={(value) => `$${(value / 100).toFixed(2)}`} formatOrderItemName={() => ''}
      formatDateTime={() => 'Jan 1'} getOrderTitle={() => 'Table T1'} onPrint={onPrint} onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: 'Print' }));
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onPrint).toHaveBeenCalledOnce(); expect(onClose).toHaveBeenCalledOnce();
  });

  it('renders phone receipt details, item payment markers, notes, and split payments', () => {
    const paidPhoneOrder: Order = {
      ...order,
      id: 'phone-order-987654',
      orderSource: 'phone',
      fulfillmentType: 'pickup',
      tableNumber: null,
      phoneNumber: '6025550100',
      notes: 'Extra napkins',
      paymentMethod: 'cash',
      payments: [
        {
          id: 'pay-1', orderId: order.id, paymentMethod: 'card',
          subtotalCents: 1200, taxCents: 103, tipCents: 120, totalCents: 1423,
          actorName: 'Kent', actorRole: 'staff', createdAt: '2026-01-01T01:00:00Z',
          itemIds: ['item-1']
        },
        {
          id: 'pay-2', orderId: order.id, paymentMethod: 'cash',
          subtotalCents: 480, taxCents: 41, tipCents: 0, totalCents: 521,
          actorName: 'Kent', actorRole: 'staff', createdAt: '2026-01-01T01:05:00Z',
          itemIds: ['item-2']
        }
      ],
      items: [
        createOrderItem({
          id: 'item-1',
          menuItemId: 'm1',
          menuItemVariantId: 'v1',
          menuItemName: 'Noodles',
          status: 'served',
          paymentId: 'pay-1'
        }),
        createOrderItem({
          id: 'item-2',
          menuItemId: 'm2',
          menuItemVariantId: 'v2',
          menuItemName: 'Lemon Iced Tea',
          menuItemCategory: 'Drinks',
          quantity: 2,
          priceCents: 480,
          status: 'served',
          isKitchenItem: false
        })
      ]
    };

    render(<ReceiptModal order={paidPhoneOrder} orderSourceLabels={{ in_person: 'In-person', phone: 'Phone' }}
      fulfillmentLabels={{ dine_in: 'Dine-in', to_go: 'To-go', pickup: 'Pickup', delivery: 'Delivery' }}
      formatMoney={(value) => `$${(value / 100).toFixed(2)}`}
      formatOrderItemName={(item) => `${item.menuItemName} x ${item.quantity}`}
      formatDateTime={(value) => `formatted ${value}`} getOrderTitle={() => 'Phone 0100'}
      onPrint={vi.fn()} onClose={vi.fn()} />);

    expect(screen.getByText('PHONE-OR')).toBeInTheDocument();
    expect(screen.getByText('Phone / Pickup')).toBeInTheDocument();
    expect(screen.getByText('6025550100')).toBeInTheDocument();
    expect(screen.getByText('Noodles x 1 / Paid')).toBeInTheDocument();
    expect(screen.getByText('Lemon Iced Tea x 2')).toBeInTheDocument();
    expect(screen.getByText('Extra napkins')).toBeInTheDocument();
    expect(screen.getByText('Payment 1 / card')).toBeInTheDocument();
    expect(screen.getByText('Payment 2 / cash')).toBeInTheDocument();
    expect(screen.getByText('formatted 2026-01-01T01:00:00Z')).toBeInTheDocument();
  });
});
