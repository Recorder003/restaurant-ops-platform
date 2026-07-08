import { AppModals } from './components/AppModals';
import { AuthGate } from './components/AuthGate';
import { OperationalWorkspace } from './components/OperationalWorkspace';
import { AppErrorProvider } from './context/AppErrorContext';
import { AuthSessionProvider } from './context/AuthSessionContext';
import { useRestaurantApp } from './hooks/useRestaurantApp';

function AppContent() {
  const {
    error,
    authSession,
    user,
    isSessionLoading,
    isLoading,
    menuItems,
    menuBundles,
    adminMenuItems,
    adminMenuBundles,
    restaurantTables,
    staffUsers,
    orderBoard,
    orderDraft,
    documents,
    checkout,
    adminManagement,
    refreshData
  } = useRestaurantApp();

  if (!user) {
    return (
      <AuthSessionProvider value={authSession}>
        <AuthGate isLoading={isLoading || isSessionLoading} />
      </AuthSessionProvider>
    );
  }

  return (
    <AuthSessionProvider value={authSession}>
      <main className="app-shell">
        <OperationalWorkspace
          user={user}
          error={error}
          isLoading={isLoading}
          isSessionLoading={isSessionLoading}
          menuItems={menuItems}
          menuBundles={menuBundles}
          adminMenuItems={adminMenuItems}
          adminMenuBundles={adminMenuBundles}
          restaurantTables={restaurantTables}
          staffUsers={staffUsers}
          orderBoard={orderBoard}
          orderDraft={orderDraft}
          documents={documents}
          checkout={checkout}
          adminManagement={adminManagement}
          onRefresh={refreshData}
        />

        <AppModals
          documents={documents}
          checkout={checkout}
          isTablePickerOpen={orderDraft.isTablePickerOpen}
          tables={restaurantTables}
          tableNumber={orderDraft.tableNumber}
          selectedTable={orderDraft.selectedTable}
          onTableSelect={orderDraft.handleTableSelect}
          onCloseTablePicker={orderDraft.closeTablePicker}
        />
      </main>
    </AuthSessionProvider>
  );
}

function App() {
  return (
    <AppErrorProvider>
      <AppContent />
    </AppErrorProvider>
  );
}

export default App;
