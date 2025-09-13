import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import ProjectDashboard from './components/ProjectDashboard';
import EventWorkspace from './components/EventWorkspace';
import GridCreator from './components/GridCreator';

function App() {
  const [currentView, setCurrentView] = useState('dashboard'); // 'dashboard' or 'workspace'
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  const navigateToWorkspace = (projectId) => {
    setSelectedProjectId(projectId);
    setCurrentView('workspace');
  };

  const navigateToDashboard = () => {
    setSelectedProjectId(null);
    setCurrentView('dashboard');
  };

  const navigateToGridCreator = (customer) => {
    setSelectedCustomer(customer);
    setCurrentView('grid');
  };

   return (
    <div className="app-container">
      <div className="sidebar">
        <h2>Tiga Dua Booth</h2>
        <nav>
          <ul>
            <li onClick={navigateToDashboard}>Projects</li>
            <li>Settings</li>
          </ul>
        </nav>
      </div>
      <main className="content">
        {currentView === 'dashboard' && (
          <ProjectDashboard onProjectSelect={navigateToWorkspace} />
        )}
        {currentView === 'workspace' && (
           <EventWorkspace 
            projectId={selectedProjectId} 
            onBack={navigateToDashboard}
            onGoToGridCreator={navigateToGridCreator}
          />
        )}
        {currentView === 'grid' && (
          <GridCreator 
            customer={selectedCustomer}
            projectId={selectedProjectId}
            onBack={() => setCurrentView('workspace')} 
          />
        )}
      </main>
    </div>
  );
}

const container = document.getElementById('app');
const root = createRoot(container);
root.render(<App />);