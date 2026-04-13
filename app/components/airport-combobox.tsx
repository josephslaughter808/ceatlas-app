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
  const selectedAirport = findAirportByCode(value);

  function commitSelection(nextValue: string) {
    const exact = resolveAirportOption(nextValue);
    if (exact) {
      setQuery(formatAirportLabel(exact));
      onChange(exact.code);
      setOpen(false);
      return true;
    }
    return false;
  }

  useEffect(() => {
    setQuery(selectedAirport ? formatAirportLabel(selectedAirport) : String(value || "").trim().toUpperCase());
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        if (!query.trim()) {
          onChange("");
          return;
        }

        setQuery(selectedAirport ? formatAirportLabel(selectedAirport) : "");
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onChange, query, selectedAirport]);

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

          if (!nextValue.trim()) {
            onChange("");
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            if (!commitSelection(query)) {
              const firstMatch = options[0];
              if (firstMatch) {
                setQuery(formatAirportLabel(firstMatch));
                onChange(firstMatch.code);
                setOpen(false);
              }
            }
          }

          if (event.key === "Escape") {
            setQuery(selectedAirport ? formatAirportLabel(selectedAirport) : "");
            setOpen(false);
          }
        }}
        onBlur={() => {
          window.setTimeout(() => {
            if (!query.trim()) {
              onChange("");
            } else {
              setQuery(selectedAirport ? formatAirportLabel(selectedAirport) : "");
            }
            setOpen(false);
          }, 120);
        }}
        placeholder={placeholder}
        autoComplete="off"
      />

      {open ? (
        <div className="airport-combobox__menu">
          <div className="airport-combobox__hint">
            Click an airport or press Enter to apply it.
          </div>
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
