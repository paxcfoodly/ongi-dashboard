import { useEffect } from 'react';
import type { ReactNode } from 'react';

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-border rounded-lg shadow-xl w-full max-w-md max-h-full flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex-none flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-text">{title}</h2>
          <button onClick={onClose} className="text-text-dim hover:text-danger text-lg leading-none" aria-label="닫기">
            ×
          </button>
        </header>
        {/* 화면보다 길면 내용만 스크롤해 저장 버튼이 항상 보이게 한다 */}
        <div className="p-4 space-y-3 min-h-0 overflow-y-auto">{children}</div>
        {footer && <footer className="flex-none px-4 py-3 border-t border-border flex justify-end gap-2">{footer}</footer>}
      </div>
    </div>
  );
}
