import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { Tool } from '@shared/types';
import { ArrowLeft, Save } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

const emojiOptions = ['🔌', '🪜', '🔧', '🛒', '🎈', '📏', '🧵', '🩹', '🔨', '🪛', '🧰', '🔩', '⚒️', '🛠️', '🪚', '🔦'];
const categoryOptions = ['电动工具', '登高工具', '手动工具', '搬运工具', '五金工具', '测量工具', '生活工具', '医疗用品', '其他'];

export default function ToolForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [form, setForm] = useState<Partial<Tool>>({
    name: '',
    category: '电动工具',
    image: '🛠️',
    description: '',
    depositAmount: 0,
    dailyRent: 0,
    stock: 1,
    status: 'available',
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isEdit && id) {
      setLoading(true);
      api.tools.get(Number(id)).then(data => {
        setForm(data);
        setLoading(false);
      }).catch(e => {
        alert((e as Error).message);
        setLoading(false);
      });
    }
  }, [id, isEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name?.trim()) {
      alert('请输入工具名称');
      return;
    }
    setSaving(true);
    try {
      if (isEdit && id) {
        await api.tools.update(Number(id), form);
      } else {
        await api.tools.create(form);
      }
      navigate('/tools');
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-gray-500">加载中...</div>;

  return (
    <div className="max-w-2xl">
      <button onClick={() => navigate('/tools')} className="btn btn-secondary mb-5">
        <ArrowLeft className="w-4 h-4 mr-1.5" />
        返回列表
      </button>

      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">
          {isEdit ? '编辑工具' : '新增工具'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="label">工具名称 *</label>
            <input
              type="text"
              className="input"
              value={form.name || ''}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="请输入工具名称"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">分类</label>
              <select
                className="input"
                value={form.category || ''}
                onChange={e => setForm({ ...form, category: e.target.value })}
              >
                {categoryOptions.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">状态</label>
              <select
                className="input"
                value={form.status || 'available'}
                onChange={e => setForm({ ...form, status: e.target.value as Tool['status'] })}
              >
                <option value="available">可借用</option>
                <option value="maintenance">维护中</option>
                <option value="retired">已停用</option>
              </select>
            </div>
          </div>

          <div>
            <label className="label">图标</label>
            <div className="flex flex-wrap gap-2">
              {emojiOptions.map(emoji => (
                <button
                  type="button"
                  key={emoji}
                  onClick={() => setForm({ ...form, image: emoji })}
                  className={`w-10 h-10 rounded-lg text-xl flex items-center justify-center transition-all ${
                    form.image === emoji
                      ? 'bg-primary-100 ring-2 ring-primary-500'
                      : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">描述</label>
            <textarea
              className="input min-h-[80px] resize-y"
              value={form.description || ''}
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="请输入工具使用说明等描述信息"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">押金金额 (元)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="input"
                value={form.depositAmount ?? 0}
                onChange={e => setForm({ ...form, depositAmount: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="label">日租金 (元)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="input"
                value={form.dailyRent ?? 0}
                onChange={e => setForm({ ...form, dailyRent: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="label">库存数量</label>
              <input
                type="number"
                min="0"
                className="input"
                value={form.stock ?? 1}
                onChange={e => setForm({ ...form, stock: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-100">
            <button type="submit" disabled={saving} className="btn btn-primary">
              <Save className="w-4 h-4 mr-1.5" />
              {saving ? '保存中...' : (isEdit ? '保存修改' : '确认新增')}
            </button>
            <button type="button" onClick={() => navigate('/tools')} className="btn btn-secondary">
              取消
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
