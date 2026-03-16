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

  function pick(sys: SolarSystem) {
    onChange(sys.name, sys.id);
    setOpen(false);
    setResults([]);
  }

  return (
    <div style={{ position: "relative", marginBottom: 16 }}>
      <div style={{ position: "relative" }}>
        <input
          style={{
            width: "100%", padding: "9px 32px 9px 11px",
            background: "var(--surface-input)", border: "1px solid var(--border-bright)",
            color: "var(--text-bright)", fontSize: 12, borderRadius: 0,
          }}
          placeholder="TYPE SYSTEM NAME..."
          value={value}
          onChange={e => onChange(e.target.value, null)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
        {loading && (
          <span style={{
            position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
            color: "var(--accent)", fontSize: 10,
          }}>···</span>
        )}
      </div>

      {open && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0, zIndex: 200,
          background: "var(--panel-header)",
          border: "1px solid var(--border-bright)",
          borderTop: "1px solid var(--accent)",
          maxHeight: 220, overflowY: "auto",
        }}>
          {results.map(sys => (
            <div key={sys.id}
              onMouseDown={() => pick(sys)}
              style={{
                padding: "8px 12px", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 12,
                borderBottom: "1px solid var(--border)",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--panel-hover)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <span style={{ color: "var(--text-bright)", fontSize: 12, flex: 1, letterSpacing: "0.05em" }}>
                {sys.name}
              </span>
              <span style={{ color: "var(--text-muted)", fontSize: 10 }}>#{sys.id}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
