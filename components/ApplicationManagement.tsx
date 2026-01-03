
import React, { useState, useMemo, useEffect } from 'react';
import toast from 'react-hot-toast';
import FocusTrap from 'focus-trap-react';
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
  const [showBulkPreview, setShowBulkPreview] = useState(false);

  // Cerrar modal con ESC
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showBulkPreview) {
        setShowBulkPreview(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [showBulkPreview]);

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

      toast.error(message);
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

  // Obtener las aplicaciones pendientes seleccionadas
  const pendingSelectedRecords = useMemo(() => {
    return Array.from(selectedIds)
      .map(id => data.records.find(r => r.id === id))
      .filter(r => r?.status === 'pending') as typeof data.records;
  }, [selectedIds, data.records]);

  const handleBulkApprove = () => {
    if (pendingSelectedRecords.length === 0) {
      toast.error('承認する保留中の申請を選択してください');
      return;
    }
    // Mostrar modal de preview en lugar de confirm()
    setShowBulkPreview(true);
  };

  const confirmBulkApprove = () => {
    const pendingSelected = pendingSelectedRecords.map(r => r.id!);
    const results = db.approveMultiple(pendingSelected);

    // Mostrar resultados separados
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
        message += `... 他${results.failed.length - 5}件\n`;
      }
    }

    // Mostrar toast según resultados
    if (results.failed.length > 0) {
      toast.error(message, { duration: 8000 });
    } else {
      toast.success(message, { duration: 5000 });
    }
    setSelectedIds(new Set());
    setShowBulkPreview(false);
    onUpdate();
  };

  const handleBulkReject = () => {
    const allSelected = Array.from(selectedIds) as string[];
    const pendingSelected = allSelected.filter(id => {
      const record = data.records.find(r => r.id === id);
      return record?.status === 'pending';
    });

    if (pendingSelected.length === 0) {
      toast.error('却下する保留中の申請を選択してください');
      return;
    }

    const reason = prompt(`${pendingSelected.length}件の申請を一括却下します。\n却下理由を入力してください（任意）:`);
    if (reason !== null) {
      const count = db.rejectMultiple(pendingSelected, reason || undefined);
      toast.success(`${count}件の申請を却下しました`);
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
    const headers = ['申請日', '取得日', '社員№', '氏名', '派遣先', '種類', '期間', '状態', '承認日', '備考'];
    const rows = filteredRecords.map(r => {
      const emp = data.employees.find(e => e.id === r.employeeId);
      const typeLabel = r.type === 'paid' ? '有給' : r.type === 'special' ? '特別休暇' : '欠勤';
      const durationLabel = r.type === 'paid' ? ((r.duration || 'full') === 'half' ? '半日' : '全日') : '-';
      return [
        r.createdAt.split('T')[0],
        r.date,
        r.employeeId,
        emp ? getDisplayName(emp.name) : '不明',
        emp?.client || '不明',
        typeLabel,
        durationLabel,
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
            <p className={`font-bold tracking-widest ml-6 md:ml-8 text-[10px] md:text-sm ${isDark ? 'text-white/70' : 'text-slate-500'}`}>
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4" role="group" aria-label="申請状態フィルター">
        <button
          onClick={() => setFilterStatus('pending')}
          aria-label={`保留中の申請を表示 (${stats.pending}件)`}
          aria-pressed={filterStatus === 'pending'}
          className={`p-4 md:p-6 border transition-all ${filterStatus === 'pending' ? 'border-yellow-500 bg-yellow-500/10' : isDark ? 'border-white/20 bg-white/10 hover:border-yellow-500/50' : 'border-slate-200 bg-white hover:border-yellow-500/50 shadow-sm'}`}
        >
          <p className={`text-[9px] md:text-[10px] font-bold uppercase tracking-widest mb-1 md:mb-2 ${isDark ? 'text-white/80' : 'text-slate-500'}`}>保留中</p>
          <p className="text-2xl md:text-4xl font-black text-yellow-500">{stats.pending}</p>
        </button>
        <button
          onClick={() => setFilterStatus('approved')}
          aria-label={`承認済の申請を表示 (${stats.approved}件)`}
          aria-pressed={filterStatus === 'approved'}
          className={`p-4 md:p-6 border transition-all ${filterStatus === 'approved' ? 'border-green-500 bg-green-500/10' : isDark ? 'border-white/20 bg-white/10 hover:border-green-500/50' : 'border-slate-200 bg-white hover:border-green-500/50 shadow-sm'}`}
        >
          <p className={`text-[9px] md:text-[10px] font-bold uppercase tracking-widest mb-1 md:mb-2 ${isDark ? 'text-white/80' : 'text-slate-500'}`}>承認済</p>
          <p className="text-2xl md:text-4xl font-black text-green-500">{stats.approved}</p>
        </button>
        <button
          onClick={() => setFilterStatus('rejected')}
          aria-label={`却下された申請を表示 (${stats.rejected}件)`}
          aria-pressed={filterStatus === 'rejected'}
          className={`p-4 md:p-6 border transition-all ${filterStatus === 'rejected' ? 'border-red-500 bg-red-500/10' : isDark ? 'border-white/20 bg-white/10 hover:border-red-500/50' : 'border-slate-200 bg-white hover:border-red-500/50 shadow-sm'}`}
        >
          <p className={`text-[9px] md:text-[10px] font-bold uppercase tracking-widest mb-1 md:mb-2 ${isDark ? 'text-white/80' : 'text-slate-500'}`}>却下</p>
          <p className="text-2xl md:text-4xl font-black text-red-500">{stats.rejected}</p>
        </button>
        <button
          onClick={() => setFilterStatus('all')}
          aria-label={`すべての申請を表示 (${stats.total}件)`}
          aria-pressed={filterStatus === 'all'}
          className={`p-4 md:p-6 border transition-all ${filterStatus === 'all' ? 'border-blue-500 bg-blue-500/10' : isDark ? 'border-white/20 bg-white/10 hover:border-blue-500/50' : 'border-slate-200 bg-white hover:border-blue-500/50 shadow-sm'}`}
        >
          <p className={`text-[9px] md:text-[10px] font-bold uppercase tracking-widest mb-1 md:mb-2 ${isDark ? 'text-white/80' : 'text-slate-500'}`}>全件</p>
          <p className="text-2xl md:text-4xl font-black text-blue-500">{stats.total}</p>
        </button>
      </div>

      {/* Live region for selection count */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {selectedIds.size > 0 ? `${selectedIds.size}件の申請を選択中` : '選択なし'}
      </div>

      {/* Filters */}
      <fieldset className={`flex flex-wrap gap-3 md:gap-4 p-3 md:p-4 border ${isDark ? 'bg-white/10 border-white/20' : 'bg-white border-slate-200 shadow-sm'}`}>
        <legend className="sr-only">申請フィルター</legend>
        <div className="flex flex-col gap-1 flex-1 min-w-[120px]">
          <label htmlFor="filter-client" className={`text-[8px] md:text-[9px] font-bold uppercase ${isDark ? 'text-white/80' : 'text-slate-500'}`}>派遣先</label>
          <select
            id="filter-client"
            value={filterClient}
            onChange={(e) => setFilterClient(e.target.value)}
            aria-label="派遣先でフィルター"
            className={`border text-xs font-bold p-2 outline-none ${isDark ? 'bg-black border-white/20 text-white' : 'bg-white border-slate-300 text-slate-800'}`}
          >
            <option value="">すべて</option>
            {clients.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="filter-date-from" className={`text-[8px] md:text-[9px] font-bold uppercase ${isDark ? 'text-white/80' : 'text-slate-500'}`}>開始日</label>
          <input
            id="filter-date-from"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            aria-label="開始日でフィルター"
            className={`border text-xs font-bold p-2 outline-none ${isDark ? 'bg-black border-white/20 text-white' : 'bg-white border-slate-300 text-slate-800'}`}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="filter-date-to" className={`text-[8px] md:text-[9px] font-bold uppercase ${isDark ? 'text-white/80' : 'text-slate-500'}`}>終了日</label>
          <input
            id="filter-date-to"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            aria-label="終了日でフィルター"
            className={`border text-xs font-bold p-2 outline-none ${isDark ? 'bg-black border-white/20 text-white' : 'bg-white border-slate-300 text-slate-800'}`}
          />
        </div>
        <div className="flex items-end">
          <button
            onClick={() => { setFilterClient(''); setDateFrom(''); setDateTo(''); setFilterStatus('all'); }}
            aria-label="すべてのフィルターをリセット"
            className={`px-3 md:px-4 py-2 text-xs font-bold transition-all ${isDark ? 'text-white/80 hover:text-white' : 'text-slate-500 hover:text-slate-800'}`}
          >
            リセット
          </button>
        </div>
      </fieldset>

      {/* Vista Mobile - Cards (lg:hidden) */}
      <div className="lg:hidden space-y-3">
        {filteredRecords.length > 0 ? (
          filteredRecords.map(record => {
            const emp = getEmployeeInfo(record.employeeId);
            const isPending = record.status === 'pending';

            return (
              <div
                key={record.id}
                className={`p-4 rounded-lg border ${
                  isDark
                    ? 'bg-white/5 border-white/10'
                    : 'bg-white border-slate-200 shadow-sm'
                }`}
              >
                {/* Header: Status + Date */}
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2">
                    {isPending && stats.pending > 0 && (
                      <input
                        type="checkbox"
                        checked={selectedIds.has(record.id!)}
                        onChange={() => toggleSelect(record.id!)}
                        aria-label={`${emp ? getDisplayName(emp.name) : '不明'}の申請を選択`}
                        className="w-4 h-4"
                      />
                    )}
                    {getStatusBadge(record.status)}
                  </div>
                  <span className={`font-black text-lg ${isDark ? 'text-white' : 'text-slate-800'}`}>
                    {record.date}
                  </span>
                </div>

                {/* Employee Info */}
                <div className="mb-3">
                  <div className={`font-bold text-base ${isDark ? 'text-white' : 'text-slate-800'}`}>
                    {emp ? getDisplayName(emp.name) : '不明'}
                  </div>
                  <div className={`text-xs ${isDark ? 'text-white/60' : 'text-slate-500'}`}>
                    №{record.employeeId} • {emp?.client || '不明'}
                  </div>
                </div>

                {/* Type + Duration + Note */}
                <div className="flex items-center gap-3 mb-3">
                  <span className={`px-2 py-1 rounded text-[10px] font-bold ${
                    record.type === 'paid' ? 'bg-blue-500/20 text-blue-400' :
                    record.type === 'special' ? 'bg-purple-500/20 text-purple-400' :
                    isDark ? 'bg-white/10 text-white/60' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {record.type === 'paid' ? '有給' : record.type === 'special' ? '特別' : '欠勤'}
                    {record.type === 'paid' && (
                      <span className="ml-1 opacity-70">
                        ({(record.duration || 'full') === 'half' ? '半日' : '全日'})
                      </span>
                    )}
                  </span>
                  {record.note && (
                    <span className={`text-xs truncate max-w-[150px] ${isDark ? 'text-white/50' : 'text-slate-400'}`}>
                      {record.note}
                    </span>
                  )}
                </div>

                {/* Actions */}
                {isPending ? (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApprove(record.id!)}
                      className="flex-1 py-2 bg-green-500/20 hover:bg-green-500/40 text-green-500 text-xs font-bold rounded transition-all"
                    >
                      承認
                    </button>
                    <button
                      onClick={() => handleReject(record.id!)}
                      className="flex-1 py-2 bg-red-500/20 hover:bg-red-500/40 text-red-500 text-xs font-bold rounded transition-all"
                    >
                      却下
                    </button>
                  </div>
                ) : (
                  <div className={`text-[10px] text-center py-2 ${isDark ? 'text-white/40' : 'text-slate-400'}`}>
                    {record.approvedAt && `処理日: ${new Date(record.approvedAt).toLocaleDateString('ja-JP')}`}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className={`py-16 text-center border rounded-lg ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
            <div className={`text-4xl mb-4 ${isDark ? 'opacity-20' : 'opacity-30'}`}>📋</div>
            <p className={`font-bold ${isDark ? 'text-white/60' : 'text-slate-400'}`}>該当する申請がありません</p>
          </div>
        )}
      </div>

      {/* Vista Desktop - Table (hidden lg:block) */}
      <div className={`hidden lg:block border overflow-hidden ${isDark ? 'border-white/20' : 'border-slate-200 shadow-sm'}`}>
        {filteredRecords.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]" role="grid" aria-label="申請一覧テーブル">
              <thead className={isDark ? 'bg-white/10' : 'bg-slate-50'}>
                <tr role="row" className={`text-[9px] md:text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-white/80' : 'text-slate-500'}`}>
                  {stats.pending > 0 && filterStatus !== 'approved' && filterStatus !== 'rejected' && (
                    <th role="columnheader" scope="col" className="p-3 md:p-4 text-left w-10">
                      <input
                        type="checkbox"
                        checked={selectedIds.size === pendingRecords.length && pendingRecords.length > 0}
                        onChange={handleSelectAll}
                        aria-label={selectedIds.size === pendingRecords.length ? 'すべての保留中申請の選択を解除' : 'すべての保留中申請を選択'}
                        className="w-4 h-4"
                      />
                    </th>
                  )}
                  <th role="columnheader" scope="col" className="p-3 md:p-4 text-left">状態</th>
                  <th role="columnheader" scope="col" className="p-3 md:p-4 text-left">取得日</th>
                  <th role="columnheader" scope="col" className="p-3 md:p-4 text-left">社員</th>
                  <th role="columnheader" scope="col" className="p-3 md:p-4 text-left hidden md:table-cell">派遣先</th>
                  <th role="columnheader" scope="col" className="p-3 md:p-4 text-left">種類</th>
                  <th role="columnheader" scope="col" className="p-3 md:p-4 text-left hidden lg:table-cell">申請日</th>
                  <th role="columnheader" scope="col" className="p-3 md:p-4 text-left hidden lg:table-cell">備考</th>
                  <th role="columnheader" scope="col" className="p-3 md:p-4 text-center">操作</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-white/5' : 'divide-slate-100'}`}>
                {filteredRecords.map(record => {
                  const emp = getEmployeeInfo(record.employeeId);
                  const isPending = record.status === 'pending';

                  return (
                    <tr key={record.id} role="row" className={`transition-all ${isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-50'}`}>
                      {stats.pending > 0 && filterStatus !== 'approved' && filterStatus !== 'rejected' && (
                        <td role="gridcell" className="p-3 md:p-4">
                          {isPending && (
                            <input
                              type="checkbox"
                              checked={selectedIds.has(record.id!)}
                              onChange={() => toggleSelect(record.id!)}
                              aria-label={`${emp ? getDisplayName(emp.name) : '不明'}の${record.date}の申請を選択`}
                              className="w-4 h-4"
                            />
                          )}
                        </td>
                      )}
                      <td role="gridcell" className="p-3 md:p-4">{getStatusBadge(record.status)}</td>
                      <td role="gridcell" className={`p-3 md:p-4 font-bold text-sm md:text-lg ${isDark ? 'text-white' : 'text-slate-800'}`}>{record.date}</td>
                      <td role="gridcell" className="p-3 md:p-4">
                        <div className={`font-bold text-sm ${isDark ? 'text-white' : 'text-slate-800'}`}>{emp ? getDisplayName(emp.name) : '不明'}</div>
                        <div className={`text-[10px] md:text-xs ${isDark ? 'text-white/80' : 'text-slate-500'}`}>№{record.employeeId}</div>
                        <div className={`text-[10px] md:hidden ${isDark ? 'text-white/70' : 'text-slate-400'}`}>{emp?.client || ''}</div>
                      </td>
                      <td role="gridcell" className={`p-3 md:p-4 text-xs md:text-sm hidden md:table-cell ${isDark ? 'text-white/60' : 'text-slate-600'}`}>{emp?.client || '不明'}</td>
                      <td role="gridcell" className="p-3 md:p-4">
                        <span className={`text-[10px] md:text-xs font-bold ${record.type === 'paid' ? 'text-blue-500' : record.type === 'special' ? 'text-purple-500' : 'text-gray-400'}`}>
                          {record.type === 'paid' ? '有給' : record.type === 'special' ? '特別' : '欠勤'}
                          {record.type === 'paid' && (
                            <span className="ml-1 opacity-60">
                              ({(record.duration || 'full') === 'half' ? '半日' : '全日'})
                            </span>
                          )}
                        </span>
                      </td>
                      <td role="gridcell" className={`p-3 md:p-4 text-xs hidden lg:table-cell ${isDark ? 'text-white/80' : 'text-slate-500'}`}>
                        {new Date(record.createdAt).toLocaleDateString('ja-JP')}
                      </td>
                      <td role="gridcell" className={`p-3 md:p-4 text-xs max-w-[150px] truncate hidden lg:table-cell ${isDark ? 'text-white/80' : 'text-slate-500'}`}>
                        {record.note || '-'}
                      </td>
                      <td role="gridcell" className="p-3 md:p-4">
                        {isPending ? (
                          <div className="flex gap-1 md:gap-2 justify-center" role="group" aria-label="申請操作">
                            <button
                              onClick={() => handleApprove(record.id!)}
                              aria-label={`${emp ? getDisplayName(emp.name) : '不明'}の${record.date}の申請を承認`}
                              className="px-2 md:px-3 py-1 bg-green-500/20 hover:bg-green-500/40 text-green-500 text-[10px] md:text-xs font-bold rounded transition-all"
                            >
                              承認
                            </button>
                            <button
                              onClick={() => handleReject(record.id!)}
                              aria-label={`${emp ? getDisplayName(emp.name) : '不明'}の${record.date}の申請を却下`}
                              className="px-2 md:px-3 py-1 bg-red-500/20 hover:bg-red-500/40 text-red-500 text-[10px] md:text-xs font-bold rounded transition-all"
                            >
                              却下
                            </button>
                          </div>
                        ) : (
                          <div className={`text-[10px] md:text-xs text-center ${isDark ? 'text-white/70' : 'text-slate-400'}`}>
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
            <p className={`font-bold ${isDark ? 'text-white/70' : 'text-slate-400'}`}>該当する申請がありません</p>
          </div>
        )}
      </div>

      {/* Footer info */}
      <div className={`text-xs text-center ${isDark ? 'text-white/70' : 'text-slate-400'}`}>
        表示件数: {filteredRecords.length} / 全{data.records.length}件
      </div>

      {/* Bulk Approval Preview Modal */}
      {showBulkPreview && (
        <FocusTrap>
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowBulkPreview(false)}
            role="presentation"
          >
            <div
              className={`max-w-2xl w-full max-h-[80vh] flex flex-col rounded-lg border ${
                isDark ? 'bg-slate-900 border-white/20' : 'bg-white border-slate-200 shadow-xl'
              }`}
              onClick={e => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="bulk-preview-title"
              aria-describedby="bulk-preview-description"
            >
            <p id="bulk-preview-description" className="sr-only">
              選択した申請の一括承認を確認するダイアログです。ESCキーで閉じることができます。
            </p>
            {/* Header */}
            <div className={`p-4 md:p-6 border-b ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
              <div className="flex items-center justify-between">
                <h3 id="bulk-preview-title" className={`text-lg md:text-xl font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>
                  一括承認の確認
                </h3>
                <button
                  onClick={() => setShowBulkPreview(false)}
                  className={`p-2 rounded-lg transition-all ${isDark ? 'hover:bg-white/10 text-white/60' : 'hover:bg-slate-100 text-slate-400'}`}
                  aria-label="閉じる"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className={`mt-2 text-sm ${isDark ? 'text-white/60' : 'text-slate-500'}`}>
                以下の <span className="font-bold text-green-500">{pendingSelectedRecords.length}件</span> の申請を承認しますか？
              </p>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-2">
              {pendingSelectedRecords.map(record => {
                const emp = data.employees.find(e => e.id === record.employeeId);
                return (
                  <div
                    key={record.id}
                    className={`p-3 md:p-4 rounded-lg flex flex-col md:flex-row md:justify-between md:items-center gap-2 ${
                      isDark ? 'bg-white/5' : 'bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${
                        record.type === 'paid' ? 'bg-blue-500' :
                        record.type === 'special' ? 'bg-purple-500' :
                        'bg-gray-500'
                      }`} />
                      <div>
                        <span className={`font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                          {emp ? getDisplayName(emp.name) : '不明'}
                        </span>
                        <span className={`text-xs ml-2 ${isDark ? 'text-white/50' : 'text-slate-400'}`}>
                          №{record.employeeId}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 ml-5 md:ml-0">
                      <span className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-700'}`}>
                        {record.date}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                        record.type === 'paid' ? 'bg-blue-500/20 text-blue-500' :
                        record.type === 'special' ? 'bg-purple-500/20 text-purple-500' :
                        isDark ? 'bg-white/10 text-white/60' : 'bg-slate-200 text-slate-500'
                      }`}>
                        {record.type === 'paid' ? '有給' : record.type === 'special' ? '特別' : '欠勤'}
                        {record.type === 'paid' && (
                          <span className="ml-1 opacity-70">
                            ({(record.duration || 'full') === 'half' ? '半日' : '全日'})
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer Actions */}
            <div className={`p-4 md:p-6 border-t flex gap-3 ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
              <button
                onClick={() => setShowBulkPreview(false)}
                className={`flex-1 py-3 rounded-lg font-bold text-sm transition-all ${
                  isDark
                    ? 'border border-white/20 text-white hover:bg-white/10'
                    : 'border border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
              >
                キャンセル
              </button>
              <button
                onClick={confirmBulkApprove}
                className="flex-1 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-bold text-sm transition-all"
              >
                承認する ({pendingSelectedRecords.length}件)
              </button>
            </div>
          </div>
          </div>
        </FocusTrap>
      )}
    </div>
  );
};

export default ApplicationManagement;
