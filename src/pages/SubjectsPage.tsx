import React, { useMemo, useState } from 'react';
import { BookOpen, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { DemoLabel } from '../components/common/DemoTag';
import { EmptyState } from '../components/common/EmptyState';
import {
  GradeLevel,
  Quarter,
  ShsStrand,
  Subject,
  SubjectAccent,
  WorkspaceSnapshot,
} from '../types/domain';
import { SUBJECT_ACCENT_STYLES } from '../utils/formatters';

interface SubjectsPageProps {
  workspace: WorkspaceSnapshot;
  onSaveSubject: (subject: Subject) => Promise<void>;
  onDeleteSubject: (subjectId: string) => Promise<void>;
  composerOpen: boolean;
  onSetComposerOpen: (open: boolean) => void;
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
const QUARTERS: Quarter[] = ['Q1', 'Q2', 'Q3', 'Q4'];
const ACCENTS: SubjectAccent[] = ['blue', 'emerald', 'amber', 'violet', 'rose', 'teal'];

export const SubjectsPage: React.FC<SubjectsPageProps> = ({
  workspace,
  onSaveSubject,
  onDeleteSubject,
  composerOpen,
  onSetComposerOpen,
}) => {
  const [search, setSearch] = useState('');
  const [gradeFilter, setGradeFilter] = useState<string>('ALL');
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [gradeLevel, setGradeLevel] = useState<GradeLevel>(workspace.profile.gradeLevel);
  const [strand, setStrand] = useState<ShsStrand>(workspace.profile.strand);
  const [quarter, setQuarter] = useState<Quarter>('Q1');
  const [teacher, setTeacher] = useState('');
  const [accent, setAccent] = useState<SubjectAccent>('blue');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const openNewModal = () => {
    setEditingSubject(null);
    setCode('');
    setName('');
    setGradeLevel(workspace.profile.gradeLevel);
    setStrand(
      workspace.profile.gradeLevel === 'Grade 11' || workspace.profile.gradeLevel === 'Grade 12'
        ? workspace.profile.strand
        : 'None'
    );
    setQuarter('Q1');
    setTeacher('');
    setAccent('blue');
    setDescription('');
    onSetComposerOpen(true);
  };

  const openEditModal = (subject: Subject) => {
    setEditingSubject(subject);
    setCode(subject.code);
    setName(subject.name);
    setGradeLevel(subject.gradeLevel);
    setStrand(subject.strand);
    setQuarter(subject.quarter);
    setTeacher(subject.teacher);
    setAccent(subject.accent);
    setDescription(subject.description);
    onSetComposerOpen(true);
  };

  const filteredSubjects = useMemo(() => {
    const query = search.trim().toLowerCase();
    return workspace.subjects.filter((subj) => {
      if (gradeFilter !== 'ALL' && subj.gradeLevel !== gradeFilter) return false;
      if (!query) return true;
      return (
        subj.name.toLowerCase().includes(query) ||
        subj.code.toLowerCase().includes(query) ||
        subj.teacher.toLowerCase().includes(query)
      );
    });
  }, [workspace.subjects, search, gradeFilter]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const record: Subject = {
        id: editingSubject?.id ?? `subj-${crypto.randomUUID().slice(0, 8)}`,
        code: code.trim().toUpperCase(),
        name: name.trim(),
        gradeLevel,
        strand: gradeLevel === 'Grade 11' || gradeLevel === 'Grade 12' ? strand : 'None',
        quarter,
        teacher: teacher.trim() || 'TBA',
        accent,
        description: description.trim() || 'Personal curriculum subject stored locally.',
        isDemo: false,
        createdAt: editingSubject?.createdAt ?? now,
        updatedAt: now,
      };
      await onSaveSubject(record);
      onSetComposerOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search subjects, codes, or teachers..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
            />
          </div>

          <select
            value={gradeFilter}
            onChange={(e) => setGradeFilter(e.target.value)}
            aria-label="Filter by grade level"
            className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="ALL">All Grade Levels (G7–G12)</option>
            {GRADE_LEVELS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={openNewModal}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add Subject</span>
        </button>
      </div>

      {/* Subject Grid */}
      {filteredSubjects.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No matching subjects found"
          description="Add a Grade 7–12 subject aligned with your DepEd modules or clear your active filter."
          actionLabel="Create Subject"
          onAction={openNewModal}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredSubjects.map((subject) => {
            const style = SUBJECT_ACCENT_STYLES[subject.accent];
            const docCount = workspace.documents.filter((d) => d.subjectId === subject.id).length;
            const topicCount = workspace.topics.filter((t) => t.subjectId === subject.id).length;
            const guideCount = workspace.studyGuides.filter(
              (g) => g.subjectId === subject.id
            ).length;

            return (
              <article
                key={subject.id}
                className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-4"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className={`text-xs font-mono font-semibold ${style.text}`}>
                      {subject.code}
                    </span>
                    <DemoLabel isDemo={subject.isDemo} />
                  </div>

                  <h3 className="font-display text-lg font-bold text-slate-900 leading-snug">
                    {subject.name}
                  </h3>

                  <p className="text-xs text-slate-500 mt-1">
                    {subject.gradeLevel}
                    {subject.strand !== 'None' ? ` · ${subject.strand}` : ''} · {subject.quarter} ·{' '}
                    {subject.teacher}
                  </p>

                  <p className="text-sm text-slate-600 mt-3 leading-relaxed line-clamp-3">
                    {subject.description}
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="text-xs text-slate-600 tabular-nums">
                    {topicCount} topics · {docCount} docs · {guideCount} guides
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEditModal(subject)}
                      aria-label={`Edit ${subject.name}`}
                      className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteSubject(subject.id)}
                      aria-label={`Delete ${subject.name}`}
                      className="p-2 text-slate-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Modal for Create / Edit Subject */}
      {composerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/45">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="subject-dialog-title"
            className="bg-white border border-slate-200 rounded-xl w-full max-w-lg shadow-lg overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 id="subject-dialog-title" className="font-display text-base font-bold text-slate-900">
                {editingSubject ? 'Edit Subject' : 'Add New Subject'}
              </h2>
              <button
                type="button"
                onClick={() => onSetComposerOpen(false)}
                className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Subject Code
                  </label>
                  <input
                    type="text"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="e.g. CORE-STAT11"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Subject Title
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Statistics and Probability"
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
                    SHS Strand
                  </label>
                  <select
                    value={gradeLevel === 'Grade 11' || gradeLevel === 'Grade 12' ? strand : 'None'}
                    disabled={gradeLevel !== 'Grade 11' && gradeLevel !== 'Grade 12'}
                    onChange={(e) => setStrand(e.target.value as ShsStrand)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    {STRANDS.map((s) => (
                      <option key={s} value={s}>
                        {s === 'None' ? 'JHS / General' : s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Quarter
                  </label>
                  <select
                    value={quarter}
                    onChange={(e) => setQuarter(e.target.value as Quarter)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    {QUARTERS.map((q) => (
                      <option key={q} value={q}>
                        {q}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Subject Teacher
                  </label>
                  <input
                    type="text"
                    value={teacher}
                    onChange={(e) => setTeacher(e.target.value)}
                    placeholder="e.g. Mr. Jose Rizal"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Color Accent
                  </label>
                  <select
                    value={accent}
                    onChange={(e) => setAccent(e.target.value as SubjectAccent)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 capitalize"
                  >
                    {ACCENTS.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description / Scope
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Key modules or DepEd MELCs covered in this subject..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => onSetComposerOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg disabled:opacity-60 cursor-pointer"
                >
                  {saving ? 'Saving...' : editingSubject ? 'Save Changes' : 'Create Subject'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
