import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Wrench,
  ArrowLeftRight,
  Wallet,
  AlertTriangle,
  Home,
  User,
  LogIn,
  LogOut,
  Package,
  Users,
  Settings,
  ChevronDown,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth';

const navItems = [
  { path: '/', label: '仪表盘', icon: LayoutDashboard },
  { path: '/tools', label: '工具管理', icon: Wrench },
  { path: '/borrows', label: '借还管理', icon: ArrowLeftRight },
  { path: '/deposits', label: '押金管理', icon: Wallet },
  { path: '/damages', label: '损耗管理', icon: AlertTriangle },
];

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, initialized, logout, initAuth } = useAuthStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const handleLogin = () => {
    navigate('/login', { state: { from: location.pathname } });
  };

  const handleLogout = async () => {
    await logout();
    setMenuOpen(false);
    navigate('/');
  };

  if (!initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

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
          {user && (
            <>
              <NavLink
                to="/my-borrows"
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  location.pathname === '/my-borrows'
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Package className="w-4.5 h-4.5" />
                我的借用
              </NavLink>
              <NavLink
                to="/my-waitlist"
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  location.pathname === '/my-waitlist'
                    ? 'bg-amber-50 text-amber-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Users className="w-4.5 h-4.5" />
                我的排队
              </NavLink>
            </>
          )}
        </nav>

        <div className="p-4 border-t border-gray-100">
          {user ? (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(o => !o)}
                className="w-full flex items-center gap-3 hover:bg-gray-50 rounded-lg p-2 -m-2 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                  {user.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="text-sm font-medium text-gray-900 truncate">{user.name}</div>
                  <div className="text-xs text-gray-500 truncate">{user.room}</div>
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
              </button>

              {menuOpen && (
                <div className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 z-10">
                  <button
                    onClick={() => { setMenuOpen(false); navigate('/my-borrows'); }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <Package className="w-4 h-4" />
                    我的借用记录
                  </button>
                  <button
                    onClick={() => { setMenuOpen(false); navigate('/my-waitlist'); }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <Users className="w-4 h-4" />
                    我的排队记录
                  </button>
                  <button
                    onClick={() => { setMenuOpen(false); navigate('/my-borrows'); }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <Settings className="w-4 h-4" />
                    个人资料设置
                  </button>
                  <div className="h-px bg-gray-100 my-1" />
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    <LogOut className="w-4 h-4" />
                    退出登录
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={handleLogin}
              className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-gray-50 transition-colors -m-2"
            >
              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 flex-shrink-0">
                <User className="w-4 h-4" />
              </div>
              <div className="flex-1 text-left">
                <div className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
                  <LogIn className="w-4 h-4" />
                  登录账号
                </div>
                <div className="text-xs text-gray-500">查看我的借用记录</div>
              </div>
            </button>
          )}
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center px-8 justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">
              {location.pathname === '/my-borrows'
                ? '我的借用'
                : location.pathname === '/my-waitlist'
                ? '我的排队'
                : navItems.find(n => location.pathname === n.path || (n.path !== '/' && location.pathname.startsWith(n.path)))?.label || '仪表盘'}
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
