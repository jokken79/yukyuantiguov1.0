
import React, { useState, useMemo } from 'react';
import { Employee } from '../types';
import { exportEmployeesToCSV, exportToPDF } from '../services/exportService';
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
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [sortKey, setSortKey] = useState<SortKey>('id');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Filter employees
  const filtered = useMemo(() => {
    return employees.filter(e =>
      e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.id.includes(searchTerm) ||
      e.client.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getDisplayName(e.name).includes(searchTerm)
    );
  }, [employees, searchTerm]);

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
      return <span className={`ml-1 ${isDark ? 'text-white/20' : 'text-slate-300'}`}>↕</span>;
    }
    return <span className="ml-1 text-blue-500">{sortOrder === 'asc' ? '↑' : '↓'}</span>;
  };

  const handleExportCSV = () => {
    exportEmployeesToCSV(filtered);
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
            <p className={`font-black tracking-[0.2em] md:tracking-[0.4em] ml-6 md:ml-8 text-[10px] md:text-xs ${isDark ? 'text-white/30' : 'text-slate-500'}`}>有給休暇管理システム</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 md:gap-4 items-stretch sm:items-center">
            <div className="relative w-full sm:w-64 md:w-96">
              <span className={`absolute left-4 md:left-6 top-1/2 -translate-y-1/2 text-base md:text-lg ${isDark ? 'text-white/20' : 'text-slate-400'}`}>/</span>
              <input
                type="text"
                placeholder="社員番号・氏名で検索..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`border rounded-none pl-10 md:pl-14 pr-4 md:pr-8 py-3 md:py-5 w-full focus:outline-none focus:border-blue-500 transition-all font-bold text-sm ${isDark ? 'bg-[#0a0a0a] border-white/10 text-white placeholder:text-white/30' : 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-400'}`}
              />
            </div>
            <div className="flex gap-2 md:gap-4">
              <button onClick={handleExportCSV} className={`flex-1 sm:flex-none border px-4 md:px-8 py-3 md:py-5 text-[9px] md:text-[10px] font-black tracking-widest transition-all ${isDark ? 'bg-white/5 border-white/10 hover:bg-white/10 text-white' : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-800'}`}>CSV</button>
              <button onClick={handleExportPDF} disabled={exportingPDF} className={`flex-1 sm:flex-none px-4 md:px-8 py-3 md:py-5 text-[9px] md:text-[10px] font-black tracking-widest transition-all ${isDark ? 'bg-white text-black hover:bg-white/90 shadow-[0_0_20px_rgba(255,255,255,0.2)]' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg'}`}>
                {exportingPDF ? '...' : 'PDF'}
              </button>
            </div>
          </div>
        </div>

        {/* Results info and pagination controls */}
        <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 px-2 ${isDark ? 'text-white/40' : 'text-slate-500'}`}>
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

      <div id="employee-list-container" className={`border overflow-hidden ${isDark ? 'bg-[#0a0a0a] border-white/5' : 'bg-white border-slate-200 shadow-sm'}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[800px]">
            <thead>
              <tr className={`text-[9px] md:text-[10px] font-black uppercase tracking-[0.1em] md:tracking-[0.2em] border-b ${isDark ? 'bg-white/[0.02] text-white/30 border-white/5' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
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
                    <tr key={emp.id} className={`transition-colors group ${isDark ? 'hover:bg-white/[0.01]' : 'hover:bg-slate-50'}`}>
                      <td className={`px-4 md:px-10 py-4 md:py-8 font-black italic text-xs md:text-sm group-hover:text-blue-500 transition-colors ${isDark ? 'text-white/20' : 'text-slate-400'}`}>#{emp.id}</td>
                      <td className="px-4 md:px-10 py-4 md:py-8">
                        <div className={`font-black text-base md:text-lg tracking-tight group-hover:translate-x-1 transition-transform ${isDark ? 'text-white' : 'text-slate-800'}`}>{displayName}</div>
                        <div className={`text-[9px] md:text-[10px] font-bold mt-1 tracking-widest ${isDark ? 'text-white/30' : 'text-slate-500'}`}>{emp.client}</div>
                      </td>
                      <td className={`px-4 md:px-10 py-4 md:py-8 text-center ${isDark ? 'text-white' : 'text-slate-800'}`}>
                        {emp.currentGrantedTotal !== undefined ? (
                          <>
                            <div className="font-black text-xs md:text-sm">{emp.currentGrantedTotal}日</div>
                            {emp.historicalGrantedTotal !== emp.currentGrantedTotal && (
                              <div className={`text-[9px] ${isDark ? 'text-white/30' : 'text-slate-400'}`}>
                                (全期間: {emp.historicalGrantedTotal}日)
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="font-black text-xs md:text-sm">{emp.grantedTotal}日</div>
                        )}
                      </td>
                      <td className="px-4 md:px-10 py-4 md:py-8 text-center">
                        {emp.currentUsedTotal !== undefined ? (
                          <>
                            <div className={`font-black text-xs md:text-sm ${emp.currentUsedTotal === 0 ? isDark ? 'text-white/20' : 'text-slate-300' : 'text-red-500'}`}>
                              {emp.currentUsedTotal}日
                            </div>
                            {emp.historicalUsedTotal !== emp.currentUsedTotal && (
                              <div className={`text-[9px] ${isDark ? 'text-white/30' : 'text-slate-400'}`}>
                                (全期間: {emp.historicalUsedTotal}日)
                              </div>
                            )}
                          </>
                        ) : (
                          <span className={`font-black text-xs md:text-sm ${emp.usedTotal === 0 ? isDark ? 'text-white/20' : 'text-slate-300' : 'text-red-500'}`}>
                            {emp.usedTotal}日
                          </span>
                        )}
                      </td>
                      <td className="px-4 md:px-10 py-4 md:py-8 text-center">
                        {emp.currentBalance !== undefined ? (
                          <div className="flex flex-col items-center">
                            <div className={`inline-block px-3 md:px-5 py-1 md:py-2 border-2 font-black text-[10px] md:text-xs ${
                              emp.currentBalance < 5 ? 'border-red-600 text-red-600' : isDark ? 'border-white/10 text-white' : 'border-slate-200 text-slate-800'
                            }`}>
                              残{emp.currentBalance}日
                            </div>
                            {emp.historicalBalance !== emp.currentBalance && (
                              <div className={`text-[8px] mt-1 ${isDark ? 'text-white/30' : 'text-slate-400'}`}>
                                (全: {emp.historicalBalance}日)
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className={`inline-block px-3 md:px-5 py-1 md:py-2 border-2 font-black text-[10px] md:text-xs ${
                            emp.balance < 5 ? 'border-red-600 text-red-600' : isDark ? 'border-white/10 text-white' : 'border-slate-200 text-slate-800'
                          }`}>
                            残{emp.balance}日
                          </div>
                        )}
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
                    <p className={`font-bold ${isDark ? 'text-white/30' : 'text-slate-400'}`}>該当する社員がいません</p>
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
              className={`px-3 py-2 text-xs font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed ${isDark ? 'bg-white/5 hover:bg-white/10 text-white border border-white/10' : 'bg-white hover:bg-slate-50 text-slate-800 border border-slate-200'}`}
            >
              ««
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className={`px-3 py-2 text-xs font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed ${isDark ? 'bg-white/5 hover:bg-white/10 text-white border border-white/10' : 'bg-white hover:bg-slate-50 text-slate-800 border border-slate-200'}`}
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
                        : isDark ? 'bg-white/5 hover:bg-white/10 text-white border border-white/10' : 'bg-white hover:bg-slate-50 text-slate-800 border border-slate-200'
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
              className={`px-3 py-2 text-xs font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed ${isDark ? 'bg-white/5 hover:bg-white/10 text-white border border-white/10' : 'bg-white hover:bg-slate-50 text-slate-800 border border-slate-200'}`}
            >
              »
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className={`px-3 py-2 text-xs font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed ${isDark ? 'bg-white/5 hover:bg-white/10 text-white border border-white/10' : 'bg-white hover:bg-slate-50 text-slate-800 border border-slate-200'}`}
            >
              »»
            </button>
          </div>
          <div className={`text-xs font-bold ${isDark ? 'text-white/40' : 'text-slate-500'}`}>
            {currentPage} / {totalPages} ページ
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeList;
