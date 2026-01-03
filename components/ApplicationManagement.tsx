
import React, { useState, useMemo } from 'react';
import { AppData, LeaveRecord } from '../types';
import { db } from '../services/db';
import { useTheme } from '../contexts/ThemeContext';
import { getDisplayName } from '../services/nameConverter';

interface ApplicationManagementProps {
  data: AppData;
  onUpdate: () => void;
}

const ApplicationManagement: React.FC<ApplicationManagementProps> = ({ data, onUpdate }) => {
  const { isDark } = useTheme();
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [filterClient, setFilterClient] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Get unique clients
  const clients = useMemo(() => {
    const unique = new Set(data.employees.map(e => e.client));
    return Array.from(unique).filter(Boolean).sort();
  }, [data.employees]);

  // Filter records
  const filteredRecords = useMemo(() => {
    return data.records
      .filter(r => {
        if (filterStatus !== 'all' && r.status !== filterStatus) return false;
        if (dateFrom && r.date < dateFrom) return false;
        if (dateTo && r.date > dateTo) return false;
        if (filterClient) {
          const emp = data.employees.find(e => e.id === r.employeeId);
          if (!emp || emp.client !== filterClient) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [data.records, data.employees, filterStatus, filterClient, dateFrom, dateTo]);

  // Stats
  const stats = useMemo(() => ({
    pending: data.records.filter(r => r.status === 'pending').length,
    approved: data.records.filter(r => r.status === 'approved').length,
    rejected: data.records.filter(r => r.status === 'rejected').length,
    total: data.records.length
  }), [data.records]);

  const pendingRecords = filteredRecords.filter(r => r.status === 'pending');

  const handleApprove = (recordId: string) => {
    const result = db.approveRecord(recordId);

    if (!result.success) {
      // ⭐ NUEVO: Mostrar error específico
      const errorMessages: Record<string, string> = {
        'INSUFFICIENT_BALANCE': '❌ 残高不足：この社員は有給日数がありません。',
        'DUPLICATE_DATE': '⚠️ 重複：この日付は既に取得済みです。',
        'EMPLOYEE_RETIRED': '❌ エラー：退社した社員の申請は承認できません。',
        'EMPLOYEE_NOT_FOUND': '❌ エラー：社員が見つかりません。'
      };

      const message = result.code && errorMessages[result.code]
        ? errorMessages[result.code]
        : result.error || 'エラーが発生しました。';

      alert(message);
      return;
    }

    // Éxito
    onUpdate();
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(recordId);
      return next;
    });
  };

  const handleReject = (recordId: string) => {
    const reason = prompt('却下理由を入力してください（任意）:');
    if (db.rejectRecord(recordId, reason || undefined)) {
      onUpdate();
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(recordId);
        return next;
      });
    }
  };

  const handleBulkApprove = () => {
    const allSelected = Array.from(selectedIds) as string[];
    const pendingSelected = allSelected.filter(id => {
      const record = data.records.find(r => r.id === id);
      return record?.status === 'pending';
    });

    if (pendingSelected.length === 0) {
      alert('承認する保留中の申請を選択してください');
      return;
    }

    if (confirm(`${pendingSelected.length}件の申請を一括承認しますか？`)) {
      const results = db.approveMultiple(pendingSelected);

      // ⭐ NUEVO: Mostrar resultados separados
      let message = `✅ 承認完了：${results.succeeded.length}件\n`;

      if (results.failed.length > 0) {
        message += `\n❌ 失敗：${results.failed.length}件\n`;
        message += '\n失敗理由：\n';
        results.failed.forEach((f, i) => {
          if (i < 5) { // Mostrar máximo 5 errores
            const reason = f.code === 'INSUFFICIENT_BALANCE' ? '残高不足' :
                          f.code === 'DUPLICATE_DATE' ? '重複' :
                          f.code === 'EMPLOYEE_RETIRED' ? '退社' :
                          f.reason;
            message += `- ${reason}\n`;
          }
        });

        if (results.failed.length > 5) {
          message += `... y ${results.failed.length - 5} más\n`;
        }
      }

      alert(message);
      setSelectedIds(new Set());
      onUpdate();
    }
  };

  const handleBulkReject = () => {
    const allSelected = Array.from(selectedIds) as string[];
    const pendingSelected = allSelected.filter(id => {
      const record = data.records.find(r => r.id === id);
      return record?.status === 'pending';
    });

    if (pendingSelected.length === 0) {
      alert('却下する保留中の申請を選択してください');
      return;
    }

    const reason = prompt(`${pendingSelected.length}件の申請を一括却下します。\n却下理由を入力してください（任意）:`);
    if (reason !== null) {
      const count = db.rejectMultiple(pendingSelected, reason || undefined);
      alert(`${count}件の申請を却下しました`);
      setSelectedIds(new Set());
      onUpdate();
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.size === pendingRecords.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingRecords.map(r => r.id!)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const exportToCSV = () => {
    const headers = ['申請日', '取得日', '社員№', '氏名', '派遣先', '種類', '状態', '承認日', '備考'];
    const rows = filteredRecords.map(r => {
      const emp = data.employees.find(e => e.id === r.employeeId);
      return [
        r.createdAt.split('T')[0],
        r.date,
        r.employeeId,
        emp ? getDisplayName(emp.name) : '不明',
        emp?.client || '不明',
        r.type === 'paid' ? '有給' : r.type === 'special' ? '特別休暇' : '欠勤',
        r.status === 'pending' ? '保留中' : r.status === 'approved' ? '承認済' : '却下',
        r.approvedAt?.split('T')[0] || '',
        r.note || ''
      ].join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `申請一覧_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getEmployeeInfo = (employeeId: string) => {
    return data.employees.find(e => e.id === employeeId);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="px-2 py-1 bg-yellow-500/20 text-yellow-500 text-[9px] md:text-[10px] font-bold rounded">保留中</span>;
      case 'approved':
        return <span className="px-2 py-1 bg-green-500/20 text-green-500 text-[9px] md:text-[10px] font-bold rounded">承認済</span>;
      case 'rejected':
        return <span className="px-2 py-1 bg-red-500/20 text-red-500 text-[9px] md:text-[10px] font-bold rounded">却下</span>;
      default:
        return null;
    }
  };

  return (
    <div className="p-4 md:p-8 lg:p-12 space-y-4 md:space-y-6 lg:space-y-8 animate-fadeIn max-w-[1600px] mx-auto">
      {/* Header */}
      <header className={`flex flex-col gap-4 md:gap-6 border-b pb-4 md:pb-6 lg:pb-8 ${isDark ? 'border-white/5' : 'border-slate-200'}`}>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 md:gap-8">
          <div className="space-y-2 md:space-y-4">
            <div className="flex items-center gap-4 md:gap-6">
              <div className={`h-10 md:h-14 w-2 ${stats.pending > 0 ? 'bg-yellow-500 shadow-[0_0_20px_#eab308]' : 'bg-green-500 shadow-[0_0_20px_#22c55e]'} animate-pulse`}></div>
              <h2 className={`text-3xl md:text-5xl lg:text-6xl font-black italic tracking-tighter ${isDark ? 'text-white' : 'text-slate-800'}`}>申請管理</h2>
            </div>
            <p className={`font-bold tracking-widest ml-6 md:ml-8 text-[10px] md:text-sm ${isDark ? 'text-white/30' : 'text-slate-500'}`}>
              申請管理システム
            </p>
          </div>

          <div className="flex flex-wrap gap-2 md:gap-3 w-full md:w-auto">
            {stats.pending > 0 && selectedIds.size > 0 && (
              <>
                <button
                  onClick={handleBulkApprove}
                  className="flex-1 md:flex-none px-4 md:px-6 py-2 md:py-3 bg-green-500 hover:bg-green-600 text-black font-bold text-xs md:text-sm transition-all"
                >
                  一括承認 ({selectedIds.size})
                </button>
                <button
                  onClick={handleBulkReject}
                  className="flex-1 md:flex-none px-4 md:px-6 py-2 md:py-3 bg-red-500 hover:bg-red-600 text-white font-bold text-xs md:text-sm transition-all"
                >
                  一括却下 ({selectedIds.size})
                </button>
              </>
            )}
            <button
              onClick={exportToCSV}
              className={`flex-1 md:flex-none px-4 md:px-6 py-2 md:py-3 font-bold text-xs md:text-sm transition-all ${isDark ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-800'}`}
            >
              CSV出力
            </button>
          </div>
        </div>
      </header>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4">
        <button
          onClick={() => setFilterStatus('pending')}
          className={`p-4 md:p-6 border transition-all ${filterStatus === 'pending' ? 'border-yellow-500 bg-yellow-500/10' : isDark ? 'border-white/10 bg-white/5 hover:border-yellow-500/50' : 'border-slate-200 bg-white hover:border-yellow-500/50 shadow-sm'}`}
        >
          <p className={`text-[9px] md:text-[10px] font-bold uppercase tracking-widest mb-1 md:mb-2 ${isDark ? 'text-white/40' : 'text-slate-500'}`}>保留中</p>
          <p className="text-2xl md:text-4xl font-black text-yellow-500">{stats.pending}</p>
        </button>
        <button
          onClick={() => setFilterStatus('approved')}
          className={`p-4 md:p-6 border transition-all ${filterStatus === 'approved' ? 'border-green-500 bg-green-500/10' : isDark ? 'border-white/10 bg-white/5 hover:border-green-500/50' : 'border-slate-200 bg-white hover:border-green-500/50 shadow-sm'}`}
        >
          <p className={`text-[9px] md:text-[10px] font-bold uppercase tracking-widest mb-1 md:mb-2 ${isDark ? 'text-white/40' : 'text-slate-500'}`}>承認済</p>
          <p className="text-2xl md:text-4xl font-black text-green-500">{stats.approved}</p>
        </button>
        <button
          onClick={() => setFilterStatus('rejected')}
          className={`p-4 md:p-6 border transition-all ${filterStatus === 'rejected' ? 'border-red-500 bg-red-500/10' : isDark ? 'border-white/10 bg-white/5 hover:border-red-500/50' : 'border-slate-200 bg-white hover:border-red-500/50 shadow-sm'}`}
        >
          <p className={`text-[9px] md:text-[10px] font-bold uppercase tracking-widest mb-1 md:mb-2 ${isDark ? 'text-white/40' : 'text-slate-500'}`}>却下</p>
          <p className="text-2xl md:text-4xl font-black text-red-500">{stats.rejected}</p>
        </button>
        <button
          onClick={() => setFilterStatus('all')}
          className={`p-4 md:p-6 border transition-all ${filterStatus === 'all' ? 'border-blue-500 bg-blue-500/10' : isDark ? 'border-white/10 bg-white/5 hover:border-blue-500/50' : 'border-slate-200 bg-white hover:border-blue-500/50 shadow-sm'}`}
        >
          <p className={`text-[9px] md:text-[10px] font-bold uppercase tracking-widest mb-1 md:mb-2 ${isDark ? 'text-white/40' : 'text-slate-500'}`}>全件</p>
          <p className="text-2xl md:text-4xl font-black text-blue-500">{stats.total}</p>
        </button>
      </div>

      {/* Filters */}
      <div className={`flex flex-wrap gap-3 md:gap-4 p-3 md:p-4 border ${isDark ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}>
        <div className="flex flex-col gap-1 flex-1 min-w-[120px]">
          <label className={`text-[8px] md:text-[9px] font-bold uppercase ${isDark ? 'text-white/40' : 'text-slate-500'}`}>派遣先</label>
          <select
            value={filterClient}
            onChange={(e) => setFilterClient(e.target.value)}
            className={`border text-xs font-bold p-2 outline-none ${isDark ? 'bg-black border-white/20 text-white' : 'bg-white border-slate-300 text-slate-800'}`}
          >
            <option value="">すべて</option>
            {clients.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className={`text-[8px] md:text-[9px] font-bold uppercase ${isDark ? 'text-white/40' : 'text-slate-500'}`}>開始日</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className={`border text-xs font-bold p-2 outline-none ${isDark ? 'bg-black border-white/20 text-white' : 'bg-white border-slate-300 text-slate-800'}`}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className={`text-[8px] md:text-[9px] font-bold uppercase ${isDark ? 'text-white/40' : 'text-slate-500'}`}>終了日</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className={`border text-xs font-bold p-2 outline-none ${isDark ? 'bg-black border-white/20 text-white' : 'bg-white border-slate-300 text-slate-800'}`}
          />
        </div>
        <div className="flex items-end">
          <button
            onClick={() => { setFilterClient(''); setDateFrom(''); setDateTo(''); setFilterStatus('all'); }}
            className={`px-3 md:px-4 py-2 text-xs font-bold transition-all ${isDark ? 'text-white/40 hover:text-white' : 'text-slate-500 hover:text-slate-800'}`}
          >
            リセット
          </button>
        </div>
      </div>

      {/* Table */}
      <div className={`border overflow-hidden ${isDark ? 'border-white/10' : 'border-slate-200 shadow-sm'}`}>
        {filteredRecords.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead className={isDark ? 'bg-white/5' : 'bg-slate-50'}>
                <tr className={`text-[9px] md:text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-white/40' : 'text-slate-500'}`}>
                  {stats.pending > 0 && filterStatus !== 'approved' && filterStatus !== 'rejected' && (
                    <th className="p-3 md:p-4 text-left w-10">
                      <input
                        type="checkbox"
                        checked={selectedIds.size === pendingRecords.length && pendingRecords.length > 0}
                        onChange={handleSelectAll}
                        className="w-4 h-4"
                      />
                    </th>
                  )}
                  <th className="p-3 md:p-4 text-left">状態</th>
                  <th className="p-3 md:p-4 text-left">取得日</th>
                  <th className="p-3 md:p-4 text-left">社員</th>
                  <th className="p-3 md:p-4 text-left hidden md:table-cell">派遣先</th>
                  <th className="p-3 md:p-4 text-left">種類</th>
                  <th className="p-3 md:p-4 text-left hidden lg:table-cell">申請日</th>
                  <th className="p-3 md:p-4 text-left hidden lg:table-cell">備考</th>
                  <th className="p-3 md:p-4 text-center">操作</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-white/5' : 'divide-slate-100'}`}>
                {filteredRecords.map(record => {
                  const emp = getEmployeeInfo(record.employeeId);
                  const isPending = record.status === 'pending';

                  return (
                    <tr key={record.id} className={`transition-all ${isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-50'}`}>
                      {stats.pending > 0 && filterStatus !== 'approved' && filterStatus !== 'rejected' && (
                        <td className="p-3 md:p-4">
                          {isPending && (
                            <input
                              type="checkbox"
                              checked={selectedIds.has(record.id!)}
                              onChange={() => toggleSelect(record.id!)}
                              className="w-4 h-4"
                            />
                          )}
                        </td>
                      )}
                      <td className="p-3 md:p-4">{getStatusBadge(record.status)}</td>
                      <td className={`p-3 md:p-4 font-bold text-sm md:text-lg ${isDark ? 'text-white' : 'text-slate-800'}`}>{record.date}</td>
                      <td className="p-3 md:p-4">
                        <div className={`font-bold text-sm ${isDark ? 'text-white' : 'text-slate-800'}`}>{emp ? getDisplayName(emp.name) : '不明'}</div>
                        <div className={`text-[10px] md:text-xs ${isDark ? 'text-white/40' : 'text-slate-500'}`}>№{record.employeeId}</div>
                        <div className={`text-[10px] md:hidden ${isDark ? 'text-white/30' : 'text-slate-400'}`}>{emp?.client || ''}</div>
                      </td>
                      <td className={`p-3 md:p-4 text-xs md:text-sm hidden md:table-cell ${isDark ? 'text-white/60' : 'text-slate-600'}`}>{emp?.client || '不明'}</td>
                      <td className="p-3 md:p-4">
                        <span className={`text-[10px] md:text-xs font-bold ${record.type === 'paid' ? 'text-blue-500' : record.type === 'special' ? 'text-purple-500' : 'text-gray-400'}`}>
                          {record.type === 'paid' ? '有給' : record.type === 'special' ? '特別' : '欠勤'}
                        </span>
                      </td>
                      <td className={`p-3 md:p-4 text-xs hidden lg:table-cell ${isDark ? 'text-white/40' : 'text-slate-500'}`}>
                        {new Date(record.createdAt).toLocaleDateString('ja-JP')}
                      </td>
                      <td className={`p-3 md:p-4 text-xs max-w-[150px] truncate hidden lg:table-cell ${isDark ? 'text-white/40' : 'text-slate-500'}`}>
                        {record.note || '-'}
                      </td>
                      <td className="p-3 md:p-4">
                        {isPending ? (
                          <div className="flex gap-1 md:gap-2 justify-center">
                            <button
                              onClick={() => handleApprove(record.id!)}
                              className="px-2 md:px-3 py-1 bg-green-500/20 hover:bg-green-500/40 text-green-500 text-[10px] md:text-xs font-bold rounded transition-all"
                            >
                              承認
                            </button>
                            <button
                              onClick={() => handleReject(record.id!)}
                              className="px-2 md:px-3 py-1 bg-red-500/20 hover:bg-red-500/40 text-red-500 text-[10px] md:text-xs font-bold rounded transition-all"
                            >
                              却下
                            </button>
                          </div>
                        ) : (
                          <div className={`text-[10px] md:text-xs text-center ${isDark ? 'text-white/30' : 'text-slate-400'}`}>
                            {record.approvedAt && (
                              <span>{new Date(record.approvedAt).toLocaleDateString('ja-JP')}</span>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={`p-12 md:p-20 text-center ${isDark ? 'bg-black' : 'bg-white'}`}>
            <div className={`text-4xl md:text-6xl mb-4 ${isDark ? 'opacity-10' : 'opacity-20'}`}>📋</div>
            <p className={`font-bold ${isDark ? 'text-white/30' : 'text-slate-400'}`}>該当する申請がありません</p>
          </div>
        )}
      </div>

      {/* Footer info */}
      <div className={`text-xs text-center ${isDark ? 'text-white/20' : 'text-slate-400'}`}>
        表示件数: {filteredRecords.length} / 全{data.records.length}件
      </div>
    </div>
  );
};

export default ApplicationManagement;
