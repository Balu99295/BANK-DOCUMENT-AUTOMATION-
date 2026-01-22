import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';

// Pages
import Dashboard from './pages/Dashboard';
import TemplatesList from './pages/TemplatesList';
import TemplateOnboarding from './pages/TemplateOnboarding';
import Mappings from './pages/Mappings';
import NewApplication from './pages/NewApplication';
import Policies from './pages/Policies';
import Settings from './pages/Settings';
import StandardSchema from './pages/StandardSchema';

import './App.css';

const App = () => {
  const [activePage, setActivePage] = useState('dashboard');
  const [currentTemplate, setCurrentTemplate] = useState(null);

  const renderContent = () => {
    switch (activePage) {
      case 'dashboard': return <Dashboard setActivePage={setActivePage} />;
      case 'templates': return <TemplatesList setActivePage={setActivePage} setTemplateContext={setCurrentTemplate} />;
      case 'templates_new': return <TemplateOnboarding setActivePage={setActivePage} setTemplateContext={setCurrentTemplate} />;
      case 'mappings': return <Mappings initialTemplate={currentTemplate} />;
      case 'applications': return <div className="p-4"><h3>Application History (Coming Soon)</h3><button className="btn-primary" onClick={() => setActivePage('applications_new')}>Start New</button></div>;

      case 'applications_new': return <NewApplication />;
      case 'schema': return <StandardSchema />;
      case 'policies': return <Policies />;
      case 'settings': return <Settings />;
      default: return <Dashboard setActivePage={setActivePage} />;
    }
  };

  const getTitle = () => {
    const titles = {
      'dashboard': 'Operational Dashboard',
      'templates': 'Template Management',
      'templates_new': 'Onboard New Template',
      'mappings': 'Intelligent Mapping Review',
      'applications': 'Applications',
      'applications_new': 'New Application Processing',
      'policies': 'Policy Knowledge Base'
    };
    return titles[activePage] || 'Bank Automation';
  };

  return (
    <div className="layout-container">
      <Sidebar activePage={activePage} setActivePage={setActivePage} />
      <div className="main-content">
        <TopBar title={getTitle()} />
        <div className="content-scrollable">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default App;
