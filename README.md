# StructRepair Drone Dashboard

React dashboard for drone-based structural damage inspection and AI assessment reports.

## Run Locally

```bash
npm install
npm run dev
```

The dashboard defaults to local/offline field services plus a separate VPS cloud/community origin:

```bash
VITE_FIELD_API_BASE_URL=http://droneapi.test/api/v1
VITE_FIELD_BACKEND_ORIGIN=http://droneapi.test
VITE_REVERB_HOST=127.0.0.1
VITE_REVERB_PORT=8090
VITE_REVERB_KEY=local-key
VITE_REALTIME_HELPER_URL=http://127.0.0.1:5010
VITE_CLOUD_API_BASE_URL=http://207.180.254.216:8082/api/v1
VITE_CLOUD_BACKEND_ORIGIN=http://207.180.254.216:8082
```

Local inspection, stream capture, AI inference, final report generation, and PDF download stay on the field backend. After a report exists locally, the Reports screen can sign in to the VPS, upload a multipart sync package to `/sync/inspection-packages`, store the returned cloud IDs in browser state, and publish/unpublish using the cloud finalized report ID.

## Build

```bash
npm run build
```
