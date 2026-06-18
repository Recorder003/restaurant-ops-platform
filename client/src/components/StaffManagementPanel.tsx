import type { FormEvent } from 'react';
import type { User, UserRole } from '../types';

type StaffManagementPanelProps = {
  currentUser: User;
  staffUsers: User[];
  newStaffName: string;
  newStaffEmail: string;
  newStaffPassword: string;
  newStaffRole: UserRole;
  errors: Partial<Record<'name' | 'email' | 'password', string>>;
  isCreatingStaff: boolean;
  isProtectedDefaultUser: (user: User) => boolean;
  onCreateStaff: (event: FormEvent<HTMLFormElement>) => void;
  onNewStaffNameChange: (value: string) => void;
  onNewStaffEmailChange: (value: string) => void;
  onNewStaffPasswordChange: (value: string) => void;
  onNewStaffRoleChange: (role: UserRole) => void;
  onStaffRoleChange: (staffUser: User, role: UserRole) => void;
  onStaffActiveChange: (staffUser: User, isActive: boolean) => void;
  onDeleteStaff: (staffUser: User) => void;
};

export function StaffManagementPanel({
  currentUser,
  staffUsers,
  newStaffName,
  newStaffEmail,
  newStaffPassword,
  newStaffRole,
  errors,
  isCreatingStaff,
  isProtectedDefaultUser,
  onCreateStaff,
  onNewStaffNameChange,
  onNewStaffEmailChange,
  onNewStaffPasswordChange,
  onNewStaffRoleChange,
  onStaffRoleChange,
  onStaffActiveChange,
  onDeleteStaff
}: StaffManagementPanelProps) {
  return (
    <section className="admin-panel">
      <div className="panel-heading">
        <h2>Staff Management</h2>
        <span>{staffUsers.length} users</span>
      </div>

      <form className="staff-form" onSubmit={onCreateStaff} noValidate>
        <label className={errors.name ? 'has-error' : ''}>
          <span>Name <span className="required-mark">*</span></span>
          <input value={newStaffName} onChange={(event) => onNewStaffNameChange(event.target.value)} />
          {errors.name && <span className="field-error">{errors.name}</span>}
        </label>
        <label className={errors.email ? 'has-error' : ''}>
          <span>Email <span className="required-mark">*</span></span>
          <input
            type="email"
            value={newStaffEmail}
            onChange={(event) => onNewStaffEmailChange(event.target.value)}
          />
          {errors.email && <span className="field-error">{errors.email}</span>}
        </label>
        <label className={errors.password ? 'has-error' : ''}>
          <span>Password <span className="required-mark">*</span></span>
          <input
            type="password"
            minLength={8}
            value={newStaffPassword}
            onChange={(event) => onNewStaffPasswordChange(event.target.value)}
          />
          {errors.password && <span className="field-error">{errors.password}</span>}
        </label>
        <label>
          Role
          <select value={newStaffRole} onChange={(event) => onNewStaffRoleChange(event.target.value as UserRole)}>
            <option value="staff">Staff</option>
            <option value="admin">Admin</option>
            <option value="chef">Chef</option>
          </select>
        </label>
        <button className="primary-button" disabled={isCreatingStaff}>
          {isCreatingStaff ? 'Creating...' : 'Create User'}
        </button>
      </form>

      <div className="staff-list">
        {staffUsers.map((staffUser) => (
          <article key={staffUser.id} className="staff-row">
            <div>
              <strong>{staffUser.name}</strong>
              <span>{staffUser.email}</span>
            </div>
            <select
              value={staffUser.role}
              disabled={isProtectedDefaultUser(staffUser)}
              onChange={(event) => onStaffRoleChange(staffUser, event.target.value as UserRole)}
            >
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
              <option value="chef">Chef</option>
            </select>
            {isProtectedDefaultUser(staffUser) ? (
              <span className="protected-label">Protected</span>
            ) : (
              <>
                <label className="toggle-label">
                  <input
                    type="checkbox"
                    checked={staffUser.isActive}
                    onChange={(event) => onStaffActiveChange(staffUser, event.target.checked)}
                  />
                  Active
                </label>
                <button
                  className="danger-button subtle-button"
                  disabled={staffUser.id === currentUser.id}
                  onClick={() => onDeleteStaff(staffUser)}
                >
                  Delete
                </button>
              </>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
