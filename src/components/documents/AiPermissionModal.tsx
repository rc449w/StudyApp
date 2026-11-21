import React from 'react';
import { ShieldAlert, Sparkles, X } from 'lucide-react';
import { DocumentExtractionContent } from '../../types/domain';

interface AiPermissionModalProps {
  content: DocumentExtractionContent;
  isProcessing: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

export const AiPermissionModal: React.FC<AiPermissionModalProps> = ({
  content,
  isProcessing,
  error,
  onCancel,
  onConfirm,
}) => {
  const isImage = Boolean(content.rawMimeType?.startsWith('image/'));
  const textChars = content.fullExtractedText.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-permission-title"
        className="bg-white border border-slate-200 rounded-xl w-full max-w-lg shadow-xl overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-5 h-5 text-amber-700" />
            <h2
              id="ai-permission-title"
              className="font-display text-base font-bold text-slate-900"
            >
              Permission Required for Online AI Processing
            </h2>
          </div>
          <button
            type="button"
            disabled={isProcessing}
            onClick={onCancel}
            className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg cursor-pointer disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4 text-sm text-slate-700">
          <p className="leading-relaxed">
            StudyWise AI keeps all uploaded documents offline on your device by default. Running{' '}
            <strong className="text-slate-900">Online AI Vision OCR & Topic Structuring</strong>{' '}
            requires transmitting content from this document to the StudyWise AI Node.js server and
            Gemini API.
          </p>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2 text-xs">
            <p className="font-semibold text-slate-900">Transmission Summary</p>
            <p className="text-slate-600">
              <span className="font-medium text-slate-800">Source File:</span>{' '}
              {content.sourceFileName}
            </p>
            <p className="text-slate-600">
              <span className="font-medium text-slate-800">Content Included:</span>{' '}
              {isImage
                ? 'Original image bytes for Vision OCR + local text'
                : `${textChars.toLocaleString()} extracted characters${
                    textChars < 150 && content.rawMimeType === 'application/pdf'
                      ? ' + first scanned PDF pages rendered as JPEG for Vision OCR'
                      : ''
                  }`}
            </p>
            <p className="text-slate-600">
              <span className="font-medium text-slate-800">Purpose:</span> Identify chapters,
              lessons, topics, subtopics, definitions, formulas, and examples with page references.
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-3 text-xs">
              {error}
            </div>
          )}

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              disabled={isProcessing}
              onClick={onCancel}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg cursor-pointer disabled:opacity-50"
            >
              Cancel — Stay Offline
            </button>
            <button
              type="button"
              disabled={isProcessing}
              onClick={onConfirm}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg cursor-pointer disabled:opacity-60"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isProcessing ? 'Processing with Online AI...' : 'Allow & Process Online'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
