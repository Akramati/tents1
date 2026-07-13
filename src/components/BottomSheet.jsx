"use client";
import { useEffect, useRef } from "react";

export default function BottomSheet({ show, title, children, onClose, className = "" }) {
  const sheetRef = useRef(null);

  useEffect(() => {
    if (show) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [show]);

  if (!show) return null;

  return (
    <>
      <div className="bottom-sheet-overlay" onClick={onClose} />
      <div className={`bottom-sheet ${className}`} ref={sheetRef}>
        <div className="bottom-sheet-handle" onClick={onClose}>
          <div className="bottom-sheet-handle-bar" />
        </div>
        {title && (
          <div className="bottom-sheet-header">
            <h3>{title}</h3>
            <button className="bottom-sheet-close" onClick={onClose}>✕</button>
          </div>
        )}
        <div className="bottom-sheet-body">
          {children}
        </div>
      </div>

      <style>{`
        .bottom-sheet-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.5);
          backdrop-filter: blur(4px); z-index: 2000;
          animation: fadeIn 0.2s ease;
        }
        .bottom-sheet {
          position: fixed; bottom: 0; left: 0; right: 0;
          background: var(--card-bg, #1e293b);
          border-radius: 20px 20px 0 0;
          z-index: 2001;
          max-height: 85vh;
          overflow-y: auto;
          padding: 0.75rem 1.25rem 1.5rem;
          direction: rtl;
          animation: slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 -8px 32px rgba(0,0,0,0.3);
        }
        .bottom-sheet-handle {
          display: flex; justify-content: center;
          padding: 0.5rem 0; cursor: pointer;
        }
        .bottom-sheet-handle-bar {
          width: 40px; height: 4px;
          background: rgba(255,255,255,0.25);
          border-radius: 4px;
        }
        .bottom-sheet-header {
          display: flex; justify-content: space-between;
          align-items: center; margin-bottom: 1rem;
        }
        .bottom-sheet-header h3 {
          margin: 0; font-size: 1.1rem;
        }
        .bottom-sheet-close {
          width: 32px; height: 32px; border-radius: 50%;
          border: 1px solid rgba(255,255,255,0.1);
          background: transparent; color: inherit;
          font-size: 1rem; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
        }
        .bottom-sheet-close:hover { background: #ef4444; color: white; border-color: #ef4444; }
        .bottom-sheet-body { min-height: 50px; }

        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @media (min-width: 768px) {
          .bottom-sheet {
            max-width: 500px;
            left: 50%; right: auto;
            transform: translateX(-50%);
            border-radius: 20px;
            bottom: 2rem;
            max-height: 80vh;
          }
          .bottom-sheet-overlay {
            display: flex; align-items: center; justify-content: center;
          }
        }
      `}</style>
    </>
  );
}