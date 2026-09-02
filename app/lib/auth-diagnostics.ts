import { AsyncLocalStorage } from "node:async_hooks";

export type AuthDiagnosticCode =
  | "AUTH_DB_CONNECTION"
  | "AUTH_DB_SCHEMA"
  | "AUTH_DB_CONFLICT"
  | "AUTH_ADAPTER"
  | "OAUTH_CALLBACK"
  | "AUTH_SERVER";

interface AuthDiagnosticState {
  code: AuthDiagnosticCode | null;
}

const authDiagnosticStorage = new AsyncLocalStorage<AuthDiagnosticState>();

export async function runWithAuthDiagnostics<T>(
  callback: () => Promise<T>
): Promise<{ result: T; code: AuthDiagnosticCode | null }> {
  const state: AuthDiagnosticState = { code: null };
  const result = await authDiagnosticStorage.run(state, callback);
  return { result, code: state.code };
}

export function captureAuthDiagnostic(error: Error): AuthDiagnosticCode {
  const prismaCode = findStringProperty(error, "code");
  const errorType = findStringProperty(error, "type");

  let code: AuthDiagnosticCode;
  if (prismaCode === "P1000" || prismaCode === "P1001" || prismaCode === "P1017") {
    code = "AUTH_DB_CONNECTION";
  } else if (prismaCode === "P2021" || prismaCode === "P2022") {
    code = "AUTH_DB_SCHEMA";
  } else if (prismaCode === "P2002" || prismaCode === "P2003") {
    code = "AUTH_DB_CONFLICT";
  } else if (errorType === "AdapterError") {
    code = "AUTH_ADAPTER";
  } else if (errorType === "CallbackRouteError") {
    code = "OAUTH_CALLBACK";
  } else {
    code = "AUTH_SERVER";
  }

  const state = authDiagnosticStorage.getStore();
  if (state) state.code = code;
  return code;
}

function findStringProperty(root: unknown, property: "code" | "type"): string | null {
  const queue: unknown[] = [root];
  const visited = new Set<object>();

  while (queue.length > 0) {
    const value = queue.shift();
    if (typeof value !== "object" || value === null || visited.has(value)) continue;
    visited.add(value);

    if (property in value) {
      const candidate = Reflect.get(value, property);
      if (typeof candidate === "string") return candidate;
    }

    if ("cause" in value) queue.push(Reflect.get(value, "cause"));
    if ("err" in value) queue.push(Reflect.get(value, "err"));
  }

  return null;
}
