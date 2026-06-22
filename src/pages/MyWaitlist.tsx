import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import type { Waitlist } from '@shared/types';
import { waitlistStatusMap, formatDate } from '@/lib/format';
import { ArrowLeft, Users, Bell, X, CheckCircle, AlertTriangle } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';

export default function MyWaitlist() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuthStore();
  const [waitlist, setWaitlist] = useState<Waitlist[]>([]);
  const [status, setStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<number | null>(null);

  const loadData = () => {
    if (!user) return;
    setLoading(true);
    api.waitlist.mine({ status: status === 'all' ? undefined : status })
      .then(data => {
        setWaitlist(data);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login', { state: { from: '/my-waitlist' } });
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [status, user]);

  const handleCancel = async (item: Waitlist) => {
    if (!window.confirm(`确定要取消"${item.toolName}"的排队预约吗？`)) return;
    setProcessingId(item.id);
    try {
      await api.waitlist.cancel(item.id);
      loadData();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleConvertToBorrow = async (item: Waitlist) => {
    if (!window.confirm(`确认要将"${item.toolName}"的排队预约转为借用申请吗？`)) return;
    setProcessingId(item.id);
    try {
      await api.waitlist.convertToBorrow(item.id);
      navigate('/my-borrows');
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setProcessingId(null);
    }
  };

  const getTimeRemaining = (expiresAt: string | null): string => {
    if (!expiresAt) return '';
    const now = Date.now();
    const expires = new Date(expiresAt).getTime();
    const diff = expires - now;
    if (diff <= 0) return '已过期';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) {
      return `${hours}小时${minutes}分钟`;
    }
    return `${minutes}分钟`;
  };

  const statusTabs = [
    { key: 'all', label: '全部' },
    { key: 'waiting', label: '排队中' },
    { key: 'notified', label: '待取件' },
    { key: 'borrowed', label: '已借用' },
    { key: 'cancelled', label: '已取消' },
    { key: 'expired', label: '已过期' },
  ];

  if (!user) return null;

  return (
    <div className="space-y-6">
      <button onClick={() => navigate(-1)} className="btn btn-secondary">
        <ArrowLeft className="w-4 h-4 mr-1.5" />
        返回
      </button>

      <div className="card p-6">
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-white text-2xl font-bold">
              {user.name.charAt(0)}
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{user.name}</h2>
              <div className="mt-1.5 space-y-1 text-sm text-gray-600">
                <div>我的预约排队</div>
              </div>
            </div>
          </div>
          <Link to="/borrows/new" className="btn btn-primary btn-sm">
            去借用
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-5 border-t border-gray-100">
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="text-xs text-gray-500 mb-1">总排队次数</div>
            <div className="text-2xl font-bold text-gray-900">{waitlist.length}</div>
          </div>
          <div className="p-3 bg-amber-50 rounded-lg">
            <div className="text-xs text-amber-600 mb-1">排队中</div>
            <div className="text-2xl font-bold text-amber-700">{waitlist.filter(w => w.status === 'waiting').length}</div>
          </div>
          <div className="p-3 bg-blue-50 rounded-lg">
            <div className="text-xs text-blue-600 mb-1">待取件</div>
            <div className="text-2xl font-bold text-blue-700">{waitlist.filter(w => w.status === 'notified').length}</div>
          </div>
          <div className="p-3 bg-green-50 rounded-lg">
            <div className="text-xs text-green-600 mb-1">已借用</div>
            <div className="text-2xl font-bold text-green-700">{waitlist.filter(w => w.status === 'borrowed').length}</div>
          </div>
        </div>
      </div>

      <div>
        <div className="flex flex-wrap gap-2 mb-4">
          {statusTabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setStatus(tab.key)}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                status === tab.key
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="card overflow-hidden">
          {loading ? (
            <div className="text-gray-500 py-10 text-center">加载中...</div>
          ) : waitlist.length === 0 ? (
            <div className="p-16 text-center">
              <Users className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <div className="text-gray-400 mb-3">暂无排队记录</div>
              <Link to="/borrows/new" className="btn btn-primary">
                去申请借用
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {waitlist.map(item => (
                <div key={item.id} className="p-5 hover:bg-gray-50/50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <h3 className="font-semibold text-gray-900">{item.toolName}</h3>
                        <span className={`badge ${waitlistStatusMap[item.status].className}`}>
                          {waitlistStatusMap[item.status].label}
                        </span>
                        {item.status === 'waiting' && item.queuePosition !== null && (
                          <span className="badge bg-gray-100 text-gray-700">
                            第 {item.queuePosition} 位
                          </span>
                        )}
                        {item.status === 'notified' && (
                          <span className="badge bg-blue-100 text-blue-800 flex items-center gap-1">
                            <Bell className="w-3 h-3" />
                            剩余 {getTimeRemaining(item.pickupExpiresAt)}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-1.5 text-sm text-gray-600">
                        <div>
                          <span className="text-gray-400">期望借用：</span>
                          {formatDate(item.expectedBorrowDate)}
                        </div>
                        <div>
                          <span className="text-gray-400">期望归还：</span>
                          {formatDate(item.expectedReturnDate)}
                        </div>
                        <div>
                          <span className="text-gray-400">登记时间：</span>
                          {formatDate(item.createdAt)}
                        </div>
                        {item.notifiedAt && (
                          <div>
                            <span className="text-gray-400">通知时间：</span>
                            {formatDate(item.notifiedAt)}
                          </div>
                        )}
                      </div>

                      {item.status === 'notified' && (
                        <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                            <div className="text-sm text-blue-800">
                              <p className="font-medium">工具已归还，请在取件时段内确认借用</p>
                              <p className="text-xs text-blue-600 mt-0.5">
                                取件截止：{item.pickupExpiresAt ? new Date(item.pickupExpiresAt).toLocaleString('zh-CN') : '-'}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 shrink-0">
                      {item.status === 'waiting' && (
                        <button
                          onClick={() => handleCancel(item)}
                          disabled={processingId === item.id}
                          className="btn btn-secondary btn-sm text-red-600 hover:bg-red-50 border border-red-200"
                        >
                          <X className="w-3.5 h-3.5 mr-1" />
                          取消排队
                        </button>
                      )}
                      {item.status === 'notified' && (
                        <>
                          <button
                            onClick={() => handleConvertToBorrow(item)}
                            disabled={processingId === item.id}
                            className="btn btn-primary btn-sm"
                          >
                            <CheckCircle className="w-3.5 h-3.5 mr-1" />
                            确认借用
                          </button>
                          <button
                            onClick={() => handleCancel(item)}
                            disabled={processingId === item.id}
                            className="btn btn-secondary btn-sm text-red-600 hover:bg-red-50 border border-red-200"
                          >
                            <X className="w-3.5 h-3.5 mr-1" />
                            放弃
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
