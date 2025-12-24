
import React from 'react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const tabs = [
    { id: 'dashboard', icon: 'M13 10V3L4 14h7v7l9-11h-7z', label: '有給分析コア' },
    { id: 'employees', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197', label: '従業員リスト' },
    { id: 'reports', icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', label: '経理レポート' },
    { id: 'request', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', label: '迅速申請' },
    { id: 'sync', icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15', label: 'データ同期' },
  ];

  return (
    <div className="w-80 h-full cyber-glass flex flex-col z-50 border-r border-white/5 relative">
      {/* Intense Brand Section */}
      <div className="p-10">
        <div className="relative group overflow-hidden bg-black rounded-3xl p-8 border border-white/10 shadow-[0_0_50px_rgba(0,0,0,1)] glitch-hover">
          <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-red-600 blur opacity-25 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
          
          <div className="relative flex flex-col items-center">
            <div className="flex items-center justify-center gap-0">
              <span className="text-7xl font-black italic tracking-tighter leading-none text-white drop-shadow-[0_0_15px_rgba(0,229,255,0.8)] transform -skew-x-12">U</span>
              <div className="h-16 w-1 bg-white mx-2 rotate-12"></div>
              <span className="text-7xl font-black italic tracking-tighter leading-none text-white drop-shadow-[0_0_15px_rgba(255,0,76,0.8)] transform -skew-x-12">N</span>
              <div className="h-16 w-1 bg-white mx-2 rotate-12"></div>
              <span className="text-7xl font-black italic tracking-tighter leading-none text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.8)] transform -skew-x-12">S</span>
            </div>
            
            <div className="mt-8 flex flex-col items-center">
              <div className="text-[10px] font-black tracking-[0.5em] text-white/40 mb-1">ユニバーサル企画</div>
              <div className="h-0.5 w-full bg-gradient-to-r from-blue-500 via-white to-red-500"></div>
              <div className="text-lg font-black italic tracking-tighter mt-2 text-white">有給PRO V1.0</div>
            </div>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-4 space-y-2 mt-4 overflow-y-auto custom-scrollbar">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`w-full group flex items-center gap-6 px-6 py-4 rounded-2xl transition-all duration-300 relative ${
              activeTab === tab.id ? 'text-white translate-x-2' : 'text-white/30 hover:text-white/70'
            }`}
          >
            {activeTab === tab.id && (
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600/30 to-transparent border-l-4 border-blue-500 animate-pulse"></div>
            )}
            <svg 
              className={`w-6 h-6 transition-transform duration-500 ${activeTab === tab.id ? 'stroke-blue-400 scale-125' : 'stroke-current group-hover:scale-110'}`} 
              fill="none" viewBox="0 0 24 24" strokeWidth="2.5"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d={tab.icon} />
            </svg>
            <span className="font-black text-[11px] tracking-[0.1em] uppercase italic">{tab.label}</span>
          </button>
        ))}
      </nav>

      <div className="p-8">
        <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 relative overflow-hidden group">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-1 h-6 bg-red-600"></div>
            <span className="text-[10px] font-black text-white/40 tracking-[0.2em]">システム状態</span>
          </div>
          <div className="text-xs font-black text-white italic tracking-tighter">
            エンジン: 稼働中<br/>
            AI分析: オンライン
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
