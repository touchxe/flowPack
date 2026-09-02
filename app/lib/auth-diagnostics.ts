import { AsyncLocalStorage } from "node:async_hooks";

export type AuthDiagnosticCode =
  | "AUTH_DB_CONNECTION"
  | "AUTH_DB_SCHEMA"
  | "AUTH_DB_CONFLICT"
  | "AUTH_ADAPTER_ACCOUNT_LOOKUP"
  | "AUTH_ADAPTER_EMAIL_LOOKUP"
  | "AUTH_ADAPTER_USER_CREATE"
  | "AUTH_ADAPTER_ACCOUNT_LINK"
  | "AUTH_ADAPTER_USER_UPDATE"
  | "AUTH_ADAPTER"
  | "OAUTH_CALLBACK"
  | "AUTH_SERVER";

interface AuthDiagnosticState {
  code: AuthDiagnosticCode | null;
  adapterMethod: string | null;
}

const authDiagnosticStorage = new AsyncLocalStorage<AuthDiagnosticState>();

export async function runWithAuthDiagnostics<T>(
  callback: () => Promise<T>
): Promise<{ result: T; code: AuthDiagnosticCode | null }> {
  const state: AuthDiagnosticState = { code: null, adapterMethod: null };
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
    code = getAdapterDiagnosticCode(authDiagnosticStorage.getStore()?.adapterMethod);
  } else if (errorType === "CallbackRouteError") {
    code = "OAUTH_CALLBACK";
  } else {
    code = "AUTH_SERVER";
  }

  const state = authDiagnosticStorage.getStore();
  if (state) state.code = code;
  return code;
}

export function captureAuthAdapterMethod(message: string): void {
  if (!message.startsWith("adapter_")) return;
  const state = authDiagnosticStorage.getStore();
  if (state) state.adapterMethod = message.slice("adapter_".length);
}

function getAdapterDiagnosticCode(method: string | null | undefined): AuthDiagnosticCode {
  switch (method) {
    case "getUserByAccount":
    case "getAccount":
      return "AUTH_ADAPTER_ACCOUNT_LOOKUP";
    case "getUserByEmail":
    case "getUser":
      return "AUTH_ADAPTER_EMAIL_LOOKUP";
    case "createUser":
      return "AUTH_ADAPTER_USER_CREATE";
    case "linkAccount":
      return "AUTH_ADAPTER_ACCOUNT_LINK";
    case "updateUser":
      return "AUTH_ADAPTER_USER_UPDATE";
    default:
      return "AUTH_ADAPTER";
  }
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
