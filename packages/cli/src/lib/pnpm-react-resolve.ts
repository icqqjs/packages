import { createRequire, register } from "node:module";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

let installed = false;

/** 从模块文件向上查找 package.json（dist/lib 需上溯到包根目录）。 */
export function findPackageJsonPath(fromFileUrl: string | URL): string | null {
  let dir = dirname(fileURLToPath(fromFileUrl));
  for (;;) {
    const candidate = join(dir, "package.json");
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/**
 * pnpm v11 全局安装时 @inkjs/ui 可能位于 store/links，无法解析其隐式依赖 react。
 * 在加载 pastel 前注册 resolve 钩子，将 react 指向本包依赖树。
 */
export function installPnpmReactResolveHook(): void {
  if (installed) return;
  installed = true;

  const pkgJson = findPackageJsonPath(import.meta.url);
  if (!pkgJson) return;

  let reactUrl: string;
  try {
    reactUrl = pathToFileURL(createRequire(pkgJson).resolve("react")).href;
  } catch {
    return;
  }

  const hookSource = `
export async function resolve(specifier, context, nextResolve) {
  if (specifier === "react" || specifier.startsWith("react/")) {
    const parent = context.parentURL ?? "";
    if (shouldRedirectReact(parent)) {
      if (specifier === "react") {
        return { url: ${JSON.stringify(reactUrl)}, shortCircuit: true };
      }
      return nextResolve(specifier, {
        ...context,
        parentURL: ${JSON.stringify(reactUrl)},
      });
    }
  }
  return nextResolve(specifier, context);
}

function shouldRedirectReact(parent) {
  if (!parent) return false;
  return (
    !parent.includes("/node_modules/react/") &&
    !parent.includes("\\\\node_modules\\\\react\\\\")
  );
}
`;

  register(`data:text/javascript,${encodeURIComponent(hookSource)}`, import.meta.url);
}
