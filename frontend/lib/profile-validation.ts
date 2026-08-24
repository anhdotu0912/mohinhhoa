/** Client-side validators for patient profile / onboarding text fields. */

const LETTER_RE = /[A-Za-z\u00C0-\u024F\u1E00-\u1EFF]/;

export type OptionalFlag = { required?: boolean };

function emptyOrRequired(raw: string, required: boolean, message: string): string | null | undefined {
  const v = raw.trim();
  if (!v) return required ? message : null;
  return undefined;
}

export function sanitizePhoneInput(raw: string): string {
  return raw.replace(/[^\d+\s.\-()]/g, "").slice(0, 16);
}

/** VN mobile: 10 digits starting with 0, or +84 / 84 prefix. Empty is allowed unless required. */
export function validatePhone(raw: string, { required = false }: OptionalFlag = {}): string | null {
  const empty = emptyOrRequired(raw, required, "Nhập số điện thoại.");
  if (empty !== undefined) return empty;

  const digits = raw.trim().replace(/[\s.\-()]/g, "");
  let normalized = digits;
  if (digits.startsWith("+84")) {
    normalized = `0${digits.slice(3)}`;
  } else if (digits.startsWith("84") && digits.length >= 11) {
    normalized = `0${digits.slice(2)}`;
  }

  if (!/^0\d{9}$/.test(normalized)) {
    return "Số điện thoại Việt Nam gồm 10 số, bắt đầu bằng 0.";
  }
  return null;
}

export function validateAddress(raw: string, { required = false }: OptionalFlag = {}): string | null {
  const empty = emptyOrRequired(raw, required, "Nhập địa chỉ.");
  if (empty !== undefined) return empty;

  const v = raw.trim();
  if (v.length < 5) return "Địa chỉ tối thiểu 5 ký tự.";
  if (v.length > 200) return "Địa chỉ tối đa 200 ký tự.";
  if (!LETTER_RE.test(v)) {
    return "Địa chỉ cần chứa chữ cái, ví dụ Quận 1, TP. Hồ Chí Minh.";
  }
  return null;
}

export function sanitizeBloodPressureInput(raw: string): string {
  return raw.replace(/[^0-9/\smmHg]/gi, "").slice(0, 20);
}

/** Accepts `130/80` or `130/80 mmHg`. Empty is allowed unless required. */
export function validateBloodPressure(
  raw: string,
  { required = false }: OptionalFlag = {}
): string | null {
  const empty = emptyOrRequired(raw, required, "Nhập huyết áp.");
  if (empty !== undefined) return empty;

  const m = raw.trim().match(/^(\d{2,3})\s*\/\s*(\d{2,3})(?:\s*mm\s*Hg)?$/i);
  if (!m) return "Huyết áp theo dạng tâm thu/tâm trương, ví dụ 130/80.";

  const sys = Number(m[1]);
  const dia = Number(m[2]);
  if (sys < 70 || sys > 250 || dia < 40 || dia > 150) {
    return "Giá trị huyết áp ngoài khoảng hợp lệ.";
  }
  if (sys <= dia) return "Huyết áp tâm thu phải lớn hơn tâm trương.";
  return null;
}

export function sanitizeBloodGlucoseInput(raw: string): string {
  return raw.replace(/[^0-9.,\s/a-zA-Z]/g, "").slice(0, 24);
}

/** Accepts `135`, `135 mg/dL`, or `7.5 mmol/L`. Empty is allowed unless required. */
export function validateBloodGlucose(
  raw: string,
  { required = false }: OptionalFlag = {}
): string | null {
  const empty = emptyOrRequired(raw, required, "Nhập đường huyết.");
  if (empty !== undefined) return empty;

  const v = raw.trim().replace(",", ".");
  const m = v.match(/^(\d+(?:\.\d+)?)\s*(mg\/dL|mmol\/L|mmol)?$/i);
  if (!m) return "Đường huyết là số, ví dụ 135 mg/dL hoặc 7.5 mmol/L.";

  const n = Number(m[1]);
  const unitRaw = m[2]?.toLowerCase();
  // No unit: values under 40 are treated as mmol/L (common VN entry like "5.8").
  const isMmol = unitRaw ? unitRaw.startsWith("mmol") : n < 40;
  if (isMmol) {
    if (n < 2 || n > 33) return "Đường huyết mmol/L hợp lệ khoảng 2–33.";
  } else if (n < 40 || n > 600) {
    return "Đường huyết mg/dL hợp lệ khoảng 40–600.";
  }
  return null;
}

export function validatePositiveInt(
  raw: string,
  min: number,
  max: number,
  label: string
): string | null {
  const v = raw.trim();
  if (!v) return `Nhập ${label.toLowerCase()}.`;
  if (!/^\d+$/.test(v)) return `${label} phải là số nguyên.`;
  const n = Number(v);
  if (n < min || n > max) return `${label} hợp lệ từ ${min}–${max}.`;
  return null;
}

export function validatePositiveNumber(
  raw: string,
  min: number,
  max: number,
  label: string
): string | null {
  const v = raw.trim().replace(",", ".");
  if (!v) return `Nhập ${label.toLowerCase()}.`;
  if (!/^\d+(\.\d+)?$/.test(v)) return `${label} phải là số.`;
  const n = Number(v);
  if (n < min || n > max) return `${label} hợp lệ từ ${min}–${max}.`;
  return null;
}

export function validateFreeTextLabel(
  raw: string,
  opts: { required?: boolean; min?: number; max?: number; label?: string } = {}
): string | null {
  const { required = false, min = 3, max = 120, label = "Nội dung" } = opts;
  const empty = emptyOrRequired(raw, required, `Nhập ${label.toLowerCase()}.`);
  if (empty !== undefined) return empty;

  const v = raw.trim();
  if (v.length < min) return `${label} tối thiểu ${min} ký tự.`;
  if (v.length > max) return `${label} tối đa ${max} ký tự.`;
  if (!LETTER_RE.test(v)) {
    return `${label} cần chứa chữ cái, không chỉ số hay ký tự đặc biệt.`;
  }
  return null;
}

export function validatePreferencesText(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  if (v.length > 500) return "Sở thích ăn uống tối đa 500 ký tự.";
  const items = v
    .split(/[,;\n]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  for (const item of items) {
    const err = validateFreeTextLabel(item, {
      min: 2,
      max: 80,
      label: "Sở thích",
    });
    if (err) return err;
  }
  return null;
}

export function firstFieldError(errors: Record<string, string | undefined>): string | null {
  return Object.values(errors).find((msg): msg is string => Boolean(msg)) ?? null;
}
