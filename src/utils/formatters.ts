import { SubjectAccent } from '../types/domain';

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
}

export function formatShortDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return date.toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const SUBJECT_ACCENT_STYLES: Record<
  SubjectAccent,
  { text: string; bg: string; border: string; bar: string }
> = {
  blue: {
    text: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    bar: 'bg-blue-600',
  },
  emerald: {
    text: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    bar: 'bg-emerald-600',
  },
  amber: {
    text: 'text-amber-800',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    bar: 'bg-amber-600',
  },
  violet: {
    text: 'text-violet-700',
    bg: 'bg-violet-50',
    border: 'border-violet-200',
    bar: 'bg-violet-600',
  },
  rose: {
    text: 'text-rose-700',
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    bar: 'bg-rose-600',
  },
  teal: {
    text: 'text-teal-700',
    bg: 'bg-teal-50',
    border: 'border-teal-200',
    bar: 'bg-teal-600',
  },
};
