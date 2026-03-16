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
    <div style={{ position: "relative", marginBottom: 18 }}>
      <div style={{ position: "relative" }}>
        <input
          style={{
            width: "100%",
            padding: "10px 36px 10px 12px",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            color: "var(--text)",
            fontSize: 13,
            borderRadius: 2,
          }}
          placeholder="TYPE SYSTEM NAME..."
          value={value}
          onChange={e => onChange(e.target.value, null)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
        {loading && (
          <span style={{
            position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
            color: "var(--accent)", fontSize: 10, letterSpacing: "0.1em",
          }}>
            ...
          </span>
        )}
      </div>

      {open && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0, zIndex: 200,
          background: "var(--surface-2)",
          border: "1px solid var(--border-bright)",
          borderTop: "1px solid var(--accent)",
          maxHeight: 240, overflowY: "auto",
        }}>
          {results.map(sys => (
            <div key={sys.id}
              onMouseDown={() => pick(sys)}
              style={{
                padding: "9px 12px", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 12,
                borderBottom: "1px solid var(--border)",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--accent-dim)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <span style={{ color: "var(--text)", fontSize: 13, flex: 1, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {sys.name}
              </span>
              <span style={{ color: "var(--text-muted)", fontSize: 11 }}>#{sys.id}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
