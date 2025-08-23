import React from 'react';

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

/**
 * Dialog component - default export for UI components
 */
function Dialog({ isOpen, onClose, title, children }: DialogProps): JSX.Element | null {
  if (!isOpen) return null;

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        {title && (
          <div className="dialog-header">
            <h2 className="dialog-title">{title}</h2>
            <button className="dialog-close" onClick={onClose}>
              ×
            </button>
          </div>
        )}
        <div className="dialog-content">{children}</div>
      </div>
    </div>
  );
}

export default Dialog;
