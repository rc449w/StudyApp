import React from 'react';
import { Cpu, Globe, Menu, Plus, WifiOff } from 'lucide-react';
import { LocalAiRuntimeState, NavRoute, OperatingMode } from '../../types/domain';
import { PWAInstallButton } from '../common/PWAInstallButton';

interface TopBarProps {
  activeRoute: NavRoute;
  effectiveMode: OperatingMode;
  manualOfflineMode: boolean;
  isBrowserOnline: boolean;
  backendReachable: boolean | null;
  internetReachable?: boolean | null;
  localAiState: LocalAiRuntimeState;
  onToggleManualOffline: () => void;
  onOpenMobileMenu: () => void;
  onPrimaryAction: () => void;
  primaryActionLabel: string;
}

const ROUTE_TITLES: Record<NavRoute, { section: string; title: string }> = {
  dashboard: { section: 'Workspace', title: 'Student Dashboard' },
  subjects: { section: 'Workspace', title: 'Subject Management' },
  documents: { section: 'Workspace', title: 'Local Documents' },
  topics: { section: 'Workspace', title: 'Topic Library' },
  'study-guides': { section: 'Study & Practice', title: 'Study Guides' },
  research: { section: 'Study & Practice', title: 'Online Research & Offline Notes' },
  'mock-exams': { section: 'Study & Practice', title: 'Mock Examinations' },
  'exam-history': { section: 'Study & Practice', title: 'Examination History' },
  progress: { section: 'Study & Practice', title: 'Learning Progress' },
  settings: { section: 'Configuration', title: 'Settings & Local Storage' },
};

export const TopBar: React.FC<TopBarProps> = ({
  activeRoute,
  effectiveMode,
  manualOfflineMode,
  isBrowserOnline,
  backendReachable,
  internetReachable,
  localAiState,
  onToggleManualOffline,
  onOpenMobileMenu,
  onPrimaryAction,
  primaryActionLabel,
}) => {
  const meta = ROUTE_TITLES[activeRoute];

  const usingLocalAi = localAiState.connected && Boolean(localAiState.activeModel);

  let modeLabel = 'Offline Mode · Local Data Only';
  let modeClasses = 'text-amber-800 bg-amber-50 border-amber-200';
  let ModeIcon = WifiOff;

  if (effectiveMode === 'online') {
    if (usingLocalAi) {
      modeLabel = `Online Mode · Local AI (${localAiState.activeModel})`;
    } else if (backendReachable) {
      modeLabel = 'Online Mode · Search Grounded';
    } else {
      modeLabel = 'Online Mode · Open Web Connected';
    }
    modeClasses = 'text-emerald-800 bg-emerald-50 border-emerald-200';
    ModeIcon = Globe;
  } else if (usingLocalAi) {
    modeLabel = `Offline Mode · Using Local AI (${localAiState.activeModel})`;
    modeClasses = 'text-blue-800 bg-blue-50 border-blue-200';
    ModeIcon = Cpu;
  } else if (!isBrowserOnline) {
    modeLabel = 'Offline Mode · No Network';
  } else if (manualOfflineMode) {
    modeLabel = 'Offline Mode · Manual Lock';
  } else if (backendReachable === false && internetReachable === false) {
    modeLabel = 'Offline Mode · Internet Unreachable';
  }

  return (
    <header className="h-14 px-4 sm:px-6 bg-white border-b border-slate-200 flex items-center justify-between gap-4 sticky top-0 z-20">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="Open navigation menu"
          className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 text-sm min-w-0">
          <span className="hidden sm:inline text-slate-500 whitespace-nowrap">
            {meta.section}
          </span>
          <span className="hidden sm:inline text-slate-300" aria-hidden="true">
            /
          </span>
          <h1 className="font-display font-semibold text-slate-900 truncate">
            {meta.title}
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <div
          data-testid="operating-mode-indicator"
          className={`hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium whitespace-nowrap ${modeClasses}`}
          title={
            usingLocalAi
              ? `Local AI connected: ${localAiState.activeModel}`
              : 'No local AI model connected. Offline mode uses IndexedDB saved materials.'
          }
        >
          <ModeIcon className="w-3.5 h-3.5 shrink-0" />
          <span>{modeLabel}</span>
        </div>

        <button
          type="button"
          onClick={onToggleManualOffline}
          disabled={!isBrowserOnline}
          title={
            !isBrowserOnline
              ? 'Browser network is disconnected — Offline Mode enforced'
              : manualOfflineMode
                ? 'Switch back to Online Mode'
                : 'Force Offline Study Mode (disables external research requests)'
          }
          className="hidden sm:inline-flex items-center px-2.5 py-1.5 border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-slate-700 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer"
        >
          {manualOfflineMode ? 'Enable Online Mode' : 'Study Offline'}
        </button>

        <PWAInstallButton />

        <button
          type="button"
          onClick={onPrimaryAction}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{primaryActionLabel}</span>
        </button>
      </div>
    </header>
  );
};
