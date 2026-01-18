
import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circle' | 'rect';
  width?: string | number;
  height?: string | number;
  count?: number;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  variant = 'text',
  width,
  height,
  count = 1
}) => {
  const { isDark } = useTheme();

  const baseClass = `animate-pulse rounded ${isDark ? 'bg-white/10' : 'bg-slate-200'}`;

  const getVariantClass = () => {
    switch (variant) {
      case 'circle':
        return 'rounded-full';
      case 'rect':
        return 'rounded-lg';
      default:
        return 'rounded h-4';
    }
  };

  const style: React.CSSProperties = {
    width: width || (variant === 'text' ? '100%' : undefined),
    height: height || (variant === 'text' ? '1rem' : undefined),
  };

  const items = Array.from({ length: count }, (_, i) => (
    <div
      key={i}
      className={`${baseClass} ${getVariantClass()} ${className}`}
      style={style}
    />
  ));

  return count === 1 ? items[0] : <>{items}</>;
};

// Card skeleton for dashboard stats
export const CardSkeleton: React.FC = () => {
  const { isDark } = useTheme();
  return (
    <div className={`p-6 rounded-2xl ${isDark ? 'bg-white/5 border border-white/10' : 'bg-white border border-slate-200'}`}>
      <div className="flex items-center gap-4">
        <Skeleton variant="circle" width={48} height={48} />
        <div className="flex-1 space-y-2">
          <Skeleton width="60%" height={12} />
          <Skeleton width="40%" height={20} />
        </div>
      </div>
    </div>
  );
};

// Table row skeleton
export const TableRowSkeleton: React.FC<{ columns?: number }> = ({ columns = 6 }) => {
  const { isDark } = useTheme();
  return (
    <tr className={isDark ? 'border-white/5' : 'border-slate-100'}>
      {Array.from({ length: columns }, (_, i) => (
        <td key={i} className="p-4">
          <Skeleton width={i === 0 ? '40px' : i === 1 ? '120px' : '60px'} />
        </td>
      ))}
    </tr>
  );
};

// Table skeleton with header and rows
export const TableSkeleton: React.FC<{ rows?: number; columns?: number }> = ({ rows = 5, columns = 6 }) => {
  const { isDark } = useTheme();
  return (
    <div className={`rounded-2xl overflow-hidden ${isDark ? 'bg-white/5 border border-white/10' : 'bg-white border border-slate-200'}`}>
      <table className="w-full">
        <thead>
          <tr className={isDark ? 'bg-white/5' : 'bg-slate-50'}>
            {Array.from({ length: columns }, (_, i) => (
              <th key={i} className="p-4 text-left">
                <Skeleton width={i === 0 ? '40px' : '80px'} height={12} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }, (_, i) => (
            <TableRowSkeleton key={i} columns={columns} />
          ))}
        </tbody>
      </table>
    </div>
  );
};

// Employee list skeleton
export const EmployeeListSkeleton: React.FC = () => {
  const { isDark } = useTheme();
  return (
    <div className="p-4 md:p-8 lg:p-12 space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div className="space-y-2">
          <Skeleton width={200} height={32} />
          <Skeleton width={300} height={16} />
        </div>
        <div className="flex gap-4">
          <Skeleton width={150} height={40} variant="rect" />
          <Skeleton width={100} height={40} variant="rect" />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }, (_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>

      {/* Table */}
      <TableSkeleton rows={10} columns={7} />
    </div>
  );
};

// Dashboard skeleton
export const DashboardSkeleton: React.FC = () => {
  const { isDark } = useTheme();
  return (
    <div className="p-6 md:p-12 space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="space-y-4">
        <Skeleton width={280} height={40} />
        <Skeleton width={180} height={16} />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className={`p-8 rounded-3xl ${isDark ? 'bg-white/5 border border-white/10' : 'bg-white border border-slate-200'}`}>
            <Skeleton width={80} height={12} className="mb-4" />
            <Skeleton width={100} height={48} className="mb-2" />
            <Skeleton width={60} height={14} />
          </div>
        ))}
      </div>

      {/* Charts area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className={`p-8 rounded-3xl ${isDark ? 'bg-white/5 border border-white/10' : 'bg-white border border-slate-200'}`}>
          <Skeleton width={120} height={20} className="mb-6" />
          <Skeleton height={200} variant="rect" />
        </div>
        <div className={`p-8 rounded-3xl ${isDark ? 'bg-white/5 border border-white/10' : 'bg-white border border-slate-200'}`}>
          <Skeleton width={120} height={20} className="mb-6" />
          <div className="space-y-4">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton variant="circle" width={40} height={40} />
                <div className="flex-1 space-y-1">
                  <Skeleton width="70%" height={14} />
                  <Skeleton width="40%" height={10} />
                </div>
                <Skeleton width={50} height={24} variant="rect" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// Application management skeleton
export const ApplicationSkeleton: React.FC = () => {
  const { isDark } = useTheme();
  return (
    <div className="p-4 md:p-8 lg:p-12 space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div className="space-y-2">
          <Skeleton width={180} height={32} />
          <Skeleton width={250} height={16} />
        </div>
        <div className="flex gap-2">
          <Skeleton width={80} height={36} variant="rect" />
          <Skeleton width={80} height={36} variant="rect" />
          <Skeleton width={80} height={36} variant="rect" />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4">
        <Skeleton width={100} height={40} variant="rect" />
        <Skeleton width={100} height={40} variant="rect" />
        <Skeleton width={100} height={40} variant="rect" />
      </div>

      {/* Table */}
      <TableSkeleton rows={8} columns={6} />
    </div>
  );
};

export default Skeleton;
