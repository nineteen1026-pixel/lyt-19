import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import type { Borrow } from '@shared/types';
import { borrowStatusMap, formatDate, formatMoney } from '@/lib/format';
import { Plus, Check, X, RotateCcw, LogIn } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export default function BorrowList() {
  const navigate = useNavigate();
  const { user, initialized } = useAuthStore();
  const [borrows, setBorrows] = useState<Borrow[]>([]);
  const [status, setStatus] = useState('all');
  const [loading, setLoading] = useState(true);

  const loadData = () => {
    setLoading(true);
    api.borrows.list({ status: status === 'all' ? undefined : status }).then(data => {
      setBorrows(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => {
    if (!initialized) return;
    loadData();
  }, [status, initialized]);

  const handleNewBorrow = () => {
    if (!user) {
      navigate('/login', { state: { from: '/borrows/new' } });
    } else {
      navigate('/borrows/new');
    }
  };

  const handleApprove = async (b: Borrow) => {
    if (!window.confirm(`确定批准 ${b.borrowerName} 的"${b.toolName}"借用申请？\n\n批准后将扣除库存并收取工具押金。`)) return;
    try {
      await api.borrows.approve(b.id);
      loadData();
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const handleReject = async (id: number) => {
    if (!window.confirm('确定拒绝该借用申请吗？')) return;
    try {
      await api.borrows.reject(id);
      loadData();
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const handleReturn = async (b: Borrow) => {
    if (!window.confirm(`确认 ${b.borrowerName} 已归还"${b.toolName}"？\n\n归还后将结算押金并退还剩余金额。`)) return;
    try {
      await api.borrows.returnTool(b.id);
      loadData();
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const statusTabs = [
    { key: 'all', label: '全部' },
    { key: 'pending', label: '待审批' },
    { key: 'borrowing', label: '借用中' },
    { key: 'returned', label: '已归还' },
    { key: 'overdue', label: '已逾期' },
    { key: 'rejected', label: '已拒绝' },
  ];

  if (!initialized) {
    return <div className="text-gray-500 py-10 text-center">加载中...</div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <div className="flex flex-wrap gap-2">
          {statusTabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setStatus(tab.key)}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                status === tab.key
                  ? 'bg-primary-700 text-white shadow-sm'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button onClick={handleNewBorrow} className="btn btn-primary">
          {user ? (
            <>
              <Plus className="w-4 h-4 mr-1.5" />
              新建借用
            </>
          ) : (
            <>
              <LogIn className="w-4 h-4 mr-1.5" />
              登录后申请
            </>
          )}
        </button>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="text-gray-500 py-10 text-center">加载中...</div>
        ) : borrows.length === 0 ? (
          <div className="p-16 text-center text-gray-400">暂无借用记录</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left text-gray-500">
                  <th className="px-5 py-3 font-medium">工具</th>
                  <th className="px-5 py-3 font-medium">借用人</th>
                  <th className="px-5 py-3 font-medium">联系方式</th>
                  <th className="px-5 py-3 font-medium">借用日期</th>
                  <th className="px-5 py-3 font-medium">预计归还</th>
                  <th className="px-5 py-3 font-medium">实际归还</th>
                  <th className="px-5 py-3 font-medium">租金</th>
                  <th className="px-5 py-3 font-medium">状态</th>
                  <th className="px-5 py-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {borrows.map(b => (
                  <tr key={b.id} className="border-t border-gray-100 hover:bg-gray-50/50">
                    <td className="px-5 py-3.5 font-medium text-gray-900">{b.toolName}</td>
                    <td className="px-5 py-3.5 text-gray-700">
                      <div>{b.borrowerName}</div>
                      <div className="text-xs text-gray-400">{b.borrowerRoom}</div>
                    </td>
                    <td className="px-5 py-3.5 text-gray-600">{b.borrowerPhone}</td>
                    <td className="px-5 py-3.5 text-gray-600">{formatDate(b.borrowDate)}</td>
                    <td className="px-5 py-3.5 text-gray-600">{formatDate(b.expectedReturnDate)}</td>
                    <td className="px-5 py-3.5 text-gray-600">{formatDate(b.actualReturnDate)}</td>
                    <td className="px-5 py-3.5 text-gray-900 font-medium">{formatMoney(b.totalRent)}</td>
                    <td className="px-5 py-3.5">
                      <span className={`badge ${borrowStatusMap[b.status].className}`}>
                        {borrowStatusMap[b.status].label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5">
                        {b.status === 'pending' && (
                          <>
                            <button onClick={() => handleApprove(b)} className="btn btn-sm bg-green-600 text-white hover:bg-green-700">
                              <Check className="w-3.5 h-3.5 mr-0.5" />批准借出
                            </button>
                            <button onClick={() => handleReject(b.id)} className="btn btn-sm text-red-600 border border-red-200 hover:bg-red-50">
                              <X className="w-3.5 h-3.5 mr-0.5" />拒绝
                            </button>
                          </>
                        )}
                        {(b.status === 'borrowing' || b.status === 'overdue') && (
                          <button onClick={() => handleReturn(b)} className="btn btn-sm bg-blue-600 text-white hover:bg-blue-700">
                            <RotateCcw className="w-3.5 h-3.5 mr-0.5" />确认归还
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
