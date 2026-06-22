import fs from "node:fs/promises";
import { getGithubTokenPath, getIcqqHome } from "./paths.js";

/** 保存 GitHub PAT。 */
export async function saveGithubToken(token: string): Promise<void> {
  const trimmed = token.trim();
  if (!trimmed) return;
  await fs.mkdir(getIcqqHome(), { recursive: true, mode: 0o700 });
  await fs.writeFile(getGithubTokenPath(), `${trimmed}\n`, { mode: 0o600 });
}
