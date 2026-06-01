export const FIELD_BACKEND_ORIGIN = (
  import.meta.env.VITE_FIELD_BACKEND_ORIGIN ||
  import.meta.env.VITE_API_BASE_URL ||
  "http://droneapi.test"
).replace(/\/$/, "");

export const FIELD_API_BASE_URL = (
  import.meta.env.VITE_FIELD_API_BASE_URL || `${FIELD_BACKEND_ORIGIN}/api/v1`
).replace(/\/$/, "");

export const CLOUD_BACKEND_ORIGIN = (
  import.meta.env.VITE_CLOUD_BACKEND_ORIGIN || "http://207.180.254.216:8082"
).replace(/\/$/, "");

export const CLOUD_API_BASE_URL = (
  import.meta.env.VITE_CLOUD_API_BASE_URL || `${CLOUD_BACKEND_ORIGIN}/api/v1`
).replace(/\/$/, "");

export const API_BASE_URL = FIELD_BACKEND_ORIGIN;

export const REVERB = {
  host: import.meta.env.VITE_REVERB_HOST || "127.0.0.1",
  port: import.meta.env.VITE_REVERB_PORT || "8090",
  key: import.meta.env.VITE_REVERB_KEY || "local-key",
  scheme: import.meta.env.VITE_REVERB_SCHEME || "ws"
};

export const REALTIME_HELPER_URL = (
  import.meta.env.VITE_REALTIME_HELPER_URL || "http://127.0.0.1:5010"
).replace(/\/$/, "");

export const TOKEN_STORAGE_KEY = "structrepair_field_dashboard_token";
export const CLOUD_TOKEN_STORAGE_KEY = "structrepair_cloud_dashboard_token";

export const SYRIAN_CITIES = [
  "Aleppo",
  "Damascus",
  "RifDimashq",
  "Daraa",
  "DeirezZor",
  "Hama",
  "Hasakah",
  "Homs",
  "Idlib",
  "Latakia",
  "Quneitra",
  "Raqqa",
  "Suwayda",
  "Tartus"
];

export const REVIEW_GRADES = ["G0", "G1", "G2", "G3", "G4"];
