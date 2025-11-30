// ... imports

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
            />
            {renderBottomNav()}
          </>
      );
  }

// ... rest of App.tsx