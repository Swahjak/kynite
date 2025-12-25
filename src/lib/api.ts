// src/lib/api.ts

export class ApiError extends Error {
  code: string;
  status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}

export async function apiFetch<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: HeadersInit = {
    ...options.headers,
  };

  // Add Content-Type for mutating requests
  if (["POST", "PUT", "PATCH"].includes(options.method ?? "GET")) {
    (headers as Record<string, string>)["Content-Type"] = "application/json";
  }

  const response = await fetch(url, { ...options, headers });
  const json: ApiResponse<T> = await response.json().catch(() => ({
    success: false,
    error: { code: "PARSE_ERROR", message: `HTTP ${response.status}` },
  }));

  if (!response.ok || !json.success) {
    throw new ApiError(
      json.error?.message ?? `HTTP ${response.status}`,
      json.error?.code ?? "UNKNOWN_ERROR",
      response.status
    );
  }

  return json.data as T;
}
