"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  findAirportByCode,
  formatAirportLabel,
  resolveAirportOption,
  searchAirportOptions,
} from "@/lib/travel/airports";

type AirportComboboxProps = {
  value: string;
  onChange: (airportCode: string) => void;
  placeholder?: string;
};

export default function AirportCombobox({
  value,
  onChange,
  placeholder = "Search airport",
}: AirportComboboxProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const airport = findAirportByCode(value);
    setQuery(airport ? formatAirportLabel(airport) : String(value || "").trim().toUpperCase());
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        const exact = resolveAirportOption(query);
        if (exact) {
          setQuery(formatAirportLabel(exact));
          onChange(exact.code);
        } else if (!query.trim()) {
          onChange("");
        }
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onChange, query]);

  const options = useMemo(() => searchAirportOptions(query, 50), [query]);

  return (
    <div className={`airport-combobox${open ? " is-open" : ""}`} ref={rootRef}>
      <input
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          const nextValue = event.target.value;
          setQuery(nextValue);
          setOpen(true);

          const exact = resolveAirportOption(nextValue);
          if (exact) {
            onChange(exact.code);
            return;
          }

          if (!nextValue.trim()) {
            onChange("");
          }
        }}
        onBlur={() => {
          window.setTimeout(() => {
            const exact = resolveAirportOption(query);
            if (exact) {
              setQuery(formatAirportLabel(exact));
              onChange(exact.code);
            } else if (!query.trim()) {
              onChange("");
            }
            setOpen(false);
          }, 120);
        }}
        placeholder={placeholder}
        autoComplete="off"
      />

      {open ? (
        <div className="airport-combobox__menu">
          {options.length > 0 ? (
            options.map((option) => (
              <button
                key={option.code}
                type="button"
                className={`airport-combobox__option${value === option.code ? " is-active" : ""}`}
                onMouseDown={(event) => {
                  event.preventDefault();
                  setQuery(formatAirportLabel(option));
                  onChange(option.code);
                  setOpen(false);
                }}
              >
                <strong>{option.code}</strong>
                <span>{option.city}</span>
                <small>{option.name}</small>
              </button>
            ))
          ) : (
            <div className="airport-combobox__empty">No airports match that search yet.</div>
          )}
        </div>
      ) : null}
    </div>
  );
}
