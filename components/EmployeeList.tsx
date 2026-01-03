
import React, { useState, useMemo, useEffect } from 'react';
import FocusTrap from 'focus-trap-react';
import Fuse from 'fuse.js';
import { Employee, PeriodHistory } from '../types';
import { exportEmployeesToCSV, exportToPDF, exportEmployeesToExcel } from '../services/exportService';
import { getDisplayName } from '../services/nameConverter';
import { useTheme } from '../contexts/ThemeContext';

interface EmployeeListProps {
  employees: Employee[];
}

type SortKey = 'id' | 'name' | 'client' | 'grantedTotal' | 'usedTotal' | 'balance' | 'status';
type SortOrder = 'asc' | 'desc';

const ITEMS_PER_PAGE_OPTIONS = [10, 25, 50, 100];

const EmployeeList: React.FC<EmployeeListProps> = ({ employees }) => {
  const { isDark } = useTheme();
  const [searchTerm, setSearchTerm] = useState('');
  const [exportingPDF, setExportingPDF] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [sortKey, setSortKey] = useState<SortKey>('id');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Cerrar modal con ESC
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showHistoryModal) {
        setShowHistoryModal(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [showHistoryModal]);

  // Configurar Fuse.js para búsqueda fuzzy
  const fuse = useMemo(() => {
    // Agregar displayName a cada empleado para búsqueda
    const employeesWithDisplayName = employees.map(e => ({
      ...e,
      displayName: getDisplayName(e.name)
    }));

    return new Fuse(employeesWithDisplayName, {
      keys: [
        { name: 'name', weight: 0.3 },
        { name: 'displayName', weight: 0.3 },
        { name: 'id', weight: 0.2 },
        { name: 'client', weight: 0.15 },
        { name: 'nameKana', weight: 0.05 }
      ],
      threshold: 0.4, // 60% similitud mínima
      includeScore: true,
      ignoreLocation: true,
      minMatchCharLength: 1
    });
  }, [employees]);

  // Filter employees con búsqueda fuzzy
  const filtered = useMemo(() => {
    if (!searchTerm.trim()) {
      return employees;
    }

    const results = fuse.search(searchTerm);
    // Retornar solo los items originales (sin displayName agregado)
    return results.map(r => employees.find(e => e.id === r.item.id)!).filter(Boolean);
  }, [employees, searchTerm, fuse]);

  // Sort employees
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let comparison = 0;
      switch (sortKey) {
        case 'id':
          comparison = a.id.localeCompare(b.id, 'ja', { numeric: true });
          break;
        case 'name':
          comparison = a.name.localeCompare(b.name, 'ja');
          break;
        case 'client':
          comparison = a.client.localeCompare(b.client, 'ja');
          break;
        case 'grantedTotal':
          comparison = a.grantedTotal - b.grantedTotal;
          break;
        case 'usedTotal':
          comparison = a.usedTotal - b.usedTotal;
          break;
        case 'balance':
          comparison = a.balance - b.balance;
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status, 'ja');
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [filtered, sortKey, sortOrder]);

  // Pagination
  const totalPages = Math.ceil(sorted.length / itemsPerPage);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sorted.slice(start, start + itemsPerPage);
  }, [sorted, currentPage, itemsPerPage]);

  // Reset to page 1 when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, itemsPerPage]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
    if (sortKey !== columnKey) {
      return <span className={`ml-1 ${isDark ? 'text-white/70' : 'text-slate-300'}`}>↕</span>;
    }
    return <span className="ml-1 text-blue-500">{sortOrder === 'asc' ? '↑' : '↓'}</span>;
  };

  const handleExportCSV = () => {
    exportEmployeesToCSV(filtered);
  };

  const handleExportExcel = () => {
    setExportingExcel(true);
    try {
      exportEmployeesToExcel(filtered);
    } finally {
      setExportingExcel(false);
    }
  };

  const handleExportPDF = async () => {
    setExportingPDF(true);
    await exportToPDF('employee-list-container', `有給休暇_社員一覧_${new Date().toISOString().split('T')[0]}.pdf`);
    setExportingPDF(false);
  };

  return (
    <div className="p-4 md:p-8 lg:p-12 space-y-6 md:space-y-8 lg:space-y-12 animate-fadeIn max-w-[1600px] mx-auto">
      <header className="flex flex-col gap-4 md:gap-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 md:gap-8">
          <div className="space-y-2 md:space-y-4">
            <div className="flex items-center gap-4 md:gap-6">
              <div className="h-8 md:h-10 w-2 bg-blue-500"></div>
              <h2 className={`text-3xl md:text-5xl font-black italic tracking-tighter ${isDark ? 'aggressive-text' : 'text-slate-800'}`}>社員台帳</h2>
            </div>
            <p className={`font-black tracking-[0.2em] md:tracking-[0.4em] ml-6 md:ml-8 text-[10px] md:text-xs ${isDark ? 'text-white/70' : 'text-slate-500'}`}>有給休暇管理システム</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 md:gap-4 items-stretch sm:items-center">
            <div className="relative w-full sm:w-64 md:w-96">
              <span className={`absolute left-4 md:left-6 top-1/2 -translate-y-1/2 text-base md:text-lg ${isDark ? 'text-white/70' : 'text-slate-400'}`}>/</span>
              <input
                type="text"
                placeholder="社員番号・氏名で検索..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`border rounded-none pl-10 md:pl-14 pr-4 md:pr-8 py-3 md:py-5 w-full focus:outline-none focus:border-blue-500 transition-all font-bold text-sm ${isDark ? 'bg-[#0a0a0a] border-white/20 text-white placeholder:text-white/70' : 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-400'}`}
              />
            </div>
            <div className="flex gap-2 md:gap-4">
              <button onClick={handleExportCSV} className={`flex-1 sm:flex-none border px-4 md:px-8 py-3 md:py-5 text-[9px] md:text-[10px] font-black tracking-widest transition-all ${isDark ? 'bg-white/10 border-white/20 hover:bg-white/10 text-white' : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-800'}`}>CSV出力</button>
              <button
                onClick={handleExportExcel}
                disabled={exportingExcel}
                className={`flex-1 sm:flex-none border px-4 md:px-8 py-3 md:py-5 text-[9px] md:text-[10px] font-black tracking-widest transition-all ${isDark ? 'bg-green-500/10 border-green-500/30 hover:bg-green-500/20 text-green-400' : 'bg-green-50 border-green-200 hover:bg-green-100 text-green-800'}`}
              >
                {exportingExcel ? '...' : 'EXCEL出力'}
              </button>
              <button onClick={handleExportPDF} disabled={exportingPDF} className={`flex-1 sm:flex-none px-4 md:px-8 py-3 md:py-5 text-[9px] md:text-[10px] font-black tracking-widest transition-all ${isDark ? 'bg-white text-black hover:bg-white/90 shadow-[0_0_20px_rgba(255,255,255,0.2)]' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg'}`}>
                {exportingPDF ? '...' : 'PDF出力'}
              </button>
            </div>
          </div>
        </div>

        {/* Results info and pagination controls */}
        <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 px-2 ${isDark ? 'text-white/80' : 'text-slate-500'}`}>
          <div className="text-xs font-bold">
            {sorted.length > 0 ? (
              <>全 {sorted.length} 件中 {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, sorted.length)} 件を表示</>
            ) : (
              <>該当なし</>
            )}
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs font-bold">表示件数:</label>
            <select
              value={itemsPerPage}
              onChange={(e) => setItemsPerPage(Number(e.target.value))}
              className={`border text-xs font-bold p-2 outline-none ${isDark ? 'bg-black border-white/20 text-white' : 'bg-white border-slate-300 text-slate-800'}`}
            >
              {ITEMS_PER_PAGE_OPTIONS.map(n => (
                <option key={n} value={n}>{n}件</option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {/* Vista Mobile - Cards (lg:hidden) */}
      <div className="lg:hidden space-y-3">
        {paginatedData.length > 0 ? (
          paginatedData.map((emp) => {
            const isMandatoryTarget = (emp.currentGrantedTotal ?? emp.grantedTotal) >= 10;
            const isCompliant = (emp.currentUsedTotal ?? emp.usedTotal) >= 5;
            const displayName = getDisplayName(emp.name);
            const granted = emp.currentGrantedTotal !== undefined ? emp.currentGrantedTotal : emp.grantedTotal;
            const used = emp.currentUsedTotal !== undefined ? emp.currentUsedTotal : emp.usedTotal;
            const balance = emp.currentBalance !== undefined ? emp.currentBalance : emp.balance;

            return (
              <div
                key={emp.id}
                onClick={() => {
                  setSelectedEmployee(emp);
                  setShowHistoryModal(true);
                }}
                className={`p-4 rounded-lg border cursor-pointer transition-all active:scale-[0.98] ${
                  isDark
                    ? 'bg-white/5 border-white/10 hover:bg-white/10'
                    : 'bg-white border-slate-200 shadow-sm hover:shadow-md'
                }`}
              >
                {/* Header: Name + Status */}
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className={`font-black text-lg ${isDark ? 'text-white' : 'text-slate-800'}`}>{displayName}</h3>
                    <p className={`text-xs ${isDark ? 'text-white/60' : 'text-slate-500'}`}>#{emp.id} • {emp.client}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 text-[10px] font-black rounded ${
                      emp.status === '在職中'
                        ? 'bg-green-500/20 text-green-400'
                        : isDark ? 'bg-white/10 text-white/40' : 'bg-slate-100 text-slate-400'
                    }`}>
                      {emp.status}
                    </span>
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className={`p-2 rounded ${isDark ? 'bg-white/5' : 'bg-slate-50'}`}>
                    <span className={`text-[9px] font-bold block ${isDark ? 'text-white/40' : 'text-slate-400'}`}>付与</span>
                    <span className={`text-sm font-black ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>{granted}日</span>
                  </div>
                  <div className={`p-2 rounded ${isDark ? 'bg-white/5' : 'bg-slate-50'}`}>
                    <span className={`text-[9px] font-bold block ${isDark ? 'text-white/40' : 'text-slate-400'}`}>消化</span>
                    <span className={`text-sm font-black ${used > 0 ? 'text-red-400' : isDark ? 'text-white/40' : 'text-slate-300'}`}>{used}日</span>
                  </div>
                  <div className={`p-2 rounded ${isDark ? 'bg-white/5' : 'bg-slate-50'}`}>
                    <span className={`text-[9px] font-bold block ${isDark ? 'text-white/40' : 'text-slate-400'}`}>残高</span>
                    <span className={`text-sm font-black ${balance < 5 ? 'text-red-500' : 'text-green-400'}`}>{balance}日</span>
                  </div>
                  <div className={`p-2 rounded ${isDark ? 'bg-white/5' : 'bg-slate-50'}`}>
                    <span className={`text-[9px] font-bold block ${isDark ? 'text-white/40' : 'text-slate-400'}`}>5日義務</span>
                    {isMandatoryTarget ? (
                      <span className={`text-sm font-black ${isCompliant ? 'text-blue-400' : 'text-red-500'}`}>
                        {isCompliant ? '達成' : '未達'}
                      </span>
                    ) : (
                      <span className={`text-sm font-black ${isDark ? 'text-white/20' : 'text-slate-300'}`}>-</span>
                    )}
                  </div>
                </div>

                {/* Exceded Warning */}
                {emp.excededDays !== undefined && emp.excededDays > 0 && (
                  <div className="mt-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-500 text-[10px] font-black text-center rounded">
                    ⚠️ 法定上限超過 {emp.excededDays}日
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className={`py-16 text-center border rounded-lg ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
            <div className={`text-4xl mb-4 ${isDark ? 'opacity-20' : 'opacity-30'}`}>📋</div>
            <p className={`font-bold ${isDark ? 'text-white/60' : 'text-slate-400'}`}>該当する社員がいません</p>
          </div>
        )}
      </div>

      {/* Vista Desktop - Tabla (hidden lg:block) */}
      <div id="employee-list-container" className={`hidden lg:block border overflow-hidden ${isDark ? 'bg-[#0a0a0a] border-white/5' : 'bg-white border-slate-200 shadow-sm'}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[800px]">
            <thead>
              <tr className={`text-[9px] md:text-[10px] font-black uppercase tracking-[0.1em] md:tracking-[0.2em] border-b ${isDark ? 'bg-white/[0.02] text-white/70 border-white/5' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                <th className="px-4 md:px-10 py-4 md:py-6 cursor-pointer hover:text-blue-500 transition-colors" onClick={() => handleSort('id')}>
                  社員№<SortIcon columnKey="id" />
                </th>
                <th className="px-4 md:px-10 py-4 md:py-6 cursor-pointer hover:text-blue-500 transition-colors" onClick={() => handleSort('name')}>
                  氏名 / 派遣先<SortIcon columnKey="name" />
                </th>
                <th className="px-4 md:px-10 py-4 md:py-6 text-center cursor-pointer hover:text-blue-500 transition-colors" onClick={() => handleSort('grantedTotal')}>
                  付与<SortIcon columnKey="grantedTotal" />
                </th>
                <th className="px-4 md:px-10 py-4 md:py-6 text-center cursor-pointer hover:text-blue-500 transition-colors" onClick={() => handleSort('usedTotal')}>
                  消化<SortIcon columnKey="usedTotal" />
                </th>
                <th className="px-4 md:px-10 py-4 md:py-6 text-center cursor-pointer hover:text-blue-500 transition-colors" onClick={() => handleSort('balance')}>
                  残日数<SortIcon columnKey="balance" />
                </th>
                <th className="px-4 md:px-10 py-4 md:py-6 text-center">年5日義務化</th>
                <th className="px-4 md:px-10 py-4 md:py-6 text-right cursor-pointer hover:text-blue-500 transition-colors" onClick={() => handleSort('status')}>
                  状態<SortIcon columnKey="status" />
                </th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-white/5' : 'divide-slate-100'}`}>
              {paginatedData.length > 0 ? (
                paginatedData.map((emp) => {
                  const isMandatoryTarget = (emp.currentGrantedTotal ?? emp.grantedTotal) >= 10;
                  const isCompliant = (emp.currentUsedTotal ?? emp.usedTotal) >= 5;
                  const displayName = getDisplayName(emp.name);

                  return (
                    <tr
                      key={emp.id}
                      onClick={() => {
                        setSelectedEmployee(emp);
                        setShowHistoryModal(true);
                      }}
                      className={`transition-colors group cursor-pointer ${isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-50'}`}
                    >
                      <td className={`px-4 md:px-10 py-4 md:py-8 font-black italic text-xs md:text-sm group-hover:text-blue-500 transition-colors ${isDark ? 'text-white/70' : 'text-slate-400'}`}>#{emp.id}</td>
                      <td className="px-4 md:px-10 py-4 md:py-8">
                        <div className={`font-black text-base md:text-lg tracking-tight group-hover:translate-x-1 transition-transform ${isDark ? 'text-white' : 'text-slate-800'}`}>{displayName}</div>
                        <div className={`text-[9px] md:text-[10px] font-bold mt-1 tracking-widest ${isDark ? 'text-white/70' : 'text-slate-500'}`}>{emp.client}</div>
                      </td>
                      <td className={`px-4 md:px-10 py-4 md:py-8 text-center ${isDark ? 'text-white' : 'text-slate-800'}`}>
                        <div className="font-black text-xs md:text-sm">
                          {emp.currentGrantedTotal !== undefined ? emp.currentGrantedTotal : emp.grantedTotal}日
                        </div>
                      </td>
                      <td className="px-4 md:px-10 py-4 md:py-8 text-center">
                        <span className={`font-black text-xs md:text-sm ${(emp.currentUsedTotal !== undefined ? emp.currentUsedTotal : emp.usedTotal) === 0 ? isDark ? 'text-white/70' : 'text-slate-300' : 'text-red-500'}`}>
                          {emp.currentUsedTotal !== undefined ? emp.currentUsedTotal : emp.usedTotal}日
                        </span>
                      </td>
                      <td className="px-4 md:px-10 py-4 md:py-8 text-center">
                        <div className="flex flex-col items-center">
                          <div className={`inline-block px-3 md:px-5 py-1 md:py-2 border-2 font-black text-[10px] md:text-xs ${
                            (emp.currentBalance !== undefined ? emp.currentBalance : emp.balance) < 5 ? 'border-red-600 text-red-600' : isDark ? 'border-white/20 text-white' : 'border-slate-200 text-slate-800'
                          }`}>
                            残{emp.currentBalance !== undefined ? emp.currentBalance : emp.balance}日
                          </div>
                          {emp.excededDays !== undefined && emp.excededDays > 0 && (
                            <div className="mt-1 px-2 py-0.5 bg-amber-500/10 border border-amber-500/30 text-amber-500 text-[7px] md:text-[8px] font-black tracking-wider">
                              ⚠️ 超過{emp.excededDays}日
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 md:px-10 py-4 md:py-8 text-center">
                        {isMandatoryTarget ? (
                          <span className={`px-2 md:px-4 py-1 md:py-1.5 text-[8px] md:text-[9px] font-black tracking-widest border ${
                            isCompliant ? 'bg-blue-500/10 border-blue-500/30 text-blue-500' : 'bg-red-600 border-red-600 text-white animate-pulse'
                          }`}>
                            {isCompliant ? '達成' : '未達'}
                          </span>
                        ) : (
                          <span className={`text-[8px] md:text-[9px] font-black tracking-widest ${isDark ? 'text-white/10' : 'text-slate-300'}`}>対象外</span>
                        )}
                      </td>
                      <td className="px-4 md:px-10 py-4 md:py-8 text-right">
                        <div className="flex items-center justify-end gap-2 md:gap-3">
                          <span className={`text-[9px] md:text-[10px] font-black tracking-widest ${isDark ? 'opacity-40' : 'text-slate-500'}`}>{emp.status}</span>
                          <div className={`w-1 md:w-1.5 h-4 md:h-6 ${emp.status === '在職中' ? 'bg-green-500 shadow-[0_0_10px_#22c55e]' : isDark ? 'bg-white/10' : 'bg-slate-200'}`}></div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-20 text-center">
                    <div className={`text-4xl mb-4 ${isDark ? 'opacity-10' : 'opacity-20'}`}>📋</div>
                    <p className={`font-bold ${isDark ? 'text-white/70' : 'text-slate-400'}`}>該当する社員がいません</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className={`px-3 py-2 text-xs font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed ${isDark ? 'bg-white/10 hover:bg-white/10 text-white border border-white/20' : 'bg-white hover:bg-slate-50 text-slate-800 border border-slate-200'}`}
            >
              ««
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className={`px-3 py-2 text-xs font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed ${isDark ? 'bg-white/10 hover:bg-white/10 text-white border border-white/20' : 'bg-white hover:bg-slate-50 text-slate-800 border border-slate-200'}`}
            >
              «
            </button>

            {/* Page numbers */}
            <div className="flex gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-8 h-8 text-xs font-bold transition-all ${
                      currentPage === pageNum
                        ? 'bg-blue-500 text-white'
                        : isDark ? 'bg-white/10 hover:bg-white/10 text-white border border-white/20' : 'bg-white hover:bg-slate-50 text-slate-800 border border-slate-200'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className={`px-3 py-2 text-xs font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed ${isDark ? 'bg-white/10 hover:bg-white/10 text-white border border-white/20' : 'bg-white hover:bg-slate-50 text-slate-800 border border-slate-200'}`}
            >
              »
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className={`px-3 py-2 text-xs font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed ${isDark ? 'bg-white/10 hover:bg-white/10 text-white border border-white/20' : 'bg-white hover:bg-slate-50 text-slate-800 border border-slate-200'}`}
            >
              »»
            </button>
          </div>
          <div className={`text-xs font-bold ${isDark ? 'text-white/80' : 'text-slate-500'}`}>
            {currentPage} / {totalPages} ページ
          </div>
        </div>
      )}

      {/* Modal de Historial de Yukyu */}
      {showHistoryModal && selectedEmployee && (
        <FocusTrap>
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn"
            onClick={() => setShowHistoryModal(false)}
          >
            <div
              className={`max-w-4xl w-full max-h-[90vh] overflow-y-auto rounded-3xl p-8 ${isDark ? 'bg-[#0a0a0a] border border-white/20' : 'bg-white border border-slate-200'}`}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="history-modal-title"
            >
            {/* Header */}
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 id="history-modal-title" className={`text-2xl font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>
                  {getDisplayName(selectedEmployee.name)}
                </h3>
                <p className="text-indigo-500 text-sm font-medium mt-1">
                  {selectedEmployee.client} / №{selectedEmployee.id}
                </p>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className={`text-2xl w-10 h-10 rounded-full transition-colors ${isDark ? 'hover:bg-white/10' : 'hover:bg-slate-100'}`}
              >
                ✕
              </button>
            </div>

            {/* Resumen de Totales */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className={`p-4 rounded-xl text-center ${isDark ? 'bg-white/10' : 'bg-slate-50'}`}>
                <p className={`text-[10px] font-bold uppercase mb-1 ${isDark ? 'text-white/80' : 'text-slate-400'}`}>付与 (現在)</p>
                <p className="text-2xl font-black text-green-500">
                  {selectedEmployee.currentGrantedTotal ?? selectedEmployee.grantedTotal}日
                </p>
              </div>
              <div className={`p-4 rounded-xl text-center ${isDark ? 'bg-white/10' : 'bg-slate-50'}`}>
                <p className={`text-[10px] font-bold uppercase mb-1 ${isDark ? 'text-white/80' : 'text-slate-400'}`}>消化 (現在)</p>
                <p className="text-2xl font-black text-pink-500">
                  {selectedEmployee.currentUsedTotal ?? selectedEmployee.usedTotal}日
                </p>
              </div>
              <div className={`p-4 rounded-xl text-center ${isDark ? 'bg-white/10' : 'bg-slate-50'}`}>
                <p className={`text-[10px] font-bold uppercase mb-1 ${isDark ? 'text-white/80' : 'text-slate-400'}`}>残高</p>
                <p className="text-2xl font-black text-blue-500">
                  {selectedEmployee.currentBalance ?? selectedEmployee.balance}日
                </p>
              </div>
              <div className={`p-4 rounded-xl text-center ${isDark ? 'bg-white/10' : 'bg-slate-50'}`}>
                <p className={`text-[10px] font-bold uppercase mb-1 ${isDark ? 'text-white/80' : 'text-slate-400'}`}>時効</p>
                <p className="text-2xl font-black text-orange-500">
                  {selectedEmployee.historicalExpiredCount ?? selectedEmployee.expiredCount ?? 0}日
                </p>
              </div>
            </div>

            {/* Totales Históricos */}
            {selectedEmployee.historicalGrantedTotal !== undefined && (
              <div className={`mb-6 p-4 rounded-xl ${isDark ? 'bg-white/10 border border-white/5' : 'bg-slate-50 border border-slate-100'}`}>
                <p className={`text-xs font-bold mb-2 ${isDark ? 'text-white/60' : 'text-slate-600'}`}>📊 全期間合計</p>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className={`text-[9px] ${isDark ? 'text-white/80' : 'text-slate-400'}`}>付与合計</p>
                    <p className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>{selectedEmployee.historicalGrantedTotal}日</p>
                  </div>
                  <div>
                    <p className={`text-[9px] ${isDark ? 'text-white/80' : 'text-slate-400'}`}>消化合計</p>
                    <p className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>{selectedEmployee.historicalUsedTotal}日</p>
                  </div>
                  <div>
                    <p className={`text-[9px] ${isDark ? 'text-white/80' : 'text-slate-400'}`}>残高合計</p>
                    <p className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>{selectedEmployee.historicalBalance}日</p>
                  </div>
                </div>
              </div>
            )}

            {/* Historial por Períodos */}
            <div>
              <h4 className={`text-lg font-bold mb-4 flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                <span className="text-xl">📅</span> 有給取得履歴（期間別）
              </h4>

              {selectedEmployee.entryDate && (
                <div className={`mb-4 px-3 py-2 rounded-lg text-xs ${isDark ? 'bg-white/10' : 'bg-slate-50'}`}>
                  <span className={isDark ? 'text-white/80' : 'text-slate-400'}>入社日: </span>
                  <span className="text-indigo-500 font-bold">
                    {new Date(selectedEmployee.entryDate).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </span>
                </div>
              )}

              {selectedEmployee.periodHistory && selectedEmployee.periodHistory.length > 0 ? (
                <div className="space-y-4">
                  {selectedEmployee.periodHistory.map((period, index) => (
                    <div key={index} className="space-y-2">
                      {/* Period Header */}
                      <div className={`flex items-center justify-between py-2 px-3 rounded-lg ${
                        period.isExpired
                          ? 'bg-red-500/10 border border-red-500/20'
                          : period.isCurrentPeriod
                            ? 'bg-blue-500/10 border border-blue-500/20'
                            : 'bg-green-500/10 border border-green-500/20'
                      }`}>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-black ${
                              period.isExpired ? 'text-red-400'
                                : period.isCurrentPeriod ? 'text-blue-400'
                                : 'text-green-400'
                            }`}>
                              {period.periodName}
                            </span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${isDark ? 'text-white/50 bg-white/10' : 'text-slate-500 bg-slate-100'}`}>
                              付与{period.granted}日
                            </span>
                            <span className={`text-xs ${isDark ? 'text-white/80' : 'text-slate-400'}`}>({period.used}日消化)</span>
                          </div>
                          <div className={`text-[9px] flex gap-2 ${isDark ? 'text-white/70' : 'text-slate-400'}`}>
                            <span>付与: {new Date(period.grantDate).toLocaleDateString('ja-JP')}</span>
                            <span>→ 時効: {new Date(period.expiryDate).toLocaleDateString('ja-JP')}</span>
                          </div>
                        </div>
                        {period.isExpired ? (
                          <span className="text-[10px] font-bold text-red-400 bg-red-500/20 px-2 py-0.5 rounded">時効済</span>
                        ) : period.isCurrentPeriod ? (
                          <span className="text-[10px] font-bold text-blue-400 bg-blue-500/20 px-2 py-0.5 rounded">現在</span>
                        ) : (
                          <span className="text-[10px] font-bold text-green-400 bg-green-500/20 px-2 py-0.5 rounded">有効</span>
                        )}
                      </div>

                      {/* Dates Grid */}
                      {period.yukyuDates && period.yukyuDates.length > 0 && (
                        <div className="grid grid-cols-3 md:grid-cols-4 gap-1 pl-2">
                          {period.yukyuDates.slice(0, 16).map((date, i) => (
                            <div
                              key={`${date}-${i}`}
                              className={`text-[11px] font-mono py-1.5 px-2 rounded text-center ${
                                period.isExpired
                                  ? 'bg-red-500/5 text-red-400/60 line-through'
                                  : isDark ? 'bg-white/10 text-white/80' : 'bg-slate-50 text-slate-600'
                              }`}
                            >
                              {new Date(date).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}
                            </div>
                          ))}
                          {period.yukyuDates.length > 16 && (
                            <div className={`text-[10px] py-1.5 px-2 text-center ${isDark ? 'text-white/70' : 'text-slate-400'}`}>
                              +{period.yukyuDates.length - 16}件
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Regla de consumo */}
                  <div className={`mt-4 p-3 rounded-xl ${isDark ? 'bg-indigo-500/5 border border-indigo-500/10' : 'bg-indigo-50 border border-indigo-100'}`}>
                    <p className={`text-[10px] leading-relaxed ${isDark ? 'text-white/60' : 'text-slate-600'}`}>
                      <span className="text-indigo-500 font-bold">労働基準法39条:</span> 入社6ヶ月で初回付与(10日)、以降1年ごとに付与。
                      各付与から2年で時効。<span className="text-pink-500">新しい付与分から優先消化。</span>
                    </p>
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center space-y-2">
                  <div className={`text-3xl ${isDark ? 'opacity-20' : 'opacity-30'}`}>📭</div>
                  <p className={`text-sm ${isDark ? 'text-white/70' : 'text-slate-400'}`}>期間別データなし</p>
                  <p className={`text-xs ${isDark ? 'text-white/70' : 'text-slate-300'}`}>有給休暇管理.xlsmを同期してください</p>
                </div>
              )}
            </div>
          </div>
          </div>
        </FocusTrap>
      )}
    </div>
  );
};

export default EmployeeList;
