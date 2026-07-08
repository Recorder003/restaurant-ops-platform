import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PartyStep, PhoneStep, ServiceStep, TableStep } from './StaffOrderSteps';
import { createRestaurantTable } from '../../test/factories';

const tableStatusLabels = {
  available: 'Available',
  occupied: 'Occupied',
  needs_cleaning: 'Needs cleaning'
};

describe('StaffOrderSteps', () => {
  it('starts service flows with the expected source and fulfillment', async () => {
    const user = userEvent.setup();
    const onStartStaffOrder = vi.fn();

    render(<ServiceStep onStartStaffOrder={onStartStaffOrder} />);

    await user.click(screen.getByRole('button', { name: /Dine-in/ }));
    await user.click(screen.getByRole('button', { name: /Phone delivery/ }));

    expect(onStartStaffOrder).toHaveBeenNthCalledWith(1, 'in_person', 'dine_in');
    expect(onStartStaffOrder).toHaveBeenNthCalledWith(2, 'phone', 'delivery');
  });

  it('selects available tables, blocks occupied tables, and marks cleaning tables', async () => {
    const user = userEvent.setup();
    const availableTable = createRestaurantTable({ id: 'table-1', name: 'T1', status: 'available' });
    const occupiedTable = createRestaurantTable({ id: 'table-2', name: 'T2', status: 'occupied' });
    const cleaningTable = createRestaurantTable({ id: 'table-3', name: 'T3', status: 'needs_cleaning' });
    const onTableSelect = vi.fn();
    const onTableCleaned = vi.fn();

    render(
      <TableStep
        tableNumber=""
        restaurantTables={[availableTable, occupiedTable, cleaningTable]}
        tableStatusLabels={tableStatusLabels}
        formErrors={{ tableNumber: 'Choose a table.' }}
        tableErrorRef={createRef()}
        onTableSelect={onTableSelect}
        onTableCleaned={onTableCleaned}
        onResetOrderDraft={vi.fn()}
        onGoToStaffPartyStep={vi.fn()}
      />
    );

    expect(screen.getByText('Choose a table.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /T2/ })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: /T1/ }));
    await user.click(screen.getByRole('button', { name: 'T3 Cleaned' }));

    expect(onTableSelect).toHaveBeenCalledWith(availableTable);
    expect(onTableCleaned).toHaveBeenCalledWith(cleaningTable);
  });

  it('adjusts party size within the configured maximum and advances to menu', async () => {
    const user = userEvent.setup();
    const onPartySizeChange = vi.fn();
    const onStaffOrderStepChange = vi.fn();
    const onGoToStaffMenuStep = vi.fn();

    render(
      <PartyStep
        partySize="4"
        selectedTable={createRestaurantTable({ name: 'T4', capacity: 4 })}
        maxPartySize={4}
        formErrors={{ partySize: 'Party is too large.' }}
        partySizeRef={createRef()}
        onPartySizeChange={onPartySizeChange}
        onStaffOrderStepChange={onStaffOrderStepChange}
        onGoToStaffMenuStep={onGoToStaffMenuStep}
      />
    );

    expect(screen.getByText('T4 seats 4. Max 4 with extra chairs.')).toBeInTheDocument();
    expect(screen.getByText('Party is too large.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: '-' }));
    await user.click(screen.getByRole('button', { name: 'Back' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));

    expect(onPartySizeChange).toHaveBeenCalledWith('3');
    expect(onStaffOrderStepChange).toHaveBeenCalledWith('table');
    expect(onGoToStaffMenuStep).toHaveBeenCalledOnce();
  });

  it('shows phone errors and forwards phone input and navigation', async () => {
    const user = userEvent.setup();
    const onPhoneNumberChange = vi.fn();
    const onResetOrderDraft = vi.fn();
    const onGoToStaffMenuStep = vi.fn();

    render(
      <PhoneStep
        phoneNumber="602"
        formErrors={{ phoneNumber: 'Enter a phone number.' }}
        phoneRef={createRef()}
        onPhoneNumberChange={onPhoneNumberChange}
        onResetOrderDraft={onResetOrderDraft}
        onGoToStaffMenuStep={onGoToStaffMenuStep}
      />
    );

    expect(screen.getByText('Enter a phone number.')).toBeInTheDocument();

    await user.type(screen.getByLabelText(/Phone/), '555');
    await user.click(screen.getByRole('button', { name: 'Back' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));

    expect(onPhoneNumberChange).toHaveBeenCalled();
    expect(onResetOrderDraft).toHaveBeenCalledOnce();
    expect(onGoToStaffMenuStep).toHaveBeenCalledOnce();
  });
});
