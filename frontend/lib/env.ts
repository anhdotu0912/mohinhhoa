/** Cờ môi trường build-time — mirror backend `APP_ENV` (contracts/api-v1.md). */
export const isProduction = process.env.NEXT_PUBLIC_APP_ENV === "production";
