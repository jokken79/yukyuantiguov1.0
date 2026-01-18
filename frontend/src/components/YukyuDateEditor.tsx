/**
 * YukyuDateEditor Component
 * 
 * Modal for viewing and editing employee yukyu (paid leave) dates.
 * Allows deletion of imported dates with confirmation.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Employee } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import { db } from '../services/db';
import toast from 'react-hot-toast';

interface YukyuDateEditorProps {
    employee: Employee;
    isOpen: boolean;
    onClose: () => void;
    onUpdate: () => void;
}

const YukyuDateEditor: React.FC<YukyuDateEditorProps> = ({
    employee,
    isOpen,
    onClose,
    onUpdate
}) => {
    const { isDark } = useTheme();
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
    const [dates, setDates] = useState<string[]>(employee.yukyuDates || []);

    const handleDelete = (date: string) => {
        if (confirmDelete === date) {
            // Actually delete
            const result = db.removeYukyuDate(employee.id, date);
            if (result) {
                setDates(prev => prev.filter(d => d !== date));
                toast.success(`${date} を削除しました`, { duration: 2000 });
                setConfirmDelete(null);
                onUpdate();
            } else {
                toast.error('削除に失敗しました');
            }
        } else {
            // Show confirmation
            setConfirmDelete(date);
        }
    };

    const cancelDelete = () => {
        setConfirmDelete(null);
    };

    // Format date for display (YYYY-MM-DD → YYYY年MM月DD日)
    const formatDate = (dateStr: string): string => {
        const [year, month, day] = dateStr.split('-');
        return `${year}年${month}月${day}日`;
    };

    // Get day of week
    const getDayOfWeek = (dateStr: string): string => {
        const days = ['日', '月', '火', '水', '木', '金', '土'];
        const date = new Date(dateStr);
        return days[date.getDay()];
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
                onClick={onClose}
            >
                {/* Backdrop */}
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

                {/* Modal */}
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    transition={{ type: 'spring', damping: 25 }}
                    onClick={(e) => e.stopPropagation()}
                    className={`relative w-full max-w-lg max-h-[80vh] rounded-2xl overflow-hidden ${isDark ? 'bg-[#111] border border-white/10' : 'bg-white border border-slate-200'
                        } shadow-2xl`}
                >
                    {/* Header */}
                    <div className={`px-6 py-4 border-b ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className={`text-xl font-black italic ${isDark ? 'text-white' : 'text-slate-800'}`}>
                                    有給取得日編集
                                </h2>
                                <p className={`text-sm ${isDark ? 'text-white/60' : 'text-slate-500'}`}>
                                    {employee.name} (№{employee.id})
                                </p>
                            </div>
                            <button
                                onClick={onClose}
                                className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-white/10 text-white/60' : 'hover:bg-slate-100 text-slate-400'
                                    }`}
                            >
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Stats */}
                        <div className="flex gap-4 mt-3">
                            <div className={`px-3 py-1 rounded-full text-xs font-bold ${isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600'
                                }`}>
                                取得日数: {dates.length}日
                            </div>
                            <div className={`px-3 py-1 rounded-full text-xs font-bold ${isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-600'
                                }`}>
                                残高: {employee.balance}日
                            </div>
                        </div>
                    </div>

                    {/* Date List */}
                    <div className="overflow-y-auto max-h-[50vh] p-4">
                        {dates.length === 0 ? (
                            <div className={`text-center py-12 ${isDark ? 'text-white/40' : 'text-slate-400'}`}>
                                <svg className="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <p className="text-sm">有給取得日がありません</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {dates.sort().reverse().map((date, idx) => (
                                    <motion.div
                                        key={date}
                                        layout
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 20 }}
                                        transition={{ delay: idx * 0.03 }}
                                        className={`flex items-center justify-between p-3 rounded-xl ${isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-slate-50 hover:bg-slate-100'
                                            } transition-colors`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold ${isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600'
                                                }`}>
                                                {getDayOfWeek(date)}
                                            </div>
                                            <div>
                                                <p className={`font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                                                    {formatDate(date)}
                                                </p>
                                                <p className={`text-xs ${isDark ? 'text-white/40' : 'text-slate-400'}`}>
                                                    {date}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Delete Button */}
                                        {confirmDelete === date ? (
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={cancelDelete}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold ${isDark ? 'bg-white/10 text-white/60 hover:bg-white/20' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                                                        }`}
                                                >
                                                    キャンセル
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(date)}
                                                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-500 text-white hover:bg-red-600"
                                                >
                                                    削除する
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => handleDelete(date)}
                                                className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-red-500/20 text-white/40 hover:text-red-400' : 'hover:bg-red-100 text-slate-400 hover:text-red-500'
                                                    }`}
                                                title="削除"
                                            >
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        )}
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className={`px-6 py-4 border-t ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
                        <div className="flex justify-between items-center">
                            <p className={`text-xs ${isDark ? 'text-white/40' : 'text-slate-400'}`}>
                                ⚠️ 削除した日付は元に戻せません
                            </p>
                            <button
                                onClick={onClose}
                                className={`px-4 py-2 rounded-lg font-bold text-sm ${isDark ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                                    }`}
                            >
                                閉じる
                            </button>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default YukyuDateEditor;
