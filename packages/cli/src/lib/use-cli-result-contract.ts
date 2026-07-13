import { useEffect } from "react";
import { isJsonMode } from "./json-mode.js";

type Options = {
  pending: boolean;
  error: string;
  data: unknown;
  exit: () => void;
  successExitDelayMs?: number;
  errorExitDelayMs?: number;
  formatJsonSuccess?: (data: unknown) => unknown;
  formatJsonError?: (error: string) => unknown;
};

export function useCliResultContract({
  pending,
  error,
  data,
  exit,
  successExitDelayMs = 1500,
  errorExitDelayMs = 2000,
  formatJsonSuccess,
  formatJsonError,
}: Options): { jsonMode: boolean } {
  const jsonMode = isJsonMode();

  useEffect(() => {
    if (pending) return;

    const hasError = !!error;
    if (hasError) {
      process.exitCode = 1;
    }

    if (jsonMode) {
      if (hasError) {
        console.error(
          JSON.stringify(formatJsonError?.(error) ?? { ok: false, error }),
        );
      } else {
        console.log(
          JSON.stringify(formatJsonSuccess?.(data) ?? data, null, 2),
        );
      }
      const timer = setTimeout(() => exit(), 0);
      return () => clearTimeout(timer);
    }

    const timer = setTimeout(
      () => exit(),
      hasError ? errorExitDelayMs : successExitDelayMs,
    );
    return () => clearTimeout(timer);
  }, [
    pending,
    error,
    data,
    exit,
    jsonMode,
    successExitDelayMs,
    errorExitDelayMs,
    formatJsonSuccess,
    formatJsonError,
  ]);

  return { jsonMode };
}