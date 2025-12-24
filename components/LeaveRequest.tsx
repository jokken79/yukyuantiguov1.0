
import React, { useState, useMemo } from 'react';
import { AppData, Employee } from '../types';
import { db } from '../services/db';

interface LeaveRequestProps {
  data: AppData;
  onSuccess: () => void;
}

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

  // Analyze usage over the last 2 years from records
  const analysis = useMemo(() => {
    if (!formData.employeeId) return { twoYearUsage: 0, recentlyUsed: 0 };
    
    const now = new Date();
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(now.getFullYear() - 2);
    
    const last30Days = new Date();
    last30Days.setDate(now.getDate() - 30);

    const employeeRecords = data.records.filter(r => r.employeeId === formData.employeeId && r.type === 'paid');
    
    return {
      twoYearUsage: employeeRecords.filter(r => new Date(r.date) >= twoYearsAgo).length,
      recentlyUsed: employeeRecords.filter(r => new Date(r.date) >= last30Days).length,
    };
  }, [formData.employeeId, data.records]);

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

        {/* Right: Analysis & Summary Card */}
        <div className="lg:col-span-5 space-y-6">
          <div className="glass p-8 rounded-3xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-3xl group-hover:bg-indigo-500/10 transition-all"></div>
            
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
              <span className="text-2xl">📋</span> 従業員詳細
            </h3>

            {selectedEmployee ? (
              <div className="space-y-8">
                <div className="flex justify-between items-end border-b border-white/5 pb-6">
                  <div>
                    <p className="text-xs text-white/40 uppercase tracking-widest font-bold mb-1">Employee Info</p>
                    <h4 className="text-2xl font-bold">{selectedEmployee.name}</h4>
                    <p className="text-indigo-400 font-medium">{selectedEmployee.client} / №{selectedEmployee.id}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-white/40 font-bold mb-1 uppercase">Current Balance</p>
                    <div className="text-5xl font-black gradient-text">{selectedEmployee.balance}<span className="text-lg ml-1 text-white">日</span></div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                    <p className="text-[10px] text-white/40 font-bold uppercase mb-1">Total Granted</p>
                    <p className="text-xl font-bold">{selectedEmployee.grantedTotal}日</p>
                  </div>
                  <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                    <p className="text-[10px] text-white/40 font-bold uppercase mb-1">Total Used</p>
                    <p className="text-xl font-bold text-pink-400">{selectedEmployee.usedTotal}日</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <h5 className="text-sm font-bold text-white/60">直近2年間の有給消化状況</h5>
                  <div className="relative h-4 bg-white/5 rounded-full overflow-hidden">
                    <div 
                      className="absolute left-0 top-0 h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-1000"
                      style={{ width: `${Math.min((analysis.twoYearUsage / 20) * 100, 100)}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-white/40">2年間の消化実績</span>
                    <span className="text-indigo-400">{analysis.twoYearUsage}日</span>
                  </div>
                  
                  <div className="bg-indigo-500/10 p-4 rounded-2xl border border-indigo-500/20">
                    <p className="text-xs text-white/80 leading-relaxed italic">
                      "新しい付与分から順に消化"のルールに基づき、{selectedEmployee.name}さんの最新の有給分から消費されます。時効（{selectedEmployee.expiredCount}日）の発生にご注意ください。
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-20 text-center space-y-4">
                <div className="text-6xl opacity-10">👤</div>
                <p className="text-white/20 font-medium italic">
                  従業員を選択すると<br />詳細データが表示されます
                </p>
              </div>
            )}
          </div>

          <div className="glass p-6 rounded-3xl">
            <h4 className="text-sm font-bold text-white/60 mb-4 flex items-center gap-2">
              <span className="text-indigo-400">●</span> 今月の申請状況 (全体)
            </h4>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-pink-500/20 rounded-xl flex items-center justify-center text-pink-400 text-xl font-bold">
                {data.records.filter(r => {
                  const d = new Date(r.date);
                  const now = new Date();
                  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                }).length}
              </div>
              <div className="text-xs text-white/40 leading-tight">
                全社員の今月の申請件数です。<br />Excel同期後、リアルタイムで反映されます。
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeaveRequest;
