"use client";

export default function ConfirmModal({ show, title, message, confirmLabel, confirmClass, onConfirm, onCancel, disabled, children }) {
  if (!show) return null;
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{maxWidth:"400px"}}>
        <div className="modal-header">
          <h2>{title || "تأكيد"}</h2>
          <button className="modal-close" onClick={onCancel}>✕</button>
        </div>
        <div className="modal-body">
          <p>{message}</p>
          {children}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onCancel}>إلغاء</button>
          <button className={confirmClass || "btn btn-danger"} onClick={onConfirm} disabled={disabled}>
            {confirmLabel || "تأكيد"}
          </button>
        </div>
      </div>
    </div>
  );
}