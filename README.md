# StructRepair Drone Dashboard

React dashboard for drone-based structural damage inspection and AI assessment reports.

## Run Locally

```bash
npm install
npm run dev
```

The dashboard defaults to the local Laravel backend and Reverb settings from `.env.example`:

```bash
VITE_API_BASE_URL=http://droneapi.test
VITE_REVERB_HOST=127.0.0.1
VITE_REVERB_PORT=8090
VITE_REVERB_KEY=local-key
VITE_REALTIME_HELPER_URL=http://127.0.0.1:5010
```

## Build

```bash
npm run build
```
