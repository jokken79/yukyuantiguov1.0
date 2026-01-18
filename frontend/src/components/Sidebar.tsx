
import React, { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import ThemeToggle from './common/ThemeToggle';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const { isDark } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  const tabs = [
    { id: 'dashboard', icon: 'M13 10V3L4 14h7v7l9-11h-7z', label: '有給分析コア' },
    { id: 'employees', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197', label: '従業員リスト' },
    { id: 'request', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', label: '迅速申請' },
    { id: 'applications', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4', label: '申請管理' },
    { id: 'reports', icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', label: '経理レポート' },
    { id: 'sync', icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15', label: 'データ同期' },
  ];

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId);
    setIsOpen(false); // Cerrar menú móvil al cambiar de tab
  };

  return (
    <>
      {/* Botón Hamburger (solo mobile) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`lg:hidden fixed top-4 left-4 z-50 p-3 rounded-lg transition-all duration-300 ${isDark
            ? 'bg-blue-600 hover:bg-blue-500 shadow-[0_0_20px_rgba(37,99,235,0.5)]'
            : 'bg-blue-500 hover:bg-blue-600 shadow-lg'
          }`}
        aria-label={isOpen ? "メニューを閉じる" : "メニューを開く"}
        aria-expanded={isOpen}
        aria-controls="main-navigation"
      >
        <svg
          className="w-6 h-6 text-white"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          {isOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {/* Backdrop (solo mobile) */}
      <div
        className={`fixed inset-0 bg-black/50 lg:hidden transition-opacity duration-300 z-40 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        onClick={() => setIsOpen(false)}
        aria-hidden="true"
      />

      {/* Sidebar */}
      <div className={`fixed lg:relative w-80 h-full cyber-glass flex flex-col z-50 border-r transition-transform duration-300 ease-in-out ${isDark ? 'border-white/5' : 'border-slate-200'
        } ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}>
        {/* Intense Brand Section */}
        <div className="p-10">
          <div className={`relative group overflow-hidden rounded-3xl p-8 border glitch-hover transition-all duration-300 ${isDark
              ? 'bg-black border-white/10 shadow-[0_0_50px_rgba(0,0,0,1)]'
              : 'bg-white border-slate-200 shadow-lg'
            }`}>
            <div className={`absolute -inset-1 bg-gradient-to-r from-blue-600 to-red-600 blur transition duration-1000 group-hover:duration-200 ${isDark ? 'opacity-25 group-hover:opacity-100' : 'opacity-10 group-hover:opacity-30'}`}></div>

            <div className="relative flex flex-col items-center">
              {/* Logo UNS con órbitas */}
              <div className="w-40 h-32 flex items-center justify-center">
                <img
                  src="/uns-logo.png"
                  alt="UNS - ユニバーサル企画"
                  className="w-full h-full object-contain drop-shadow-[0_0_20px_rgba(59,130,246,0.5)]"
                  onError={(e) => {
                    // Fallback al texto si la imagen no carga
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.nextElementSibling?.classList.remove('hidden');
                  }}
                />
                {/* Fallback text logo */}
                <div className="hidden flex items-center justify-center gap-0">
                  <span className={`text-5xl font-black italic tracking-tighter leading-none ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>U</span>
                  <span className={`text-5xl font-black italic tracking-tighter leading-none ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>N</span>
                  <span className={`text-5xl font-black italic tracking-tighter leading-none ${isDark ? 'text-red-500' : 'text-red-600'}`}>S</span>
                </div>
              </div>

              <div className="mt-4 flex flex-col items-center">
                <div className={`text-[10px] font-black tracking-[0.5em] mb-1 ${isDark ? 'text-white/80' : 'text-slate-500'}`}>ユニバーサル企画</div>
                <div className="h-0.5 w-full bg-gradient-to-r from-blue-500 via-white to-red-500"></div>
                <div className={`text-lg font-black italic tracking-tighter mt-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>有給PRO V1.0</div>
              </div>
            </div>
          </div>
        </div>

        <nav
          id="main-navigation"
          role="navigation"
          aria-label="メインナビゲーション"
          className="flex-1 px-4 space-y-2 mt-4 overflow-y-auto custom-scrollbar"
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              aria-current={activeTab === tab.id ? "page" : undefined}
              aria-label={`${tab.label}${activeTab === tab.id ? ' (現在のページ)' : ''}`}
              className={`w-full group flex items-center gap-6 px-6 py-4 rounded-2xl transition-all duration-300 relative ${activeTab === tab.id
                  ? isDark ? 'text-white translate-x-2' : 'text-slate-800 translate-x-2'
                  : isDark ? 'text-white/90 hover:text-white' : 'text-slate-500 hover:text-slate-700'
                }`}
            >
              {activeTab === tab.id && (
                <div className={`absolute inset-0 border-l-4 border-blue-500 animate-pulse ${isDark ? 'bg-gradient-to-r from-blue-600/30 to-transparent' : 'bg-gradient-to-r from-blue-100 to-transparent'}`}></div>
              )}
              <svg
                className={`w-6 h-6 transition-transform duration-500 ${activeTab === tab.id ? 'stroke-blue-500 scale-125' : 'stroke-current group-hover:scale-110'}`}
                fill="none" viewBox="0 0 24 24" strokeWidth="2.5"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d={tab.icon} />
              </svg>
              <span className="font-black text-[11px] tracking-[0.1em] uppercase italic">{tab.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 space-y-4">
          {/* Theme Toggle */}
          <ThemeToggle />

          {/* System Status */}
          <div
            role="status"
            aria-label="システム状態"
            className={`p-4 rounded-xl border relative overflow-hidden group ${isDark
                ? 'bg-white/10 border-white/20'
                : 'bg-slate-50 border-slate-200'
              }`}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-1 h-5 bg-green-500" aria-hidden="true"></div>
              <span className={`text-[9px] font-bold tracking-[0.2em] uppercase ${isDark ? 'text-white/90' : 'text-slate-600'}`}>システム状態</span>
            </div>
            <div className={`text-xs font-bold italic tracking-tight ${isDark ? 'text-white' : 'text-slate-700'}`}>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" aria-hidden="true"></div>
                <span>エンジン: 稼働中</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" aria-hidden="true"></div>
                <span>AI分析: オンライン</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
