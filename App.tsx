
import React, { useState, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import ExcelSync from './components/ExcelSync';
import EmployeeList from './components/EmployeeList';
import LeaveRequest from './components/LeaveRequest';
import AccountingReports from './components/AccountingReports';
import ApplicationManagement from './components/ApplicationManagement';
import { DashboardSkeleton, EmployeeListSkeleton, ApplicationSkeleton, TableSkeleton } from './components/Skeleton';
import { db } from './services/db';
import { AppData } from './types';

// Inner App component that uses theme context
const AppContent: React.FC = () => {
  const { isDark } = useTheme();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [appData, setAppData] = useState<AppData>(db.loadData());
  const [isLoading, setIsLoading] = useState(true);

  // Initial load delay for nice skeleton animation
  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 600);
    return () => clearTimeout(timer);
  }, []);

  // Show brief loading when switching tabs
  const handleTabChange = (tab: string) => {
    if (tab !== activeTab) {
      setIsLoading(true);
      setActiveTab(tab);
      setTimeout(() => setIsLoading(false), 300);
    }
  };

  const refreshData = () => {
    setAppData(db.loadData());
  };

  const renderSkeleton = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardSkeleton />;
      case 'employees':
        return <EmployeeListSkeleton />;
      case 'applications':
        return <ApplicationSkeleton />;
      case 'reports':
        return (
          <div className="p-8 space-y-8">
            <TableSkeleton rows={8} columns={5} />
          </div>
        );
      default:
        return <DashboardSkeleton />;
    }
  };

  const renderContent = () => {
    if (isLoading) {
      return renderSkeleton();
    }

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
          <div className={`p-8 flex flex-col items-center justify-center h-full space-y-8 opacity-20`}>
            <div className={`text-8xl italic font-black tracking-tighter ${isDark ? 'text-white/10' : 'text-slate-200'}`}>UNS</div>
            <p className={`text-sm font-black tracking-[0.5em] uppercase ${isDark ? 'text-white/40' : 'text-slate-400'}`}>開発中のモジュールです</p>
          </div>
        );
    }
  };

  return (
    <div className={`flex h-screen selection:bg-blue-500/30 overflow-hidden font-['Plus_Jakarta_Sans','Noto_Sans_JP'] transition-colors duration-300 ${
      isDark ? 'bg-[#000000] text-white' : 'bg-slate-50 text-slate-900'
    }`}>
      {/* Noise Texture Overlay for that premium analog feel */}
      <div className={`fixed inset-0 pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')] z-50 ${isDark ? 'opacity-[0.02]' : 'opacity-[0.01]'}`}></div>

      <Sidebar activeTab={activeTab} setActiveTab={handleTabChange} />

      <main className={`flex-1 overflow-y-auto relative z-10 custom-scrollbar ${isDark ? '' : 'bg-slate-50'}`}>
        <div className="min-h-screen">
          {renderContent()}
        </div>
      </main>

      {/* React Hot Toast Notifications */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: isDark ? '#1a1a1a' : '#ffffff',
            color: isDark ? '#ffffff' : '#000000',
            border: isDark ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(0,0,0,0.1)',
            fontWeight: 'bold',
            fontSize: '14px',
          },
          success: {
            iconTheme: {
              primary: '#22c55e',
              secondary: '#ffffff',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#ffffff',
            },
          },
        }}
      />

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: ${isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.1)'};
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.2)'};
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

// Main App component wrapped with ThemeProvider
const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
};

export default App;
