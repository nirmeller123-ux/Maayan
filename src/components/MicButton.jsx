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
    rec.onresult = (e) => {
      // Emit each finalized result exactly once. Some browsers re-deliver the
      // same final result on later events; tracking processed.current (and only
      // advancing past finals, breaking at the first interim) prevents the
      // duplicate insertion that repeated a dictated phrase several times.
      for (let k = processed.current; k < e.results.length; k++) {
        const r = e.results[k];
        if (!r.isFinal) break;
        processed.current = k + 1;
        const t = r[0].transcript.trim();
        if (t) {
          acc.current = acc.current ? `${acc.current} ${t}` : t;
          onText && onText(t);
        }
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
