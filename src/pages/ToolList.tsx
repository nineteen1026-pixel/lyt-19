import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { Tool } from '@shared/types';
import { toolStatusMap, formatMoney } from '@/lib/format';
import { Plus, Search, Pencil, Trash2, Users } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export default function ToolList() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [waitlistCounts, setWaitlistCounts] = useState<Record<number, number>>({});
  const navigate = useNavigate();

  const loadData = () => {
    setLoading(true);
    Promise.all([
      api.tools.list({ category, keyword: keyword || undefined }),
      api.tools.categories(),
    ]).then(([toolList, cats]) => {
      setTools(toolList);
      setCategories(cats);

      const countPromises = toolList
        .filter(t => (t.availableStock ?? t.stock) === 0 && t.status === 'available')
        .map(t => api.waitlist.getToolCount(t.id).then(data => ({ toolId: t.id, count: data.count })));

      return Promise.all(countPromises);
    }).then(counts => {
      const countMap: Record<number, number> = {};
      counts.forEach(c => { countMap[c.toolId] = c.count; });
      setWaitlistCounts(countMap);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [category, keyword]);

  const handleDelete = async (id: number, name: string) => {
    if (!window.confirm(`确定删除工具"${name}"吗？`)) return;
    try {
      await api.tools.remove(id);
      loadData();
    } catch (e) {
      alert((e as Error).message);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <div className="flex flex-col sm:flex-row gap-3 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="搜索工具名称或描述..."
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              className="input pl-9"
            />
          </div>
          <select value={category} onChange={e => setCategory(e.target.value)} className="input max-w-xs">
            <option value="all">全部分类</option>
            {categories.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <Link to="/tools/new" className="btn btn-primary">
          <Plus className="w-4 h-4 mr-1.5" />
          新增工具
        </Link>
      </div>

      {loading ? (
        <div className="text-gray-500 py-10 text-center">加载中...</div>
      ) : tools.length === 0 ? (
        <div className="card p-16 text-center text-gray-400">暂无工具数据</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {tools.map(tool => (
            <div key={tool.id} className="card p-5 flex flex-col">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-16 h-16 rounded-xl bg-primary-50 flex items-center justify-center text-3xl shrink-0">
                  {tool.image || '🛠️'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900 truncate">{tool.name}</h3>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">{tool.category}</div>
                  <span className={`badge ${toolStatusMap[tool.status].className} mt-2`}>
                    {toolStatusMap[tool.status].label}
                  </span>
                </div>
              </div>

              <p className="text-sm text-gray-600 mb-4 line-clamp-2 min-h-[40px]">
                {tool.description || '暂无描述'}
              </p>

              <div className="mb-4 py-3 px-3 bg-gray-50 rounded-lg">
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div className="text-center">
                    <div className="text-xs text-gray-500">可借</div>
                    <div className={`font-semibold mt-0.5 text-lg ${(tool.availableStock ?? tool.stock) === 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {tool.availableStock ?? tool.stock}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-500">总库存</div>
                    <div className="font-semibold mt-0.5 text-lg text-gray-700">
                      {tool.totalStock ?? (tool.stock + (tool.borrowedCount ?? 0) + (tool.lockedCount ?? 0))}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-600 border-t border-gray-200 pt-2">
                  <span>
                    借用中: <b className="text-orange-600">{tool.borrowedCount ?? 0}</b>
                  </span>
                  <span>
                    已预留: <b className="text-blue-600">{tool.lockedCount ?? 0}</b>
                  </span>
                </div>
                {(tool.availableStock ?? tool.stock) === 0 && waitlistCounts[tool.id] !== undefined && waitlistCounts[tool.id] > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-200 text-center">
                    <span className="text-xs text-amber-600">
                      <Users className="w-3 h-3 inline mr-0.5" />
                      {waitlistCounts[tool.id]} 人排队等待
                    </span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 text-center text-sm mb-4">
                <div className="py-2 bg-primary-50 rounded-lg">
                  <div className="text-xs text-gray-500">押金</div>
                  <div className="font-semibold text-primary-700 mt-0.5">{formatMoney(tool.depositAmount)}</div>
                </div>
                <div className="py-2 bg-accent-50 rounded-lg">
                  <div className="text-xs text-gray-500">日租金</div>
                  <div className="font-semibold text-accent-700 mt-0.5">{formatMoney(tool.dailyRent)}</div>
                </div>
              </div>

              {(tool.availableStock ?? tool.stock) === 0 && tool.status === 'available' && (
                <button
                  onClick={() => navigate(`/borrows/new?toolId=${tool.id}&queue=1`)}
                  className="w-full mb-3 py-2 px-3 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg text-sm text-amber-800 font-medium transition-colors"
                >
                  <Users className="w-3.5 h-3.5 inline mr-1.5" />
                  加入预约排队
                  {waitlistCounts[tool.id] > 0 && ` (${waitlistCounts[tool.id]}人等待)`}
                </button>
              )}
              {(tool.availableStock ?? tool.stock) > 0 && (tool.lockedCount ?? 0) > 0 && tool.status === 'available' && (
                <div className="w-full mb-3 py-2 px-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700 text-center">
                  <Users className="w-3 h-3 inline mr-1" />
                  {tool.lockedCount} 件已为排队用户预留，{tool.availableStock} 件可直接借用
                </div>
              )}

              <div className="flex gap-2 mt-auto pt-3 border-t border-gray-100">
                <button
                  onClick={() => navigate(`/tools/${tool.id}/edit`)}
                  className="btn btn-secondary btn-sm flex-1"
                >
                  <Pencil className="w-3.5 h-3.5 mr-1" />
                  编辑
                </button>
                <button
                  onClick={() => handleDelete(tool.id, tool.name)}
                  className="btn btn-sm flex-1 text-red-600 hover:bg-red-50 border border-red-200"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
