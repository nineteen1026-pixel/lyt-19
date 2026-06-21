import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Wrench,
  ArrowLeftRight,
  Wallet,
  AlertTriangle,
  Home,
} from 'lucide-react';

const navItems = [
  { path: '/', label: '仪表盘', icon: LayoutDashboard },
  { path: '/tools', label: '工具管理', icon: Wrench },
  { path: '/borrows', label: '借还管理', icon: ArrowLeftRight },
  { path: '/deposits', label: '押金管理', icon: Wallet },
  { path: '/damages', label: '损耗管理', icon: AlertTriangle },
];

export default function Layout() {
  const location = useLocation();

  return (
    <div className="min-h-screen flex bg-gray-50">
      <aside className="w-60 bg-white border-r border-gray-200 flex flex-col">
        <div className="h-16 flex items-center gap-2 px-6 border-b border-gray-100">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
            <Home className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-bold text-gray-900 text-sm">小区工具借还站</div>
            <div className="text-xs text-gray-500">邻里共享 · 便捷生活</div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(({ path, label, icon: Icon }) => {
            const isActive = location.pathname === path || (path !== '/' && location.pathname.startsWith(path));
            return (
              <NavLink
                key={path}
                to={path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Icon className="w-4.5 h-4.5" />
                {label}
              </NavLink>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-sm font-bold">
              管
            </div>
            <div>
              <div className="text-sm font-medium text-gray-900">管理员</div>
              <div className="text-xs text-gray-500">admin@community</div>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center px-8 justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">
              {navItems.find(n => location.pathname === n.path || (n.path !== '/' && location.pathname.startsWith(n.path)))?.label || '仪表盘'}
            </h1>
          </div>
          <div className="text-sm text-gray-500">
            {new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
          </div>
        </header>

        <div className="flex-1 overflow-auto p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
