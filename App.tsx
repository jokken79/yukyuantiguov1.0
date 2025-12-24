
import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import ExcelSync from './components/ExcelSync';
import EmployeeList from './components/EmployeeList';
import LeaveRequest from './components/LeaveRequest';
import AccountingReports from './components/AccountingReports';
import ApplicationManagement from './components/ApplicationManagement';
import { db } from './services/db';
import { AppData } from './types';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [appData, setAppData] = useState<AppData>(db.loadData());

  const refreshData = () => {
    setAppData(db.loadData());
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard data={appData} />;
      case 'sync':
        return <ExcelSync onSyncComplete={refreshData} />;
      case 'employees':
        return <EmployeeList employees={appData.employees} />;
      case 'reports':
        return <AccountingReports data={appData} />;
      case 'request':
        return <LeaveRequest data={appData} onSuccess={refreshData} />;
      case 'applications':
        return <ApplicationManagement data={appData} onUpdate={refreshData} />;
      default:
        return (
          <div className="p-8 flex flex-col items-center justify-center h-full space-y-8 opacity-20">
            <div className="text-8xl italic font-black tracking-tighter text-white/10">UNS</div>
            <p className="text-sm font-black tracking-[0.5em] uppercase">開発中のモジュールです</p>
          </div>
        );
    }
  };

  return (
    <div className="flex h-screen bg-[#000000] text-white selection:bg-blue-500/30 overflow-hidden font-['Plus_Jakarta_Sans','Noto_Sans_JP']">
      {/* Noise Texture Overlay for that premium analog feel */}
      <div className="fixed inset-0 opacity-[0.02] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')] z-50"></div>

      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <main className="flex-1 overflow-y-auto relative z-10 custom-scrollbar">
        <div className="min-h-screen">
          {renderContent()}
        </div>
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.1);
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(15px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 1s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </div>
  );
};

export default App;
