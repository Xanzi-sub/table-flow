import { FunctionsHttpError } from "@supabase/supabase-js";

/** Extracts the real error message an Edge Function returned in its response body. */
export async function getFunctionErrorMessage(error: unknown, fallback: string) {
  if (error instanceof FunctionsHttpError) {
    const status = error.context?.status;
    try {
      const body = await error.context.json();
      const message = body?.error ?? body?.message ?? body?.msg;
      if (typeof message === "string") {
        return status ? `${message} (HTTP ${status})` : message;
      }
    } catch {
      // response body wasn't JSON — fall through below
    }
    if (status === 404) {
      return 'Edge Function not found (HTTP 404) — has it been deployed with "supabase functions deploy"?';
    }
    if (status) return `${fallback} (HTTP ${status})`;
  }
  return error instanceof Error ? error.message : fallback;
}
