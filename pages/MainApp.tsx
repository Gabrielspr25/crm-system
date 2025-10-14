import React, { useState } from 'react';
import MainNavigation from '../components/MainNavigation';
import PipelineKanban from './PipelineKanban';
import ActivityDashboard from './ActivityDashboard';
import CallsScheduler from './CallsScheduler';

interface MainAppProps {
  currentUser?: {
    id: string;
    name: string;
    role: 'admin' | 'vendedor';
  };
}

const MainApp: React.FC<MainAppProps> = ({ 
  currentUser = { id: 'vendedor1', name: 'Gabriel Sánchez', role: 'vendedor' }
}) => {
  const [currentView, setCurrentView] = useState<'pipeline' | 'dashboard' | 'calendar'>('pipeline');

  const handleNavigate = (view: 'pipeline' | 'dashboard' | 'calendar') => {
    setCurrentView(view);
  };

  const renderCurrentView = () => {
    switch (currentView) {
      case 'pipeline':
        return <PipelineKanban currentUser={currentUser} />;
      
      case 'dashboard':
        return (
          <ActivityDashboard 
            currentUser={currentUser}
            onBackToPipeline={() => setCurrentView('pipeline')}
          />
        );
      
      case 'calendar':
        return (
          <CallsScheduler 
            currentUser={currentUser}
            onBackToPipeline={() => setCurrentView('pipeline')}
          />
        );
      
      default:
        return <PipelineKanban currentUser={currentUser} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <MainNavigation 
        currentView={currentView}
        onNavigate={handleNavigate}
        currentUser={currentUser}
      />
      
      <div className="pt-0">
        {renderCurrentView()}
      </div>
    </div>
  );
};

export default MainApp;