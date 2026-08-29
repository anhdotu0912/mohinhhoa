"use client";

import { clampClinical, type ClinicalLimitKey, CLINICAL_LIMITS } from "@/lib/clinical-constraints";

export function ConstraintRangeInput({
  limitKey,
  value,
  disabled,
  onChange,
  className = "w-full h-2.5 bg-surface-container-high rounded-full appearance-none cursor-pointer accent-primary",
}: {
  limitKey: ClinicalLimitKey;
  value: number;
  disabled?: boolean;
  onChange: (value: number) => void;
  className?: string;
}) {
  const spec = CLINICAL_LIMITS[limitKey];
  const clamped = clampClinical(limitKey, value);
  return (
    <input
      type="range"
      min={spec.min}
      max={spec.max}
      step={spec.step}
      value={clamped}
      disabled={disabled}
      aria-valuemin={spec.min}
      aria-valuemax={spec.max}
      aria-valuenow={clamped}
      onChange={(e) => onChange(Number(e.target.value))}
      className={className}
    />
  );
}
