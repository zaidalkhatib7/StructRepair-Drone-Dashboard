import { API_BASE_URL } from "./config.js";

export class ApiError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "ApiError";
    this.status = options.status || 0;
    this.errors = options.errors || {};
    this.payload = options.payload || null;
    this.retryAfter = options.retryAfter || null;
  }
}

function joinUrl(path) {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

async function parseResponse(response) {
  const contentType = response.headers.get("content-type") || "";

  if (response.status === 204) {
    return null;
  }

  if (contentType.includes("application/json")) {
    return response.json();
  }

  return response.text();
}

export async function apiRequest(path, options = {}) {
  const { token, body, headers, ...rest } = options;
  const requestHeaders = new Headers(headers || {});

  if (!requestHeaders.has("Accept")) {
    requestHeaders.set("Accept", "application/json");
  }

  if (token) {
    requestHeaders.set("Authorization", `Bearer ${token}`);
  }

  let requestBody = body;
  if (body !== undefined && !(body instanceof FormData)) {
    if (!requestHeaders.has("Content-Type")) {
      requestHeaders.set("Content-Type", "application/json");
    }
    requestBody = typeof body === "string" ? body : JSON.stringify(body);
  }

  const response = await fetch(joinUrl(path), {
    ...rest,
    headers: requestHeaders,
    body: requestBody
  });

  const payload = await parseResponse(response);

  if (!response.ok) {
    const retryAfter = response.headers.get("Retry-After");
    const message =
      typeof payload === "object" && payload !== null
        ? payload.message || `Request failed with HTTP ${response.status}.`
        : payload || `Request failed with HTTP ${response.status}.`;

    throw new ApiError(message, {
      status: response.status,
      errors: typeof payload === "object" && payload !== null ? payload.errors : {},
      payload,
      retryAfter
    });
  }

  if (payload && typeof payload === "object" && payload.success === false) {
    throw new ApiError(payload.message || "Request failed.", {
      status: response.status,
      errors: payload.errors || {},
      payload
    });
  }

  return payload;
}

export async function downloadRequest(path, token, accept = "application/pdf") {
  const response = await fetch(joinUrl(path), {
    headers: {
      Accept: accept,
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const payload = await parseResponse(response);
    const message =
      typeof payload === "object" && payload !== null
        ? payload.message || `Download failed with HTTP ${response.status}.`
        : payload || `Download failed with HTTP ${response.status}.`;

    throw new ApiError(message, { status: response.status, payload });
  }

  return response.blob();
}

export function mediaAssetUrl(mediaAssetId, token) {
  if (!mediaAssetId || !token) {
    return "";
  }

  return `${API_BASE_URL}/field-media/${mediaAssetId}?token=${encodeURIComponent(token)}`;
}

export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
