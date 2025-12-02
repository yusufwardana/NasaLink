// ... imports

const App: React.FC = () => {
  // ... state logic

  // --- Render Views ---

  // 1. Settings View (Admin)
  if (activeView === 'settings') {
      return (
          <>
            <AdminModal
                isOpen={true}
                onClose={() => setActiveView('home')}
                templates={templates}
                onUpdateTemplates={setTemplates}
                onResetData={async () => {
                    await loadData();
                    setActiveView('home');
                }}
                // PASSING DEFAULT TEMPLATES FOR RESET
                defaultTemplates={INITIAL_TEMPLATES_FALLBACK}
            />
            {renderBottomNav()}
          </>
      );
  }

  // ... rest of App.tsx