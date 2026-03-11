"use client";
import { useState } from "react";
import { searchSystems, systemByName, SECURITY_COLORS, type SolarSystem } from "@/lib/systems";

interface Props {
  value: string;
  onChange: (name: string, id: number | null) => void;
}

export default function SystemInput({ value, onChange }: Props) {
  const [results, setResults] = useState<SolarSystem[]>([]);
  const [open, setOpen] = useState(false);

  function handleInput(v: string) {
    const matches = searchSystems(v);
    setResults(matches);
    setOpen(v.length > 0 && matches.length > 0);

    // If exact match, resolve ID
    const exact = systemByName(v);
    onChange(v, exact?.id ?? null);
  }

  function pick(sys: SolarSystem) {
    onChange(sys.name, sys.id);
    setOpen(false);
    setResults([]);
  }

  return (
    <div style={{ position: "relative", marginBottom: 20 }}>
      <input
        style={{
          width: "100%", background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(74,158,255,0.2)", borderRadius: 8,
          color: "#e0eaf8", padding: "12px 14px", fontSize: 14, outline: "none",
        }}
        placeholder="e.g. Jita, Amarr, Amamake..."
        value={value}
        onChange={e => handleInput(e.target.value)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onFocus={() => value && setOpen(results.length > 0)}
      />
      {open && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0, zIndex: 200,
          background: "#0d1e30", border: "1px solid rgba(74,158,255,0.25)",
          borderRadius: 8, marginTop: 4, overflow: "hidden",
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
              <span style={{
                fontSize: 10, padding: "2px 7px", borderRadius: 4, fontWeight: 600,
                background: `${SECURITY_COLORS[sys.security]}22`,
                color: SECURITY_COLORS[sys.security],
              }}>
                {sys.security.replace("sec", "").toUpperCase()}
              </span>
              <span style={{ color: "#e0eaf8", fontSize: 14 }}>{sys.name}</span>
              <span style={{ color: "#8aafd4", fontSize: 12, marginLeft: "auto" }}>#{sys.id}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
