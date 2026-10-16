import { type ReactNode, useEffect } from "react";

export function Modal({ title, children, onClose, wide }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? "wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="panel-head">
          <h2>{title}</h2>
          <button type="button" className="tool" onClick={onClose} aria-label="Close">
            &#10005;
          </button>
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}