import React, { useEffect } from "react";

// A centered overlay dialog. Renders its children (an editor form) above the
// current view with a backdrop, so the editor appears wherever you are on the
// page — no scrolling up. Closes on Escape or a click on the backdrop, and
// locks background scrolling while open.
export default function Modal({ onClose, children }) {
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      // Close only when the press starts on the backdrop itself (not when a
      // drag inside the form — e.g. the range picker — releases over it).
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(20,23,28,0.45)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "5vh 16px",
        overflowY: "auto",
      }}
    >
      <div style={{ width: "100%", maxWidth: 760 }} onMouseDown={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
