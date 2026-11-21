import React from 'react';
import { CheckCircle2, Database, FolderLock, GraduationCap, Loader2 } from 'lucide-react';

interface StartupScreenProps {
  databaseReady: boolean;
  runtimeLabel: string;
  databaseLabel: string;
}

export const StartupScreen: React.FC<StartupScreenProps> = ({
  databaseReady,
  runtimeLabel,
  databaseLabel,
}) => {
  return (
    <div
      data-testid="startup-screen"
      className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6"
    >
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-md w-full space-y-6 shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-700 text-white flex items-center justify-center shrink-0">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold tracking-tight text-white">
              StudyWise AI
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Philippines Grade 7–12 · Local-First Study Engine
            </p>
          </div>
        </div>

        <div className="space-y-3 bg-slate-950/60 border border-slate-800 rounded-xl p-4 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2 text-slate-300">
              <Database className="w-4 h-4 text-blue-400" />
              <span>{databaseLabel}</span>
            </span>
            {databaseReady ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <Loader2 className="w-4 h-4 text-blue-400 animate-spin shrink-0" />
            )}
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2 text-slate-300">
              <FolderLock className="w-4 h-4 text-blue-400" />
              <span>Local Document &amp; Exam Storage</span>
            </span>
            {databaseReady ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <Loader2 className="w-4 h-4 text-slate-500 animate-spin shrink-0" />
            )}
          </div>
        </div>

        <div className="space-y-2">
          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full bg-blue-500 transition-all duration-300 ${
                databaseReady ? 'w-full' : 'w-2/3 animate-pulse'
              }`}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>{runtimeLabel}</span>
            <span>Offline-Ready</span>
          </div>
        </div>
      </div>
    </div>
  );
};
