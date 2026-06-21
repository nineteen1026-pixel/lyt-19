import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { Tool } from '@shared/types';
import { toolStatusMap, formatMoney } from '@/lib/format';
import { Plus, Search, Pencil, Trash2, Edit3 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export default function ToolList() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const loadData = () => {
    setLoading(true);
    Promise.all([
      api.tools.list({ category, keyword: keyword || undefined }),
      api.tools.categories(),
    ]).then(([toolList, cats]) => {
      setTools(toolList);
      setCategories(cats);
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

              <div className="grid grid-cols-3 gap-2 text-center text-sm mb-4 py-3 bg-gray-50 rounded-lg">
                <div>
                  <div className="text-xs text-gray-500">库存</div>
                  <div className="font-semibold text-gray-900 mt-0.5">{tool.stock}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">押金</div>
                  <div className="font-semibold text-primary-700 mt-0.5">{formatMoney(tool.depositAmount)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">日租金</div>
                  <div className="font-semibold text-accent-700 mt-0.5">{formatMoney(tool.dailyRent)}</div>
                </div>
              </div>

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
