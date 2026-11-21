import React from 'react';

interface DemoLabelProps {
  isDemo: boolean;
  customLabel?: string;
}

/**
 * Clean unboxed typographic marker distinguishing Stage 1 demonstration records
 * from student-created local records.
 */
export const DemoLabel: React.FC<DemoLabelProps> = ({ isDemo, customLabel }) => {
  if (!isDemo) {
    return (
      <span className="text-xs font-medium text-emerald-700 whitespace-nowrap">
        {customLabel ?? 'Saved Locally'}
      </span>
    );
  }

  return (
    <span className="text-xs font-medium text-amber-700 whitespace-nowrap">
      Demo Data
    </span>
  );
};
