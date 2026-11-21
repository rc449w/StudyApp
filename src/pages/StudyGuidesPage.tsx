import React, { useMemo, useState } from 'react';
import { AlertCircle, FileText, Globe, Pencil, Plus, Trash2, X } from 'lucide-react';
import { DemoLabel } from '../components/common/DemoTag';
import { EmptyState } from '../components/common/EmptyState';
import { StudyGuide, WorkspaceSnapshot } from '../types/domain';
import { formatShortDate } from '../utils/formatters';

interface StudyGuidesPageProps {
  workspace: WorkspaceSnapshot;
  onSaveGuide: (guide: StudyGuide) => Promise<void>;
  onDeleteGuide: (guideId: string) => Promise<void>;
  onOpenResearch: () => void;
}

export const StudyGuidesPage: React.FC<StudyGuidesPageProps> = ({
  workspace,
  onSaveGuide,
  onDeleteGuide,
  onOpenResearch,
}) => {
  const [selectedId, setSelectedId] = useState<string>(workspace.studyGuides[0]?.id ?? '');
  const [subjectFilter, setSubjectFilter] = useState('ALL');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingGuide, setEditingGuide] = useState<StudyGuide | null>(null);

  const [title, setTitle] = useState('');
  const [subjectId, setSubjectId] = useState(workspace.subjects[0]?.id ?? '');
  const [summary, setSummary] = useState('');
  const [keyConceptsText, setKeyConceptsText] = useState('');
  const [bodyMarkdown, setBodyMarkdown] = useState('');

  const subjectMap = useMemo(
    () => new Map(workspace.subjects.map((s) => [s.id, s])),
    [workspace.subjects]
  );

  const filteredGuides = useMemo(() => {
    if (subjectFilter === 'ALL') return workspace.studyGuides;
    return workspace.studyGuides.filter((g) => g.subjectId === subjectFilter);
  }, [workspace.studyGuides, subjectFilter]);

  const activeGuide =
    filteredGuides.find((g) => g.id === selectedId) ?? filteredGuides[0] ?? null;

  const openNewEditor = () => {
    setEditingGuide(null);
    setTitle('');
    setSubjectId(workspace.subjects[0]?.id ?? '');
    setSummary('');
    setKeyConceptsText('');
    setBodyMarkdown('');
    setEditorOpen(true);
  };

  const openEditEditor = (guide: StudyGuide) => {
    setEditingGuide(guide);
    setTitle(guide.title);
    setSubjectId(guide.subjectId);
    setSummary(guide.summary);
    setKeyConceptsText(guide.keyConcepts.join('\n'));
    setBodyMarkdown(guide.bodyMarkdown);
    setEditorOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const guide: StudyGuide = {
      id: editingGuide?.id ?? `guide-${crypto.randomUUID().slice(0, 8)}`,
      subjectId: subjectId || workspace.subjects[0]?.id || '',
      topicId: editingGuide?.topicId,
      title: title.trim(),
      summary: summary.trim() || 'Offline personal study guide.',
      keyConcepts: keyConceptsText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
      bodyMarkdown: bodyMarkdown.trim() || 'Add reviewer notes here.',
      sourceMode: 'manual-offline',
      isDemo: false,
      updatedAt: new Date().toISOString(),
    };

    await onSaveGuide(guide);
    setSelectedId(guide.id);
    setEditorOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Offline Study Guides Header */}
      <section className="bg-slate-100 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
          <div className="text-sm text-slate-900">
            <p className="font-semibold">Offline Study Guides & Saved Research Reviewers</p>
            <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
              Create, read, and edit study reviewers offline in IndexedDB, or save verified online
              research explanations as offline reviewers.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpenResearch}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            <Globe className="w-3.5 h-3.5 text-emerald-700" />
            <span>Online Research</span>
          </button>
          <button
            type="button"
            onClick={openNewEditor}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Study Guide</span>
          </button>
        </div>
      </section>

      {/* Split-pane Reader */}
      {filteredGuides.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No study guides available"
          description="Write a personal offline reviewer for any subject or clear your subject filter."
          actionLabel="Create Study Guide"
          onAction={openNewEditor}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Guide List */}
          <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-700">
                Saved Guides ({filteredGuides.length})
              </span>
              <select
                value={subjectFilter}
                onChange={(e) => setSubjectFilter(e.target.value)}
                aria-label="Filter study guides by subject"
                className="px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600 max-w-[170px]"
              >
                <option value="ALL">All Subjects</option>
                {workspace.subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="divide-y divide-slate-200">
              {filteredGuides.map((guide) => {
                const subj = subjectMap.get(guide.subjectId);
                const isSelected = activeGuide?.id === guide.id;
                return (
                  <button
                    key={guide.id}
                    type="button"
                    onClick={() => setSelectedId(guide.id)}
                    className={`w-full p-4 text-left transition-colors cursor-pointer ${
                      isSelected ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-xs text-slate-500 mb-1">
                      <span className="truncate">{subj?.name ?? 'General'}</span>
                      <DemoLabel
                        isDemo={guide.isDemo}
                        customLabel={
                          guide.sourceMode === 'offline-saved-research'
                            ? 'Saved Research'
                            : guide.sourceMode === 'local-ai'
                              ? 'Local AI Note'
                              : 'Offline Note'
                        }
                      />
                    </div>
                    <p
                      className={`text-sm font-semibold leading-snug ${
                        isSelected ? 'text-blue-800' : 'text-slate-900'
                      }`}
                    >
                      {guide.title}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Updated {formatShortDate(guide.updatedAt)}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Detail Reader */}
          {activeGuide && (
            <article className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b border-slate-200">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="font-medium text-slate-700">
                      {subjectMap.get(activeGuide.subjectId)?.name ?? 'General'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>Updated {formatShortDate(activeGuide.updatedAt)}</span>
                    <span aria-hidden="true">·</span>
                    <DemoLabel
                      isDemo={activeGuide.isDemo}
                      customLabel={
                        activeGuide.sourceMode === 'offline-saved-research'
                          ? 'Saved Offline Research'
                          : activeGuide.sourceMode === 'local-ai'
                            ? 'Local AI Note'
                            : 'Saved Offline'
                      }
                    />
                  </div>
                  <h2 className="font-display text-xl font-bold text-slate-900">
                    {activeGuide.title}
                  </h2>
                  <p className="text-sm text-slate-600 leading-relaxed">{activeGuide.summary}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => openEditEditor(activeGuide)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await onDeleteGuide(activeGuide.id);
                      setSelectedId('');
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 bg-white border border-slate-300 hover:bg-red-50 rounded-lg cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>

              {activeGuide.keyConcepts.length > 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                  <h3 className="text-xs font-semibold text-slate-700">Key Concepts</h3>
                  <ul className="space-y-1.5 text-sm text-slate-700 list-disc pl-5">
                    {activeGuide.keyConcepts.map((concept, idx) => (
                      <li key={idx} className="leading-relaxed">
                        {concept}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-slate-500">Study Notes</h3>
                <div className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed font-sans">
                  {activeGuide.bodyMarkdown}
                </div>
              </div>
            </article>
          )}
        </div>
      )}

      {/* Create / Edit Study Guide Modal */}
      {editorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/45">
          <div
            role="dialog"
            aria-modal="true"
            className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl shadow-lg overflow-hidden max-h-[90vh] flex flex-col"
          >
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="font-display text-base font-bold text-slate-900">
                {editingGuide ? 'Edit Study Guide' : 'Create Offline Study Guide'}
              </h2>
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Guide Title
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Inverse Functions Reviewer"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Subject
                  </label>
                  <select
                    value={subjectId}
                    onChange={(e) => setSubjectId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    {workspace.subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Short Summary
                </label>
                <input
                  type="text"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="One-sentence overview of what this reviewer covers"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Key Concepts (one bullet per line)
                </label>
                <textarea
                  rows={3}
                  value={keyConceptsText}
                  onChange={(e) => setKeyConceptsText(e.target.value)}
                  placeholder={'A function f has an inverse only if it is one-to-one.\nSwap x and y then solve for y.'}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Detailed Notes
                </label>
                <textarea
                  rows={7}
                  required
                  value={bodyMarkdown}
                  onChange={(e) => setBodyMarkdown(e.target.value)}
                  placeholder="Write definitions, formulas, examples, and exam tips..."
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditorOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg cursor-pointer"
                >
                  Save Offline Guide
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
