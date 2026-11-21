import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  BookMarked,
  BookOpen,
  ClipboardCheck,
  FileText,
  FolderOpen,
  Globe,
  GraduationCap,
  History,
  LayoutDashboard,
  Settings,
  User,
  X,
} from 'lucide-react';
import { NavRoute, StudentProfile } from '../../types/domain';

interface SidebarProps {
  activeRoute: NavRoute;
  onNavigate: (route: NavRoute) => void;
  profile: StudentProfile;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

interface NavGroup {
  label: string;
  items: {
    route: NavRoute;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Workspace',
    items: [
      { route: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { route: 'subjects', label: 'Subjects', icon: BookOpen },
      { route: 'documents', label: 'Documents', icon: FolderOpen },
      { route: 'topics', label: 'Topic Library', icon: BookMarked },
    ],
  },
  {
    label: 'Study & Practice',
    items: [
      { route: 'study-guides', label: 'Study Guides', icon: FileText },
      { route: 'research', label: 'Online Research', icon: Globe },
      { route: 'mock-exams', label: 'Mock Exams', icon: ClipboardCheck },
      { route: 'exam-history', label: 'Exam History', icon: History },
      { route: 'progress', label: 'Learning Progress', icon: BarChart3 },
    ],
  },
  {
    label: 'Configuration',
    items: [{ route: 'settings', label: 'Settings', icon: Settings }],
  },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeRoute,
  onNavigate,
  profile,
  mobileOpen,
  onCloseMobile,
}) => {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [profile.avatarUrl]);

  const trimmedName = profile.fullName.trim();
  const initials = trimmedName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  const handleSelect = (route: NavRoute) => {
    onNavigate(route);
    onCloseMobile();
  };

  const sidebarContent = (
    <aside className="w-64 h-full bg-slate-100 border-r border-slate-200 flex flex-col justify-between select-none">
      <div>
        <div className="h-14 px-5 flex items-center justify-between border-b border-slate-200 bg-white">
          <button
            type="button"
            onClick={() => handleSelect('dashboard')}
            className="flex items-center gap-2.5 text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded-md"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-700 text-white flex items-center justify-center shrink-0">
              <GraduationCap className="w-4 h-4" />
            </div>
            <span className="font-display font-bold text-base tracking-tight text-slate-900 whitespace-nowrap">
              StudyWise AI
            </span>
          </button>

          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Close navigation menu"
            className="lg:hidden p-1.5 text-slate-500 hover:text-slate-900 rounded-md cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav aria-label="Primary navigation" className="p-3 space-y-5">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="px-3 mb-1.5 text-xs font-semibold text-slate-500">
                {group.label}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeRoute === item.route;
                  return (
                    <li key={item.route}>
                      <button
                        type="button"
                        onClick={() => handleSelect(item.route)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                          isActive
                            ? 'bg-white text-blue-700 border border-slate-200 shadow-xs'
                            : 'text-slate-700 hover:bg-slate-200/60 hover:text-slate-900 border border-transparent'
                        }`}
                      >
                        <Icon
                          className={`w-4 h-4 shrink-0 ${
                            isActive ? 'text-blue-700' : 'text-slate-500'
                          }`}
                        />
                        <span className="truncate">{item.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </div>

      <div className="p-3 border-t border-slate-200 bg-white/80">
        <button
          type="button"
          onClick={() => handleSelect('settings')}
          className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-slate-100 transition-colors text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          {!imgError && profile.avatarUrl ? (
            <img
              src={profile.avatarUrl}
              alt={trimmedName || 'Student profile photo'}
              referrerPolicy="no-referrer"
              onError={() => setImgError(true)}
              className="w-9 h-9 rounded-lg object-cover border border-slate-200 shrink-0"
            />
          ) : (
            <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-800 border border-blue-200 flex items-center justify-center text-xs font-bold shrink-0">
              {initials || <User className="w-4 h-4" />}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900 truncate">
              {trimmedName || 'Set Up Your Profile'}
            </p>
            <p className="text-xs text-slate-500 truncate">
              {trimmedName ? (
                <>
                  {profile.gradeLevel}
                  {profile.strand !== 'None' ? ` · ${profile.strand}` : ''}
                </>
              ) : (
                'Tap to add name & photo'
              )}
            </p>
          </div>
        </button>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop persistent sidebar */}
      <div className="hidden lg:block shrink-0 h-screen sticky top-0">{sidebarContent}</div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-50 h-full">{sidebarContent}</div>
        </div>
      )}
    </>
  );
};
