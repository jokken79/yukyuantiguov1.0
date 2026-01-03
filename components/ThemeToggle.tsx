
import React from 'react';
import { useTheme } from '../contexts/ThemeContext';

const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme, isDark } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? 'ダークモードがオン、ライトモードに切り替え' : 'ライトモードがオン、ダークモードに切り替え'}
      className={`
        relative w-full p-4 rounded-xl
        ${isDark
          ? 'bg-white/5 border border-white/10 hover:border-white/20'
          : 'bg-slate-100 border border-slate-200 hover:border-slate-300'
        }
        transition-all duration-300 group
      `}
      title={isDark ? 'ライトモードに切り替え' : 'ダークモードに切り替え'}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Sun/Moon Icon */}
          <div className={`
            w-10 h-10 rounded-lg flex items-center justify-center
            ${isDark
              ? 'bg-yellow-500/20 text-yellow-400'
              : 'bg-blue-500/20 text-blue-600'
            }
            transition-all duration-300
          `}>
            {isDark ? (
              // Moon icon
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
              </svg>
            ) : (
              // Sun icon
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
              </svg>
            )}
          </div>

          <div className="text-left">
            <p className={`text-[10px] font-bold tracking-widest uppercase ${isDark ? 'text-white/40' : 'text-slate-500'}`}>
              テーマ
            </p>
            <p className={`text-sm font-black italic ${isDark ? 'text-white' : 'text-slate-800'}`}>
              {isDark ? 'ダークモード' : 'ライトモード'}
            </p>
          </div>
        </div>

        {/* Toggle Switch */}
        <div className={`
          relative w-12 h-6 rounded-full transition-colors duration-300
          ${isDark ? 'bg-yellow-500/30' : 'bg-blue-500/30'}
        `}>
          <div className={`
            absolute top-1 w-4 h-4 rounded-full transition-all duration-300
            ${isDark
              ? 'left-1 bg-yellow-400'
              : 'left-7 bg-blue-500'
            }
          `} />
        </div>
      </div>
    </button>
  );
};

export default ThemeToggle;
