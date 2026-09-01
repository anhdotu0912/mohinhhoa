/**
 * Curated preset avatars for patient profiles (SVG Data URIs).
 * Fast, self-contained, no external network dependencies.
 */

export interface AvatarPreset {
  id: string;
  name: string;
  category: "senior" | "adult" | "wellness";
  svgDataUri: string;
}

export const AVATAR_PRESETS: AvatarPreset[] = [
  {
    id: "senior-male",
    name: "Bác Nam (Cao tuổi)",
    category: "senior",
    svgDataUri: `data:image/svg+xml;utf8,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" fill="none">
        <circle cx="60" cy="60" r="60" fill="#E6F4F1"/>
        <!-- Shoulders -->
        <path d="M20 112c0-22 18-36 40-36s40 14 40 36" fill="#006A6A"/>
        <!-- Neck & Head -->
        <rect x="52" y="68" width="16" height="18" rx="8" fill="#FAD0B1"/>
        <circle cx="60" cy="52" r="26" fill="#FCD9BD"/>
        <!-- Grey Hair -->
        <path d="M34 50c0-16 12-28 26-28s26 12 26 28c-4-4-10-6-16-6-8 0-14 4-20 4-6 0-12-2-16 2z" fill="#94A3B8"/>
        <!-- Eyebrows -->
        <path d="M48 44c3-1 7 0 9 2" stroke="#64748B" stroke-width="2.5" stroke-linecap="round"/>
        <path d="M72 44c-3-1-7 0-9 2" stroke="#64748B" stroke-width="2.5" stroke-linecap="round"/>
        <!-- Eyes -->
        <circle cx="51" cy="50" r="2.5" fill="#334155"/>
        <circle cx="69" cy="50" r="2.5" fill="#334155"/>
        <!-- Glasses -->
        <rect x="44" y="45" width="14" height="10" rx="3" stroke="#475569" stroke-width="2" fill="rgba(255,255,255,0.4)"/>
        <rect x="62" y="45" width="14" height="10" rx="3" stroke="#475569" stroke-width="2" fill="rgba(255,255,255,0.4)"/>
        <path d="M58 50h4" stroke="#475569" stroke-width="2"/>
        <!-- Nose -->
        <path d="M60 52v4c0 1.5-1 2-2 2" stroke="#E29D72" stroke-width="2" stroke-linecap="round"/>
        <!-- Kind Smile -->
        <path d="M52 64c2.5 3 13.5 3 16 0" stroke="#B45309" stroke-width="2" stroke-linecap="round"/>
      </svg>
    `)}`,
  },
  {
    id: "senior-female",
    name: "Bác Nữ (Cao tuổi)",
    category: "senior",
    svgDataUri: `data:image/svg+xml;utf8,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" fill="none">
        <circle cx="60" cy="60" r="60" fill="#FDF2E9"/>
        <!-- Shoulders -->
        <path d="M22 112c0-20 17-34 38-34s38 14 38 34" fill="#D97706"/>
        <!-- Scarf / Collar -->
        <path d="M46 76l14 16 14-16c-9 2-19 2-28 0z" fill="#FEF3C7"/>
        <!-- Neck & Head -->
        <rect x="52" y="68" width="16" height="18" rx="8" fill="#FAD0B1"/>
        <circle cx="60" cy="52" r="26" fill="#FCD9BD"/>
        <!-- Soft Silver Perm Hair -->
        <path d="M34 56c-4-18 6-32 26-32s30 14 26 32c-3-2-6-3-10-3-6 0-11 3-16 3s-10-3-16-3c-4 0-7 1-10 3z" fill="#A8A29E"/>
        <circle cx="36" cy="46" r="8" fill="#A8A29E"/>
        <circle cx="84" cy="46" r="8" fill="#A8A29E"/>
        <!-- Eyebrows -->
        <path d="M48 45c3-1 6 0 8 2" stroke="#78716C" stroke-width="2" stroke-linecap="round"/>
        <path d="M72 45c-3-1-6 0-8 2" stroke="#78716C" stroke-width="2" stroke-linecap="round"/>
        <!-- Eyes with gentle wrinkles -->
        <path d="M48 51c2-1 4-1 6 0" stroke="#44403C" stroke-width="2.5" stroke-linecap="round"/>
        <path d="M66 51c2-1 4-1 6 0" stroke="#44403C" stroke-width="2.5" stroke-linecap="round"/>
        <!-- Nose -->
        <path d="M60 52v4c0 1-1 1.5-2 1.5" stroke="#E29D72" stroke-width="2" stroke-linecap="round"/>
        <!-- Warm Smile -->
        <path d="M52 64c3 3 13 3 16 0" stroke="#DC2626" stroke-width="2.2" stroke-linecap="round"/>
        <!-- Pearl Earrings -->
        <circle cx="36" cy="54" r="3" fill="#FFFFFF"/>
        <circle cx="84" cy="54" r="3" fill="#FFFFFF"/>
      </svg>
    `)}`,
  },
  {
    id: "adult-male",
    name: "Nam (Trẻ / Trung niên)",
    category: "adult",
    svgDataUri: `data:image/svg+xml;utf8,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" fill="none">
        <circle cx="60" cy="60" r="60" fill="#EEF2FF"/>
        <!-- Shoulders -->
        <path d="M20 112c0-22 18-36 40-36s40 14 40 36" fill="#2563EB"/>
        <!-- Neck & Head -->
        <rect x="52" y="68" width="16" height="18" rx="8" fill="#FCD34D"/>
        <circle cx="60" cy="52" r="26" fill="#FDE68A"/>
        <!-- Modern Hair -->
        <path d="M34 46c0-16 12-24 26-24s26 8 26 24c-5-3-12-5-18-4-8 1-14 6-22 5-5-1-9-4-12-1z" fill="#1E293B"/>
        <!-- Eyes -->
        <circle cx="50" cy="50" r="3" fill="#0F172A"/>
        <circle cx="70" cy="50" r="3" fill="#0F172A"/>
        <!-- Smile -->
        <path d="M52 62c3 4 13 4 16 0" stroke="#0F172A" stroke-width="2.5" stroke-linecap="round"/>
      </svg>
    `)}`,
  },
  {
    id: "adult-female",
    name: "Nữ (Trẻ / Trung niên)",
    category: "adult",
    svgDataUri: `data:image/svg+xml;utf8,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" fill="none">
        <circle cx="60" cy="60" r="60" fill="#FDF4FF"/>
        <!-- Shoulders -->
        <path d="M22 112c0-20 17-34 38-34s38 14 38 34" fill="#9333EA"/>
        <!-- Neck & Head -->
        <rect x="52" y="68" width="16" height="18" rx="8" fill="#FED7AA"/>
        <circle cx="60" cy="52" r="26" fill="#FFEDD5"/>
        <!-- Long Hair -->
        <path d="M32 54c-2-18 8-32 28-32s30 14 28 32c-3-2-7-3-12-3-8 0-14 4-20 4-6 0-12-2-16 2-4 5-6 12-8 20z" fill="#3B0764"/>
        <path d="M30 65c-2 10 2 20 4 25" stroke="#3B0764" stroke-width="6" stroke-linecap="round"/>
        <path d="M90 65c2 10-2 20-4 25" stroke="#3B0764" stroke-width="6" stroke-linecap="round"/>
        <!-- Eyes -->
        <circle cx="50" cy="51" r="3" fill="#18181B"/>
        <circle cx="70" cy="51" r="3" fill="#18181B"/>
        <!-- Blush -->
        <circle cx="44" cy="57" r="4" fill="#F472B6" fill-opacity="0.5"/>
        <circle cx="76" cy="57" r="4" fill="#F472B6" fill-opacity="0.5"/>
        <!-- Sweet Smile -->
        <path d="M53 62c2.5 3 11.5 3 14 0" stroke="#BE185D" stroke-width="2.5" stroke-linecap="round"/>
      </svg>
    `)}`,
  },
  {
    id: "nutrition-wellness",
    name: "Sống khỏe & Dinh dưỡng",
    category: "wellness",
    svgDataUri: `data:image/svg+xml;utf8,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" fill="none">
        <circle cx="60" cy="60" r="60" fill="#ECFDF5"/>
        <!-- Green Apple / Heart Shape -->
        <path d="M60 96c-18 0-32-14-32-34 0-18 12-28 24-28 6 0 8 3 8 3s2-3 8-3c12 0 24 10 24 28 0 20-14 34-32 34z" fill="#059669"/>
        <!-- Leaf -->
        <path d="M60 38c0-8 6-14 14-14 0 8-6 14-14 14z" fill="#10B981"/>
        <path d="M60 38c-2-5-2-10 0-14" stroke="#047857" stroke-width="2.5" stroke-linecap="round"/>
        <!-- Cute Eyes -->
        <circle cx="48" cy="62" r="3.5" fill="#FFFFFF"/>
        <circle cx="72" cy="62" r="3.5" fill="#FFFFFF"/>
        <!-- Happy Smile -->
        <path d="M52 74c3 4 13 4 16 0" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round"/>
      </svg>
    `)}`,
  },
  {
    id: "medical-care",
    name: "Chăm sóc Y tế (Clinical)",
    category: "wellness",
    svgDataUri: `data:image/svg+xml;utf8,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" fill="none">
        <circle cx="60" cy="60" r="60" fill="#F0FDF4"/>
        <!-- Shield -->
        <path d="M60 22l30 12v26c0 22-14 38-30 44-16-6-30-22-30-44V34l30-12z" fill="#006A6A"/>
        <!-- Inner Medical Cross -->
        <path d="M52 46h16v10h10v16H68v10H52V72H42V56h10V46z" fill="#34D399"/>
        <path d="M54 48h12v10h10v12H66v10H54V70H44V58h10V48z" fill="#FFFFFF"/>
      </svg>
    `)}`,
  },
];
