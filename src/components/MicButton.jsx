import React, { useRef, useState, useEffect } from "react";
import { NAVY } from "../lib/constants";

const SR = typeof window !== "undefined" ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
export const speechSupported = !!SR;

// A small push-to-talk button built on the browser's Web Speech API (free, no
// backend). While listening it calls onText(chunk) for each finalized phrase
// (good for live dictation); when it stops it calls onFinish(fullTranscript)
// once (good for "capture a whole message, then act on it"). Renders nothing
// where the browser lacks speech recognition (e.g. some iOS setups).
export default function MicButton({ onText, onFinish, lang = "he-IL", title = "Speak", label = "Speak" }) {
  const [listening, setListening] = useState(false);
  const recRef = useRef(null);
  const acc = useRef("");
  const processed = useRef(0); // # of final results already emitted this session
  const lastEmit = useRef(""); // last emitted phrase, to drop consecutive dupes

  useEffect(() => () => { try { recRef.current?.stop(); } catch { /* noop */ } }, []);

  if (!SR) return null;

  function toggle() {
    if (listening) {
      try { recRef.current?.stop(); } catch { /* noop */ }
      return;
    }
    const rec = new SR();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    acc.current = "";
    processed.current = 0;
    lastEmit.current = "";
    rec.onresult = (e) => {
      // Emit each finalized phrase once. Two mobile-browser quirks cause the
      // dictated text to repeat: (1) the same final result is re-delivered on
      // later events — handled by the processed cursor (only advance past
      // finals, break at the first interim); (2) the same phrase is appended
      // as a *new* final entry — handled by skipping a final identical to the
      // one just emitted.
      for (let k = processed.current; k < e.results.length; k++) {
        const r = e.results[k];
        if (!r.isFinal) break;
        processed.current = k + 1;
        const t = r[0].transcript.trim();
        if (!t || t === lastEmit.current) continue;
        lastEmit.current = t;
        acc.current = acc.current ? `${acc.current} ${t}` : t;
        onText && onText(t);
      }
    };
    rec.onend = () => {
      setListening(false);
      if (onFinish && acc.current) onFinish(acc.current);
    };
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    try { rec.start(); setListening(true); } catch { setListening(false); }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      title={title}
      className="text-xs px-3 py-1 rounded-full font-medium inline-flex items-center gap-1.5"
      style={listening ? { background: "#B3261E", color: "#fff" } : { background: NAVY, color: "#fff" }}
    >
      {listening ? "● Listening…" : `🎤 ${label}`}
    </button>
  );
}
