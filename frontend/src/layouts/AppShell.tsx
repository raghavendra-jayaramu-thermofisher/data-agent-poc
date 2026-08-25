import { Button, Dropdown, Label } from '@heroui/react';
import { NavLink, Outlet, useNavigate, useLocation, Link } from 'react-router';
import { useState } from 'react';
import {
  MessageSquarePlus,
  LayoutDashboard,
  Database,
  BrainCircuit,
  Cpu,
  Activity,
  Settings,
  Building2,
  User as UserIcon,
  ChevronDown,
  LogOut,
  SlidersHorizontal,
  Menu,
  Plus,
  Sparkles,
  MessageSquare,
  Clock,
  X,
  Search,
  Shield,
  FileText,
  Wrench,
} from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { useOrganization } from '../organizations/OrganizationProvider';
import { useConversationList } from '../conversations/hooks/useConversations';
import { formatRelativeTime } from '../lib/datetime';
import { JobCenter } from '../jobs/components/JobCenter';

const railNavigationItems = [
  { label: 'Ask', to: '/ask', icon: MessageSquarePlus },
  { label: 'Dashboards', to: '/dashboards', icon: LayoutDashboard },
  { label: 'Data Sources', to: '/data-sources', icon: Database },
  { label: 'Knowledge', to: '/knowledge', icon: BrainCircuit },
  { label: 'Models', to: '/models', icon: Cpu },
  { label: 'Jobs', to: '/jobs', icon: Activity },
  { label: 'Settings', to: '/settings', icon: Settings },
] as const;

export function AppShell() {
  const { user, signOut } = useAuth();
  const { organizations, activeOrganization, setActiveOrganization } = useOrganization();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const conversations = useConversationList();

  const logout = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  const isAskRoute = location.pathname === '/ask' || location.pathname.startsWith('/conversations/');
  const isSettingsRoute = location.pathname.startsWith('/settings');
  const hasSecondarySidebar = isAskRoute || isSettingsRoute;

  const rawList = conversations.data ?? [];
  const recentList = rawList.filter((c) =>
    (c.title ?? '').toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div
      className="app-shell"
      data-has-secondary-sidebar={hasSecondarySidebar ? 'true' : 'false'}
    >
      {/* 48px Aubergine Topbar */}
      <header className="topbar">
        <div className="topbar-left">
          <button
            className="topbar-btn mobile-only-menu"
            type="button"
            aria-label="Open navigation"
            onClick={() => setMobileOpen(true)}
          >
            <Menu size={18} />
          </button>

          <button
            className="brand brand-button"
            type="button"
            aria-label="Go to Ask"
            onClick={() => navigate('/ask')}
          >
            <span className="brand-mark">
              <Sparkles size={15} />
            </span>
            <span className="desktop-brand-text font-semibold tracking-tight text-sm">
              DB Assistant
            </span>
          </button>

          <span className="topbar-divider" />

          <Dropdown>
            <Button variant="ghost" size="sm" className="topbar-btn">
              <Building2 size={14} />
              <span className="text-xs font-medium">{activeOrganization?.name ?? 'Workspace'}</span>
              <ChevronDown size={11} className="opacity-70" />
            </Button>
            <Dropdown.Popover>
              <Dropdown.Menu
                aria-label="Switch organization"
                onAction={(key) => setActiveOrganization(String(key))}
              >
                {organizations.map((organization) => (
                  <Dropdown.Item key={organization.id} id={organization.id} textValue={organization.name}>
                    <Label>{organization.name}</Label>
                  </Dropdown.Item>
                ))}
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
        </div>

        <div className="topbar-actions">
          <JobCenter />

          <Dropdown>
            <Button variant="ghost" size="sm" className="topbar-btn" aria-label="User menu">
              <UserIcon size={14} />
              <span className="max-w-[140px] truncate text-xs font-medium">
                {user?.display_name || user?.email || 'Account'}
              </span>
              <ChevronDown size={11} className="opacity-70" />
            </Button>
            <Dropdown.Popover>
              <Dropdown.Menu
                aria-label="User actions"
                onAction={(key) => {
                  if (key === 'settings') navigate('/settings');
                  if (key === 'logout') void logout();
                }}
              >
                <Dropdown.Item id="settings" textValue="Settings">
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal size={14} />
                    <Label>Settings</Label>
                  </div>
                </Dropdown.Item>
                <Dropdown.Item id="logout" textValue="Sign out">
                  <div className="flex items-center gap-2 text-danger">
                    <LogOut size={14} />
                    <Label>Sign out</Label>
                  </div>
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
        </div>
      </header>

      {/* Primary 64px Icon Rail Sidebar */}
      <aside className="primary-rail-sidebar">
        <button
          type="button"
          className="rail-new-btn"
          onClick={() => navigate('/ask')}
          title="New Analysis"
        >
          <Plus size={18} />
        </button>

        <nav className="rail-nav" aria-label="Primary navigation">
          {railNavigationItems.map(({ label, to, icon: Icon }) => {
            const isActive =
              to === '/ask'
                ? location.pathname === '/ask' || location.pathname.startsWith('/conversations/')
                : location.pathname.startsWith(to);

            return (
              <NavLink
                key={to}
                to={to}
                className={`rail-link ${isActive ? 'active' : ''}`}
                title={label}
              >
                <Icon size={19} />
                <span className="rail-link-label">{label}</span>
              </NavLink>
            );
          })}
        </nav>
      </aside>

      {/* Secondary Sidebar (Context-Driven) */}
      {hasSecondarySidebar && (
        <aside className="secondary-sidebar">
          {/* Ask & Chat: Recent Analyses View */}
          {isAskRoute && (
            <div className="secondary-sidebar-content">
              <div className="secondary-sidebar-header">
                <div className="flex items-center justify-between w-full">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#625C64]">
                    Recent Analyses
                  </span>
                  <span className="text-[11px] px-1.5 py-0.5 bg-[#EAE7E1] text-[#625C64] rounded-full font-semibold">
                    {rawList.length}
                  </span>
                </div>
              </div>

              <div className="p-2 border-b border-[#DAD5CD]">
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-2 text-[#8B848C]" />
                  <input
                    type="text"
                    placeholder="Search history…"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="w-full h-8 pl-8 pr-2.5 bg-[#FFFDFC] border border-[#DAD5CD] rounded text-xs text-[#252127] placeholder:text-[#8B848C] outline-none focus:border-[#9A4D86]"
                  />
                </div>
              </div>

              <div className="secondary-sidebar-scroll">
                {recentList.map((conv) => {
                  const isActive = location.pathname === `/conversations/${conv.id}`;
                  return (
                    <Link
                      key={conv.id}
                      to={`/conversations/${conv.id}`}
                      className={`secondary-chat-item ${isActive ? 'active' : ''}`}
                      title={conv.title || 'Untitled analysis'}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <MessageSquare
                          size={14}
                          className={isActive ? 'text-[#4B123F] shrink-0' : 'text-[#8B848C] shrink-0'}
                        />
                        <span className="text-[13px] truncate font-medium text-[#252127]">
                          {conv.title?.trim() || 'Untitled analysis'}
                        </span>
                      </div>
                      <span className="text-[11px] text-[#8B848C] pl-5">
                        {formatRelativeTime(conv.updated_at)}
                      </span>
                    </Link>
                  );
                })}

                {recentList.length === 0 && (
                  <p className="text-xs text-[#8B848C] text-center py-8">
                    {searchFilter ? 'No matching chats' : 'No analyses yet'}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Settings Route: Secondary Navigation */}
          {isSettingsRoute && (
            <div className="secondary-sidebar-content">
              <div className="secondary-sidebar-header">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#625C64]">
                  Settings & Governance
                </span>
              </div>

              <nav className="p-2 space-y-1">
                <NavLink
                  to="/settings/organization"
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 px-3 py-2 rounded text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-[#F4E8F0] text-[#4B123F] font-semibold'
                        : 'text-[#252127] hover:bg-[#EAE7E1]'
                    }`
                  }
                >
                  <Building2 size={15} />
                  <span>Organization Profile</span>
                </NavLink>

                <NavLink
                  to="/settings/audit"
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 px-3 py-2 rounded text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-[#F4E8F0] text-[#4B123F] font-semibold'
                        : 'text-[#252127] hover:bg-[#EAE7E1]'
                    }`
                  }
                >
                  <FileText size={15} />
                  <span>Audit Logs</span>
                </NavLink>

                <NavLink
                  to="/settings/operations"
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 px-3 py-2 rounded text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-[#F4E8F0] text-[#4B123F] font-semibold'
                        : 'text-[#252127] hover:bg-[#EAE7E1]'
                    }`
                  }
                >
                  <Wrench size={15} />
                  <span>Operations Diagnostics</span>
                </NavLink>
              </nav>
            </div>
          )}
        </aside>
      )}

      {/* Main Content Area */}
      <main className="main-content">
        <Outlet />
      </main>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="fixed inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="relative w-72 max-w-[85vw] bg-[#F0EEE9] h-full flex flex-col p-4 z-10 shadow-xl border-r border-[#DAD5CD]">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#DAD5CD]">
              <span className="font-semibold text-sm text-[#4B123F] flex items-center gap-1.5">
                <Sparkles size={15} /> DB Assistant
              </span>
              <button
                type="button"
                className="p-1 rounded hover:bg-[#EAE7E1] text-[#252127]"
                onClick={() => setMobileOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <nav className="space-y-1 mb-4">
              {railNavigationItems.map(({ label, to, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-3 py-2 rounded text-xs font-medium ${
                      isActive ? 'bg-[#F4E8F0] text-[#4B123F]' : 'text-[#252127]'
                    }`
                  }
                >
                  <Icon size={16} />
                  <span>{label}</span>
                </NavLink>
              ))}
            </nav>

            {isAskRoute && (
              <div className="flex-1 overflow-y-auto pt-2 border-t border-[#DAD5CD]">
                <span className="text-[11px] font-semibold text-[#625C64] uppercase tracking-wider block px-1 mb-2">
                  Recent Chats
                </span>
                <div className="space-y-1">
                  {recentList.map((conv) => (
                    <Link
                      key={conv.id}
                      to={`/conversations/${conv.id}`}
                      onClick={() => setMobileOpen(false)}
                      className="block p-2 rounded text-xs text-[#252127] hover:bg-[#EAE7E1] truncate"
                    >
                      {conv.title?.trim() || 'Untitled analysis'}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
