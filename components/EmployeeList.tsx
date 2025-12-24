
import React, { useState } from 'react';
import { Employee } from '../types';
import { exportEmployeesToCSV, exportToPDF } from '../services/exportService';
import { getDisplayName } from '../services/nameConverter';
import { useTheme } from '../contexts/ThemeContext';

interface EmployeeListProps {
  employees: Employee[];
}

const EmployeeList: React.FC<EmployeeListProps> = ({ employees }) => {
  const { isDark } = useTheme();
  const [searchTerm, setSearchTerm] = useState('');
  const [exportingPDF, setExportingPDF] = useState(false);

  const filtered = employees.filter(e =>
    e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.id.includes(searchTerm) ||
    e.client.toLowerCase().includes(searchTerm.toLowerCase()) ||
    getDisplayName(e.name).includes(searchTerm)
  );

  const handleExportCSV = () => {
    exportEmployeesToCSV(filtered);
  };

  const handleExportPDF = async () => {
    setExportingPDF(true);
    await exportToPDF('employee-list-container', `有給休暇_社員一覧_${new Date().toISOString().split('T')[0]}.pdf`);
    setExportingPDF(false);
  };

  return (
    <div className="p-12 space-y-12 animate-fadeIn max-w-[1600px] mx-auto">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div className="space-y-4">
          <div className="flex items-center gap-6">
            <div className="h-10 w-2 bg-blue-500"></div>
            <h2 className={`text-5xl font-black italic tracking-tighter ${isDark ? 'aggressive-text' : 'text-slate-800'}`}>社員台帳</h2>
          </div>
          <p className={`font-black tracking-[0.4em] ml-8 text-xs ${isDark ? 'text-white/30' : 'text-slate-500'}`}>有給休暇管理システム</p>
        </div>

        <div className="flex flex-wrap gap-4 items-center">
          <div className="relative w-full md:w-96">
            <span className={`absolute left-6 top-1/2 -translate-y-1/2 text-lg ${isDark ? 'text-white/20' : 'text-slate-400'}`}>/</span>
            <input
              type="text"
              placeholder="社員番号・氏名で検索..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`border rounded-none pl-14 pr-8 py-5 w-full focus:outline-none focus:border-blue-500 transition-all font-bold text-sm ${isDark ? 'bg-[#0a0a0a] border-white/10 text-white placeholder:text-white/30' : 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-400'}`}
            />
          </div>
          <button onClick={handleExportCSV} className={`border px-8 py-5 text-[10px] font-black tracking-widest transition-all ${isDark ? 'bg-white/5 border-white/10 hover:bg-white/10 text-white' : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-800'}`}>CSV出力</button>
          <button onClick={handleExportPDF} className={`px-8 py-5 text-[10px] font-black tracking-widest transition-all ${isDark ? 'bg-white text-black hover:bg-white/90 shadow-[0_0_20px_rgba(255,255,255,0.2)]' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg'}`}>PDF出力</button>
        </div>
      </header>

      <div id="employee-list-container" className={`border overflow-hidden ${isDark ? 'bg-[#0a0a0a] border-white/5' : 'bg-white border-slate-200 shadow-sm'}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className={`text-[10px] font-black uppercase tracking-[0.2em] border-b ${isDark ? 'bg-white/[0.02] text-white/30 border-white/5' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                <th className="px-10 py-6">社員№</th>
                <th className="px-10 py-6">氏名 / 派遣先</th>
                <th className="px-10 py-6 text-center">付与</th>
                <th className="px-10 py-6 text-center">消化</th>
                <th className="px-10 py-6 text-center">残日数</th>
                <th className="px-10 py-6 text-center">年5日義務化</th>
                <th className="px-10 py-6 text-right">状態</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-white/5' : 'divide-slate-100'}`}>
              {filtered.map((emp) => {
                const isMandatoryTarget = emp.grantedTotal >= 10;
                const isCompliant = emp.usedTotal >= 5;
                const displayName = getDisplayName(emp.name);

                return (
                  <tr key={emp.id} className={`transition-colors group ${isDark ? 'hover:bg-white/[0.01]' : 'hover:bg-slate-50'}`}>
                    <td className={`px-10 py-8 font-black italic text-sm group-hover:text-blue-500 transition-colors ${isDark ? 'text-white/20' : 'text-slate-400'}`}>#{emp.id}</td>
                    <td className="px-10 py-8">
                      <div className={`font-black text-lg tracking-tight group-hover:translate-x-1 transition-transform ${isDark ? 'text-white' : 'text-slate-800'}`}>{displayName}</div>
                      <div className={`text-[10px] font-bold mt-1 tracking-widest ${isDark ? 'text-white/30' : 'text-slate-500'}`}>{emp.client}</div>
                    </td>
                    <td className={`px-10 py-8 text-center font-black text-sm ${isDark ? 'text-white' : 'text-slate-800'}`}>{emp.grantedTotal}日</td>
                    <td className="px-10 py-8 text-center">
                      <span className={`font-black text-sm ${emp.usedTotal === 0 ? isDark ? 'text-white/20' : 'text-slate-300' : 'text-red-500'}`}>
                        {emp.usedTotal}日
                      </span>
                    </td>
                    <td className="px-10 py-8 text-center">
                      <div className={`inline-block px-5 py-2 border-2 font-black text-xs ${
                        emp.balance < 5 ? 'border-red-600 text-red-600' : isDark ? 'border-white/10 text-white' : 'border-slate-200 text-slate-800'
                      }`}>
                        残{emp.balance}日
                      </div>
                    </td>
                    <td className="px-10 py-8 text-center">
                      {isMandatoryTarget ? (
                        <span className={`px-4 py-1.5 text-[9px] font-black tracking-widest border ${
                          isCompliant ? 'bg-blue-500/10 border-blue-500/30 text-blue-500' : 'bg-red-600 border-red-600 text-white animate-pulse'
                        }`}>
                          {isCompliant ? '達成' : '未達 / 要対応'}
                        </span>
                      ) : (
                        <span className={`text-[9px] font-black tracking-widest ${isDark ? 'text-white/10' : 'text-slate-300'}`}>対象外</span>
                      )}
                    </td>
                    <td className="px-10 py-8 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <span className={`text-[10px] font-black tracking-widest ${isDark ? 'opacity-40' : 'text-slate-500'}`}>{emp.status}</span>
                        <div className={`w-1.5 h-6 ${emp.status === '在職中' ? 'bg-green-500 shadow-[0_0_10px_#22c55e]' : isDark ? 'bg-white/10' : 'bg-slate-200'}`}></div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default EmployeeList;
