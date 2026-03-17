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
    <div style={{ position: "relative" }}>
      <div style={{ position: "relative" }}>
        <input
          style={{ paddingRight: 32 }}
          placeholder="Type system name..."
          value={value}
          onChange={e => onChange(e.target.value, null)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
        {loading && (
          <span style={{
            position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
            color: "var(--primary)", fontSize: 10, letterSpacing: "0.1em",
          }}>{"\u00B7\u00B7\u00B7"}</span>
        )}
      </div>

      {open && (
        <div className="dropdown-list">
          {results.map(sys => (
            <div key={sys.id} className="dropdown-item" onMouseDown={() => pick(sys)}>
              <span className="dropdown-item-name">{sys.name}</span>
              <span className="dropdown-item-id">#{sys.id}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
