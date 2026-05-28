export const PACKAGE_MANAGERS = ["pnpm", "npm", "cnpm", "yarn"] as const;
export type PackageManager = (typeof PACKAGE_MANAGERS)[number];
