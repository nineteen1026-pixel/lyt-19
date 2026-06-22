import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import type { Borrow, CreditInfo, Tool } from '@shared/types';
import { borrowStatusMap, formatDate, formatMoney } from '@/lib/format';
import { ArrowLeft, Package, Phone, Hash, Edit2, Save, X, Star, CreditCard } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { getCreditLevelColor } from '@shared/credit';
import DepositPayModal from '@/components/DepositPayModal';

export default function MyBorrows() {
  const navigate = useNavigate();
  const { user, loading: authLoading, updateProfile } = useAuthStore();
  const [borrows, setBorrows] = useState<Borrow[]>([]);
  const [status, setStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editRoom, setEditRoom] = useState('');
  const [saving, setSaving] = useState(false);
  const [creditInfo, setCreditInfo] = useState<CreditInfo | null>(null);
  const [toolsMap, setToolsMap] = useState<Record<number, Tool>>({});
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payingBorrow, setPayingBorrow] = useState<Borrow | null>(null);

  useEffect(() => {
    api.tools.list().then(tools => {
      const map: Record<number, Tool> = {};
      tools.forEach(t => { map[t.id] = t; });
      setToolsMap(map);
    }).catch(() => {});
  }, []);

  const handleOpenPay = (b: Borrow) => {
    setPayingBorrow(b);
    setPayModalOpen(true);
  };
  const handlePaySuccess = () => {
    setPayModalOpen(false);
    setPayingBorrow(null);
    loadData();
  };

  const loadData = () => {
    if (!user) return;
    setLoading(true);
    Promise.all([
      api.borrows.mine({ status: status === 'all' ? undefined : status }),
      api.credit.getInfo(),
    ]).then(([borrowsData, creditData]) => {
      setBorrows(borrowsData);
      setCreditInfo(creditData);
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });
  };

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login', { state: { from: '/my-borrows' } });
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [status, user]);

  const handleStartEdit = () => {
    if (!user) return;
    setEditName(user.name);
    setEditRoom(user.room);
    setEditing(true);
  };

  const handleSaveProfile = async () => {
    if (!editName.trim() || !editRoom.trim()) {
      alert('姓名和房号不能为空');
      return;
    }
    setSaving(true);
    try {
      await updateProfile({ name: editName, room: editRoom });
      setEditing(false);
      loadData();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const statusTabs = [
    { key: 'all', label: '全部' },
    { key: 'pending', label: '待审批' },
    { key: 'approved', label: '待支付' },
    { key: 'borrowing', label: '借用中' },
    { key: 'returned', label: '已归还' },
    { key: 'overdue', label: '已逾期' },
    { key: 'rejected', label: '已拒绝' },
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
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white text-2xl font-bold">
              {user.name.charAt(0)}
            </div>
            <div>
              {!editing ? (
                <>
                  <h2 className="text-xl font-bold text-gray-900">{user.name}</h2>
                  <div className="mt-1.5 space-y-1 text-sm text-gray-600">
                    <div className="flex items-center gap-1.5">
                      <Hash className="w-4 h-4" />
                      <span>{user.room}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-4 h-4" />
                      <span>{user.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')}</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="text-sm text-gray-500 mb-1 block">姓名</label>
                    <input
                      type="text"
                      className="input"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-500 mb-1 block">房号</label>
                    <input
                      type="text"
                      className="input"
                      value={editRoom}
                      onChange={e => setEditRoom(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={handleSaveProfile} disabled={saving} className="btn btn-primary btn-sm">
                      <Save className="w-3.5 h-3.5 mr-1" />
                      {saving ? '保存中' : '保存'}
                    </button>
                    <button onClick={() => setEditing(false)} disabled={saving} className="btn btn-secondary btn-sm">
                      <X className="w-3.5 h-3.5 mr-1" />
                      取消
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
          {!editing && (
            <button onClick={handleStartEdit} className="btn btn-secondary">
              <Edit2 className="w-4 h-4 mr-1.5" />
              编辑资料
            </button>
          )}
        </div>

        {creditInfo && (
          <div className="mb-5 p-4 bg-amber-50 rounded-lg border border-amber-200">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
                <Star className="w-6 h-6 text-amber-500" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-amber-900">信用分</span>
                  <span className={`badge px-2 py-0.5 text-xs ${getCreditLevelColor(creditInfo.score)}`}>
                    {creditInfo.level}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <div>
                    <span className="text-amber-700 font-bold text-xl">{creditInfo.score}</span>
                    <span className="text-amber-600 ml-1">/ 100</span>
                  </div>
                  <div className="text-amber-800">
                    可借 <b>{creditInfo.maxBorrows}</b> 件
                    <span className="text-amber-600 mx-1">·</span>
                    已借 <b>{creditInfo.currentBorrows}</b> 件
                  </div>
                </div>
              </div>
              <Link to="/borrows/new" className="btn btn-primary btn-sm">
                去借用
              </Link>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-5 border-t border-gray-100">
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="text-xs text-gray-500 mb-1">总借用次数</div>
            <div className="text-2xl font-bold text-gray-900">{borrows.length}</div>
          </div>
          <div className="p-3 bg-amber-50 rounded-lg">
            <div className="text-xs text-amber-600 mb-1">待审批</div>
            <div className="text-2xl font-bold text-amber-700">{borrows.filter(b => b.status === 'pending').length}</div>
          </div>
          <div className="p-3 bg-orange-50 rounded-lg">
            <div className="text-xs text-orange-600 mb-1">待支付</div>
            <div className="text-2xl font-bold text-orange-700">{borrows.filter(b => b.status === 'approved').length}</div>
          </div>
          <div className="p-3 bg-primary-50 rounded-lg">
            <div className="text-xs text-primary-600 mb-1">借用中</div>
            <div className="text-2xl font-bold text-primary-700">{borrows.filter(b => b.status === 'borrowing' || b.status === 'overdue').length}</div>
          </div>
          <div className="p-3 bg-green-50 rounded-lg">
            <div className="text-xs text-green-600 mb-1">已归还</div>
            <div className="text-2xl font-bold text-green-700">{borrows.filter(b => b.status === 'returned').length}</div>
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
                  ? 'bg-primary-700 text-white shadow-sm'
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
          ) : borrows.length === 0 ? (
            <div className="p-16 text-center">
              <Package className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <div className="text-gray-400 mb-3">暂无借用记录</div>
              <Link to="/borrows/new" className="btn btn-primary">
                去申请借用
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {borrows.map(b => (
                <div key={b.id} className="p-5 hover:bg-gray-50/50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <h3 className="font-semibold text-gray-900">{b.toolName}</h3>
                        <span className={`badge ${borrowStatusMap[b.status].className}`}>
                          {borrowStatusMap[b.status].label}
                        </span>
                        {b.status === 'approved' && toolsMap[b.toolId] && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-orange-50 text-orange-700 text-xs font-medium border border-orange-200">
                            待付押金：{formatMoney(toolsMap[b.toolId].depositAmount)}
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-1.5 text-sm text-gray-600">
                        <div>
                          <span className="text-gray-400">借用日期：</span>
                          {formatDate(b.borrowDate)}
                        </div>
                        <div>
                          <span className="text-gray-400">预计归还：</span>
                          {formatDate(b.expectedReturnDate)}
                        </div>
                        <div>
                          <span className="text-gray-400">实际归还：</span>
                          {formatDate(b.actualReturnDate)}
                        </div>
                        <div>
                          <span className="text-gray-400">租金：</span>
                          <b className="text-gray-900">{formatMoney(b.totalRent)}</b>
                        </div>
                      </div>
                    </div>
                    {b.status === 'approved' && (
                      <div className="flex-shrink-0">
                        <button onClick={() => handleOpenPay(b)} className="btn btn-sm bg-orange-600 text-white hover:bg-orange-700">
                          <CreditCard className="w-3.5 h-3.5 mr-0.5" />
                          立即支付押金
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {payingBorrow && (
        <DepositPayModal
          open={payModalOpen}
          onClose={() => { setPayModalOpen(false); setPayingBorrow(null); }}
          borrow={payingBorrow}
          depositAmount={toolsMap[payingBorrow.toolId]?.depositAmount || 0}
          onPaySuccess={handlePaySuccess}
        />
      )}
    </div>
  );
}
