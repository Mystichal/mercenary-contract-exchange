"use client";
import { useState, useEffect, useRef } from "react";
import { searchSystems, type SolarSystem } from "@/lib/systems";

interface Props {
  value: string;
  onChange: (name: string, id: number | null) => void;
}

export default function SystemInput({ value, onChange }: Props) {
  const [results, setResults] = useState<SolarSystem[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.length < 2) { setResults([]); setOpen(false); return; }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const matches = await searchSystems(value);
      setResults(matches);
      setOpen(matches.length > 0);
      setLoading(false);
    }, 300);
  }, [value]);

  function handleInput(v: string) {
    onChange(v, null); // clear id until a system is picked
  }

  function pick(sys: SolarSystem) {
    onChange(sys.name, sys.id);
    setOpen(false);
    setResults([]);
  }

  return (
    <div style={{ position: "relative", marginBottom: 20 }}>
      <div style={{ position: "relative" }}>
        <input
          style={{
            width: "100%", background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(74,158,255,0.2)", borderRadius: 8,
            color: "#e0eaf8", padding: "12px 40px 12px 14px", fontSize: 14, outline: "none",
          }}
          placeholder="Type a system name (e.g. A 2560, M 974...)"
          value={value}
          onChange={e => handleInput(e.target.value)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
        {loading && (
          <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", color: "#4a9eff", fontSize: 12 }}>
            ...
          </span>
        )}
      </div>

      {open && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0, zIndex: 200,
          background: "#0d1e30", border: "1px solid rgba(74,158,255,0.25)",
          borderRadius: 8, marginTop: 4, overflow: "hidden", maxHeight: 280, overflowY: "auto",
        }}>
          {results.map(sys => (
            <div key={sys.id}
              onMouseDown={() => pick(sys)}
              style={{
                padding: "10px 14px", cursor: "pointer", display: "flex",
                alignItems: "center", gap: 10,
                borderBottom: "1px solid rgba(255,255,255,0.05)",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(74,158,255,0.08)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <span style={{ color: "#e0eaf8", fontSize: 14, flex: 1 }}>{sys.name}</span>
              <span style={{ color: "#8aafd4", fontSize: 12 }}>#{sys.id}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
