import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Library, LineChart, Lightbulb, Activity, LogOut } from 'lucide-react';
import clsx from 'clsx';
import browser from 'webextension-polyfill';

interface DashboardLayoutProps {
  children: React.ReactNode;
  onLogout?: () => void;
}

const NAV_ITEMS = [
  { path: '/', label: 'Overview', icon: LayoutDashboard },
  { path: '/topics', label: 'Topics', icon: Library },
  { path: '/analytics', label: 'Analytics', icon: LineChart },
  { path: '/recommendations', label: 'Tips', icon: Lightbulb },
  { path: '/sync', label: 'Status', icon: Activity },
];

export default function DashboardLayout({ children, onLogout }: DashboardLayoutProps) {

  async function handleLogout() {
    if (typeof browser !== 'undefined') {
      await browser.runtime.sendMessage({ type: 'LOGOUT' });
    }
    onLogout?.();
  }
  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 font-sans">
      {/* Sidebar Navigation */}
      <aside className="w-16 border-r border-slate-800 bg-slate-900/50 flex flex-col items-center py-6 gap-6 shrink-0">
        <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center mb-4">
          <svg className="w-5 h-5 text-indigo-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" />
          </svg>
        </div>
        
        <nav className="flex flex-col gap-4">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              title={item.label}
              className={({ isActive }) =>
                clsx(
                  'p-2.5 rounded-xl transition-all duration-200',
                  isActive 
                    ? 'bg-indigo-500/20 text-indigo-400' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                )
              }
            >
              <item.icon className="w-5 h-5" />
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto">
          <button
            onClick={handleLogout}
            title="Sign out"
            className="p-2.5 rounded-xl transition-all duration-200 text-slate-500 hover:text-red-400 hover:bg-slate-800"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden relative">
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
