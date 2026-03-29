"use client";

import { useState } from "react";

export type AsyncButtonStatus = "idle" | "loading" | "success" | "error";

type UseAsyncButtonActionOptions<T> = {
  label: string;
  action: () => Promise<T> | T;
  getSuccessMessage?: (result: T) => string;
};

function formatActionError(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected button action failure";
}

export function useAsyncButtonAction<T>({
  label,
  action,
  getSuccessMessage,
}: UseAsyncButtonActionOptions<T>) {
  const [status, setStatus] = useState<AsyncButtonStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function run() {
    if (status === "loading") {
      console.info(`[button:${label}] skipped duplicate click while loading`);
      return undefined;
    }

    console.info(`[button:${label}] starting`);
    setStatus("loading");
    setError(null);
    setFeedback(null);

    try {
      const result = await action();
      const message = getSuccessMessage?.(result) ?? `${label} completed`;
      console.info(`[button:${label}] completed`, result);
      setStatus("success");
      setFeedback(message);
      return result;
    } catch (actionError) {
      const message = formatActionError(actionError);
      console.error(`[button:${label}] failed`, actionError);
      setStatus("error");
      setError(message);
      setFeedback(null);
      return undefined;
    }
  }

  function reset() {
    setStatus("idle");
    setError(null);
    setFeedback(null);
  }

  return {
    run,
    reset,
    status,
    error,
    feedback,
    isLoading: status === "loading",
    isSuccess: status === "success",
    isError: status === "error",
  };
}
