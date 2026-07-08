import { useEffect, useRef } from 'react';
import { AdminOrderForm } from './order-entry/AdminOrderForm';
import { StaffOrderWizard } from './order-entry/StaffOrderWizard';
import type { OrderEntryPanelProps, StaffOrderStep } from './order-entry/types';

export type { StaffOrderStep };

export function OrderEntryPanel(props: OrderEntryPanelProps) {
  const {
  role,
  formErrors
  } = props;
  const tableErrorRef = useRef<HTMLDivElement>(null);
  const partySizeRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const serverRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const firstErrorTarget =
      formErrors.tableNumber ? tableErrorRef.current :
      formErrors.partySize ? partySizeRef.current :
      formErrors.phoneNumber ? phoneRef.current :
      formErrors.serverName ? serverRef.current :
      null;

    firstErrorTarget?.focus();
  }, [formErrors]);

  if (role === 'staff') {
    return (
      <StaffOrderWizard
        {...props}
        tableErrorRef={tableErrorRef}
        partySizeRef={partySizeRef}
        phoneRef={phoneRef}
      />
    );
  }

  return (
    <AdminOrderForm
      {...props}
      tableErrorRef={tableErrorRef}
      partySizeRef={partySizeRef}
      phoneRef={phoneRef}
      serverRef={serverRef}
    />
  );
}
