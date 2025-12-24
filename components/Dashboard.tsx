
import React, { useEffect, useState, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Cell, PieChart, Pie, AreaChart, Area, ScatterChart, Scatter, ZAxis, Legend 
} from 'recharts';
import { AppData, AIInsight, Employee } from '../types';
import { analyzeLeaveData } from '../services/geminiService';
import { exportEmployeesToCSV, exportToPDF } from '../services/exportService';

interface DashboardProps {
  data: AppData;
}

const Dashboard: React.FC<DashboardProps> = ({ data }) => {
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [loadingAI, setLoadingAI] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);

  // 1. 月別使用推移データの生成
  const monthlyTrendData = useMemo(() => {
    const months = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];
    const counts = new Array(12).fill(0);
    data.records.forEach(r => {
      if (r.type === 'paid') {
        const m = new Date(r.date).getMonth();
        counts[m]++;
      }
    });
    return months.map((name, i) => ({ name, value: counts[i] }));
  }, [data.records]);

  // 2. 曜日別取得パターンの生成
  const dayOfWeekData = useMemo(() => {
    const days = ["日", "月", "火", "水", "木", "金", "土"];
    const counts = new Array(7).fill(0);
    data.records.forEach(r => {
      if (r.type === 'paid') {
        const d = new Date(r.date).getDay();
        counts[d]++;
      }
    });
    return days.map((name, i) => ({ name, value: counts[i] })).filter((_, i) => i !== 0 && i !== 6); // 平日のみ
  }, [data.records]);

  // 3. 派遣先別の分布
  const clientData = useMemo(() => {
    const clients: Record<string, number> = {};
    data.employees.forEach(e => {
      clients[e.client] = (clients[e.client] || 0) + 1;
    });
    return Object.entries(clients).map(([name, value]) => ({ name, value }));
  }, [data.employees]);

  // 4. トップユーザー
  const topUsers = useMemo(() => {
    return [...data.employees]
      .sort((a, b) => b.usedTotal - a.usedTotal)
      .slice(0, 10);
  }, [data.employees]);

  // 5. 法的リスクアラート
  const legalAlerts = useMemo(() => {
    return data.employees.filter(e => e.status === '在職中' && e.grantedTotal >= 10 && e.usedTotal < 5);
  }, [data.employees]);

  const COLORS = ['#00e5ff', '#ff004c', '#7000ff', '#eab308', '#22c55e', '#ec4899'];

  useEffect(() => {
    if (data.employees.length > 0) {
      setLoadingAI(true);
      analyzeLeaveData(data).then(res => {
        setInsights(res);
        setLoadingAI(false);
      });
    }
  }, [data]);

  const kpis = [
    { label: '有給対象', value: data.employees.length, suffix: '名', color: 'blue' },
    { label: '法的リスク', value: legalAlerts.length, suffix: '名', color: 'red' },
    { label: '消化合計', value: data.employees.reduce((s, e) => s + e.usedTotal, 0), suffix: '日', color: 'white' },
    { label: '遵守率', value: Math.round(((data.employees.length - legalAlerts.length) / (data.employees.length || 1)) * 100), suffix: '%', color: 'blue' },
  ];

  return (
    <div className="p-12 space-y-12 animate-fadeIn max-w-[1800px] mx-auto relative pb-32">
      <div className="absolute top-0 right-0 text-[18vw] font-black text-white/[0.01] select-none pointer-events-none italic tracking-tighter">分析</div>

      <header className="flex flex-col md:flex-row justify-between items-end gap-8 relative z-10 border-b border-white/5 pb-12">
        <div className="space-y-4">
          <div className="flex items-center gap-6">
            <div className={`h-14 w-2 ${legalAlerts.length > 0 ? 'bg-red-600 shadow-[0_0_20px_#ff004c]' : 'bg-blue-500 shadow-[0_0_20px_#00e5ff]'} animate-pulse`}></div>
            <h2 className="text-7xl font-black italic tracking-tighter aggressive-text underline decoration-blue-500/30 decoration-8 underline-offset-8">データ分析</h2>
          </div>
          <div className="flex items-center gap-4 text-white/30 font-black tracking-[0.4em] ml-8 text-sm">
             <span>詳細分析モード</span>
             <span className="text-blue-500">●</span>
             <span>システム状態: 正常稼働中</span>
          </div>
        </div>

        <div className="flex gap-4">
          <button onClick={() => exportEmployeesToCSV(data.employees)} className="px-10 py-5 bg-black border border-white/10 hover:border-white/40 transition-all text-xs font-black tracking-widest text-white">CSV出力</button>
          <button
            onClick={async () => {
              setExportingPDF(true);
              await exportToPDF('dashboard-full-view', `分析レポート_${Date.now()}.pdf`);
              setExportingPDF(false);
            }}
            className="px-10 py-5 bg-white text-black hover:scale-105 transition-all text-xs font-black tracking-widest shadow-[0_0_40px_rgba(255,255,255,0.2)]"
          >
            {exportingPDF ? '処理中...' : 'PDF出力'}
          </button>
        </div>
      </header>

      {/* KPI Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {kpis.map((kpi, i) => (
          <div key={i} className={`bg-[#0a0a0a] p-12 border-t-4 ${kpi.color === 'red' && kpi.value > 0 ? 'border-red-600 shadow-[0_0_30px_rgba(255,0,76,0.1)]' : 'border-white/5'} hover:bg-[#111] transition-all`}>
            <p className="text-[10px] font-black text-white/40 mb-8 tracking-[0.3em] uppercase">{kpi.label}</p>
            <div className="flex items-baseline gap-3">
              <h3 className={`text-7xl font-black tabular-nums tracking-tighter italic ${kpi.color === 'red' && kpi.value > 0 ? 'text-red-600' : 'text-white'}`}>{kpi.value}</h3>
              <span className="text-xs font-black text-white/20 uppercase italic">{kpi.suffix}</span>
            </div>
          </div>
        ))}
      </div>

      <div id="dashboard-full-view" className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        
        {/* Row 1 Left: Monthly Trend (Big Area Chart) */}
        <div className="lg:col-span-8 bg-[#0a0a0a] p-12 border border-white/5 relative group overflow-hidden">
          <div className="absolute top-0 right-0 p-8 text-white/5 font-black text-6xl italic select-none">推移</div>
          <h3 className="text-3xl font-black italic tracking-tighter mb-12 flex items-center gap-4">
            <span className="w-8 h-1 bg-blue-500"></span> 使用日数の月別推移
          </h3>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyTrendData}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00e5ff" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#00e5ff" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" vertical={false} />
                <XAxis dataKey="name" stroke="rgba(255,255,255,0.4)" fontSize={11} axisLine={false} tickLine={false} fontWeight="900" />
                <YAxis stroke="rgba(255,255,255,0.4)" fontSize={11} axisLine={false} tickLine={false} fontWeight="900" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#000', border: '1px solid rgba(255,255,255,0.1)', padding: '20px', borderRadius: '0px' }}
                />
                <Area type="monotone" dataKey="value" stroke="#00e5ff" strokeWidth={4} fillOpacity={1} fill="url(#colorValue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Row 1 Right: Top 10 Ranking (Horizontal Bars) */}
        <div className="lg:col-span-4 bg-[#0a0a0a] p-12 border border-white/5">
          <h3 className="text-3xl font-black italic tracking-tighter mb-12">TOP 10 使用者</h3>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topUsers} layout="vertical">
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" stroke="rgba(255,255,255,0.7)" fontSize={10} axisLine={false} tickLine={false} width={80} fontWeight="900" />
                <Tooltip cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                <Bar dataKey="usedTotal" fill="#7000ff" barSize={12} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Row 2 Left: Pie Distribution (Clients) */}
        <div className="lg:col-span-4 bg-[#0a0a0a] p-12 border border-white/5">
          <h3 className="text-3xl font-black italic tracking-tighter mb-12 text-center">派遣先別分布</h3>
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
                <Legend iconType="rect" layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: '10px', fontWeight: '900', paddingTop: '20px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Row 2 Center: Day of Week Pattern */}
        <div className="lg:col-span-4 bg-[#0a0a0a] p-12 border border-white/5">
          <h3 className="text-3xl font-black italic tracking-tighter mb-12">曜日別取得パターン</h3>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dayOfWeekData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" vertical={false} />
                <XAxis dataKey="name" stroke="rgba(255,255,255,0.4)" fontSize={11} axisLine={false} tickLine={false} fontWeight="900" />
                <Tooltip cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                <Bar dataKey="value" fill="#ff004c">
                  {dayOfWeekData.map((entry, index) => (
                    <Cell key={index} fill={entry.name === '月' || entry.name === '金' ? '#ff004c' : '#444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Row 2 Right: AI Legal Insights (Compact) */}
        <div className="lg:col-span-4 bg-[#0a0a0a] border border-white/5 p-12">
          <h3 className="text-2xl font-black italic tracking-tighter text-white mb-8">AIコンプライアンス分析</h3>
          <div className="space-y-6">
            {loadingAI ? (
              [1, 2].map(i => <div key={i} className="h-28 bg-white/[0.02] animate-pulse border border-white/5"></div>)
            ) : insights.map((insight, i) => (
              <div key={i} className={`p-6 border-l-4 ${insight.type === 'warning' ? 'border-red-600 bg-red-600/5' : 'border-blue-500 bg-blue-500/5'}`}>
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/70 mb-2">{insight.title}</h4>
                <p className="text-[11px] text-white/40 leading-relaxed font-bold italic">{insight.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Final Row: Scatter Efficiency (付与日数 vs 消化日数) */}
        <div className="lg:col-span-12 bg-[#0a0a0a] p-12 border border-white/5">
          <h3 className="text-3xl font-black italic tracking-tighter mb-12 flex items-center gap-4">
             <span className="w-8 h-1 bg-yellow-500"></span> 取得効率・散布図分析 (付与日数 vs 消化日数)
          </h3>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                <XAxis type="number" dataKey="grantedTotal" name="付与日数" unit="日" stroke="rgba(255,255,255,0.4)" fontSize={11} fontWeight="900" />
                <YAxis type="number" dataKey="usedTotal" name="消化日数" unit="日" stroke="rgba(255,255,255,0.4)" fontSize={11} fontWeight="900" />
                <ZAxis type="number" range={[100, 1000]} />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                <Scatter name="従業員" data={data.employees} fill="#eab308">
                  {data.employees.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.usedTotal < 5 && entry.grantedTotal >= 10 ? '#ff004c' : '#eab308'} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-6 text-[10px] font-black text-white/20 uppercase tracking-widest text-center italic">
            ※ 赤いプロットは法的リスク対象（10日以上付与かつ5日未満消化）を示しています
          </p>
        </div>

      </div>
    </div>
  );
};

export default Dashboard;
