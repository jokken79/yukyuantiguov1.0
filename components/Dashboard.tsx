
import React, { useEffect, useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, PieChart, Pie, AreaChart, Area, ScatterChart, Scatter, ZAxis, Legend
} from 'recharts';
import { AppData, AIInsight, Employee } from '../types';
import { analyzeLeaveData } from '../services/geminiService';
import { exportEmployeesToCSV, exportToPDF } from '../services/exportService';
import { useTheme } from '../contexts/ThemeContext';
import { getDisplayName } from '../services/nameConverter';

interface DashboardProps {
  data: AppData;
}

const Dashboard: React.FC<DashboardProps> = ({ data }) => {
  const { isDark } = useTheme();
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [loadingAI, setLoadingAI] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);

  // 1. 月別使用推移データの生成 (⭐ SOLO yukyuDates - BUG #3 resuelto)
  const monthlyTrendData = useMemo(() => {
    const months = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];
    const counts = new Array(12).fill(0);

    // ⭐ NUEVO: Contar SOLO desde yukyuDates (single source of truth)
    // Esto elimina duplicados porque records aprobados ya están en yukyuDates
    data.employees.forEach(emp => {
      if (emp.yukyuDates && emp.yukyuDates.length > 0) {
        emp.yukyuDates.forEach(dateStr => {
          try {
            const m = new Date(dateStr).getMonth();
            if (!isNaN(m)) {
              counts[m]++;
            }
          } catch (e) {
            // Ignorar fechas inválidas
          }
        });
      }
    });

    return months.map((name, i) => ({ name, value: counts[i] }));
  }, [data.employees]); // ⭐ Dependencia cambiada: solo employees

  // 2. 曜日別取得パターンの生成 (⭐ SOLO yukyuDates - BUG #3 resuelto)
  const dayOfWeekData = useMemo(() => {
    const days = ["日", "月", "火", "水", "木", "金", "土"];
    const counts = new Array(7).fill(0);

    // ⭐ NUEVO: Contar SOLO desde yukyuDates (single source of truth)
    data.employees.forEach(emp => {
      if (emp.yukyuDates && emp.yukyuDates.length > 0) {
        emp.yukyuDates.forEach(dateStr => {
          try {
            const d = new Date(dateStr).getDay();
            if (!isNaN(d)) {
              counts[d]++;
            }
          } catch (e) {
            // Ignorar fechas inválidas
          }
        });
      }
    });

    return days.map((name, i) => ({ name, value: counts[i] })).filter((_, i) => i !== 0 && i !== 6); // 平日のみ
  }, [data.employees]); // ⭐ Dependencia cambiada: solo employees

  // Filter active employees for accurate analytics
  const activeEmployees = useMemo(() => {
    return data.employees.filter(e => e.status === '在職中');
  }, [data.employees]);

  // 3. 派遣先別の分布 (在職中のみ)
  const clientData = useMemo(() => {
    const clients: Record<string, number> = {};
    activeEmployees.forEach(e => {
      clients[e.client] = (clients[e.client] || 0) + 1;
    });
    return Object.entries(clients).map(([name, value]) => ({ name, value }));
  }, [activeEmployees]);

  // 4. トップユーザー (在職中のみ)
  const topUsers = useMemo(() => {
    return [...activeEmployees]
      .sort((a, b) => (b.currentUsedTotal ?? b.usedTotal) - (a.currentUsedTotal ?? a.usedTotal))
      .slice(0, 10);
  }, [activeEmployees]);

  // 5. 法的リスクアラート (在職中で10日以上付与かつ5日未満消化)
  const legalAlerts = useMemo(() => {
    return activeEmployees.filter(e =>
      (e.currentGrantedTotal ?? e.grantedTotal) >= 10 &&
      (e.currentUsedTotal ?? e.usedTotal) < 5
    );
  }, [activeEmployees]);

  const COLORS = ['#00e5ff', '#ff004c', '#7000ff', '#eab308', '#22c55e', '#ec4899'];

  useEffect(() => {
    if (data.employees.length > 0) {
      setLoadingAI(true);
      analyzeLeaveData(data)
        .then(res => {
          setInsights(res);
          setLoadingAI(false);
        })
        .catch(error => {
          console.error('AI分析エラー:', error);
          toast.error('AI分析に失敗しました。後でもう一度お試しください。', { duration: 5000 });
          setLoadingAI(false);
          setInsights(null);
        });
    }
  }, [data]);

  // Debug function - exponer datos en consola
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).debugDashboard = () => {
        console.log('=== DASHBOARD DEBUG DATA ===');
        console.log('Total employees:', data.employees.length);
        console.log('Active employees:', activeEmployees.length);
        console.log('Total records:', data.records.length);
        console.log('Monthly trend data:', monthlyTrendData);
        console.log('Day of week data:', dayOfWeekData);
        console.log('Top users:', topUsers);
        console.log('Client data:', clientData);
        console.log('Legal alerts:', legalAlerts.length);
        console.log('Sample employee with yukyuDates:',
          data.employees.find(e => e.yukyuDates && e.yukyuDates.length > 0)
        );
        return {
          employees: data.employees,
          activeEmployees,
          records: data.records,
          monthlyTrendData,
          dayOfWeekData,
          topUsers,
          clientData,
          legalAlerts
        };
      };
      console.log('💡 Debug function available: window.debugDashboard()');
    }
  }, [data, activeEmployees, monthlyTrendData, dayOfWeekData, topUsers, clientData, legalAlerts]);

  const kpis = [
    { label: '有給対象', value: activeEmployees.length, suffix: '名', color: 'blue' },
    { label: '法的リスク', value: legalAlerts.length, suffix: '名', color: 'red' },
    { label: '消化合計', value: activeEmployees.reduce((s, e) => s + (e.currentUsedTotal ?? e.usedTotal), 0), suffix: '日', color: 'white' },
    { label: '遵守率', value: Math.round(((activeEmployees.length - legalAlerts.length) / (activeEmployees.length || 1)) * 100), suffix: '%', color: 'blue' },
  ];

  // Theme-aware colors for charts
  const chartColors = {
    grid: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.05)',
    axis: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.5)',
    tooltipBg: isDark ? '#000' : '#fff',
    tooltipBorder: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
  };

  return (
    <div className={`p-12 space-y-12 animate-fadeIn max-w-[1800px] mx-auto relative pb-32`}>
      <div className={`absolute top-0 right-0 text-[18vw] font-black select-none pointer-events-none italic tracking-tighter ${isDark ? 'text-white/[0.01]' : 'text-slate-900/[0.02]'}`}>分析</div>

      <header className={`flex flex-col md:flex-row justify-between items-end gap-8 relative z-10 border-b pb-12 ${isDark ? 'border-white/5' : 'border-slate-200'}`}>
        <div className="space-y-4">
          <div className="flex items-center gap-6">
            <div className={`h-14 w-2 ${legalAlerts.length > 0 ? 'bg-red-600 shadow-[0_0_20px_#ff004c]' : 'bg-blue-500 shadow-[0_0_20px_#00e5ff]'} animate-pulse`}></div>
            <h2 className={`text-7xl font-black italic tracking-tighter underline decoration-blue-500/30 decoration-8 underline-offset-8 ${isDark ? 'aggressive-text' : 'text-slate-800'}`}>データ分析</h2>
          </div>
          <div className={`flex items-center gap-4 font-black tracking-[0.4em] ml-8 text-sm ${isDark ? 'text-white/70' : 'text-slate-500'}`}>
             <span>詳細分析モード</span>
             <span className="text-blue-500">●</span>
             <span>システム状態: 正常稼働中</span>
          </div>
        </div>

        <div className="flex gap-4">
          <button onClick={() => exportEmployeesToCSV(data.employees)} className={`px-10 py-5 border transition-all text-xs font-black tracking-widest ${isDark ? 'bg-black border-white/20 hover:border-white/40 text-white' : 'bg-white border-slate-200 hover:border-slate-400 text-slate-800'}`}>CSV出力</button>
          <button
            onClick={async () => {
              setExportingPDF(true);
              await exportToPDF('dashboard-full-view', `分析レポート_${Date.now()}.pdf`);
              setExportingPDF(false);
            }}
            className={`px-10 py-5 hover:scale-105 transition-all text-xs font-black tracking-widest ${isDark ? 'bg-white text-black shadow-[0_0_40px_rgba(255,255,255,0.2)]' : 'bg-blue-600 text-white shadow-lg'}`}
          >
            {exportingPDF ? '処理中...' : 'PDF出力'}
          </button>
        </div>
      </header>

      {/* KPI Section */}
      <section aria-labelledby="kpi-section-title" role="region">
        <h3 id="kpi-section-title" className="sr-only">主要指標 (KPI)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {kpis.map((kpi, i) => (
            <div
              key={i}
              role="group"
              aria-label={`${kpi.label}: ${kpi.value}${kpi.suffix}`}
              className={`p-12 border-t-4 transition-all ${
                kpi.color === 'red' && kpi.value > 0
                  ? 'border-red-600 shadow-[0_0_30px_rgba(255,0,76,0.1)]'
                  : isDark ? 'border-white/5' : 'border-slate-200'
              } ${isDark ? 'bg-[#0a0a0a] hover:bg-[#111]' : 'bg-white hover:bg-slate-50 shadow-sm'}`}
            >
              <p className={`text-[10px] font-black mb-8 tracking-[0.3em] uppercase ${isDark ? 'text-white/80' : 'text-slate-500'}`}>{kpi.label}</p>
              <div className="flex items-baseline gap-3">
                <span className={`text-7xl font-black tabular-nums tracking-tighter italic ${
                  kpi.color === 'red' && kpi.value > 0 ? 'text-red-600' : isDark ? 'text-white' : 'text-slate-800'
                }`} aria-hidden="true">{kpi.value}</span>
                <span className={`text-xs font-black uppercase italic ${isDark ? 'text-white/70' : 'text-slate-400'}`} aria-hidden="true">{kpi.suffix}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div id="dashboard-full-view" className="grid grid-cols-1 lg:grid-cols-12 gap-10">

        {/* Row 1 Left: Monthly Trend (Big Area Chart) */}
        <div className={`lg:col-span-8 p-12 border relative group overflow-hidden ${isDark ? 'bg-[#0a0a0a] border-white/5' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className={`absolute top-0 right-0 p-8 font-black text-6xl italic select-none ${isDark ? 'text-white/5' : 'text-slate-100'}`}>推移</div>
          <h3 className={`text-3xl font-black italic tracking-tighter mb-12 flex items-center gap-4 ${isDark ? 'text-white' : 'text-slate-800'}`}>
            <span className="w-8 h-1 bg-blue-500"></span> 使用日数の月別推移
          </h3>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyTrendData}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={isDark ? "#00e5ff" : "#3b82f6"} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={isDark ? "#00e5ff" : "#3b82f6"} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} vertical={false} />
                <XAxis dataKey="name" stroke={chartColors.axis} fontSize={11} axisLine={false} tickLine={false} fontWeight="900" />
                <YAxis stroke={chartColors.axis} fontSize={11} axisLine={false} tickLine={false} fontWeight="900" />
                <Tooltip
                  contentStyle={{ backgroundColor: chartColors.tooltipBg, border: `1px solid ${chartColors.tooltipBorder}`, padding: '20px', borderRadius: '0px' }}
                />
                <Area type="monotone" dataKey="value" stroke={isDark ? "#00e5ff" : "#3b82f6"} strokeWidth={4} fillOpacity={1} fill="url(#colorValue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Row 1 Right: Top 10 Ranking (Horizontal Bars) */}
        <div className={`lg:col-span-4 p-12 border ${isDark ? 'bg-[#0a0a0a] border-white/5' : 'bg-white border-slate-200 shadow-sm'}`}>
          <h3 className={`text-3xl font-black italic tracking-tighter mb-12 ${isDark ? 'text-white' : 'text-slate-800'}`}>TOP 10 使用者</h3>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topUsers} layout="vertical">
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" stroke={chartColors.axis} fontSize={10} axisLine={false} tickLine={false} width={80} fontWeight="900" />
                <Tooltip cursor={{ fill: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }} />
                <Bar dataKey="usedTotal" fill={isDark ? "#7000ff" : "#8b5cf6"} barSize={12} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Row 2 Left: Pie Distribution (Clients) */}
        <div className={`lg:col-span-4 p-12 border ${isDark ? 'bg-[#0a0a0a] border-white/5' : 'bg-white border-slate-200 shadow-sm'}`}>
          <h3 className={`text-3xl font-black italic tracking-tighter mb-12 text-center ${isDark ? 'text-white' : 'text-slate-800'}`}>派遣先別分布</h3>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={clientData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {clientData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend iconType="rect" layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: '10px', fontWeight: '900', paddingTop: '20px', color: isDark ? '#fff' : '#334155' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Row 2 Center: Day of Week Pattern */}
        <div className={`lg:col-span-4 p-12 border ${isDark ? 'bg-[#0a0a0a] border-white/5' : 'bg-white border-slate-200 shadow-sm'}`}>
          <h3 className={`text-3xl font-black italic tracking-tighter mb-12 ${isDark ? 'text-white' : 'text-slate-800'}`}>曜日別取得パターン</h3>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dayOfWeekData}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} vertical={false} />
                <XAxis dataKey="name" stroke={chartColors.axis} fontSize={11} axisLine={false} tickLine={false} fontWeight="900" />
                <Tooltip cursor={{ fill: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }} />
                <Bar dataKey="value" fill="#ff004c">
                  {dayOfWeekData.map((entry, index) => (
                    <Cell key={index} fill={entry.name === '月' || entry.name === '金' ? '#ff004c' : isDark ? '#444' : '#cbd5e1'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Row 2 Right: AI Legal Insights (Compact) */}
        <div className={`lg:col-span-4 border p-12 ${isDark ? 'bg-[#0a0a0a] border-white/5' : 'bg-white border-slate-200 shadow-sm'}`}>
          <h3 className={`text-2xl font-black italic tracking-tighter mb-8 ${isDark ? 'text-white' : 'text-slate-800'}`}>AIコンプライアンス分析</h3>
          <div className="space-y-6">
            {loadingAI ? (
              [1, 2].map(i => <div key={i} className={`h-28 animate-pulse border ${isDark ? 'bg-white/[0.02] border-white/5' : 'bg-slate-100 border-slate-200'}`}></div>)
            ) : insights.map((insight, i) => (
              <div key={i} className={`p-6 border-l-4 ${insight.type === 'warning' ? 'border-red-600 bg-red-600/5' : 'border-blue-500 bg-blue-500/5'}`}>
                <h4 className={`text-[10px] font-black uppercase tracking-[0.2em] mb-2 ${isDark ? 'text-white/70' : 'text-slate-600'}`}>{insight.title}</h4>
                <p className={`text-[11px] leading-relaxed font-bold italic ${isDark ? 'text-white/80' : 'text-slate-500'}`}>{insight.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Legal Risk Alert Panel - Detailed List */}
        {legalAlerts.length > 0 && (
          <div className={`lg:col-span-12 p-8 border-2 border-red-500/30 bg-red-500/5 relative overflow-hidden ${isDark ? '' : 'shadow-lg'}`}>
            <div className="absolute top-0 right-0 w-40 h-40 bg-red-500/10 blur-3xl"></div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center">
                  <span className="text-2xl">⚠️</span>
                </div>
                <div>
                  <h3 className={`text-2xl font-black italic tracking-tighter text-red-500`}>
                    法的リスク対象者一覧
                  </h3>
                  <p className={`text-xs ${isDark ? 'text-white/50' : 'text-slate-500'}`}>
                    労働基準法39条: 10日以上付与された従業員は年5日以上の取得が義務
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-4xl font-black text-red-500">{legalAlerts.length}</div>
                <p className={`text-xs ${isDark ? 'text-white/80' : 'text-slate-500'}`}>名が未達成</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
              {legalAlerts
                .sort((a, b) => (a.currentUsedTotal ?? a.usedTotal) - (b.currentUsedTotal ?? b.usedTotal)) // 消化が少ない順
                .map((emp, i) => {
                  const currentUsed = emp.currentUsedTotal ?? emp.usedTotal;
                  const daysNeeded = 5 - currentUsed;
                  const urgencyClass = currentUsed === 0
                    ? 'border-red-500 bg-red-500/10'
                    : currentUsed <= 2
                      ? 'border-orange-500 bg-orange-500/10'
                      : 'border-yellow-500 bg-yellow-500/10';

                  return (
                    <div
                      key={emp.id}
                      className={`p-4 rounded-xl border-2 ${urgencyClass} transition-all hover:scale-[1.02]`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm font-black truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>
                            {getDisplayName(emp.name)}
                          </p>
                          <p className={`text-[10px] truncate ${isDark ? 'text-white/80' : 'text-slate-500'}`}>
                            {emp.client} / №{emp.id}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className={`text-lg font-black ${
                            currentUsed === 0 ? 'text-red-500' : currentUsed <= 2 ? 'text-orange-500' : 'text-yellow-500'
                          }`}>
                            {currentUsed}<span className="text-xs">日</span>
                          </div>
                          <p className={`text-[9px] ${isDark ? 'text-white/70' : 'text-slate-400'}`}>
                            消化済
                            {emp.historicalUsedTotal !== undefined && emp.historicalUsedTotal !== currentUsed && (
                              <> (全: {emp.historicalUsedTotal}日)</>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className={`mt-2 pt-2 border-t ${isDark ? 'border-white/20' : 'border-slate-200'}`}>
                        <div className="flex items-center justify-between text-[10px]">
                          <span className={isDark ? 'text-white/50' : 'text-slate-500'}>
                            付与: {emp.currentGrantedTotal ?? emp.grantedTotal}日
                            {emp.historicalGrantedTotal !== undefined && emp.historicalGrantedTotal !== (emp.currentGrantedTotal ?? emp.grantedTotal) && (
                              <> (全: {emp.historicalGrantedTotal}日)</>
                            )}
                            {' / '}
                            残高: {emp.currentBalance ?? emp.balance}日
                          </span>
                          <span className={`font-black px-2 py-0.5 rounded ${
                            currentUsed === 0
                              ? 'bg-red-500/20 text-red-400'
                              : currentUsed <= 2
                                ? 'bg-orange-500/20 text-orange-400'
                                : 'bg-yellow-500/20 text-yellow-400'
                          }`}>
                            あと{daysNeeded}日必要
                          </span>
                        </div>
                        {emp.excededDays !== undefined && emp.excededDays > 0 && (
                          <div className="mt-2 px-2 py-1 bg-amber-500/10 border border-amber-500/30 rounded text-amber-500 text-[8px] font-black tracking-wider flex items-center gap-1">
                            <span>⚠️</span>
                            <span>40日超過制限: {emp.excededDays}日失効</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>

            <div className={`mt-4 pt-4 border-t ${isDark ? 'border-white/20' : 'border-slate-200'} flex flex-wrap gap-4 text-[10px]`}>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-red-500"></div>
                <span className={isDark ? 'text-white/50' : 'text-slate-500'}>0日消化（緊急）</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-orange-500"></div>
                <span className={isDark ? 'text-white/50' : 'text-slate-500'}>1-2日消化</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-yellow-500"></div>
                <span className={isDark ? 'text-white/50' : 'text-slate-500'}>3-4日消化</span>
              </div>
            </div>
          </div>
        )}

        {/* Final Row: Scatter Efficiency (付与日数 vs 消化日数) */}
        <div className={`lg:col-span-12 p-12 border ${isDark ? 'bg-[#0a0a0a] border-white/5' : 'bg-white border-slate-200 shadow-sm'}`}>
          <h3 className={`text-3xl font-black italic tracking-tighter mb-12 flex items-center gap-4 ${isDark ? 'text-white' : 'text-slate-800'}`}>
             <span className="w-8 h-1 bg-yellow-500"></span> 取得効率・散布図分析 (付与日数 vs 消化日数)
          </h3>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid stroke={isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"} />
                <XAxis type="number" dataKey="grantedTotal" name="付与日数" unit="日" stroke={chartColors.axis} fontSize={11} fontWeight="900" />
                <YAxis type="number" dataKey="usedTotal" name="消化日数" unit="日" stroke={chartColors.axis} fontSize={11} fontWeight="900" />
                <ZAxis type="number" range={[100, 1000]} />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                <Scatter name="従業員" data={activeEmployees} fill="#eab308">
                  {activeEmployees.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.usedTotal < 5 && entry.grantedTotal >= 10 ? '#ff004c' : '#eab308'} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <p className={`mt-6 text-[10px] font-black uppercase tracking-widest text-center italic ${isDark ? 'text-white/70' : 'text-slate-400'}`}>
            ※ 赤いプロットは法的リスク対象（10日以上付与かつ5日未満消化）を示しています
          </p>
        </div>

      </div>
    </div>
  );
};

export default Dashboard;
