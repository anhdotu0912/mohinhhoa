"use client";

import { useState, useRef, useEffect } from "react";

export interface DropdownOption {
  value: string;
  label: string;
  icon?: string;
  description?: string;
}

export interface DropdownProps {
  options: (DropdownOption | string)[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  className?: string;
}

export function Dropdown({
  options,
  value,
  onChange,
  placeholder = "Chọn một tùy chọn",
  label,
  required = false,
  disabled = false,
  error,
  className = "",
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Normalize options to DropdownOption format
  const normalizedOptions: DropdownOption[] = options.map((opt) =>
    typeof opt === "string" ? { value: opt, label: opt } : opt
  );

  const selectedOption = normalizedOptions.find((opt) => opt.value === value);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
  };

  return (
    <div className={`relative w-full ${className}`} ref={containerRef}>
      {label && (
        <label className="block font-label text-label text-on-surface mb-xs text-xs font-semibold">
          {label} {required && <span className="text-error">*</span>}
        </label>
      )}

      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-md py-sm bg-surface-container-lowest border rounded-xl text-sm font-body text-left flex items-center justify-between gap-sm transition-all cursor-pointer shadow-2xs ${
          disabled
            ? "opacity-50 cursor-not-allowed bg-surface-container-low"
            : isOpen
            ? "border-primary ring-2 ring-primary/10 shadow-xs"
            : error
            ? "border-error focus:ring-2 focus:ring-error/20"
            : "border-outline-variant hover:border-primary/50"
        }`}
      >
        <div className="flex items-center gap-xs truncate">
          {selectedOption?.icon && (
            <span className="material-symbols-outlined text-[18px] text-primary shrink-0">
              {selectedOption.icon}
            </span>
          )}
          <span
            className={`truncate text-sm ${
              selectedOption ? "text-on-surface font-medium" : "text-on-surface-variant/70"
            }`}
          >
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>

        <span
          className={`material-symbols-outlined text-[20px] text-on-surface-variant transition-transform duration-200 shrink-0 ${
            isOpen ? "rotate-180 text-primary" : ""
          }`}
        >
          expand_more
        </span>
      </button>

      {/* Error Message */}
      {error && <p className="text-xs text-error mt-xs font-caption">{error}</p>}

      {/* Dropdown Menu Popup */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-surface-container-lowest border border-outline-variant rounded-xl shadow-xl py-1.5 max-h-60 overflow-y-auto animate-slide-down">
          {normalizedOptions.length === 0 ? (
            <div className="px-md py-sm text-xs text-on-surface-variant text-center">
              Không có tùy chọn
            </div>
          ) : (
            normalizedOptions.map((option) => {
              const isSelected = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  className={`w-full px-md py-2.5 text-left text-xs font-body flex items-center justify-between gap-sm transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-primary/10 text-primary font-bold"
                      : "text-on-surface hover:bg-surface-bright"
                  }`}
                >
                  <div className="flex items-center gap-xs min-w-0">
                    {option.icon && (
                      <span className="material-symbols-outlined text-[16px] text-primary shrink-0">
                        {option.icon}
                      </span>
                    )}
                    <div>
                      <p className="truncate font-semibold">{option.label}</p>
                      {option.description && (
                        <p className="text-[11px] text-on-surface-variant/80 font-normal truncate mt-0.5">
                          {option.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {isSelected && (
                    <span className="material-symbols-outlined text-[16px] text-primary shrink-0">
                      check
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
