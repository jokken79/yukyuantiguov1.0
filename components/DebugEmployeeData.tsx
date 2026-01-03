import React from 'react';
import { Employee } from '../types';
import { useTheme } from '../contexts/ThemeContext';

interface DebugEmployeeDataProps {
  emp: Employee;
}

/**
 * Componente de debugging para diagnosticar discrepancias de datos
 * ⚠️ SOLO PARA DESARROLLO - Remover en producción
 */
const DebugEmployeeData: React.FC<DebugEmployeeDataProps> = ({ emp }) => {
  const { isDark } = useTheme();

  return (
    <div className={`p-4 border-2 border-amber-500 rounded text-[10px] ${isDark ? 'bg-amber-500/5' : 'bg-amber-50'}`}>
      <h4 className="font-black mb-3 text-amber-500 flex items-center gap-2">
        <span>🐛</span>
        <span>DEBUG: {emp.name} (#{emp.id})</span>
      </h4>

      <div className="grid grid-cols-3 gap-3">
        {/* periodHistory */}
        <div className={`p-2 border ${isDark ? 'bg-black/30 border-white/10' : 'bg-white border-slate-200'}`}>
          <div className={`font-black mb-1 ${isDark ? 'text-white/50' : 'text-slate-500'}`}>periodHistory</div>
          <div className={`font-mono ${isDark ? 'text-white' : 'text-slate-800'}`}>
            {emp.periodHistory ? `${emp.periodHistory.length} periods` : '❌ undefined'}
          </div>
        </div>

        {/* entryDate */}
        <div className={`p-2 border ${isDark ? 'bg-black/30 border-white/10' : 'bg-white border-slate-200'}`}>
          <div className={`font-black mb-1 ${isDark ? 'text-white/50' : 'text-slate-500'}`}>entryDate</div>
          <div className={`font-mono ${isDark ? 'text-white' : 'text-slate-800'}`}>
            {emp.entryDate || '❌ undefined'}
          </div>
        </div>

        {/* yukyuDates */}
        <div className={`p-2 border ${isDark ? 'bg-black/30 border-white/10' : 'bg-white border-slate-200'}`}>
          <div className={`font-black mb-1 ${isDark ? 'text-white/50' : 'text-slate-500'}`}>yukyuDates</div>
          <div className={`font-mono ${isDark ? 'text-white' : 'text-slate-800'}`}>
            {emp.yukyuDates ? `${emp.yukyuDates.length} dates` : '❌ undefined'}
          </div>
        </div>

        {/* currentGrantedTotal */}
        <div className={`p-2 border ${emp.currentGrantedTotal === undefined ? 'border-red-500' : isDark ? 'border-white/10' : 'border-slate-200'} ${isDark ? 'bg-black/30' : 'bg-white'}`}>
          <div className={`font-black mb-1 ${isDark ? 'text-white/50' : 'text-slate-500'}`}>currentGrantedTotal</div>
          <div className={`font-mono font-black ${emp.currentGrantedTotal === undefined ? 'text-red-500' : isDark ? 'text-blue-400' : 'text-blue-600'}`}>
            {emp.currentGrantedTotal !== undefined ? `${emp.currentGrantedTotal}日` : '❌ undefined'}
          </div>
        </div>

        {/* grantedTotal (legacy) */}
        <div className={`p-2 border ${isDark ? 'bg-black/30 border-white/10' : 'bg-white border-slate-200'}`}>
          <div className={`font-black mb-1 ${isDark ? 'text-white/50' : 'text-slate-500'}`}>grantedTotal (legacy)</div>
          <div className={`font-mono ${isDark ? 'text-white/30' : 'text-slate-400'}`}>
            {emp.grantedTotal}日
          </div>
        </div>

        {/* historicalGrantedTotal */}
        <div className={`p-2 border ${isDark ? 'bg-black/30 border-white/10' : 'bg-white border-slate-200'}`}>
          <div className={`font-black mb-1 ${isDark ? 'text-white/50' : 'text-slate-500'}`}>historicalGrantedTotal</div>
          <div className={`font-mono ${isDark ? 'text-white' : 'text-slate-800'}`}>
            {emp.historicalGrantedTotal !== undefined ? `${emp.historicalGrantedTotal}日` : 'undefined'}
          </div>
        </div>

        {/* currentUsedTotal */}
        <div className={`p-2 border ${emp.currentUsedTotal === undefined ? 'border-red-500' : isDark ? 'border-white/10' : 'border-slate-200'} ${isDark ? 'bg-black/30' : 'bg-white'}`}>
          <div className={`font-black mb-1 ${isDark ? 'text-white/50' : 'text-slate-500'}`}>currentUsedTotal</div>
          <div className={`font-mono font-black ${emp.currentUsedTotal === undefined ? 'text-red-500' : isDark ? 'text-blue-400' : 'text-blue-600'}`}>
            {emp.currentUsedTotal !== undefined ? `${emp.currentUsedTotal}日` : '❌ undefined'}
          </div>
        </div>

        {/* usedTotal (legacy) */}
        <div className={`p-2 border ${isDark ? 'bg-black/30 border-white/10' : 'bg-white border-slate-200'}`}>
          <div className={`font-black mb-1 ${isDark ? 'text-white/50' : 'text-slate-500'}`}>usedTotal (legacy)</div>
          <div className={`font-mono ${isDark ? 'text-white/30' : 'text-slate-400'}`}>
            {emp.usedTotal}日
          </div>
        </div>

        {/* historicalUsedTotal */}
        <div className={`p-2 border ${isDark ? 'bg-black/30 border-white/10' : 'bg-white border-slate-200'}`}>
          <div className={`font-black mb-1 ${isDark ? 'text-white/50' : 'text-slate-500'}`}>historicalUsedTotal</div>
          <div className={`font-mono ${isDark ? 'text-white' : 'text-slate-800'}`}>
            {emp.historicalUsedTotal !== undefined ? `${emp.historicalUsedTotal}日` : 'undefined'}
          </div>
        </div>

        {/* currentBalance */}
        <div className={`p-2 border ${emp.currentBalance === undefined ? 'border-red-500' : isDark ? 'border-white/10' : 'border-slate-200'} ${isDark ? 'bg-black/30' : 'bg-white'}`}>
          <div className={`font-black mb-1 ${isDark ? 'text-white/50' : 'text-slate-500'}`}>currentBalance</div>
          <div className={`font-mono font-black ${emp.currentBalance === undefined ? 'text-red-500' : isDark ? 'text-blue-400' : 'text-blue-600'}`}>
            {emp.currentBalance !== undefined ? `${emp.currentBalance}日` : '❌ undefined'}
          </div>
        </div>

        {/* balance (legacy) */}
        <div className={`p-2 border ${isDark ? 'bg-black/30 border-white/10' : 'bg-white border-slate-200'}`}>
          <div className={`font-black mb-1 ${isDark ? 'text-white/50' : 'text-slate-500'}`}>balance (legacy)</div>
          <div className={`font-mono ${isDark ? 'text-white/30' : 'text-slate-400'}`}>
            {emp.balance}日
          </div>
        </div>

        {/* historicalBalance */}
        <div className={`p-2 border ${isDark ? 'bg-black/30 border-white/10' : 'bg-white border-slate-200'}`}>
          <div className={`font-black mb-1 ${isDark ? 'text-white/50' : 'text-slate-500'}`}>historicalBalance</div>
          <div className={`font-mono ${isDark ? 'text-white' : 'text-slate-800'}`}>
            {emp.historicalBalance !== undefined ? `${emp.historicalBalance}日` : 'undefined'}
          </div>
        </div>
      </div>

      {/* periodHistory detail */}
      {emp.periodHistory && emp.periodHistory.length > 0 && (
        <div className={`mt-3 p-2 border ${isDark ? 'bg-black/30 border-white/10' : 'bg-white border-slate-200'}`}>
          <div className={`font-black mb-2 ${isDark ? 'text-white/50' : 'text-slate-500'}`}>
            Períodos Detalle ({emp.periodHistory.length}):
          </div>
          <div className="space-y-1">
            {emp.periodHistory.map((period, idx) => (
              <div key={idx} className={`text-[9px] font-mono ${period.isExpired ? 'text-red-400' : isDark ? 'text-green-400' : 'text-green-600'}`}>
                {period.periodName}: 付与{period.granted} 消化{period.used} 残{period.balance} {period.isExpired ? '❌ EXPIRADO' : '✅ VIGENTE'}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Análisis de discrepancia */}
      <div className={`mt-3 p-3 border-2 border-amber-500 ${isDark ? 'bg-amber-500/10' : 'bg-amber-50'}`}>
        <div className="font-black mb-2 text-amber-500">📊 ANÁLISIS:</div>
        <div className={`space-y-1 text-[9px] ${isDark ? 'text-white/70' : 'text-slate-700'}`}>
          {emp.currentGrantedTotal === undefined && (
            <div className="text-red-500 font-black">⚠️ currentGrantedTotal es undefined → usando fallback legacy</div>
          )}
          {emp.periodHistory === undefined && (
            <div className="text-red-500 font-black">⚠️ periodHistory es undefined → no hay historial</div>
          )}
          {emp.currentGrantedTotal !== undefined && emp.grantedTotal !== emp.currentGrantedTotal && (
            <div className="text-orange-500 font-black">
              ⚠️ Discrepancia: current({emp.currentGrantedTotal}) vs legacy({emp.grantedTotal})
            </div>
          )}
          {emp.yukyuDates && emp.currentUsedTotal !== undefined && emp.yukyuDates.length !== emp.currentUsedTotal && (
            <div className="text-orange-500 font-black">
              ⚠️ yukyuDates({emp.yukyuDates.length}) ≠ currentUsedTotal({emp.currentUsedTotal})
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DebugEmployeeData;
