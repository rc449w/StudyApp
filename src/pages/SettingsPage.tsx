import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Database,
  Download,
  FolderCheck,
  FolderPlus,
  HardDrive,
  Laptop,
  RefreshCw,
  Server,
  Trash2,
  Upload,
} from 'lucide-react';
import { AiConnectionTestResult, onlineAiClient } from '../services/ai/onlineAiClient';
import { desktopBridge } from '../services/desktop/desktopBridge';
import { PWAInstallButton } from '../components/common/PWAInstallButton';
import {
  backupService,
  BackupValidationResult,
  StudyWiseBackupBundle,
} from '../services/storage/backupService';
import { fileSystemAdapter } from '../services/storage/fileSystemAdapter';
import { buildSqliteSqlDump } from '../services/storage/sqliteMigration';
import {
  GradeLevel,
  LocalAiConfig,
  LocalAiProvider,
  LocalAiRuntimeState,
  OnlineAiStatus,
  ShsStrand,
  StudentProfile,
  WorkspaceSnapshot,
} from '../types/domain';

interface SettingsPageProps {
  workspace: WorkspaceSnapshot;
  aiStatus: OnlineAiStatus | null;
  localAiState: LocalAiRuntimeState;
  onSaveProfile: (profile: StudentProfile) => Promise<void>;
  onSaveLocalAiConfig: (config: LocalAiConfig) => Promise<LocalAiRuntimeState>;
  onRestoreBackup: (bundle: StudyWiseBackupBundle, mode: 'replace' | 'merge') => Promise<void>;
  onRefreshWorkspace: () => Promise<void>;
  onResetDemoData: () => Promise<void>;
  onClearStudyData: () => Promise<void>;
  onRefreshAiStatus: () => Promise<void>;
}

const GRADE_LEVELS: GradeLevel[] = [
  'Grade 7',
  'Grade 8',
  'Grade 9',
  'Grade 10',
  'Grade 11',
  'Grade 12',
];
const STRANDS: ShsStrand[] = ['None', 'STEM', 'ABM', 'HUMSS', 'GAS', 'TVL'];

export const SettingsPage: React.FC<SettingsPageProps> = ({
  workspace,
  aiStatus,
  localAiState,
  onSaveProfile,
  onSaveLocalAiConfig,
  onRestoreBackup,
  onRefreshWorkspace,
  onResetDemoData,
  onClearStudyData,
  onRefreshAiStatus,
}) => {
  const [fullName, setFullName] = useState(workspace.profile.fullName);
  const [gradeLevel, setGradeLevel] = useState<GradeLevel>(workspace.profile.gradeLevel);
  const [strand, setStrand] = useState<ShsStrand>(workspace.profile.strand);
  const [schoolName, setSchoolName] = useState(workspace.profile.schoolName);
  const [preferredLanguage, setPreferredLanguage] = useState(workspace.profile.preferredLanguage);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);

  const [localAiEnabled, setLocalAiEnabled] = useState(workspace.localAiConfig.enabled);
  const [localAiProvider, setLocalAiProvider] = useState<LocalAiProvider>(
    workspace.localAiConfig.provider
  );
  const [localAiEndpoint, setLocalAiEndpoint] = useState(workspace.localAiConfig.endpointUrl);
  const [localAiModel, setLocalAiModel] = useState(workspace.localAiConfig.modelName);
  const [checkingLocalAi, setCheckingLocalAi] = useState(false);

  const [fsMessage, setFsMessage] = useState<string | null>(null);
  const [fsError, setFsError] = useState<string | null>(null);
  const [dataActionMessage, setDataActionMessage] = useState<string | null>(null);
  const [dataActionError, setDataActionError] = useState<string | null>(null);
  const [pendingRestore, setPendingRestore] = useState<BackupValidationResult | null>(null);
  const [restoringBackup, setRestoringBackup] = useState(false);

  const [testingAi, setTestingAi] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<AiConnectionTestResult | null>(null);

  const fsCapabilities = fileSystemAdapter.getCapabilities();
  const isTauriDesktop = desktopBridge.isTauri();

  useEffect(() => {
    setFullName(workspace.profile.fullName);
    setGradeLevel(workspace.profile.gradeLevel);
    setStrand(workspace.profile.strand);
    setSchoolName(workspace.profile.schoolName);
    setPreferredLanguage(workspace.profile.preferredLanguage);
  }, [workspace.profile]);

  useEffect(() => {
    setLocalAiEnabled(workspace.localAiConfig.enabled);
    setLocalAiProvider(workspace.localAiConfig.provider);
    setLocalAiEndpoint(workspace.localAiConfig.endpointUrl);
    setLocalAiModel(workspace.localAiConfig.modelName);
  }, [workspace.localAiConfig]);

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const isShs = gradeLevel === 'Grade 11' || gradeLevel === 'Grade 12';
    await onSaveProfile({
      ...workspace.profile,
      fullName: fullName.trim() || 'Student',
      gradeLevel,
      strand: isShs ? strand : 'None',
      schoolName: schoolName.trim() || 'Philippine High School',
      preferredLanguage,
      updatedAt: new Date().toISOString(),
    });
    setProfileMessage('Student profile saved to IndexedDB.');
    window.setTimeout(() => setProfileMessage(null), 3500);
  };

  const handleSelectFolder = async () => {
    setFsError(null);
    setFsMessage(null);
    if (isTauriDesktop) {
      const pickedPath = await desktopBridge.pickLocalFolder();
      if (pickedPath) {
        setFsMessage(`Selected Windows local directory: ${pickedPath}`);
        await onRefreshWorkspace();
      }
      return;
    }
    const result = await fileSystemAdapter.pickAndSaveLocalDirectory();
    if (result.success && result.directoryName) {
      setFsMessage(`Linked local folder "${result.directoryName}" via File System Access API.`);
      await onRefreshWorkspace();
    } else if (result.error) {
      setFsError(result.error);
    }
  };

  const handleUnlinkFolder = async () => {
    await fileSystemAdapter.clearSavedDirectory();
    setFsError(null);
    setFsMessage('Unlinked local folder. Using local database metadata storage.');
    await onRefreshWorkspace();
  };

  const handleExportBackupBundle = async () => {
    setDataActionError(null);
    const bundle = await backupService.createWorkspaceBackup(workspace, {
      includeRawDocuments: true,
    });
    const payload = JSON.stringify(bundle, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `studywise-ai-backup-${new Date().toISOString().slice(0, 10)}.studywise.json`;
    link.click();
    URL.revokeObjectURL(url);
    setDataActionMessage(
      `Exported verified local backup bundle (.studywise.json · SHA-256 ${bundle.checksumSha256.slice(0, 10)}…).`
    );
  };

  const handleExportSqliteDump = () => {
    setDataActionError(null);
    const sqlText = buildSqliteSqlDump(workspace);
    const blob = new Blob([sqlText], { type: 'application/sql' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `studywise-ai-sqlite-${new Date().toISOString().slice(0, 10)}.sql`;
    link.click();
    URL.revokeObjectURL(url);
    setDataActionMessage('Exported portable SQLite schema & records script (.sql).');
  };

  const handleBackupFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setDataActionError(null);
    setDataActionMessage(null);
    const text = await file.text();
    const validation = await backupService.parseAndValidateBackup(text);
    if (!validation.valid) {
      setPendingRestore(null);
      setDataActionError(validation.error ?? 'Invalid backup file.');
      return;
    }
    setPendingRestore(validation);
  };

  const handleConfirmRestore = async (mode: 'replace' | 'merge') => {
    if (!pendingRestore?.bundle) return;
    setRestoringBackup(true);
    setDataActionError(null);
    try {
      await onRestoreBackup(pendingRestore.bundle, mode);
      setPendingRestore(null);
      setDataActionMessage(
        mode === 'replace'
          ? 'Restored local backup bundle (replaced previous study data).'
          : 'Merged backup records into your local study workspace.'
      );
    } catch (err: unknown) {
      setDataActionError(
        err instanceof Error ? err.message : 'Failed restoring backup into local database.'
      );
    } finally {
      setRestoringBackup(false);
    }
  };

  const handleResetDemo = async () => {
    setDataActionError(null);
    await onResetDemoData();
    setDataActionMessage('Restored demonstration dataset in local storage.');
  };

  const handleClearStudyData = async () => {
    setDataActionError(null);
    await onClearStudyData();
    setDataActionMessage('Cleared all subjects, documents, topics, guides, and exam history.');
  };

  const handleTestBackendAi = async () => {
    setTestingAi(true);
    try {
      await onRefreshAiStatus();
      const result = await onlineAiClient.verifyAiConnection();
      setAiTestResult(result);
    } finally {
      setTestingAi(false);
    }
  };

  const handleSaveAndVerifyLocalAi = async (e: React.FormEvent) => {
    e.preventDefault();
    setCheckingLocalAi(true);
    try {
      const nextConfig: LocalAiConfig = {
        enabled: localAiEnabled,
        provider: localAiProvider,
        endpointUrl:
          localAiEndpoint.trim() ||
          (localAiProvider === 'ollama' ? 'http://127.0.0.1:11434' : 'http://127.0.0.1:1234/v1'),
        modelName: localAiModel.trim(),
      };
      const result = await onSaveLocalAiConfig(nextConfig);
      if (result.activeModel && !localAiModel.trim()) {
        setLocalAiModel(result.activeModel);
      }
    } finally {
      setCheckingLocalAi(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* 1. Student Profile */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div>
          <h2 className="font-display text-base font-bold text-slate-900">
            Student Profile (Philippines K–12)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Stored locally in IndexedDB · Tailors your workspace for Grade 7–12 & SHS tracks
          </p>
        </div>

        <form onSubmit={handleProfileSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Student Name
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                School Name
              </label>
              <input
                type="text"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Grade Level
              </label>
              <select
                value={gradeLevel}
                onChange={(e) => setGradeLevel(e.target.value as GradeLevel)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {GRADE_LEVELS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                SHS Strand (Grade 11–12)
              </label>
              <select
                value={gradeLevel === 'Grade 11' || gradeLevel === 'Grade 12' ? strand : 'None'}
                disabled={gradeLevel !== 'Grade 11' && gradeLevel !== 'Grade 12'}
                onChange={(e) => setStrand(e.target.value as ShsStrand)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:bg-slate-100 disabled:text-slate-400"
              >
                {STRANDS.map((s) => (
                  <option key={s} value={s}>
                    {s === 'None' ? 'Junior High / Not Applicable' : s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Preferred Study Language
              </label>
              <select
                value={preferredLanguage}
                onChange={(e) =>
                  setPreferredLanguage(e.target.value as 'English' | 'Filipino' | 'Bilingual')
                }
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="English">English</option>
                <option value="Filipino">Filipino</option>
                <option value="Bilingual">Bilingual (English & Filipino)</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 pt-1">
            {profileMessage ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                <CheckCircle2 className="w-4 h-4" />
                <span>{profileMessage}</span>
              </span>
            ) : (
              <span />
            )}

            <button
              type="submit"
              className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer"
            >
              Save Profile
            </button>
          </div>
        </form>
      </section>

      {/* 2. Local Storage Folder & Tauri Windows Readiness */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex items-start gap-3">
          <HardDrive className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
          <div>
            <h2 className="font-display text-base font-bold text-slate-900">
              Local Storage Folder (File System Access API & Tauri Architecture)
            </h2>
            <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
              {fsCapabilities.statusDetail}
            </p>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1 text-xs">
            <p className="font-semibold text-slate-800 flex items-center gap-1.5">
              <FolderCheck className="w-4 h-4 text-slate-600" />
              <span>
                Active Storage Target:{' '}
                {workspace.storageConfig.directoryName
                  ? `Local Folder (${workspace.storageConfig.directoryName})`
                  : 'IndexedDB Browser Database'}
              </span>
            </p>
            <p className="text-slate-500">
              Adapter Mode: <span className="font-mono">{fsCapabilities.recommendedAdapter}</span> ·
              Windows Desktop Target: Tauri FS Adapter Ready
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => void handleSelectFolder()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              <FolderPlus className="w-4 h-4" />
              <span>Select Local Folder</span>
            </button>

            {workspace.storageConfig.directoryName && (
              <button
                type="button"
                onClick={() => void handleUnlinkFolder()}
                className="px-3 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-medium rounded-lg cursor-pointer"
              >
                Unlink
              </button>
            )}
          </div>
        </div>

        {fsMessage && (
          <p className="text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
            {fsMessage}
          </p>
        )}
        {fsError && (
          <p className="text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            {fsError}
          </p>
        )}
      </section>

      {/* 3. Local Database, Backup & Restore */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <Database className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
            <div>
              <h2 className="font-display text-base font-bold text-slate-900">
                {isTauriDesktop
                  ? 'Local SQLite Database & Backup / Restore'
                  : 'Local IndexedDB Database & Backup / Restore'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                Engine:{' '}
                <span className="font-mono font-semibold text-slate-700">
                  {workspace.storageConfig.databaseEngine === 'sqlite-tauri'
                    ? 'SQLite (studywise_ai.db)'
                    : 'IndexedDB (Browser)'}
                </span>{' '}
                · {workspace.subjects.length} subjects · {workspace.documents.length} documents ·{' '}
                {workspace.topics.length} topics · {workspace.studyGuides.length} study guides ·{' '}
                {workspace.researchNotes.length} research notes · {workspace.examAttempts.length}{' '}
                exam attempts
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void handleExportBackupBundle()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Full Local Backup (.studywise.json)</span>
          </button>

          <label className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-lg cursor-pointer">
            <Upload className="w-3.5 h-3.5 text-blue-700" />
            <span>Restore from Backup File</span>
            <input
              type="file"
              accept=".json,.studywise.json,application/json"
              onChange={(e) => void handleBackupFileSelected(e)}
              className="hidden"
            />
          </label>

          <button
            type="button"
            onClick={handleExportSqliteDump}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-lg cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-emerald-700" />
            <span>Export SQLite SQL Dump (.sql)</span>
          </button>

          <button
            type="button"
            onClick={() => void handleResetDemo()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-lg cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Restore Demo Data</span>
          </button>

          <button
            type="button"
            onClick={() => void handleClearStudyData()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-red-200 hover:bg-red-50 text-red-700 text-xs font-semibold rounded-lg cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear All Study Data</span>
          </button>
        </div>

        {pendingRestore?.bundle && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="text-xs space-y-1">
                <p className="font-semibold text-blue-950">
                  Backup Bundle Verified — Ready to Restore
                </p>
                <p className="text-blue-900 tabular-nums">
                  {pendingRestore.bundle.counts.subjects} subjects ·{' '}
                  {pendingRestore.bundle.counts.documents} documents ·{' '}
                  {pendingRestore.bundle.counts.topics} topics ·{' '}
                  {pendingRestore.bundle.counts.studyGuides} guides ·{' '}
                  {pendingRestore.bundle.counts.researchNotes} research notes ·{' '}
                  {pendingRestore.bundle.counts.mockExams} exams ·{' '}
                  {pendingRestore.bundle.counts.examAttempts} attempts
                </p>
                <p className="text-[11px] text-blue-800 font-mono">
                  Checksum:{' '}
                  {pendingRestore.checksumVerified ? 'SHA-256 Verified' : 'Modified / Unverified'}{' '}
                  ({pendingRestore.bundle.checksumSha256.slice(0, 14)}…)
                </p>
                {pendingRestore.warning && (
                  <p className="text-[11px] text-amber-800">{pendingRestore.warning}</p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={restoringBackup}
                onClick={() => void handleConfirmRestore('replace')}
                className="px-3.5 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg disabled:opacity-60 cursor-pointer"
              >
                {restoringBackup ? 'Restoring...' : 'Restore & Replace Current Data'}
              </button>
              <button
                type="button"
                disabled={restoringBackup}
                onClick={() => void handleConfirmRestore('merge')}
                className="px-3.5 py-2 bg-white border border-blue-300 hover:bg-blue-100 text-blue-900 text-xs font-semibold rounded-lg disabled:opacity-60 cursor-pointer"
              >
                Merge into Current Workspace
              </button>
              <button
                type="button"
                onClick={() => setPendingRestore(null)}
                className="px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {dataActionMessage && (
          <p className="text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
            {dataActionMessage}
          </p>
        )}
        {dataActionError && (
          <p className="flex items-center gap-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{dataActionError}</span>
          </p>
        )}
      </section>

      {/* 3b. Windows Desktop Packaging & Standalone Local App */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <Laptop className="w-5 h-5 text-slate-800 shrink-0 mt-0.5" />
            <div>
              <h2 className="font-display text-base font-bold text-slate-900">
                Local Desktop App (PWA &amp; Tauri v2 + SQLite)
              </h2>
              <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                {isTauriDesktop
                  ? 'Running inside Tauri Desktop with native SQLite (studywise_ai.db), local document vault storage, and offline splashscreen.'
                  : 'Install directly as a standalone offline browser app (PWA) in Chrome/Edge, or run .\\scripts\\package-windows.ps1 (npm run desktop:build) on Windows 10/11 to compile the native .exe / .msi installer.'}
              </p>
            </div>
          </div>
          <div className="shrink-0">
            <PWAInstallButton />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
            <p className="text-slate-500">Runtime Target</p>
            <p className="font-semibold text-slate-900 mt-1 font-mono">
              {workspace.storageConfig.runtimeTarget}
            </p>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
            <p className="text-slate-500">Desktop Database</p>
            <p className="font-semibold text-slate-900 mt-1">
              {isTauriDesktop ? 'SQLite Active' : 'SQLite Migration Ready'}
            </p>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
            <p className="text-slate-500">Documents Vault</p>
            <p className="font-semibold text-slate-900 mt-1 truncate">
              {workspace.storageConfig.documentsVaultPath ?? '%APPDATA%/StudyWiseAI/documents'}
            </p>
          </div>
        </div>
      </section>

      {/* 4. Online AI Backend Boundary (No API key fields in UI) */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Server className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
            <div>
              <h2 className="font-display text-base font-bold text-slate-900">
                Online AI Backend Separation (Node.js)
              </h2>
              <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                AI credentials remain strictly on the Node.js server. Offline study tools work
                independently without server connectivity.
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={testingAi}
            onClick={() => void handleTestBackendAi()}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 disabled:opacity-60 cursor-pointer"
          >
            {testingAi ? 'Checking Backend...' : 'Verify Backend AI Endpoint'}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
            <p className="text-slate-500">Backend Status</p>
            <p className="font-semibold text-slate-900 mt-1">
              {aiStatus ? 'Reachable (/api/ai/status)' : 'Offline / Unreachable'}
            </p>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
            <p className="text-slate-500">Server Credential State</p>
            <p className="font-semibold text-slate-900 mt-1">
              {aiStatus
                ? aiStatus.serverCredentialConfigured
                  ? 'Configured on Server'
                  : 'Not Set in Server Env'
                : 'Unknown (Offline)'}
            </p>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
            <p className="text-slate-500">Development Stage</p>
            <p className="font-semibold text-slate-900 mt-1">
              {aiStatus?.stage ?? 'stage-1-foundation'}
            </p>
          </div>
        </div>

        {aiTestResult && (
          <div
            className={`text-xs rounded-lg p-3 border ${
              aiTestResult.connected
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}
          >
            <p className="font-semibold">
              {aiTestResult.connected
                ? `Connected (${aiTestResult.model ?? 'Gemini'})`
                : 'Online AI Check Notice'}
            </p>
            <p className="mt-0.5">{aiTestResult.reply ?? aiTestResult.message}</p>
          </div>
        )}
      </section>

      {/* 5. Optional Local AI Model Connection (Offline Study AI) */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex items-start gap-3">
          <Cpu className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
          <div>
            <h2 className="font-display text-base font-bold text-slate-900">
              Local AI Model Runtime (Optional Offline AI)
            </h2>
            <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
              Connect a real local model server (such as Ollama or LM Studio on your Windows
              device) for offline study explanations. Offline AI generation is enabled only when
              this local runtime actually responds.
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveAndVerifyLocalAi} className="space-y-4">
          <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-800 cursor-pointer">
            <input
              type="checkbox"
              checked={localAiEnabled}
              onChange={(e) => setLocalAiEnabled(e.target.checked)}
              className="rounded border-slate-300 text-blue-700 focus:ring-blue-600"
            />
            <span>Enable local AI runtime detection for Offline Mode</span>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Provider</label>
              <select
                value={localAiProvider}
                onChange={(e) => {
                  const next = e.target.value as LocalAiProvider;
                  setLocalAiProvider(next);
                  setLocalAiEndpoint(
                    next === 'ollama' ? 'http://127.0.0.1:11434' : 'http://127.0.0.1:1234/v1'
                  );
                }}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="ollama">Ollama (Local)</option>
                <option value="openai-compatible">LM Studio / OpenAI-Compatible</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Local Endpoint URL
              </label>
              <input
                type="url"
                value={localAiEndpoint}
                onChange={(e) => setLocalAiEndpoint(e.target.value)}
                placeholder="http://127.0.0.1:11434"
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Model Name (Optional Auto-Detect)
              </label>
              <input
                type="text"
                value={localAiModel}
                onChange={(e) => setLocalAiModel(e.target.value)}
                placeholder="e.g. llama3.2 or qwen2.5"
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div
              className={`text-xs px-3 py-2 rounded-lg border ${
                localAiState.connected
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : localAiState.status === 'disabled'
                    ? 'bg-slate-50 border-slate-200 text-slate-700'
                    : 'bg-amber-50 border-amber-200 text-amber-900'
              }`}
            >
              <span className="font-semibold">
                {localAiState.connected
                  ? `Connected (${localAiState.activeModel})`
                  : localAiState.status === 'disabled'
                    ? 'Local AI Disabled'
                    : 'Local AI Not Connected'}
              </span>
              {' · '}
              <span>{localAiState.message}</span>
            </div>

            <button
              type="submit"
              disabled={checkingLocalAi}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg whitespace-nowrap disabled:opacity-60 cursor-pointer"
            >
              {checkingLocalAi ? 'Checking Local Runtime...' : 'Save & Probe Local AI'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
};
