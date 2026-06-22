import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import type { Tool, CreditInfo } from '@shared/types';
import { ArrowLeft, Save, Calculator, Hash, Phone, User, AlertTriangle, CheckCircle, Star, Users, Clock } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { formatMoney } from '@/lib/format';
import { getCreditLevelColor } from '@shared/credit';

export default function BorrowForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, initialized } = useAuthStore();
  const [tools, setTools] = useState<Tool[]>([]);
  const [form, setForm] = useState({
    toolId: Number(searchParams.get('toolId')) || 0,
    borrowDate: new Date().toISOString().slice(0, 10),
    expectedReturnDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  });
  const [saving, setSaving] = useState(false);
  const [creditInfo, setCreditInfo] = useState<CreditInfo | null>(null);
  const [queueMode, setQueueMode] = useState(searchParams.get('queue') === '1');
  const [waitlistCount, setWaitlistCount] = useState<number | null>(null);

  useEffect(() => {
    if (initialized && !user) {
      navigate('/login', { state: { from: '/borrows/new' } });
    }
  }, [initialized, user, navigate]);

  useEffect(() => {
    api.tools.list().then(setTools);
  }, []);

  useEffect(() => {
    if (form.toolId && queueMode) {
      api.waitlist.getToolCount(form.toolId).then(data => {
        setWaitlistCount(data.count);
      });
    }
  }, [form.toolId, queueMode]);

  useEffect(() => {
    if (user) {
      api.credit.getInfo()
        .then(setCreditInfo)
        .catch(console.error);
    }
  }, [user]);

  const selectedTool = useMemo(() => tools.find(t => t.id === form.toolId), [tools, form.toolId]);

  useEffect(() => {
    if (selectedTool) {
      const available = selectedTool.availableStock ?? selectedTool.stock;
      if (available === 0 && selectedTool.status === 'available') {
        setQueueMode(true);
      } else if (available > 0) {
        setQueueMode(false);
      }
    }
  }, [selectedTool]);

  const days = useMemo(() => {
    if (!form.borrowDate || !form.expectedReturnDate) return 0;
    const s = new Date(form.borrowDate).getTime();
    const e = new Date(form.expectedReturnDate).getTime();
    return Math.max(1, Math.ceil((e - s) / (24 * 60 * 60 * 1000)));
  }, [form.borrowDate, form.expectedReturnDate]);

  const totalRent = selectedTool ? days * selectedTool.dailyRent : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.toolId) {
      alert('请选择工具');
      return;
    }
    if (creditInfo && !creditInfo.canBorrow) {
      alert(creditInfo.reason || '暂时无法借用工具');
      return;
    }
    setSaving(true);
    try {
      if (queueMode) {
        await api.waitlist.create({
          toolId: form.toolId,
          expectedBorrowDate: form.borrowDate,
          expectedReturnDate: form.expectedReturnDate,
        });
        navigate('/my-waitlist');
      } else {
        await api.borrows.create(form);
        navigate('/my-borrows');
      }
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (!initialized || !user) {
    return <div className="text-gray-500 py-10 text-center">加载中...</div>;
  }

  return (
    <div className="max-w-2xl">
      <button onClick={() => navigate(queueMode ? '/my-waitlist' : '/my-borrows')} className="btn btn-secondary mb-5">
        <ArrowLeft className="w-4 h-4 mr-1.5" />
        {queueMode ? '返回我的排队' : '返回我的借用'}
      </button>

      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">
          {queueMode ? '加入预约排队' : '新建借用申请'}
        </h2>

        {queueMode && (
          <div className="mb-6 p-4 bg-amber-50 rounded-lg border border-amber-200">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                <Users className="w-5 h-5 text-amber-600" />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-amber-900 mb-1">预约排队说明</div>
                <div className="text-sm text-amber-700 space-y-1">
                  <p>• 当前所选工具库存为0，您可以登记借用意向加入排队</p>
                  <p>• 工具归还后将按排队顺序自动通知，保留24小时取件时段</p>
                  <p>• 收到通知后请在24小时内确认借用，逾期将自动取消排队资格</p>
                  {waitlistCount !== null && waitlistCount > 0 && (
                    <p className="font-medium">• 当前已有 <b>{waitlistCount}</b> 人在排队等待</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mb-6 p-4 bg-primary-50 rounded-lg border border-primary-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white font-bold">
              {user.name.charAt(0)}
            </div>
            <div className="flex-1">
              <div className="font-semibold text-primary-900">{user.name}</div>
              <div className="text-xs text-primary-600 mt-0.5 flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="flex items-center gap-1">
                  <Hash className="w-3 h-3" />
                  {user.room}
                </span>
                <span className="flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  {user.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')}
                </span>
              </div>
            </div>
            <span className="badge bg-green-100 text-green-800">信息已绑定</span>
          </div>
        </div>

        {creditInfo && (
          <div className={`mb-6 p-4 rounded-lg border ${
            creditInfo.canBorrow
              ? 'bg-green-50 border-green-200'
              : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-start gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                creditInfo.canBorrow ? 'bg-green-100' : 'bg-red-100'
              }`}>
                {creditInfo.canBorrow ? (
                  <CheckCircle className={`w-6 h-6 ${getCreditLevelColor(creditInfo.score).split(' ')[0]}`} />
                ) : (
                  <AlertTriangle className="w-6 h-6 text-red-500" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Star className="w-4 h-4 text-amber-500" />
                  <span className="font-semibold text-gray-900">信用评估</span>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <div className="flex items-center gap-1">
                    <span className="text-gray-500">信用分：</span>
                    <span className={`font-bold ${getCreditLevelColor(creditInfo.score).split(' ')[0]}`}>
                      {creditInfo.score}
                    </span>
                    <span className={`badge px-2 py-0.5 text-xs ${getCreditLevelColor(creditInfo.score)}`}>
                      {creditInfo.level}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-gray-500">可借数量：</span>
                    <span className="font-bold text-primary-700">
                      {creditInfo.maxBorrows}件
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-gray-500">当前借用：</span>
                    <span className="font-medium text-gray-700">
                      {creditInfo.currentBorrows}件
                    </span>
                  </div>
                </div>
                {creditInfo.reason && (
                  <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {creditInfo.reason}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="label">选择工具 *</label>
            <select
              className="input"
              value={form.toolId}
              onChange={e => setForm({ ...form, toolId: Number(e.target.value) })}
            >
              <option value={0}>-- 请选择工具 --</option>
              {tools
                .filter(t => t.status === 'available')
                .filter(t => queueMode ? (t.availableStock ?? t.stock) === 0 : (t.availableStock ?? t.stock) > 0)
                .map(t => {
                  const available = t.availableStock ?? t.stock;
                  const total = t.totalStock ?? (t.stock + (t.borrowedCount ?? 0) + (t.lockedCount ?? 0));
                  const lockedPart = (t.lockedCount ?? 0) > 0 ? `（${t.lockedCount}件已预留）` : '';
                  const borrowedPart = (t.borrowedCount ?? 0) > 0 ? `（${t.borrowedCount}件借出）` : '';
                  return (
                    <option key={t.id} value={t.id}>
                      {t.image} {t.name} - 总{total}{available > 0 ? ` 可借${available}${lockedPart}${borrowedPart}` : ' 已借完（可排队）'} - 押金{formatMoney(t.depositAmount)} - {formatMoney(t.dailyRent)}/天
                    </option>
                  );
                })}
            </select>
            {tools.filter(t => t.status === 'available').some(t => (t.availableStock ?? t.stock) === 0) && (
              <div className="mt-2">
                <button
                  type="button"
                  onClick={() => setQueueMode(!queueMode)}
                  className="text-sm text-amber-600 hover:text-amber-700 flex items-center gap-1"
                >
                  <Clock className="w-3.5 h-3.5" />
                  {queueMode ? '切换到借用模式（有库存工具）' : '查看已借完的工具（可预约排队）'}
                </button>
              </div>
            )}
          </div>

          {selectedTool && (
            <div className="p-4 bg-primary-50 rounded-lg border border-primary-100">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-lg bg-white flex items-center justify-center text-2xl">
                  {selectedTool.image}
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-gray-900">{selectedTool.name}</div>
                  <div className="text-sm text-gray-600 mt-0.5">{selectedTool.description}</div>
                  <div className="flex items-center gap-4 mt-2 text-sm flex-wrap">
                    <span>押金: <b className="text-primary-700">{formatMoney(selectedTool.depositAmount)}</b></span>
                    <span>日租金: <b className="text-accent-700">{formatMoney(selectedTool.dailyRent)}</b></span>
                    <span>
                      可借: <b className={(selectedTool.availableStock ?? selectedTool.stock) === 0 ? 'text-red-600' : 'text-green-600'}>
                        {selectedTool.availableStock ?? selectedTool.stock}
                      </b>
                    </span>
                    <span>
                      总: <b className="text-gray-700">
                        {selectedTool.totalStock ?? (selectedTool.stock + (selectedTool.borrowedCount ?? 0) + (selectedTool.lockedCount ?? 0))}
                      </b>
                    </span>
                    {(selectedTool.borrowedCount ?? 0) > 0 && (
                      <span className="text-xs text-orange-600">
                        借出{selectedTool.borrowedCount}件
                      </span>
                    )}
                    {(selectedTool.lockedCount ?? 0) > 0 && (
                      <span className="text-xs text-blue-600">
                        预留{selectedTool.lockedCount}件
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="text-xs text-gray-500 mb-2 flex items-center gap-1">
              <User className="w-3.5 h-3.5" />
              借用人信息（已从您的账号自动绑定）
            </div>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <div className="text-xs text-gray-400">姓名</div>
                <div className="font-medium text-gray-900">{user.name}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400">房号</div>
                <div className="font-medium text-gray-900">{user.room}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400">手机</div>
                <div className="font-medium text-gray-900">{user.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')}</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">借用日期</label>
              <input
                type="date"
                className="input"
                value={form.borrowDate}
                onChange={e => setForm({ ...form, borrowDate: e.target.value })}
              />
            </div>
            <div>
              <label className="label">预计归还日期</label>
              <input
                type="date"
                className="input"
                value={form.expectedReturnDate}
                onChange={e => setForm({ ...form, expectedReturnDate: e.target.value })}
              />
            </div>
          </div>

          {selectedTool && (
            <div className="p-4 bg-amber-50 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-800">
                <Calculator className="w-4 h-4" />
                <span className="text-sm">借用 {days} 天，预计租金：</span>
              </div>
              <span className="text-xl font-bold text-amber-700">{formatMoney(totalRent)}</span>
            </div>
          )}

          <div className="flex gap-3 pt-4 border-t border-gray-100">
            <button type="submit" disabled={saving} className="btn btn-primary">
              <Save className="w-4 h-4 mr-1.5" />
              {saving ? '提交中...' : (queueMode ? '加入排队' : '提交申请')}
            </button>
            <button type="button" onClick={() => navigate(queueMode ? '/my-waitlist' : '/my-borrows')} className="btn btn-secondary">
              取消
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
