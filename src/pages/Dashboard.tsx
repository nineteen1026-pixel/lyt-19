import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { DashboardStats, Borrow } from '@shared/types';
import { Wrench, ArrowLeftRight, Wallet, AlertTriangle, Plus, ChevronRight } from 'lucide-react';
import { borrowStatusMap, formatDate, formatMoney } from '@/lib/format';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.dashboard.getStats().then(data => {
      setStats(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const statCards = [
    { label: '工具总数', value: stats?.totalTools ?? 0, icon: Wrench, gradient: 'from-primary-500 to-primary-700' },
    { label: '借用中', value: stats?.borrowingCount ?? 0, icon: ArrowLeftRight, gradient: 'from-blue-500 to-blue-700' },
    { label: '押金余额', value: formatMoney(stats?.depositBalance ?? 0), icon: Wallet, gradient: 'from-accent-500 to-accent-700' },
    { label: '损耗次数', value: stats?.damageCount ?? 0, icon: AlertTriangle, gradient: 'from-red-500 to-red-700' },
  ];

  if (loading) {
    return <div className="text-gray-500">加载中...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(({ label, value, icon: Icon, gradient }) => (
          <div key={label} className="card p-5 overflow-hidden relative">
            <div className={`absolute -right-6 -top-6 w-24 h-24 rounded-full bg-gradient-to-br ${gradient} opacity-10`} />
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm text-gray-500 mb-1">{label}</div>
                <div className="text-2xl font-bold text-gray-900">{value}</div>
              </div>
              <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center`}>
                <Icon className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold text-gray-900">最近借还记录</h2>
            <Link to="/borrows" className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1">
              查看全部 <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="py-2.5 font-medium">工具</th>
                  <th className="py-2.5 font-medium">借用人</th>
                  <th className="py-2.5 font-medium">借用日期</th>
                  <th className="py-2.5 font-medium">预计归还</th>
                  <th className="py-2.5 font-medium">租金</th>
                  <th className="py-2.5 font-medium">状态</th>
                </tr>
              </thead>
              <tbody>
                {(stats?.recentBorrows ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-400">暂无记录</td>
                  </tr>
                ) : (
                  (stats?.recentBorrows ?? []).map((b: Borrow) => (
                    <tr key={b.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="py-3 text-gray-900">{b.toolName}</td>
                      <td className="py-3 text-gray-600">{b.borrowerName} · {b.borrowerRoom}</td>
                      <td className="py-3 text-gray-600">{formatDate(b.borrowDate)}</td>
                      <td className="py-3 text-gray-600">{formatDate(b.expectedReturnDate)}</td>
                      <td className="py-3 text-gray-900 font-medium">{formatMoney(b.totalRent)}</td>
                      <td className="py-3">
                        <span className={`badge ${borrowStatusMap[b.status].className}`}>
                          {borrowStatusMap[b.status].label}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-5">快捷操作</h2>
          <div className="space-y-3">
            <Link to="/tools/new" className="flex items-center gap-3 p-3 rounded-lg bg-primary-50 text-primary-700 hover:bg-primary-100 transition-colors">
              <Plus className="w-5 h-5" />
              <div>
                <div className="font-medium text-sm">新增工具</div>
                <div className="text-xs text-primary-600/70">录入新的共享工具</div>
              </div>
            </Link>
            <Link to="/borrows/new" className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors">
              <ArrowLeftRight className="w-5 h-5" />
              <div>
                <div className="font-medium text-sm">新建借用</div>
                <div className="text-xs text-blue-600/70">登记居民借用申请</div>
              </div>
            </Link>
            <Link to="/damages/new" className="flex items-center gap-3 p-3 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 transition-colors">
              <AlertTriangle className="w-5 h-5" />
              <div>
                <div className="font-medium text-sm">登记损耗</div>
                <div className="text-xs text-red-600/70">记录工具损坏情况</div>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
