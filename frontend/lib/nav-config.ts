export type AppRole = "doctor" | "patient";

export type NavItem = {
  id: string;
  label: string;
  href: string;
  icon: string;
};

export const NAV_BY_ROLE: Record<AppRole, NavItem[]> = {
  doctor: [
    { id: "dashboard", label: "Dashboard", href: "/doctor", icon: "dashboard" },
    { id: "patients", label: "Bệnh nhân", href: "/doctor/patients", icon: "group" },
    { id: "inbox", label: "Hàng việc", href: "/doctor/inbox", icon: "inbox" },
  ],
  patient: [
    { id: "home", label: "Trang chủ", href: "/patient", icon: "dashboard" },
    { id: "meals", label: "Thực đơn", href: "/patient", icon: "restaurant" },
    {
      id: "notifications",
      label: "Thông báo",
      href: "/patient/notifications",
      icon: "notifications",
    },
    { id: "history", label: "Chỉ số sức khỏe", href: "/patient?panel=health", icon: "monitor_heart" },
    { id: "profile", label: "Hồ sơ", href: "/patient/profile", icon: "person" },
  ],
};

const ROLE_HOME: Record<AppRole, string> = {
  doctor: "/doctor",
  patient: "/patient",
};

/** Resolve active nav item id, preferring the longest matching href. */
export function resolveActiveNavId(
  role: AppRole,
  pathname: string,
  activeItemOverride?: string
): string {
  if (activeItemOverride) return activeItemOverride;

  const items = NAV_BY_ROLE[role];
  const home = ROLE_HOME[role];

  if (role === "doctor") {
    if (pathname.startsWith("/doctor/reviews/")) return "patients";
    if (pathname.startsWith("/doctor/inbox")) return "inbox";
  }

  const matches = items.filter((item) => {
    if (item.href === home) {
      return pathname === home;
    }
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  });

  if (matches.length === 0) return items[0]?.id ?? "";

  matches.sort((a, b) => b.href.length - a.href.length);
  return matches[0].id;
}

export const ROLE_META: Record<
  AppRole,
  { displayName: string; roleLabel: string; homeHref: string; brandSubtitle: string }
> = {
  doctor: {
    displayName: "BS. Minh",
    roleLabel: "Bác sĩ",
    homeHref: "/doctor",
    brandSubtitle: "Hệ thống Dinh dưỡng",
  },
  patient: {
    displayName: "Nguyễn Văn A",
    roleLabel: "Bệnh nhân",
    homeHref: "/patient",
    brandSubtitle: "Trợ lý Sức khỏe",
  },
};

export const PATIENT_AVATAR_SRC =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuAAEO489Y9x22XpBDURh5EbYSPORMZ-fqupO1piTVhKxnLwxMBJvDcoBNb8mMUI2oFidOXaMbW8vE8x1KBieFqD63boIjI0T_jx6lhF1X8vIfLhN9vorW753hCqscv9-taa2FEGEPxCywf6ftNRoY65F0cxi8nrKxySOzPFv-WVdPDOe1fzvxMKUwYGVQLmLNvQbHZdDAOu8vh8yEHgIvbGGdnuJOQ32uO3_Qji3yxymqOGAjBFcRtsxQ";

export const DOCTOR_AVATAR_SRC =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuAwL9PNRmLD-Pi64Tmk7dsW5mYBmK7WZw-HCDaxLYZZQmWYmGul1uzxZuwztxdnfM0PxKTq2XmWXUnxGMJCKnaAPnyQ_Rkc8K6GWfeJlmHrtb6fPXjqi1baoc7LcqTBb8HFwCFnOxHbQ3wX2a586eXPmwcPM9gZwZFOYG1JvCgODx5y58AR-sD1VZp6KRKErcS88dfG0c887viJ96i0XZCX7_Vq7jP2hLaGY1_oAwyYEzn03l6HCuJ_XQ";

export const TOPBAR_PATIENT_AVATAR_SRC =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBxHY31kVzCzgHgRGdCYDSFnemw1MldBt3HQzQ42c9ovBpzp_EYy_hq5VzuZDGfB_C840YTDJpU6mHgXJ9OF72CJJYeMvNy1xo5n89jVQ51uU-rnAh55AA5iF0cLWNI14JwtsRBj3wCgSDvblkTh6dqjZ6kX27zHh26wxyrOM6YmHLXDFEH_SK2Ck54D1EV9PEvDCFYOBAclFDCnQRd6oSv4wMSpmpiqt4Q-U7v2V5We1-rYbkTasIYcA";
