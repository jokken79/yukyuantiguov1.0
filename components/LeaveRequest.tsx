
import React, { useState, useMemo } from 'react';
import { AppData, Employee } from '../types';
import { db } from '../services/db';

interface LeaveRequestProps {
  data: AppData;
  onSuccess: () => void;
}

// Categorizar fechas por período de aniversario (basado en 入社日)
interface YearGroup {
  period: string; // "1年目", "2年目", etc.
  periodStart: string;
  periodEnd: string;
  dates: string[];
  isExpired: boolean;
  expiresIn?: number; // meses hasta expirar
  isCurrentPeriod: boolean;
}

// Calcular el período de aniversario basado en la fecha de entrada
const categorizeDatesByEntryAnniversary = (dates: string[], entryDate: string | undefined): YearGroup[] => {
  if (!entryDate || dates.length === 0) return [];

  const now = new Date();
  const entry = new Date(entryDate);

  // Calcular cuántos años han pasado desde la entrada
  const getAnniversaryYear = (date: Date): number => {
    const diffTime = date.getTime() - entry.getTime();
    const diffYears = Math.floor(diffTime / (365.25 * 24 * 60 * 60 * 1000));
    return Math.max(0, diffYears);
  };

  // Período actual del empleado
  const currentPeriod = getAnniversaryYear(now);

  // Agrupar fechas por período de aniversario
  const yearGroups: Map<number, string[]> = new Map();

  dates.forEach(dateStr => {
    const date = new Date(dateStr);
    const period = getAnniversaryYear(date);

    if (!yearGroups.has(period)) {
      yearGroups.set(period, []);
    }
    yearGroups.get(period)!.push(dateStr);
  });

  const result: YearGroup[] = [];
  // Ordenar por período más reciente primero (nuevos primero = 新しい付与分から消化)
  const sortedPeriods = Array.from(yearGroups.keys()).sort((a, b) => b - a);

  sortedPeriods.forEach(period => {
    const periodDates = yearGroups.get(period)!.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

    // Calcular fechas de inicio y fin del período
    const periodStartDate = new Date(entry);
    periodStartDate.setFullYear(entry.getFullYear() + period);
    const periodEndDate = new Date(entry);
    periodEndDate.setFullYear(entry.getFullYear() + period + 1);
    periodEndDate.setDate(periodEndDate.getDate() - 1);

    // Un período expira 2 años después de su inicio
    const expiryDate = new Date(periodStartDate);
    expiryDate.setFullYear(expiryDate.getFullYear() + 2);

    const isExpired = now >= expiryDate;
    const isCurrentPeriod = period === currentPeriod;

    // Calcular meses hasta expirar si está en el año anterior al actual
    let expiresIn: number | undefined;
    if (!isExpired && period === currentPeriod - 1) {
      const monthsUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (30 * 24 * 60 * 60 * 1000));
      expiresIn = Math.max(0, monthsUntilExpiry);
    }

    result.push({
      period: `${period + 1}年目`,
      periodStart: periodStartDate.toLocaleDateString('ja-JP', { year: 'numeric', month: 'short' }),
      periodEnd: periodEndDate.toLocaleDateString('ja-JP', { year: 'numeric', month: 'short' }),
      dates: periodDates,
      isExpired,
      expiresIn,
      isCurrentPeriod
    });
  });

  return result;
};

const LeaveRequest: React.FC<LeaveRequestProps> = ({ data, onSuccess }) => {
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

    setFormData(prev => ({ ...prev, note: '' }));
    onSuccess();
    alert("休暇申請が完了しました。最新の有給残高が更新されました。");
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8 animate-fadeIn">
      <div className="mb-4">
        <h2 className="text-3xl font-extrabold gradient-text">有給休暇申請</h2>
        <p className="text-white/50 mt-2">
          工場を選択して従業員を絞り込み、申請を行います。
          <br />
          <span className="text-xs italic text-indigo-400 opacity-80">
            ※当社の規定（新しい付与分から優先消化）に基づき計算されます。
          </span>
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Input Form */}
        <div className="lg:col-span-7">
          <form onSubmit={handleSubmit} className="glass p-8 rounded-3xl space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-white/60">工場（派遣先）</label>
                <select
                  value={selectedClient}
                  onChange={(e) => {
                    setSelectedClient(e.target.value);
                    setFormData(prev => ({ ...prev, employeeId: '' }));
                  }}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:border-indigo-500 transition-all text-white outline-none"
                  required
                >
                  <option value="" className="bg-black">工場を選択</option>
                  {factories.map(f => <option key={f} value={f} className="bg-black">{f}</option>)}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-white/60">従業員名</label>
                <select
                  value={formData.employeeId}
                  onChange={(e) => setFormData(prev => ({ ...prev, employeeId: e.target.value }))}
                  disabled={!selectedClient}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:border-indigo-500 transition-all text-white outline-none disabled:opacity-30 disabled:cursor-not-allowed"
                  required
                >
                  <option value="" className="bg-black">
                    {selectedClient ? '従業員を選択' : '先に工場を選択'}
                  </option>
                  {filteredEmployees.map(emp => (
                    <option key={emp.id} value={emp.id} className="bg-black">{emp.name} (№{emp.id})</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-white/60">取得予定日</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:border-indigo-500 transition-all text-white outline-none"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-white/60">休暇の種類</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as any }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:border-indigo-500 transition-all text-white outline-none"
                >
                  <option value="paid" className="bg-black">有給休暇 (全休)</option>
                  <option value="special" className="bg-black">特別休暇</option>
                  <option value="unpaid" className="bg-black">欠勤</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-white/60">備考 / 理由</label>
              <textarea
                value={formData.note}
                onChange={(e) => setFormData(prev => ({ ...prev, note: e.target.value }))}
                placeholder="私用、冠婚葬祭など..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:border-indigo-500 transition-all text-white outline-none h-24 resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={!formData.employeeId}
              className="w-full bg-indigo-500 hover:bg-indigo-600 disabled:bg-white/10 disabled:text-white/20 py-4 rounded-2xl font-bold text-lg transition-all shadow-lg shadow-indigo-500/20 active:scale-[0.98]"
            >
              申請を確定する
            </button>
          </form>
        </div>

        {/* Right: Analysis & Summary Card + History */}
        <div className="lg:col-span-5 space-y-6">
          {/* Employee Summary Card */}
          <div className="glass p-6 rounded-3xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-3xl group-hover:bg-indigo-500/10 transition-all"></div>

            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <span className="text-xl">📋</span> 従業員詳細
            </h3>

            {selectedEmployee ? (
              <div className="space-y-4">
                <div className="flex justify-between items-end border-b border-white/5 pb-4">
                  <div>
                    <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold mb-1">Employee</p>
                    <h4 className="text-xl font-bold">{selectedEmployee.name}</h4>
                    <p className="text-indigo-400 text-sm font-medium">{selectedEmployee.client} / №{selectedEmployee.id}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-white/40 font-bold mb-1 uppercase">残高</p>
                    <div className="text-4xl font-black gradient-text">{selectedEmployee.balance}<span className="text-sm ml-1 text-white">日</span></div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                    <p className="text-[9px] text-white/40 font-bold uppercase">付与</p>
                    <p className="text-lg font-bold text-green-400">{selectedEmployee.grantedTotal}</p>
                  </div>
                  <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                    <p className="text-[9px] text-white/40 font-bold uppercase">消化</p>
                    <p className="text-lg font-bold text-pink-400">{selectedEmployee.usedTotal}</p>
                  </div>
                  <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                    <p className="text-[9px] text-white/40 font-bold uppercase">時効</p>
                    <p className="text-lg font-bold text-orange-400">{selectedEmployee.expiredCount}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center space-y-3">
                <div className="text-5xl opacity-10">👤</div>
                <p className="text-white/20 text-sm font-medium italic">
                  従業員を選択してください
                </p>
              </div>
            )}
          </div>

          {/* Leave History Table - 有給取得履歴 */}
          <div className="glass p-6 rounded-3xl">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-bold flex items-center gap-2">
                <span className="text-xl">📅</span> 有給取得履歴
              </h4>
              {selectedEmployee && allLeaveHistory.length > 0 && (
                <span className="text-xs bg-indigo-500/20 text-indigo-400 px-2 py-1 rounded-full font-bold">
                  計 {allLeaveHistory.length} 日
                </span>
              )}
            </div>

            {/* Mostrar 入社日 si existe */}
            {selectedEmployee?.entryDate && (
              <div className="mb-4 px-3 py-2 bg-white/5 rounded-lg text-xs">
                <span className="text-white/40">入社日: </span>
                <span className="text-indigo-400 font-bold">
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
                            <span className="text-xs text-white/40">({yearGroup.dates.length}日消化)</span>
                          </div>
                          <span className="text-[9px] text-white/30">
                            {yearGroup.periodStart} 〜 {yearGroup.periodEnd}
                          </span>
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
                                : 'bg-white/5 text-white/80'
                            }`}
                          >
                            {new Date(date).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}
                          </div>
                        ))}
                        {yearGroup.dates.length > 12 && (
                          <div className="text-[10px] text-white/30 py-1.5 px-2 text-center">
                            +{yearGroup.dates.length - 12}件
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Regla de consumo */}
                  <div className="mt-4 p-3 bg-indigo-500/5 rounded-xl border border-indigo-500/10">
                    <p className="text-[10px] text-white/60 leading-relaxed">
                      <span className="text-indigo-400 font-bold">消化ルール:</span> 新しい付与分から優先消化。
                      付与から2年経過で時効消滅。
                    </p>
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center space-y-2">
                  <div className="text-3xl opacity-20">📭</div>
                  <p className="text-white/30 text-sm">取得履歴なし</p>
                  <p className="text-white/20 text-xs">有給休暇管理.xlsmを同期してください</p>
                </div>
              )
            ) : (
              <div className="py-8 text-center">
                <p className="text-white/20 text-sm italic">従業員選択後に表示</p>
              </div>
            )}
          </div>

          {/* Monthly Stats */}
          <div className="glass p-4 rounded-2xl">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-pink-500/20 rounded-xl flex items-center justify-center text-pink-400 text-xl font-bold">
                {data.records.filter(r => {
                  const d = new Date(r.date);
                  const now = new Date();
                  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                }).length}
              </div>
              <div className="text-xs text-white/40 leading-tight">
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
