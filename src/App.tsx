import { useCallback, useEffect, useState } from 'react';
import { StartupScreen } from './components/common/StartupScreen';
import { Sidebar } from './components/layout/Sidebar';
import { TopBar } from './components/layout/TopBar';
import { DashboardPage } from './pages/DashboardPage';
import { DocumentsPage } from './pages/DocumentsPage';
import { ExamHistoryPage } from './pages/ExamHistoryPage';
import { MockExamsPage } from './pages/MockExamsPage';
import { ProgressPage } from './pages/ProgressPage';
import { ResearchPage } from './pages/ResearchPage';
import { SettingsPage } from './pages/SettingsPage';
import { StudyGuidesPage } from './pages/StudyGuidesPage';
import { SubjectsPage } from './pages/SubjectsPage';
import { TopicsPage } from './pages/TopicsPage';
import { localAiClient } from './services/ai/localAiClient';
import { onlineAiClient } from './services/ai/onlineAiClient';
import { desktopBridge } from './services/desktop/desktopBridge';
import { StudyWiseBackupBundle } from './services/storage/backupService';
import { studyStore } from './services/storage/studyStore';
import {
  DocumentExtractionContent,
  ExamAttempt,
  LocalAiConfig,
  LocalAiRuntimeState,
  LocalDocument,
  MockExam,
  NavRoute,
  OnlineAiStatus,
  OperatingMode,
  ResearchNote,
  StudentProfile,
  StudyGuide,
  Subject,
  Topic,
  WorkspaceSnapshot,
} from './types/domain';

export default function App() {
  const [activeRoute, setActiveRoute] = useState<NavRoute>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [workspace, setWorkspace] = useState<WorkspaceSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [isBrowserOnline, setIsBrowserOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [manualOfflineMode, setManualOfflineMode] = useState(false);
  const [backendReachable, setBackendReachable] = useState<boolean | null>(null);
  const [internetReachable, setInternetReachable] = useState<boolean | null>(null);
  const [aiStatus, setAiStatus] = useState<OnlineAiStatus | null>(null);
  const [localAiState, setLocalAiState] = useState<LocalAiRuntimeState>({
    status: 'disabled',
    connected: false,
    activeModel: null,
    availableModels: [],
    lastCheckedAt: null,
    message: 'Local AI runtime is disabled.',
  });

  // Contextual sub-states for seamless navigation
  const [subjectComposerOpen, setSubjectComposerOpen] = useState(false);
  const [activeExamId, setActiveExamId] = useState<string | null>(null);

  const effectiveMode: OperatingMode =
    !isBrowserOnline ||
    manualOfflineMode ||
    (backendReachable === false && internetReachable === false)
      ? 'offline'
      : 'online';

  const refreshWorkspace = useCallback(async () => {
    const snapshot = await studyStore.loadWorkspace();
    setWorkspace(snapshot);
    return snapshot;
  }, []);

  const refreshLocalAiState = useCallback(async (config: LocalAiConfig) => {
    const state = await localAiClient.checkConnection(config);
    setLocalAiState(state);
    return state;
  }, []);

  const refreshOnlineStatus = useCallback(async () => {
    const [connectivity, status] = await Promise.all([
      onlineAiClient.checkInternetConnectivity(),
      onlineAiClient.getAiServiceStatus(),
    ]);
    setBackendReachable(connectivity.backendReachable);
    setInternetReachable(connectivity.internetReachable);
    setAiStatus(status);
  }, []);

  useEffect(() => {
    let mounted = true;
    const bootStartedAt = Date.now();

    async function init() {
      try {
        const snapshot = await studyStore.loadWorkspace();
        const elapsed = Date.now() - bootStartedAt;
        if (elapsed < 450) {
          await new Promise((resolve) => window.setTimeout(resolve, 450 - elapsed));
        }
        if (mounted) {
          setWorkspace(snapshot);
          setLoading(false);
          void desktopBridge.notifyAppReady();
          void refreshLocalAiState(snapshot.localAiConfig);
        }
      } catch (err: unknown) {
        if (mounted) {
          setLoadError(
            err instanceof Error ? err.message : 'Unable to initialize local student database.'
          );
          setLoading(false);
          void desktopBridge.notifyAppReady();
        }
      }
      void refreshOnlineStatus();
    }

    void init();

    const handleOnline = () => {
      setIsBrowserOnline(true);
      void refreshOnlineStatus();
    };
    const handleOffline = () => {
      setIsBrowserOnline(false);
      setBackendReachable(false);
      setInternetReachable(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      mounted = false;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [refreshLocalAiState, refreshOnlineStatus]);

  const handleNavigate = (route: NavRoute) => {
    setActiveRoute(route);
    if (route !== 'mock-exams') {
      setActiveExamId(null);
    }
    if (route !== 'subjects') {
      setSubjectComposerOpen(false);
    }
  };

  const handleTopBarPrimaryAction = () => {
    if (activeRoute === 'subjects') {
      setSubjectComposerOpen(true);
      return;
    }
    if (activeRoute === 'documents') {
      setActiveRoute('subjects');
      setSubjectComposerOpen(true);
      return;
    }
    setActiveRoute('documents');
  };

  const topBarActionLabel =
    activeRoute === 'subjects'
      ? 'New Subject'
      : activeRoute === 'documents'
        ? 'New Subject'
        : 'Add Document';

  if (loading) {
    const isDesktop = desktopBridge.isTauri();
    return (
      <StartupScreen
        databaseReady={Boolean(workspace)}
        runtimeLabel={isDesktop ? 'Tauri Windows Desktop' : 'Local-First Web Workspace'}
        databaseLabel={
          isDesktop
            ? 'Opening Local SQLite Database (studywise_ai.db)'
            : 'Opening Local IndexedDB Storage'
        }
      />
    );
  }

  if (loadError || !workspace) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white border border-red-200 rounded-xl p-8 max-w-md w-full space-y-3">
          <h1 className="font-display text-lg font-bold text-slate-900">
            Local Storage Initialization Error
          </h1>
          <p className="text-sm text-slate-600">
            {loadError ?? 'IndexedDB could not be opened in this browser context.'}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-700 text-white text-sm font-semibold rounded-lg cursor-pointer"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      <Sidebar
        activeRoute={activeRoute}
        onNavigate={handleNavigate}
        profile={workspace.profile}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar
          activeRoute={activeRoute}
          effectiveMode={effectiveMode}
          manualOfflineMode={manualOfflineMode}
          isBrowserOnline={isBrowserOnline}
          backendReachable={backendReachable}
          internetReachable={internetReachable}
          localAiState={localAiState}
          onToggleManualOffline={() => setManualOfflineMode((prev) => !prev)}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onPrimaryAction={handleTopBarPrimaryAction}
          primaryActionLabel={topBarActionLabel}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {activeRoute === 'dashboard' && (
            <DashboardPage
              workspace={workspace}
              aiStatus={aiStatus}
              effectiveMode={effectiveMode}
              localAiState={localAiState}
              onNavigate={handleNavigate}
              onOpenExam={(examId) => {
                setActiveExamId(examId);
                setActiveRoute('mock-exams');
              }}
            />
          )}

          {activeRoute === 'subjects' && (
            <SubjectsPage
              workspace={workspace}
              composerOpen={subjectComposerOpen}
              onSetComposerOpen={setSubjectComposerOpen}
              onSaveSubject={async (subject: Subject) => {
                await studyStore.saveSubject(subject);
                await refreshWorkspace();
              }}
              onDeleteSubject={async (id: string) => {
                await studyStore.deleteSubject(id);
                await refreshWorkspace();
              }}
            />
          )}

          {activeRoute === 'documents' && (
            <DocumentsPage
              workspace={workspace}
              onSaveDocumentAndContent={async (
                doc: LocalDocument,
                content: DocumentExtractionContent
              ) => {
                await studyStore.saveDocumentAndContent(doc, content);
                await refreshWorkspace();
              }}
              onUpdateDocumentContent={async (
                doc: LocalDocument,
                content: DocumentExtractionContent
              ) => {
                await studyStore.saveDocument(doc);
                await studyStore.saveDocumentContent(content);
                await refreshWorkspace();
              }}
              onConfirmInventoryToTopics={async (params) => {
                await studyStore.confirmDocumentInventoryToTopics(params);
                await refreshWorkspace();
              }}
              onDeleteDocument={async (id: string) => {
                await studyStore.deleteDocument(id);
                await refreshWorkspace();
              }}
              onGoToSettings={() => handleNavigate('settings')}
            />
          )}

          {activeRoute === 'topics' && (
            <TopicsPage
              workspace={workspace}
              effectiveMode={effectiveMode}
              onSaveTopic={async (topic: Topic) => {
                await studyStore.saveTopic(topic);
                await refreshWorkspace();
              }}
              onSaveTopics={async (topics: Topic[]) => {
                for (const t of topics) {
                  await studyStore.saveTopic(t);
                }
                await refreshWorkspace();
              }}
              onDeleteTopic={async (id: string) => {
                await studyStore.deleteTopic(id);
                await refreshWorkspace();
              }}
            />
          )}

          {activeRoute === 'study-guides' && (
            <StudyGuidesPage
              workspace={workspace}
              onSaveGuide={async (guide: StudyGuide) => {
                await studyStore.saveStudyGuide(guide);
                await refreshWorkspace();
              }}
              onDeleteGuide={async (id: string) => {
                await studyStore.deleteStudyGuide(id);
                await refreshWorkspace();
              }}
              onOpenResearch={() => handleNavigate('research')}
            />
          )}

          {activeRoute === 'research' && (
            <ResearchPage
              workspace={workspace}
              effectiveMode={effectiveMode}
              localAiState={localAiState}
              onSaveResearchNote={async (note: ResearchNote) => {
                await studyStore.saveResearchNote(note);
                await refreshWorkspace();
              }}
              onDeleteResearchNote={async (id: string) => {
                await studyStore.deleteResearchNote(id);
                await refreshWorkspace();
              }}
              onSaveStudyGuide={async (guide: StudyGuide) => {
                await studyStore.saveStudyGuide(guide);
                await refreshWorkspace();
              }}
              onOpenSettings={() => handleNavigate('settings')}
              onOpenStudyGuides={() => handleNavigate('study-guides')}
            />
          )}

          {activeRoute === 'mock-exams' && (
            <MockExamsPage
              workspace={workspace}
              effectiveMode={effectiveMode}
              activeExamId={activeExamId}
              onSelectExam={setActiveExamId}
              onSaveMockExam={async (exam: MockExam) => {
                await studyStore.saveMockExam(exam);
                await refreshWorkspace();
              }}
              onDeleteMockExam={async (id: string) => {
                await studyStore.deleteMockExam(id);
                await refreshWorkspace();
              }}
              onSaveAttempt={async (attempt: ExamAttempt) => {
                await studyStore.saveExamAttempt(attempt);
                await refreshWorkspace();
              }}
              onSaveTopics={async (topics: Topic[]) => {
                for (const t of topics) {
                  await studyStore.saveTopic(t);
                }
                await refreshWorkspace();
              }}
              onNavigateToHistory={() => handleNavigate('exam-history')}
            />
          )}

          {activeRoute === 'exam-history' && (
            <ExamHistoryPage
              workspace={workspace}
              onGoToMockExams={() => handleNavigate('mock-exams')}
            />
          )}

          {activeRoute === 'progress' && (
            <ProgressPage
              workspace={workspace}
              onGoToTopics={() => handleNavigate('topics')}
            />
          )}

          {activeRoute === 'settings' && (
            <SettingsPage
              workspace={workspace}
              aiStatus={aiStatus}
              backendReachable={backendReachable}
              internetReachable={internetReachable}
              localAiState={localAiState}
              onSaveProfile={async (profile: StudentProfile) => {
                await studyStore.saveProfile(profile);
                await refreshWorkspace();
              }}
              onSaveLocalAiConfig={async (config: LocalAiConfig) => {
                await studyStore.saveLocalAiConfig(config);
                await refreshWorkspace();
                return refreshLocalAiState(config);
              }}
              onRestoreBackup={async (bundle: StudyWiseBackupBundle, mode: 'replace' | 'merge') => {
                const updated = await studyStore.restoreFromBackup(bundle, mode);
                setWorkspace(updated);
                await refreshLocalAiState(updated.localAiConfig);
              }}
              onRefreshWorkspace={async () => {
                await refreshWorkspace();
              }}
              onResetDemoData={async () => {
                const updated = await studyStore.resetToDemoData();
                setWorkspace(updated);
                await refreshLocalAiState(updated.localAiConfig);
              }}
              onClearStudyData={async () => {
                const updated = await studyStore.clearAllStudyDataKeepProfile();
                setWorkspace(updated);
              }}
              onRefreshAiStatus={refreshOnlineStatus}
            />
          )}
        </main>
      </div>
    </div>
  );
}
