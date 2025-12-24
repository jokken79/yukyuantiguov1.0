
import React, { useState } from 'react';
import { Employee } from '../types';
import { exportEmployeesToCSV, exportToPDF } from '../services/exportService';

interface EmployeeListProps {
  employees: Employee[];
}

const EmployeeList: React.FC<EmployeeListProps> = ({ employees }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [exportingPDF, setExportingPDF] = useState(false);

  const filtered = employees.filter(e => 
    e.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    e.id.includes(searchTerm) ||
    e.client.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleExportCSV = () => {
    exportEmployeesToCSV(filtered);
  };

  const handleExportPDF = async () => {
    setExportingPDF(true);
    await exportToPDF('employee-list-container', `yukyu_employee_list_${new Date().toISOString().split('T')[0]}.pdf`);
    setExportingPDF(false);
  };

  return (
    <div className="p-12 space-y-12 animate-fadeIn max-w-[1600px] mx-auto">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div className="space-y-4">
          <div className="flex items-center gap-6">
            <div className="h-10 w-2 bg-blue-500"></div>
            <h2 className="text-5xl font-black italic tracking-tighter aggressive-text">EMPLOYEE REGISTRY</h2>
          </div>
          <p className="text-white/30 font-black tracking-[0.4em] ml-8 text-xs uppercase">Personnel Leave Records Management</p>
        </div>
        
        <div className="flex flex-wrap gap-4 items-center">
          <div className="relative w-full md:w-96">
            <span className="absolute left-6 top-1/2 -translate-y-1/2 text-white/20 text-lg">/</span>
            <input
              type="text"
              placeholder="SEARCH_EMPLOYEE_ID_OR_NAME..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-[#0a0a0a] border border-white/10 rounded-none pl-14 pr-8 py-5 w-full focus:outline-none focus:border-red-600 transition-all font-black italic text-xs tracking-widest"
            />
          </div>
          <button onClick={handleExportCSV} className="bg-white/5 border border-white/10 px-8 py-5 text-[10px] font-black tracking-widest hover:bg-white/10 transition-all italic">EXPORT.CSV</button>
          <button onClick={handleExportPDF} className="bg-white text-black px-8 py-5 text-[10px] font-black tracking-widest hover:bg-white/90 transition-all italic shadow-[0_0_20px_rgba(255,255,255,0.2)]">GEN_PDF</button>
        </div>
      </header>

      <div id="employee-list-container" className="bg-[#0a0a0a] border border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-white/[0.02] text-[10px] font-black uppercase tracking-[0.3em] text-white/30 border-b border-white/5">
                <th className="px-10 py-6">ID</th>
                <th className="px-10 py-6">NAME / CLIENT</th>
                <th className="px-10 py-6 text-center">GRANTED</th>
                <th className="px-10 py-6 text-center">USED</th>
                <th className="px-10 py-6 text-center">BALANCE</th>
                <th className="px-10 py-6 text-center">年5日義務化</th>
                <th className="px-10 py-6 text-right">STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map((emp) => {
                const isMandatoryTarget = emp.grantedTotal >= 10;
                const isCompliant = emp.usedTotal >= 5;

                return (
                  <tr key={emp.id} className="hover:bg-white/[0.01] transition-colors group">
                    <td className="px-10 py-8 font-black italic text-sm text-white/20 group-hover:text-blue-500 transition-colors">#{emp.id}</td>
                    <td className="px-10 py-8">
                      <div className="font-black text-lg tracking-tight group-hover:translate-x-1 transition-transform">{emp.name}</div>
                      <div className="text-[10px] font-bold text-white/30 mt-1 uppercase tracking-widest">{emp.client}</div>
                    </td>
                    <td className="px-10 py-8 text-center font-black text-sm">{emp.grantedTotal}D</td>
                    <td className="px-10 py-8 text-center">
                      <span className={`font-black text-sm ${emp.usedTotal === 0 ? 'text-white/20' : 'text-red-500'}`}>
                        {emp.usedTotal}D
                      </span>
                    </td>
                    <td className="px-10 py-8 text-center">
                      <div className={`inline-block px-5 py-2 border-2 font-black text-xs italic ${
                        emp.balance < 5 ? 'border-red-600 text-red-600' : 'border-white/10 text-white'
                      }`}>
                        {emp.balance} DAYS LEFT
                      </div>
                    </td>
                    <td className="px-10 py-8 text-center">
                      {isMandatoryTarget ? (
                        <span className={`px-4 py-1.5 text-[9px] font-black uppercase tracking-widest border ${
                          isCompliant ? 'bg-blue-500/10 border-blue-500/30 text-blue-500' : 'bg-red-600 border-red-600 text-white animate-pulse'
                        }`}>
                          {isCompliant ? '達成' : '未達 / 要対応'}
                        </span>
                      ) : (
                        <span className="text-[9px] font-black text-white/10 uppercase tracking-widest italic">対象外</span>
                      )}
                    </td>
                    <td className="px-10 py-8 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <span className="text-[10px] font-black tracking-widest opacity-40 italic">{emp.status}</span>
                        <div className={`w-1.5 h-6 ${emp.status === '在職中' ? 'bg-green-500 shadow-[0_0_10px_#22c55e]' : 'bg-white/10'}`}></div>
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
