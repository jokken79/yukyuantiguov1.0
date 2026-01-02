
import React, { useState, useMemo } from 'react';
import { AppData, Employee } from '../types';
import { db } from '../services/db';
import { useTheme } from '../contexts/ThemeContext';

interface LeaveRequestProps {
  data: AppData;
  onSuccess: () => void;
}

// Categorizar fechas por período de 有給 (basado en 入社日 + 6ヶ月, luego anual)
// 労働基準法39条: 6ヶ月で初回付与、その後1年ごと
interface YearGroup {
  period: string; // "1回目(6ヶ月)", "2回目(1年6ヶ月)", etc.
  grantDate: string; // 付与日
  expiryDate: string; // 時効日 (2年後)
  daysGranted: number; // 法定付与日数
  dates: string[];
  isExpired: boolean;
  expiresIn?: number; // meses hasta expirar
  isCurrentPeriod: boolean;
}

// 法定付与日数テーブル (労働基準法39条)
const LEGAL_GRANT_TABLE: { months: number; days: number }[] = [
  { months: 6, days: 10 },    // 6ヶ月
  { months: 18, days: 11 },   // 1年6ヶ月
  { months: 30, days: 12 },   // 2年6ヶ月
  { months: 42, days: 14 },   // 3年6ヶ月
  { months: 54, days: 16 },   // 4年6ヶ月
  { months: 66, days: 18 },   // 5年6ヶ月
  { months: 78, days: 20 },   // 6年6ヶ月以上
];

// Obtener el período de grant basado en la fecha
const getGrantPeriod = (date: Date, entryDate: Date): number => {
  const diffMonths = (date.getFullYear() - entryDate.getFullYear()) * 12 +
                     (date.getMonth() - entryDate.getMonth());

  if (diffMonths < 6) return -1; // Antes de la primera asignación

  // Encontrar el período correspondiente
  for (let i = LEGAL_GRANT_TABLE.length - 1; i >= 0; i--) {
    if (diffMonths >= LEGAL_GRANT_TABLE[i].months) {
      return i;
    }
  }
  return 0;
};

// Calcular fecha de grant para un período específico
const getGrantDate = (entryDate: Date, periodIndex: number): Date => {
  const grantDate = new Date(entryDate);
  grantDate.setMonth(grantDate.getMonth() + LEGAL_GRANT_TABLE[periodIndex].months);
  return grantDate;
};

const categorizeDatesByEntryAnniversary = (dates: string[], entryDate: string | undefined): YearGroup[] => {
  if (!entryDate || dates.length === 0) return [];

  const now = new Date();
  const entry = new Date(entryDate);

  // Período actual del empleado
  const currentPeriod = getGrantPeriod(now, entry);

  // Agrupar fechas por período de grant
  const yearGroups: Map<number, string[]> = new Map();

  dates.forEach(dateStr => {
    const date = new Date(dateStr);
    const period = getGrantPeriod(date, entry);

    if (period >= 0) {
      if (!yearGroups.has(period)) {
        yearGroups.set(period, []);
      }
      yearGroups.get(period)!.push(dateStr);
    }
  });

  const result: YearGroup[] = [];
  // Ordenar por período más reciente primero (nuevos primero = 新しい付与分から消化)
  const sortedPeriods = Array.from(yearGroups.keys()).sort((a, b) => b - a);

  sortedPeriods.forEach(periodIndex => {
    const periodDates = yearGroups.get(periodIndex)!.sort((a, b) =>
      new Date(b).getTime() - new Date(a).getTime()
    );

    const grantDate = getGrantDate(entry, periodIndex);
    const expiryDate = new Date(grantDate);
    expiryDate.setFullYear(expiryDate.getFullYear() + 2);

    const isExpired = now >= expiryDate;
    const isCurrentPeriod = periodIndex === currentPeriod;

    // Calcular meses hasta expirar
    let expiresIn: number | undefined;
    if (!isExpired) {
      const monthsUntilExpiry = Math.ceil(
        (expiryDate.getTime() - now.getTime()) / (30 * 24 * 60 * 60 * 1000)
      );
      if (monthsUntilExpiry <= 12) {
        expiresIn = Math.max(0, monthsUntilExpiry);
      }
    }

    // Nombre del período
    const monthsFromEntry = LEGAL_GRANT_TABLE[periodIndex].months;
    const periodName = monthsFromEntry === 6
      ? '初回(6ヶ月)'
      : `${Math.floor(monthsFromEntry / 12)}年${monthsFromEntry % 12 > 0 ? (monthsFromEntry % 12) + 'ヶ月' : ''}`;

    result.push({
      period: periodName,
      grantDate: grantDate.toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' }),
      expiryDate: expiryDate.toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' }),
      daysGranted: LEGAL_GRANT_TABLE[periodIndex].days,
      dates: periodDates,
      isExpired,
      expiresIn,
      isCurrentPeriod
    });
  });

  return result;
};

const LeaveRequest: React.FC<LeaveRequestProps> = ({ data, onSuccess }) => {
  const { isDark } = useTheme();
  const [selectedClient, setSelectedClient] = useState('');
  const [formData, setFormData] = useState({
    employeeId: '',
    date: new Date().toISOString().split('T')[0],
    type: 'paid' as const,
    note: ''
  });

  // Unique factories (clients) for the dropdown
  const factories = useMemo(() => {
    const unique = new Set(data.employees.map(e => e.client));
    return Array.from(unique).filter(Boolean).sort();
  }, [data.employees]);

  // Employees filtered by selected factory
  const filteredEmployees = useMemo(() => {
    if (!selectedClient) return [];
    return data.employees.filter(e => e.client === selectedClient && e.status === '在職中');
  }, [selectedClient, data.employees]);

  // Selected employee data for the summary card
  const selectedEmployee = useMemo(() => {
    return data.employees.find(e => e.id === formData.employeeId);
  }, [formData.employeeId, data.employees]);

  // Combinar yukyuDates del Excel + records de la app
  const allLeaveHistory = useMemo(() => {
    if (!selectedEmployee) return [];

    // Fechas del Excel (yukyuDates)
    const excelDates = selectedEmployee.yukyuDates || [];

    // Fechas de records de la app
    const appDates = data.records
      .filter(r => r.employeeId === selectedEmployee.id && r.type === 'paid')
      .map(r => r.date);

    // Combinar y eliminar duplicados
    const allDates = [...new Set([...excelDates, ...appDates])];
    return allDates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  }, [selectedEmployee, data.records]);

  // Agrupar por período de aniversario (入社日)
  const historyByYear = useMemo(() => {
    return categorizeDatesByEntryAnniversary(allLeaveHistory, selectedEmployee?.entryDate);
  }, [allLeaveHistory, selectedEmployee?.entryDate]);

  // Calcular totales reales basados en historyByYear (más preciso que Excel)
  const calculatedTotals = useMemo(() => {
    if (!historyByYear || historyByYear.length === 0) {
      return {
        totalGranted: selectedEmployee?.grantedTotal || 0,
        totalUsed: selectedEmployee?.usedTotal || 0,
        balance: selectedEmployee?.balance || 0,
        expiredCount: selectedEmployee?.expiredCount || 0
      };
    }

    // Sumar todos los días otorgados de los períodos NO expirados
    const totalGranted = historyByYear
      .filter(period => !period.isExpired)
      .reduce((sum, period) => sum + period.daysGranted, 0);

    // Sumar todos los días consumidos
    const totalUsed = historyByYear
      .reduce((sum, period) => sum + period.dates.length, 0);

    // Calcular días expirados: días otorgados en períodos expirados MENOS los que se consumieron
    const expiredCount = historyByYear
      .filter(period => period.isExpired)
      .reduce((sum, period) => {
        // Días expirados = días otorgados - días consumidos en ese período
        const unusedInPeriod = period.daysGranted - period.dates.length;
        return sum + Math.max(0, unusedInPeriod);
      }, 0);

    // Balance = otorgados - consumidos (solo períodos no expirados)
    const balance = totalGranted - historyByYear
      .filter(period => !period.isExpired)
      .reduce((sum, period) => sum + period.dates.length, 0);

    return { totalGranted, totalUsed, balance, expiredCount };
  }, [historyByYear, selectedEmployee]);

  // Analyze usage over the last 2 years from records
  const analysis = useMemo(() => {
    if (!formData.employeeId) return { twoYearUsage: 0, recentlyUsed: 0, totalHistory: 0 };

    const now = new Date();
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(now.getFullYear() - 2);

    const last30Days = new Date();
    last30Days.setDate(now.getDate() - 30);

    // Contar desde allLeaveHistory
    const validDates = allLeaveHistory.filter(d => new Date(d) >= twoYearsAgo);
    const recentDates = allLeaveHistory.filter(d => new Date(d) >= last30Days);

    return {
      twoYearUsage: validDates.length,
      recentlyUsed: recentDates.length,
      totalHistory: allLeaveHistory.length
    };
  }, [formData.employeeId, allLeaveHistory]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.employeeId || !formData.date) return;

    db.addRecord({
      employeeId: formData.employeeId,
      date: formData.date,
      type: formData.type,
      note: formData.note
    });

    setFormData(prev => ({ ...prev, note: '', date: new Date().toISOString().split('T')[0] }));
    onSuccess();
    alert("休暇申請を受け付けました。\n\n※承認後に有給残高が更新されます。\n申請管理ページで承認状況を確認できます。");
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-5xl mx-auto space-y-6 md:space-y-8 animate-fadeIn">
      <div className="mb-2 md:mb-4">
        <h2 className={`text-2xl md:text-3xl font-extrabold ${isDark ? 'text-white' : 'text-slate-800'}`}>有給休暇申請</h2>
        <p className={`mt-1 md:mt-2 text-sm ${isDark ? 'text-white/50' : 'text-slate-500'}`}>
          工場を選択して従業員を絞り込み、申請を行います。
          <br className="hidden md:block" />
          <span className="text-xs italic text-indigo-500 opacity-80">
            ※当社の規定（新しい付与分から優先消化）に基づき計算されます。
          </span>
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Input Form */}
        <div className="lg:col-span-7">
          <form onSubmit={handleSubmit} className={`p-8 rounded-3xl space-y-6 ${isDark ? 'bg-white/5 border border-white/10' : 'bg-white border border-slate-200 shadow-lg'}`}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className={`text-sm font-semibold ${isDark ? 'text-white/60' : 'text-slate-600'}`}>工場（派遣先）</label>
                <select
                  value={selectedClient}
                  onChange={(e) => {
                    setSelectedClient(e.target.value);
                    setFormData(prev => ({ ...prev, employeeId: '' }));
                  }}
                  className={`w-full rounded-xl px-4 py-3 focus:border-indigo-500 transition-all outline-none ${isDark ? 'bg-white/5 border border-white/10 text-white' : 'bg-white border border-slate-200 text-slate-800'}`}
                  required
                >
                  <option value="" className={isDark ? 'bg-black' : 'bg-white'}>工場を選択</option>
                  {factories.map(f => <option key={f} value={f} className={isDark ? 'bg-black' : 'bg-white'}>{f}</option>)}
                </select>
              </div>

              <div className="space-y-2">
                <label className={`text-sm font-semibold ${isDark ? 'text-white/60' : 'text-slate-600'}`}>従業員名</label>
                <select
                  value={formData.employeeId}
                  onChange={(e) => setFormData(prev => ({ ...prev, employeeId: e.target.value }))}
                  disabled={!selectedClient}
                  className={`w-full rounded-xl px-4 py-3 focus:border-indigo-500 transition-all outline-none disabled:opacity-30 disabled:cursor-not-allowed ${isDark ? 'bg-white/5 border border-white/10 text-white' : 'bg-white border border-slate-200 text-slate-800'}`}
                  required
                >
                  <option value="" className={isDark ? 'bg-black' : 'bg-white'}>
                    {selectedClient ? '従業員を選択' : '先に工場を選択'}
                  </option>
                  {filteredEmployees.map(emp => (
                    <option key={emp.id} value={emp.id} className={isDark ? 'bg-black' : 'bg-white'}>{emp.name} (№{emp.id})</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Prominent Balance Indicator - shown when employee is selected */}
            {selectedEmployee && formData.type === 'paid' && (
              <div className={`p-4 rounded-2xl flex items-center justify-between ${
                calculatedTotals.balance <= 0
                  ? 'bg-red-500/10 border-2 border-red-500/30'
                  : calculatedTotals.balance <= 3
                    ? 'bg-orange-500/10 border-2 border-orange-500/30'
                    : 'bg-green-500/10 border-2 border-green-500/30'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl font-black ${
                    calculatedTotals.balance <= 0
                      ? 'bg-red-500/20 text-red-500'
                      : calculatedTotals.balance <= 3
                        ? 'bg-orange-500/20 text-orange-500'
                        : 'bg-green-500/20 text-green-500'
                  }`}>
                    {calculatedTotals.balance}
                  </div>
                  <div>
                    <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                      有給残高
                    </p>
                    <p className={`text-xs ${isDark ? 'text-white/50' : 'text-slate-500'}`}>
                      {calculatedTotals.balance <= 0
                        ? '残高なし - 申請不可'
                        : calculatedTotals.balance <= 3
                          ? '残りわずか'
                          : '申請可能'}
                    </p>
                  </div>
                </div>
                {calculatedTotals.balance > 0 && (
                  <div className={`text-right text-xs ${isDark ? 'text-white/40' : 'text-slate-400'}`}>
                    <p>付与: {calculatedTotals.totalGranted}日</p>
                    <p>消化: {calculatedTotals.totalUsed}日</p>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className={`text-sm font-semibold ${isDark ? 'text-white/60' : 'text-slate-600'}`}>取得予定日</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                  className={`w-full rounded-xl px-4 py-3 focus:border-indigo-500 transition-all outline-none ${isDark ? 'bg-white/5 border border-white/10 text-white' : 'bg-white border border-slate-200 text-slate-800'}`}
                  required
                />
                {/* Warning if date already taken */}
                {selectedEmployee && allLeaveHistory.includes(formData.date) && (
                  <p className="text-xs text-orange-500 font-medium flex items-center gap-1 mt-1">
                    <span>⚠️</span> この日付は既に取得済みです
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label className={`text-sm font-semibold ${isDark ? 'text-white/60' : 'text-slate-600'}`}>休暇の種類</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as any }))}
                  className={`w-full rounded-xl px-4 py-3 focus:border-indigo-500 transition-all outline-none ${isDark ? 'bg-white/5 border border-white/10 text-white' : 'bg-white border border-slate-200 text-slate-800'}`}
                >
                  <option value="paid" className={isDark ? 'bg-black' : 'bg-white'}>有給休暇 (全休)</option>
                  <option value="special" className={isDark ? 'bg-black' : 'bg-white'}>特別休暇</option>
                  <option value="unpaid" className={isDark ? 'bg-black' : 'bg-white'}>欠勤</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className={`text-sm font-semibold ${isDark ? 'text-white/60' : 'text-slate-600'}`}>備考 / 理由</label>
              <textarea
                value={formData.note}
                onChange={(e) => setFormData(prev => ({ ...prev, note: e.target.value }))}
                placeholder="私用、冠婚葬祭など..."
                className={`w-full rounded-xl px-4 py-3 focus:border-indigo-500 transition-all outline-none h-24 resize-none ${isDark ? 'bg-white/5 border border-white/10 text-white placeholder:text-white/30' : 'bg-white border border-slate-200 text-slate-800 placeholder:text-slate-400'}`}
              />
            </div>

            {/* Mini Calendar - shows current and next month with taken dates */}
            {selectedEmployee && allLeaveHistory.length > 0 && (
              <div className={`p-4 rounded-2xl ${isDark ? 'bg-white/5 border border-white/10' : 'bg-slate-50 border border-slate-100'}`}>
                <p className={`text-xs font-semibold mb-3 ${isDark ? 'text-white/60' : 'text-slate-500'}`}>
                  📅 取得済み日付（直近2ヶ月）
                </p>
                <div className="grid grid-cols-2 gap-4">
                  {[0, 1].map(monthOffset => {
                    const targetDate = new Date();
                    targetDate.setMonth(targetDate.getMonth() + monthOffset);
                    const year = targetDate.getFullYear();
                    const month = targetDate.getMonth();
                    const firstDay = new Date(year, month, 1).getDay();
                    const daysInMonth = new Date(year, month + 1, 0).getDate();

                    // Get dates taken in this month
                    const takenInMonth = allLeaveHistory.filter(d => {
                      const date = new Date(d);
                      return date.getFullYear() === year && date.getMonth() === month;
                    }).map(d => new Date(d).getDate());

                    return (
                      <div key={monthOffset} className="space-y-1">
                        <p className={`text-[10px] font-bold text-center ${isDark ? 'text-white/80' : 'text-slate-700'}`}>
                          {targetDate.toLocaleDateString('ja-JP', { year: 'numeric', month: 'short' })}
                        </p>
                        <div className="grid grid-cols-7 gap-0.5 text-[9px]">
                          {['日', '月', '火', '水', '木', '金', '土'].map(d => (
                            <div key={d} className={`text-center py-0.5 ${isDark ? 'text-white/30' : 'text-slate-400'}`}>{d}</div>
                          ))}
                          {Array.from({ length: firstDay }).map((_, i) => (
                            <div key={`empty-${i}`} />
                          ))}
                          {Array.from({ length: daysInMonth }).map((_, i) => {
                            const day = i + 1;
                            const isTaken = takenInMonth.includes(day);
                            const isToday = monthOffset === 0 && day === new Date().getDate();
                            return (
                              <div
                                key={day}
                                className={`text-center py-0.5 rounded ${
                                  isTaken
                                    ? 'bg-pink-500 text-white font-bold'
                                    : isToday
                                      ? 'bg-indigo-500/20 text-indigo-500 font-bold'
                                      : isDark ? 'text-white/50' : 'text-slate-500'
                                }`}
                              >
                                {day}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className={`text-[9px] mt-2 text-center ${isDark ? 'text-white/30' : 'text-slate-400'}`}>
                  <span className="inline-block w-2 h-2 bg-pink-500 rounded mr-1"></span>取得済み
                  <span className="inline-block w-2 h-2 bg-indigo-500/30 rounded ml-3 mr-1"></span>今日
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={!formData.employeeId}
              className="w-full bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-300 disabled:text-slate-400 py-4 rounded-2xl font-bold text-lg text-white transition-all shadow-lg shadow-indigo-500/20 active:scale-[0.98]"
            >
              申請を確定する
            </button>
          </form>
        </div>

        {/* Right: Analysis & Summary Card + History */}
        <div className="lg:col-span-5 space-y-6">
          {/* Employee Summary Card */}
          <div className={`p-6 rounded-3xl relative overflow-hidden group ${isDark ? 'bg-white/5 border border-white/10' : 'bg-white border border-slate-200 shadow-lg'}`}>
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-3xl group-hover:bg-indigo-500/10 transition-all"></div>

            <h3 className={`text-lg font-bold mb-4 flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>
              <span className="text-xl">📋</span> 従業員詳細
            </h3>

            {selectedEmployee ? (
              <div className="space-y-4">
                <div className={`flex justify-between items-end pb-4 ${isDark ? 'border-b border-white/5' : 'border-b border-slate-100'}`}>
                  <div>
                    <p className={`text-[10px] uppercase tracking-widest font-bold mb-1 ${isDark ? 'text-white/40' : 'text-slate-400'}`}>Employee</p>
                    <h4 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>{selectedEmployee.name}</h4>
                    <p className="text-indigo-500 text-sm font-medium">{selectedEmployee.client} / №{selectedEmployee.id}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-[10px] font-bold mb-1 uppercase ${isDark ? 'text-white/40' : 'text-slate-400'}`}>残高</p>
                    <div className="text-4xl font-black gradient-text">{calculatedTotals.balance}<span className={`text-sm ml-1 ${isDark ? 'text-white' : 'text-slate-600'}`}>日</span></div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className={`p-3 rounded-xl ${isDark ? 'bg-white/5 border border-white/5' : 'bg-slate-50 border border-slate-100'}`}>
                    <p className={`text-[9px] font-bold uppercase ${isDark ? 'text-white/40' : 'text-slate-400'}`}>付与</p>
                    <p className="text-lg font-bold text-green-500">{calculatedTotals.totalGranted}</p>
                  </div>
                  <div className={`p-3 rounded-xl ${isDark ? 'bg-white/5 border border-white/5' : 'bg-slate-50 border border-slate-100'}`}>
                    <p className={`text-[9px] font-bold uppercase ${isDark ? 'text-white/40' : 'text-slate-400'}`}>消化</p>
                    <p className="text-lg font-bold text-pink-500">{calculatedTotals.totalUsed}</p>
                  </div>
                  <div className={`p-3 rounded-xl ${isDark ? 'bg-white/5 border border-white/5' : 'bg-slate-50 border border-slate-100'}`}>
                    <p className={`text-[9px] font-bold uppercase ${isDark ? 'text-white/40' : 'text-slate-400'}`}>時効</p>
                    <p className="text-lg font-bold text-orange-500">{calculatedTotals.expiredCount}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center space-y-3">
                <div className={`text-5xl ${isDark ? 'opacity-10' : 'opacity-20'}`}>👤</div>
                <p className={`text-sm font-medium italic ${isDark ? 'text-white/20' : 'text-slate-400'}`}>
                  従業員を選択してください
                </p>
              </div>
            )}
          </div>

          {/* Leave History Table - 有給取得履歴 */}
          <div className={`p-6 rounded-3xl ${isDark ? 'bg-white/5 border border-white/10' : 'bg-white border border-slate-200 shadow-lg'}`}>
            <div className="flex items-center justify-between mb-4">
              <h4 className={`text-lg font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                <span className="text-xl">📅</span> 有給取得履歴
              </h4>
              {selectedEmployee && allLeaveHistory.length > 0 && (
                <span className="text-xs bg-indigo-500/20 text-indigo-500 px-2 py-1 rounded-full font-bold">
                  計 {allLeaveHistory.length} 日
                </span>
              )}
            </div>

            {/* Mostrar 入社日 si existe */}
            {selectedEmployee?.entryDate && (
              <div className={`mb-4 px-3 py-2 rounded-lg text-xs ${isDark ? 'bg-white/5' : 'bg-slate-50'}`}>
                <span className={isDark ? 'text-white/40' : 'text-slate-400'}>入社日: </span>
                <span className="text-indigo-500 font-bold">
                  {new Date(selectedEmployee.entryDate).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
              </div>
            )}

            {selectedEmployee ? (
              allLeaveHistory.length > 0 && historyByYear.length > 0 ? (
                <div className="space-y-4 max-h-[350px] overflow-y-auto custom-scrollbar pr-2">
                  {historyByYear.map((yearGroup) => (
                    <div key={yearGroup.period} className="space-y-2">
                      {/* Period Header */}
                      <div className={`flex items-center justify-between py-2 px-3 rounded-lg ${
                        yearGroup.isExpired
                          ? 'bg-red-500/10 border border-red-500/20'
                          : yearGroup.expiresIn !== undefined
                            ? 'bg-orange-500/10 border border-orange-500/20'
                            : yearGroup.isCurrentPeriod
                              ? 'bg-blue-500/10 border border-blue-500/20'
                              : 'bg-green-500/10 border border-green-500/20'
                      }`}>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-black ${
                              yearGroup.isExpired ? 'text-red-400'
                                : yearGroup.expiresIn !== undefined ? 'text-orange-400'
                                : yearGroup.isCurrentPeriod ? 'text-blue-400'
                                : 'text-green-400'
                            }`}>
                              {yearGroup.period}
                            </span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${isDark ? 'text-white/50 bg-white/5' : 'text-slate-500 bg-slate-100'}`}>
                              付与{yearGroup.daysGranted}日
                            </span>
                            <span className={`text-xs ${isDark ? 'text-white/40' : 'text-slate-400'}`}>({yearGroup.dates.length}日消化)</span>
                          </div>
                          <div className={`text-[9px] flex gap-2 ${isDark ? 'text-white/30' : 'text-slate-400'}`}>
                            <span>付与: {yearGroup.grantDate}</span>
                            <span>→ 時効: {yearGroup.expiryDate}</span>
                          </div>
                        </div>
                        {yearGroup.isExpired ? (
                          <span className="text-[10px] font-bold text-red-400 bg-red-500/20 px-2 py-0.5 rounded">時効済</span>
                        ) : yearGroup.expiresIn !== undefined ? (
                          <span className="text-[10px] font-bold text-orange-400 bg-orange-500/20 px-2 py-0.5 rounded">
                            あと{yearGroup.expiresIn}ヶ月
                          </span>
                        ) : yearGroup.isCurrentPeriod ? (
                          <span className="text-[10px] font-bold text-blue-400 bg-blue-500/20 px-2 py-0.5 rounded">現在</span>
                        ) : (
                          <span className="text-[10px] font-bold text-green-400 bg-green-500/20 px-2 py-0.5 rounded">有効</span>
                        )}
                      </div>

                      {/* Dates Grid */}
                      <div className="grid grid-cols-3 gap-1 pl-2">
                        {yearGroup.dates.slice(0, 12).map((date, i) => (
                          <div
                            key={`${date}-${i}`}
                            className={`text-[11px] font-mono py-1.5 px-2 rounded text-center ${
                              yearGroup.isExpired
                                ? 'bg-red-500/5 text-red-400/60 line-through'
                                : isDark ? 'bg-white/5 text-white/80' : 'bg-slate-50 text-slate-600'
                            }`}
                          >
                            {new Date(date).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}
                          </div>
                        ))}
                        {yearGroup.dates.length > 12 && (
                          <div className={`text-[10px] py-1.5 px-2 text-center ${isDark ? 'text-white/30' : 'text-slate-400'}`}>
                            +{yearGroup.dates.length - 12}件
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Regla de consumo - 労働基準法39条 */}
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
                  <p className={`text-sm ${isDark ? 'text-white/30' : 'text-slate-400'}`}>取得履歴なし</p>
                  <p className={`text-xs ${isDark ? 'text-white/20' : 'text-slate-300'}`}>有給休暇管理.xlsmを同期してください</p>
                </div>
              )
            ) : (
              <div className="py-8 text-center">
                <p className={`text-sm italic ${isDark ? 'text-white/20' : 'text-slate-400'}`}>従業員選択後に表示</p>
              </div>
            )}
          </div>

          {/* Monthly Stats */}
          <div className={`p-4 rounded-2xl ${isDark ? 'bg-white/5 border border-white/10' : 'bg-white border border-slate-200 shadow-lg'}`}>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-pink-500/20 rounded-xl flex items-center justify-center text-pink-500 text-xl font-bold">
                {data.records.filter(r => {
                  const d = new Date(r.date);
                  const now = new Date();
                  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                }).length}
              </div>
              <div className={`text-xs leading-tight ${isDark ? 'text-white/40' : 'text-slate-500'}`}>
                今月の申請件数（全社員）
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeaveRequest;
