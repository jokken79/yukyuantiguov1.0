
import React, { useState, useMemo } from 'react';
import { AppData, Employee, LeaveRecord } from '../types';
import { exportToPDF } from '../services/exportService';
import { useTheme } from '../contexts/ThemeContext';

interface AccountingReportsProps {
  data: AppData;
}

const AccountingReports: React.FC<AccountingReportsProps> = ({ data }) => {
  const { isDark } = useTheme();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [cutoffDay, setCutoffDay] = useState<15 | 20>(20); // デフォルト20日締め（21日〜20日）
  const [exporting, setExporting] = useState(false);

  // 締め日に基づいた期間（Start Date / End Date）を計算
  // 20日締めの場合：前月21日〜当月20日
  // 15日締めの場合：前月16日〜当月15日
  const period = useMemo(() => {
    const end = new Date(selectedYear, selectedMonth - 1, cutoffDay);
    const start = new Date(selectedYear, selectedMonth - 2, cutoffDay + 1);
    return { start, end };
  }, [selectedYear, selectedMonth, cutoffDay]);

  // 期間内の申請レコードをフィルタリングし、社員ごとに集計 (承認済のみ)
  const reportData = useMemo(() => {
    const recordsInPeriod = data.records.filter(r => {
      const d = new Date(r.date);
      return d >= period.start && d <= period.end && r.type === 'paid' && r.status === 'approved';
    });

    const summary: Record<string, { emp: Employee; days: string[]; total: number }> = {};

    recordsInPeriod.forEach(r => {
      const emp = data.employees.find(e => e.id === r.employeeId);
      if (!emp) return;

      if (!summary[r.employeeId]) {
        summary[r.employeeId] = { emp, days: [], total: 0 };
      }
      summary[r.employeeId].days.push(r.date);
      summary[r.employeeId].total += 1;
    });

    return Object.values(summary).sort((a, b) => a.emp.client.localeCompare(b.emp.client));
  }, [data, period]);

  const handleExport = async () => {
    setExporting(true);
    await exportToPDF('accounting-report-content', `yukyu_ledger_${selectedYear}_${selectedMonth}_cutoff${cutoffDay}.pdf`);
    setExporting(false);
  };

  return (
    <div className="p-12 space-y-12 animate-fadeIn max-w-[1600px] mx-auto relative">
      <div className={`absolute top-0 right-0 text-[18vw] font-black select-none pointer-events-none italic tracking-tighter uppercase ${isDark ? 'text-white/[0.01]' : 'text-slate-900/[0.02]'}`}>Ledger</div>

      <header className="flex flex-col md:flex-row justify-between items-end gap-8 relative z-10">
        <div className="space-y-4">
          <div className="flex items-center gap-6">
            <div className="h-14 w-2 bg-yellow-500 shadow-[0_0_20px_#eab308] animate-pulse"></div>
            <h2 className={`text-7xl font-black italic tracking-tighter ${isDark ? 'aggressive-text' : 'text-slate-800'}`}>MONTHLY LEDGER</h2>
          </div>
          <p className={`font-black tracking-[0.4em] ml-8 uppercase text-sm ${isDark ? 'text-white/30' : 'text-slate-500'}`}>
            Financial Accounting & Payroll Support
          </p>
        </div>

        <div className={`flex flex-wrap gap-4 p-4 border ${isDark ? 'bg-[#0a0a0a] border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="flex flex-col gap-2">
            <label className={`text-[9px] font-black tracking-widest uppercase italic ${isDark ? 'text-white/40' : 'text-slate-500'}`}>Target Month</label>
            <div className="flex gap-2">
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className={`border text-xs font-black p-2 outline-none focus:border-yellow-500 ${isDark ? 'bg-black border-white/20 text-white' : 'bg-white border-slate-300 text-slate-800'}`}
              >
                {[2024, 2025].map(y => <option key={y} value={y}>{y}Y</option>)}
              </select>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className={`border text-xs font-black p-2 outline-none focus:border-yellow-500 ${isDark ? 'bg-black border-white/20 text-white' : 'bg-white border-slate-300 text-slate-800'}`}
              >
                {Array.from({length: 12}).map((_, i) => <option key={i+1} value={i+1}>{i+1}M</option>)}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className={`text-[9px] font-black tracking-widest uppercase italic ${isDark ? 'text-white/40' : 'text-slate-500'}`}>Cutoff Strategy</label>
            <div className="flex gap-2">
              <button
                onClick={() => setCutoffDay(15)}
                className={`px-4 py-2 text-[10px] font-black italic border ${cutoffDay === 15 ? 'bg-yellow-500 text-black border-yellow-500' : isDark ? 'bg-transparent text-white/40 border-white/20' : 'bg-white text-slate-500 border-slate-300'}`}
              >
                15D_CUTOFF (16-15)
              </button>
              <button
                onClick={() => setCutoffDay(20)}
                className={`px-4 py-2 text-[10px] font-black italic border ${cutoffDay === 20 ? 'bg-yellow-500 text-black border-yellow-500' : isDark ? 'bg-transparent text-white/40 border-white/20' : 'bg-white text-slate-500 border-slate-300'}`}
              >
                20D_CUTOFF (21-20)
              </button>
            </div>
          </div>

          <button
            onClick={handleExport}
            disabled={exporting}
            className={`ml-4 px-10 text-[10px] font-black tracking-widest italic hover:bg-yellow-500 transition-all ${isDark ? 'bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.1)]' : 'bg-slate-800 text-white shadow-lg'}`}
          >
            {exporting ? 'GENERATING...' : 'EXPORT_LEDGER_PDF'}
          </button>
        </div>
      </header>

      <div id="accounting-report-content" className={`border p-12 relative overflow-hidden ${isDark ? 'bg-[#050505] border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}>
        <div className="absolute top-0 right-0 w-full h-1 bg-gradient-to-r from-transparent via-yellow-500 to-transparent opacity-50"></div>

        <div className="flex justify-between items-start mb-16">
          <div>
            <h3 className={`text-4xl font-black italic tracking-tighter ${isDark ? 'text-white' : 'text-slate-800'}`}>給与計算用 有給消化報告書</h3>
            <p className="text-sm font-bold text-yellow-500/80 mt-2 italic tracking-widest uppercase">
              Period: {period.start.toLocaleDateString('ja-JP')} {' >>> '} {period.end.toLocaleDateString('ja-JP')}
            </p>
          </div>
          <div className="text-right">
            <div className={`text-[10px] font-black tracking-[0.5em] uppercase ${isDark ? 'text-white/20' : 'text-slate-400'}`}>Security Level</div>
            <div className="text-xs font-black text-red-600 italic">CLASSIFIED FINANCIAL DATA</div>
          </div>
        </div>

        {reportData.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className={`border-b-2 text-[10px] font-black uppercase tracking-[0.3em] ${isDark ? 'border-white/10 text-white/40' : 'border-slate-200 text-slate-500'}`}>
                  <th className="py-6 px-4">Client / Factory</th>
                  <th className="py-6 px-4">Employee ID</th>
                  <th className="py-6 px-4">Full Name</th>
                  <th className="py-6 px-4 text-center">Dates Taken</th>
                  <th className="py-6 px-4 text-right">Total Days</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-white/5' : 'divide-slate-100'}`}>
                {reportData.map(({ emp, days, total }) => (
                  <tr key={emp.id} className={`group transition-all ${isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-50'}`}>
                    <td className={`py-8 px-4 font-black text-xs italic ${isDark ? 'text-white/40' : 'text-slate-500'}`}>{emp.client}</td>
                    <td className="py-8 px-4 font-black text-sm tracking-widest text-blue-500">#{emp.id}</td>
                    <td className={`py-8 px-4 font-black text-xl italic group-hover:translate-x-1 transition-transform ${isDark ? 'text-white' : 'text-slate-800'}`}>{emp.name}</td>
                    <td className="py-8 px-4 text-center">
                      <div className="flex flex-wrap justify-center gap-2">
                        {days.map(d => (
                          <span key={d} className={`px-3 py-1 border text-[9px] font-black italic ${isDark ? 'bg-white/5 border-white/10 text-white/60' : 'bg-slate-100 border-slate-200 text-slate-600'}`}>
                            {d.split('-').slice(1).join('/')}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-8 px-4 text-right">
                      <div className="text-4xl font-black italic text-yellow-500 drop-shadow-[0_0_10px_rgba(234,179,8,0.3)]">
                        {total}<span className={`text-xs ml-1 ${isDark ? 'text-white/40' : 'text-slate-400'}`}>D</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className={isDark ? 'bg-white/[0.02]' : 'bg-slate-50'}>
                  <td colSpan={4} className={`py-8 px-4 text-right text-[10px] font-black tracking-widest uppercase italic ${isDark ? 'text-white/20' : 'text-slate-400'}`}>Grand Total (Period)</td>
                  <td className={`py-8 px-4 text-right text-4xl font-black italic ${isDark ? 'text-white' : 'text-slate-800'}`}>
                    {reportData.reduce((s, i) => s + i.total, 0)}<span className="text-xs ml-1">DAYS</span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className={`py-32 flex flex-col items-center justify-center space-y-6 opacity-20 border-2 border-dashed ${isDark ? 'border-white/10' : 'border-slate-300'}`}>
            <div className="text-8xl italic font-black">NULL</div>
            <p className="text-sm font-black tracking-[0.5em] uppercase text-center">
              対象期間内に有給申請レコードは<br/>存在しません
            </p>
          </div>
        )}

        <div className={`mt-20 flex justify-between items-end border-t pt-10 ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
           <div className="space-y-4">
              <div className="flex items-center gap-3">
                 <div className="w-3 h-3 bg-blue-500"></div>
                 <span className={`text-[10px] font-black tracking-widest uppercase ${isDark ? 'text-white/40' : 'text-slate-500'}`}>Timestamp: {new Date().toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-3">
                 <div className="w-3 h-3 bg-red-600"></div>
                 <span className={`text-[10px] font-black tracking-widest uppercase ${isDark ? 'text-white/40' : 'text-slate-500'}`}>Authentication: INTERNAL_ONLY</span>
              </div>
           </div>
           <div className="text-right">
              <p className={`text-[10px] font-black italic mb-4 ${isDark ? 'text-white/20' : 'text-slate-400'}`}>APPROVED BY YUKYU-PRO ENGINE</p>
              <div className={`h-16 w-48 border flex items-center justify-center italic font-black select-none ${isDark ? 'bg-white/5 border-white/10 text-white/10' : 'bg-slate-100 border-slate-200 text-slate-300'}`}>
                DIGITAL_STAMP
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default AccountingReports;
