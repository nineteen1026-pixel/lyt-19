import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import type { Tool } from '@shared/types';
import { ArrowLeft, Save, Calculator } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatMoney } from '@/lib/format';

export default function BorrowForm() {
  const navigate = useNavigate();
  const [tools, setTools] = useState<Tool[]>([]);
  const [form, setForm] = useState({
    toolId: 0,
    borrowerName: '',
    borrowerRoom: '',
    borrowerPhone: '',
    borrowDate: new Date().toISOString().slice(0, 10),
    expectedReturnDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.tools.list().then(setTools);
  }, []);

  const selectedTool = useMemo(() => tools.find(t => t.id === form.toolId), [tools, form.toolId]);

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
    if (!form.borrowerName.trim() || !form.borrowerRoom.trim() || !form.borrowerPhone.trim()) {
      alert('请填写完整借用人信息');
      return;
    }
    setSaving(true);
    try {
      await api.borrows.create(form);
      navigate('/borrows');
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <button onClick={() => navigate('/borrows')} className="btn btn-secondary mb-5">
        <ArrowLeft className="w-4 h-4 mr-1.5" />
        返回列表
      </button>

      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">新建借用申请</h2>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="label">选择工具 *</label>
            <select
              className="input"
              value={form.toolId}
              onChange={e => setForm({ ...form, toolId: Number(e.target.value) })}
            >
              <option value={0}>-- 请选择工具 --</option>
              {tools.filter(t => t.stock > 0 && t.status === 'available').map(t => (
                <option key={t.id} value={t.id}>
                  {t.image} {t.name} - 库存{t.stock} - 押金{formatMoney(t.depositAmount)} - {formatMoney(t.dailyRent)}/天
                </option>
              ))}
            </select>
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
                  <div className="flex items-center gap-4 mt-2 text-sm">
                    <span>押金: <b className="text-primary-700">{formatMoney(selectedTool.depositAmount)}</b></span>
                    <span>日租金: <b className="text-accent-700">{formatMoney(selectedTool.dailyRent)}</b></span>
                    <span>库存: <b>{selectedTool.stock}</b></span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">借用人姓名 *</label>
              <input
                type="text"
                className="input"
                value={form.borrowerName}
                onChange={e => setForm({ ...form, borrowerName: e.target.value })}
                placeholder="请输入姓名"
              />
            </div>
            <div>
              <label className="label">房号 *</label>
              <input
                type="text"
                className="input"
                value={form.borrowerRoom}
                onChange={e => setForm({ ...form, borrowerRoom: e.target.value })}
                placeholder="例如：3栋2单元501"
              />
            </div>
          </div>

          <div>
            <label className="label">联系电话 *</label>
            <input
              type="tel"
              className="input"
              value={form.borrowerPhone}
              onChange={e => setForm({ ...form, borrowerPhone: e.target.value })}
              placeholder="请输入手机号"
            />
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
              {saving ? '提交中...' : '提交申请'}
            </button>
            <button type="button" onClick={() => navigate('/borrows')} className="btn btn-secondary">
              取消
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
