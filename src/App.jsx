import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Columns3,
  Download,
  Eye,
  FileText,
  History,
  Image as ImageIcon,
  Loader2,
  LogOut,
  MapPin,
  Menu,
  Play,
  Radio,
  RefreshCw,
  Save,
  Send,
  Server,
  Settings,
  ShieldCheck,
  Square,
  Upload,
  Wifi,
  WifiOff,
  XCircle,
  Zap
} from "lucide-react";
import { ApiError, apiRequest, cloudApiRequest, downloadRequest, mediaAssetUrl, saveBlob } from "./api.js";
import {
  API_BASE_URL,
  CLOUD_API_BASE_URL,
  CLOUD_BACKEND_ORIGIN,
  CLOUD_TOKEN_STORAGE_KEY,
  REALTIME_HELPER_URL,
  REVIEW_GRADES,
  REVERB,
  SYRIAN_CITIES,
  TOKEN_STORAGE_KEY
} from "./config.js";

const ASSETS = {
  logo: "/assets/structrepair-logo.png",
  aiAssessment: "/assets/ai-assessment.png",
  closeup: "/assets/drone-closeup.png",
  damageScan: "/assets/damage-detection-scan.png",
  droneScan: "/assets/drone-building-scan.png",
  elements: "/assets/structural-elements.png",
  exterior: "/assets/building-drone-exterior.png",
  live: "/assets/live-inspection-room.png",
  reportAnalytics: "/assets/report-analytics-hero.png",
  frameScan: "/assets/structural-frame-scan.png"
};

const emptyFloorData = {
  media: [],
  inspectionMedia: [],
  elements: [],
  assessments: [],
  predictions: [],
  inspectionPredictions: [],
  reviewQueue: []
};

const navItems = [
  { id: "buildings", label: "Buildings", icon: Building2 },
  { id: "live", label: "Live Inspection", icon: Radio },
  { id: "history", label: "History", icon: History },
  { id: "reports", label: "Reports", icon: FileText },
  { id: "tools", label: "Local Tools", icon: Settings }
];

const defaultInspectionDraft = {
  name: "Field Dashboard Building",
  city: "Damascus",
  number_of_floors: 2,
  address: "",
  latitude: "",
  longitude: "",
  notes: ""
};

const REALTIME_SETTINGS_STORAGE_KEY = "structrepair_realtime_stream_settings";
const REALTIME_URL_STORAGE_KEY = "structrepair_realtime_stream_url";
const CLOUD_SYNC_STORAGE_KEY = "structrepair_cloud_report_sync_state";

const realtimeDefaults = {
  mode: "columns_beams",
  left: 0,
  top: 0,
  width: 960,
  height: 540,
  fps: 8,
  conf: 0.25
};

const realtimePresets = {
  stable: { width: 640, height: 360, fps: 5, conf: 0.35 },
  balanced: { width: 960, height: 540, fps: 8, conf: 0.25 },
  lowLatency: { width: 640, height: 360, fps: 10, conf: 0.3 }
};

function unwrapArray(payload) {
  return Array.isArray(payload?.data) ? payload.data : [];
}

function sortFloorSessions(floorSessions = []) {
  return [...floorSessions].sort((left, right) => {
    const leftLevel = Number(left.floor?.level_number ?? left.id ?? 0);
    const rightLevel = Number(right.floor?.level_number ?? right.id ?? 0);
    return leftLevel - rightLevel;
  });
}

function formatDate(value) {
  if (!value) {
    return "Not recorded";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatPercent(value) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "-";
  }

  return `${Math.round((numeric <= 1 ? numeric * 100 : numeric) || 0)}%`;
}

function riskTone(value) {
  const risk = String(value || "").toLowerCase();
  if (["critical", "severe", "high", "danger", "failed"].includes(risk)) {
    return "danger";
  }

  if (["moderate", "medium", "elevated", "pending", "required"].includes(risk)) {
    return "warning";
  }

  if (["minor", "low", "stable", "success", "approved", "online"].includes(risk)) {
    return "success";
  }

  return "neutral";
}

function floorLabel(floorSession) {
  if (!floorSession) {
    return "No floor selected";
  }

  return floorSession.floor?.name || `Floor session ${floorSession.id}`;
}

function normalizeBox(box) {
  if (!box || typeof box !== "object") {
    return null;
  }

  if (Array.isArray(box) && box.length >= 4) {
    const [x1, y1, x2, y2] = box.map(Number);
    return {
      x: x1,
      y: y1,
      width: Math.max(0, x2 - x1),
      height: Math.max(0, y2 - y1)
    };
  }

  const x = Number(box.x ?? box.left ?? box.x1);
  const y = Number(box.y ?? box.top ?? box.y1);
  let width = Number(box.width ?? box.w);
  let height = Number(box.height ?? box.h);

  if ((!width || !height) && box.x2 !== undefined && box.y2 !== undefined) {
    width = Number(box.x2) - x;
    height = Number(box.y2) - y;
  }

  if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
    return null;
  }

  return { x, y, width, height };
}

function normalizeGrade(value) {
  const grade = String(value || "").toUpperCase();
  if (REVIEW_GRADES.includes(grade)) {
    return grade;
  }

  if (String(value || "").toLowerCase() === "moderate") {
    return "G2";
  }

  if (String(value || "").toLowerCase().includes("severe")) {
    return "G3";
  }

  return "G2";
}

function slugify(value, fallback) {
  const slug = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  return slug || fallback;
}

function messageFromError(error) {
  if (error instanceof ApiError && error.status === 429 && error.retryAfter) {
    return `${error.message} Wait ${error.retryAfter} seconds before uploading another frame.`;
  }

  return error?.message || "Request failed.";
}

function buildInspectionPayload(draft) {
  const building = {
    name: draft.name.trim(),
    city: draft.city,
    number_of_floors: Number(draft.number_of_floors || 1)
  };

  ["address", "notes"].forEach((key) => {
    if (draft[key]?.trim()) {
      building[key] = draft[key].trim();
    }
  });

  if (draft.latitude !== "" && draft.latitude !== null && draft.latitude !== undefined) {
    building.latitude = Number(draft.latitude);
  }

  if (draft.longitude !== "" && draft.longitude !== null && draft.longitude !== undefined) {
    building.longitude = Number(draft.longitude);
  }

  return { building, disaster_area: true };
}

function loadCloudSyncState() {
  try {
    return JSON.parse(localStorage.getItem(CLOUD_SYNC_STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function normalizeRiskLevel(value) {
  const risk = String(value || "").toLowerCase();
  if (["critical"].includes(risk)) return "critical";
  if (["severe", "high", "danger"].includes(risk)) return "severe";
  if (["moderate", "medium", "elevated", "pending"].includes(risk)) return "moderate";
  return "low";
}

function normalizeReportLanguage(value) {
  return value === "ar" ? "ar" : "en";
}

function normalizeCity(value) {
  return SYRIAN_CITIES.includes(value) ? value : "Damascus";
}

function optionalNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function findSessionForReport(report, activeInspection, groupedSessions) {
  const reportSessionId = Number(report.inspection_session_id || report.inspection_session?.id || 0);
  if (report.inspection_session?.floor_sessions?.length) {
    return report.inspection_session;
  }

  if (activeInspection?.id && Number(activeInspection.id) === reportSessionId && activeInspection.floor_sessions?.length) {
    return activeInspection;
  }

  const sessions = Object.values(groupedSessions || {}).flat();
  return sessions.find((session) => Number(session.id) === reportSessionId) || report.inspection_session || null;
}

function buildCloudSyncManifest(report, session, floorPackages = []) {
  const building = session?.building || report.inspection_session?.building || {};
  const floorPackageById = new Map(floorPackages.map((item) => [Number(item.floorSession?.id), item]));

  const floors = sortFloorSessions(session?.floor_sessions || []).map((floorSession) => {
    const floorPackage = floorPackageById.get(Number(floorSession.id));
    const assessments = floorPackage?.assessments || [];
    const severityValues = assessments
      .map((assessment) => optionalNumber(assessment.severity_score ?? assessment.damage_score, null))
      .filter((value) => value !== null);
    const overallSeverity =
      floorSession.overall_severity_score ?? floorSession.damage_score ??
      (severityValues.length ? severityValues.reduce((sum, value) => sum + value, 0) / severityValues.length : report.damage_score);

    return {
      local_floor_session_id: floorSession.id,
      level_number: Number(floorSession.floor?.level_number ?? floorSession.level_number ?? 0),
      name: floorSession.floor?.name || floorSession.name || floorLabel(floorSession),
      status: floorSession.status || "completed",
      overall_severity_score: optionalNumber(overallSeverity),
      risk_level: normalizeRiskLevel(floorSession.risk_level || report.risk_level)
    };
  });

  const elements = floorPackages.flatMap(({ floorSession, elements: floorElements = [] }) =>
    floorElements
      .map((element) => {
        const boundingBox = normalizeBox(element.bounding_box || element.bbox || element.box);
        if (!boundingBox || !["column", "beam"].includes(element.type)) {
          return null;
        }

        return {
          local_id: element.id,
          local_floor_session_id: floorSession.id,
          production_id: element.production_id || element.label || `${element.type}-${element.id}`,
          type: element.type,
          confidence: optionalNumber(element.confidence),
          bounding_box: boundingBox
        };
      })
      .filter(Boolean)
  );

  const damageAssessments = floorPackages.flatMap(({ assessments = [] }) =>
    assessments
      .map((assessment) => {
        const structuralElementId = assessment.structural_element_id || assessment.structural_element?.id;
        if (!structuralElementId) {
          return null;
        }

        return {
          local_structural_element_id: structuralElementId,
          raw_label: assessment.raw_label || assessment.risk_level || assessment.raw_grade || "moderate",
          raw_grade: normalizeGrade(assessment.raw_grade || assessment.raw_label),
          adjusted_grade: normalizeGrade(assessment.adjusted_grade || assessment.raw_grade || assessment.raw_label),
          confidence: optionalNumber(assessment.confidence),
          risk_level: normalizeRiskLevel(assessment.risk_level || assessment.raw_label),
          review_status: assessment.review_status || "approved",
          adjustment_reason: assessment.adjustment_reason || "Synced from offline dashboard review."
        };
      })
      .filter(Boolean)
  );

  const damageScore = optionalNumber(report.damage_score ?? report.overall_damage_score);
  const repairabilityScore = optionalNumber(report.repairability_score ?? report.overall_repairability_score, 100 - damageScore);

  return {
    local_inspection_session_id: session?.id || report.inspection_session_id,
    building: {
      name: building.name || `Building ${report.inspection_session_id || report.id}`,
      city: normalizeCity(building.city),
      number_of_floors: Number(building.number_of_floors || floors.length || 1)
    },
    inspection: {
      session_code: session?.session_code || report.inspection_session?.session_code || `LOCAL-REPORT-${report.id}`,
      status: session?.status || "completed",
      started_at: session?.started_at || session?.created_at || report.created_at || new Date().toISOString(),
      completed_at: session?.completed_at || report.finalized_at || report.created_at || new Date().toISOString()
    },
    finalized_report: {
      title: report.title || `Inspection Report - ${building.name || "Building"}`,
      summary: report.summary || report.executive_summary || "Reviewed structural inspection summary.",
      language: normalizeReportLanguage(report.language),
      damage_score: damageScore,
      repairability_score: repairabilityScore,
      risk_level: normalizeRiskLevel(report.risk_level),
      status: "unpublished",
      finalized_at: report.finalized_at || report.created_at || new Date().toISOString()
    },
    exterior_assessment: {
      damage_score_percent: optionalNumber(report.exterior_damage_score ?? report.damage_score),
      repairability_percent: optionalNumber(report.exterior_repairability_score ?? report.repairability_score, 100 - damageScore),
      risk_level: normalizeRiskLevel(report.exterior_risk_level || report.risk_level),
      damaged_part_count: Number(report.exterior_damaged_part_count || report.damaged_part_count || 0)
    },
    floors,
    elements,
    damage_assessments: damageAssessments
  };
}

function loadRealtimeSettings() {
  try {
    return {
      ...realtimeDefaults,
      ...JSON.parse(localStorage.getItem(REALTIME_SETTINGS_STORAGE_KEY) || "{}")
    };
  } catch {
    return { ...realtimeDefaults };
  }
}

function buildRealtimeStreamUrl(settings) {
  const url = new URL("/stream", REALTIME_HELPER_URL);
  url.searchParams.set("mode", settings.mode || realtimeDefaults.mode);
  url.searchParams.set("left", Math.round(Number(settings.left) || realtimeDefaults.left));
  url.searchParams.set("top", Math.round(Number(settings.top) || realtimeDefaults.top));
  url.searchParams.set("width", Math.round(Number(settings.width) || realtimeDefaults.width));
  url.searchParams.set("height", Math.round(Number(settings.height) || realtimeDefaults.height));
  url.searchParams.set("fps", Number(settings.fps) || realtimeDefaults.fps);
  url.searchParams.set("conf", Number(settings.conf) || realtimeDefaults.conf);
  return url.toString();
}

function StatusBadge({ value, tone, icon: Icon }) {
  const badgeTone = tone || riskTone(value);
  return (
    <span className={`status-badge ${badgeTone}`}>
      {Icon ? <Icon size={15} /> : null}
      {value}
    </span>
  );
}

function PageHeader({ title, subtitle, actions }) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </header>
  );
}

function AppShell({ activeView, user, cloudStatus, cloudReportCount, onNavigate, onLogout, children }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const activeItem = navItems.find((item) => item.id === activeView) || navItems[0];

  return (
    <div className={`app-shell ${isCollapsed ? "sidebar-collapsed" : ""}`}>
      <aside className="sidebar">
        <div className="brand-box">
          <img src={ASSETS.logo} alt="StructRepair Drone" />
        </div>
        <nav className="main-nav" aria-label="Field dashboard navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                className={`nav-button ${activeView === item.id ? "active" : ""}`}
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
              >
                <Icon size={21} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="operator-card">
          <div className="avatar">{user?.name?.slice(0, 2).toUpperCase() || "EN"}</div>
          <div>
            <strong>{user?.name || "Engineer"}</strong>
            <span>{user?.role || "engineer"}</span>
          </div>
          <button className="icon-button" type="button" onClick={onLogout} aria-label="Log out">
            <LogOut size={20} />
          </button>
        </div>
      </aside>
      <main className="page">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button sidebar-toggle"
              type="button"
              onClick={() => setIsCollapsed((value) => !value)}
              aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <Menu size={20} />
            </button>
            <div>
              <span className="breadcrumb">StructRepair / {activeItem.label}</span>
              <strong>{activeItem.label}</strong>
            </div>
          </div>
          <div className="topbar-right">
            <StatusBadge
              value={`cloud ${cloudStatus}${cloudReportCount ? ` · ${cloudReportCount}` : ""}`}
              tone={["online", "synced", "published"].includes(cloudStatus) ? "success" : cloudStatus === "checking" || cloudStatus === "syncing" ? "warning" : cloudStatus === "failed" ? "danger" : "neutral"}
            />
            <button className="icon-button light" type="button" aria-label="Notifications">
              <Bell size={19} />
            </button>
            <div className="topbar-avatar">{user?.name?.slice(0, 2).toUpperCase() || "EN"}</div>
          </div>
        </header>
        <div className="page-content">{children}</div>
      </main>
    </div>
  );
}

function LoadingScreen() {
  return (
    <main className="loading-page">
      <Loader2 className="spin" size={34} />
      <span>Preparing field dashboard</span>
    </main>
  );
}

function LoginPage({ onLogin, error, isLoading }) {
  const [email, setEmail] = useState("engineer@example.com");
  const [password, setPassword] = useState("password");

  return (
    <main className="login-page">
      <section className="login-visual" aria-label="StructRepair Drone">
        <img className="login-logo" src={ASSETS.logo} alt="StructRepair Drone" />
        <div className="login-copy">
          <h1>StructRepair</h1>
          <p>AI-Powered Structural Damage Assessment</p>
          <ul>
            <li>Drone-based building inspection</li>
            <li>Real-time AI damage detection</li>
            <li>Automated structural analysis reports</li>
          </ul>
        </div>
        <div className="login-image">
          <img src={ASSETS.reportAnalytics} alt="Structural report analytics" />
        </div>
        <div className="login-gallery" aria-hidden="true">
          <img src={ASSETS.droneScan} alt="" />
          <img src={ASSETS.damageScan} alt="" />
          <img src={ASSETS.aiAssessment} alt="" />
        </div>
      </section>
      <section className="login-panel">
        <form
          className="login-form"
          onSubmit={(event) => {
            event.preventDefault();
            onLogin({ email, password });
          }}
        >
          <div>
            <h1>Welcome Back</h1>
            <p>Sign in to access your structural inspection dashboard.</p>
          </div>
          {error ? <div className="alert danger">{error}</div> : null}
          <label>
            Email
            <input value={email} type="email" onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label>
            Password
            <input value={password} type="password" onChange={(event) => setPassword(event.target.value)} />
          </label>
          <button className="primary-button" type="submit" disabled={isLoading}>
            {isLoading ? <Loader2 className="spin" size={18} /> : <ShieldCheck size={18} />}
            Sign In
          </button>
          <small className="endpoint-note">API gateway: {API_BASE_URL}</small>
        </form>
      </section>
    </main>
  );
}

function InspectionStartForm({ draft, setDraft, onStart, isStarting }) {
  return (
    <form
      className="start-form"
      onSubmit={(event) => {
        event.preventDefault();
        onStart(draft);
      }}
    >
      <label>
        Building name
        <input
          required
          value={draft.name}
          onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
        />
      </label>
      <label>
        City
        <select
          value={draft.city}
          onChange={(event) => setDraft((current) => ({ ...current, city: event.target.value }))}
        >
          {SYRIAN_CITIES.map((city) => (
            <option value={city} key={city}>
              {city}
            </option>
          ))}
        </select>
      </label>
      <label>
        Floors
        <input
          min="1"
          max="200"
          required
          type="number"
          value={draft.number_of_floors}
          onChange={(event) => setDraft((current) => ({ ...current, number_of_floors: event.target.value }))}
        />
      </label>
      <label>
        Address
        <input
          value={draft.address}
          onChange={(event) => setDraft((current) => ({ ...current, address: event.target.value }))}
        />
      </label>
      <label>
        Latitude
        <input
          step="any"
          type="number"
          value={draft.latitude}
          onChange={(event) => setDraft((current) => ({ ...current, latitude: event.target.value }))}
        />
      </label>
      <label>
        Longitude
        <input
          step="any"
          type="number"
          value={draft.longitude}
          onChange={(event) => setDraft((current) => ({ ...current, longitude: event.target.value }))}
        />
      </label>
      <label className="wide-field">
        Notes
        <textarea
          rows="3"
          value={draft.notes}
          onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
        />
      </label>
      <button className="primary-button form-action" type="submit" disabled={isStarting}>
        {isStarting ? <Loader2 className="spin" size={18} /> : <Play size={18} />}
        Start Inspection
      </button>
    </form>
  );
}

function BuildingsPage({ buildings, loading, onRefresh, onStartInspection, isStarting, onNavigateHistory }) {
  const [draft, setDraft] = useState(defaultInspectionDraft);
  const [focusedBuilding, setFocusedBuilding] = useState(null);
  const totalFloors = buildings.reduce((sum, building) => sum + Number(building.number_of_floors || 0), 0);

  const prefillFromBuilding = (building) => {
    setDraft({
      ...defaultInspectionDraft,
      name: building.name || defaultInspectionDraft.name,
      city: building.city || defaultInspectionDraft.city,
      number_of_floors: building.number_of_floors || 1,
      address: building.address || "",
      latitude: building.latitude ?? "",
      longitude: building.longitude ?? "",
      notes: building.notes || ""
    });
    setFocusedBuilding(building);
  };

  return (
    <>
      <PageHeader
        title="Buildings Overview"
        subtitle="Manage and monitor structural inspections across all buildings"
        actions={
          <button className="secondary-button" type="button" onClick={onRefresh}>
            <RefreshCw size={18} />
            Refresh
          </button>
        }
      />

      <section className="overview-stats">
        <Metric label="Total Buildings" value={buildings.length} />
        <Metric label="Total Floors" value={totalFloors} />
        <Metric label="Selected Building" value={focusedBuilding ? 1 : 0} />
        <Metric label="Local Records" value={loading ? "..." : buildings.length} />
      </section>

      <section className="setup-band">
        <div className="setup-copy">
          <span className="eyebrow">New Inspection</span>
          <h2>Start the Laravel-backed floor workflow</h2>
          <p>
            The current backend start endpoint creates a new building record with matching floor sessions.
          </p>
        </div>
        <InspectionStartForm
          draft={draft}
          setDraft={setDraft}
          onStart={onStartInspection}
          isStarting={isStarting}
        />
      </section>

      <section className="content-grid two-column buildings-layout">
        <article className="panel">
          <div className="panel-heading">
            <h2>Building Records</h2>
            <StatusBadge value={`${buildings.length} total`} tone="neutral" />
          </div>
          {loading ? <InlineLoading label="Loading buildings" /> : null}
          {!loading && buildings.length === 0 ? <EmptyState icon={Building2} label="No buildings found" /> : null}
          <div className="record-list">
            {buildings.map((building) => (
              <div className="record-row" key={building.id}>
                <div>
                  <strong>{building.name}</strong>
                  <span>
                    {building.city || "Unknown city"} · {building.number_of_floors || 0} floors
                  </span>
                  <small>Updated {formatDate(building.updated_at)}</small>
                </div>
                <div className="row-actions">
                  <button className="icon-button light" type="button" onClick={() => setFocusedBuilding(building)} aria-label="View building">
                    <Eye size={18} />
                  </button>
                  <button className="icon-button light" type="button" onClick={() => onNavigateHistory(building.id)} aria-label="Building history">
                    <History size={18} />
                  </button>
                  <button className="icon-button filled" type="button" onClick={() => onStartInspection(building)} aria-label="Start inspection">
                    <Play size={18} />
                  </button>
                  <button className="icon-button light" type="button" onClick={() => prefillFromBuilding(building)} aria-label="Prefill form">
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="panel detail-panel">
          <div className="panel-heading">
            <h2>Building Detail</h2>
            {focusedBuilding ? <StatusBadge value={`ID ${focusedBuilding.id}`} tone="neutral" /> : null}
          </div>
          {focusedBuilding ? (
            <div className="detail-stack">
              <img src={ASSETS.exterior} alt="" />
              <dl>
                <div>
                  <dt>Name</dt>
                  <dd>{focusedBuilding.name}</dd>
                </div>
                <div>
                  <dt>City</dt>
                  <dd>{focusedBuilding.city}</dd>
                </div>
                <div>
                  <dt>Floors</dt>
                  <dd>{focusedBuilding.number_of_floors}</dd>
                </div>
                <div>
                  <dt>Address</dt>
                  <dd>{focusedBuilding.address || "Not provided"}</dd>
                </div>
                <div>
                  <dt>Notes</dt>
                  <dd>{focusedBuilding.notes || "No notes"}</dd>
                </div>
              </dl>
            </div>
          ) : (
            <EmptyState icon={Eye} label="Select a building to inspect details" />
          )}
        </article>
      </section>
    </>
  );
}

function InlineLoading({ label }) {
  return (
    <div className="inline-loading">
      <Loader2 className="spin" size={18} />
      <span>{label}</span>
    </div>
  );
}

function EmptyState({ icon: Icon, label }) {
  return (
    <div className="empty-state">
      <Icon size={34} />
      <span>{label}</span>
    </div>
  );
}

function FrameViewer({ latestFrame, elements, token }) {
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const imageWidth = Number(latestFrame?.width || naturalSize.width || 1);
  const imageHeight = Number(latestFrame?.height || naturalSize.height || 1);
  const boxes = elements
    .map((element) => ({ element, box: normalizeBox(element.bounding_box) }))
    .filter(({ box }) => box);

  if (!latestFrame) {
    return (
      <div className="frame-empty">
        <ImageIcon size={48} />
        <span>No frame uploaded yet</span>
      </div>
    );
  }

  return (
    <div className="frame-canvas-wrap">
      <div className="frame-canvas">
        <img
          src={`${mediaAssetUrl(latestFrame.id, token)}&v=${latestFrame.updated_at || latestFrame.id}`}
          alt={latestFrame.original_filename || "Inspection frame"}
          onLoad={(event) =>
            setNaturalSize({
              width: event.currentTarget.naturalWidth,
              height: event.currentTarget.naturalHeight
            })
          }
        />
        <div className="box-layer" aria-hidden="true">
          {boxes.map(({ element, box }) => (
            <div
              className={`detection-box ${String(element.type).toLowerCase() === "beam" ? "beam" : "column"}`}
              key={element.id}
              style={{
                left: `${(box.x / imageWidth) * 100}%`,
                top: `${(box.y / imageHeight) * 100}%`,
                width: `${(box.width / imageWidth) * 100}%`,
                height: `${(box.height / imageHeight) * 100}%`
              }}
            >
              <span>
                {element.production_id || `E${element.id}`} {formatPercent(element.confidence)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function UploadFrameForm({ onUpload, disabled, isUploading }) {
  const [file, setFile] = useState(null);
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [altitude, setAltitude] = useState("");

  return (
    <form
      className="upload-form"
      onSubmit={async (event) => {
        event.preventDefault();
        if (file) {
          try {
            await onUpload({ file, latitude, longitude, altitude_m: altitude });
            setFile(null);
            event.currentTarget.reset();
          } catch {
            // The parent handler renders the API error; keep the selected file available.
          }
        }
      }}
    >
      <label className="file-picker">
        <Upload size={18} />
        <span>{file?.name || "Choose frame"}</span>
        <input
          accept="image/png,image/jpeg"
          disabled={disabled}
          type="file"
          onChange={(event) => setFile(event.target.files?.[0] || null)}
        />
      </label>
      <input placeholder="Latitude" type="number" step="any" disabled={disabled} onChange={(event) => setLatitude(event.target.value)} />
      <input placeholder="Longitude" type="number" step="any" disabled={disabled} onChange={(event) => setLongitude(event.target.value)} />
      <input placeholder="Altitude m" type="number" step="any" disabled={disabled} onChange={(event) => setAltitude(event.target.value)} />
      <button className="primary-button" type="submit" disabled={disabled || !file || isUploading}>
        {isUploading ? <Loader2 className="spin" size={17} /> : <Send size={17} />}
        Upload & Analyze
      </button>
    </form>
  );
}

function ExteriorOverviewPanel({ inspectionMedia, inspectionPredictions, token, onRunExteriorDetection, isRunning, disabled }) {
  const [file, setFile] = useState(null);
  const overviewImages = inspectionMedia
    .filter((asset) => asset.type === "building_overview")
    .sort((left, right) => new Date(right.created_at || 0) - new Date(left.created_at || 0));
  const latestOverview = overviewImages[0] || null;
  const exteriorPredictions = inspectionPredictions
    .filter((prediction) => prediction.raw_response?.model_type === "building_damage_detection")
    .sort((left, right) => new Date(right.created_at || 0) - new Date(left.created_at || 0));
  const latestPrediction = exteriorPredictions[0] || null;
  const response = latestPrediction?.raw_response || {};

  return (
    <article className="panel exterior-panel">
      <div className="panel-heading">
        <div>
          <h2>Building Exterior Damage</h2>
          <p>Optional overview detection for exterior building images.</p>
        </div>
        <StatusBadge value={latestPrediction?.status || "not run"} />
      </div>

      <div className="exterior-grid">
        <div className="exterior-preview">
          {latestOverview ? (
            <img src={`${mediaAssetUrl(latestOverview.id, token)}&v=${latestOverview.updated_at || latestOverview.id}`} alt={latestOverview.original_filename || "Building overview"} />
          ) : (
            <div className="stream-empty">
              <Building2 size={40} />
              <strong>No overview image</strong>
              <span>Upload an exterior image to run the building detector.</span>
            </div>
          )}
        </div>
        <div className="exterior-summary">
          <Metric label="Damage" value={response.damage_score_percent !== undefined ? `${Number(response.damage_score_percent).toFixed(1)}%` : "-"} />
          <Metric label="Repairability" value={response.repairability_percent !== undefined ? `${Number(response.repairability_percent).toFixed(1)}%` : "-"} />
          <Metric label="Risk" value={response.risk_level || "-"} />
          <Metric label="Detections" value={Array.isArray(response.detections) ? response.detections.length : 0} />
        </div>
      </div>

      {latestPrediction?.error_message ? <div className="alert warning">{latestPrediction.error_message}</div> : null}

      <form
        className="exterior-form"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!file) {
            return;
          }

          try {
            await onRunExteriorDetection(file);
            setFile(null);
            event.currentTarget.reset();
          } catch {
            // Parent handler renders the API error and keeps the selected file available.
          }
        }}
      >
        <label className="file-picker">
          <Upload size={18} />
          <span>{file?.name || "Choose exterior image"}</span>
          <input
            accept="image/png,image/jpeg"
            disabled={disabled}
            type="file"
            onChange={(event) => setFile(event.target.files?.[0] || null)}
          />
        </label>
        <button className="primary-button" type="submit" disabled={disabled || !file || isRunning}>
          {isRunning ? <Loader2 className="spin" size={17} /> : <Zap size={17} />}
          Run Exterior Detection
        </button>
      </form>
    </article>
  );
}

function RealtimeStreamPanel({ onCaptureHelper, onCaptureExterior, isCapturing, isCapturingExterior, disabled, exteriorDisabled }) {
  const [settings, setSettings] = useState(loadRealtimeSettings);
  const [streamUrl, setStreamUrl] = useState(() => buildRealtimeStreamUrl(loadRealtimeSettings()));
  const [isConnected, setIsConnected] = useState(false);
  const [streamVersion, setStreamVersion] = useState(0);
  const [helperStatus, setHelperStatus] = useState("Helper not checked.");
  const [isChecking, setIsChecking] = useState(false);
  const isExteriorMode = settings.mode === "building_exterior";

  const syncUrlFromSettings = (nextSettings) => {
    const nextUrl = buildRealtimeStreamUrl(nextSettings);
    setStreamUrl(nextUrl);
    return nextUrl;
  };

  const updateSetting = (key, value) => {
    setSettings((current) => {
      const next = { ...current, [key]: value };
      syncUrlFromSettings(next);
      return next;
    });
  };

  const applyPreset = (presetName) => {
    setSettings((current) => {
      const next = { ...current, ...realtimePresets[presetName] };
      syncUrlFromSettings(next);
      return next;
    });
  };

  const switchMode = (mode) => {
    setSettings((current) => {
      const next = { ...current, mode };
      syncUrlFromSettings(next);
      setIsConnected(false);
      setHelperStatus(
        mode === "building_exterior"
          ? "Exterior mode selected. Live guide only; deep floor analysis is disabled."
          : "Deep mode selected. Captures will be sent to the current floor."
      );
      return next;
    });
  };

  const saveSettings = () => {
    localStorage.setItem(REALTIME_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    localStorage.setItem(REALTIME_URL_STORAGE_KEY, streamUrl);
    setHelperStatus("Stream settings saved.");
  };

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(streamUrl);
      setHelperStatus("Stream URL copied.");
    } catch {
      setHelperStatus("Copy failed. Select the URL manually.");
    }
  };

  const connectStream = (event) => {
    event.preventDefault();
    let nextUrl = streamUrl.trim() || buildRealtimeStreamUrl(settings);
    try {
      const url = new URL(nextUrl);
      url.searchParams.set("mode", settings.mode || realtimeDefaults.mode);
      nextUrl = url.toString();
    } catch {
      nextUrl = buildRealtimeStreamUrl(settings);
    }
    localStorage.setItem(REALTIME_URL_STORAGE_KEY, nextUrl);
    setStreamUrl(nextUrl);
    setIsConnected(true);
    setStreamVersion((version) => version + 1);
    setHelperStatus("Stream connected.");
  };

  const checkHelper = async () => {
    setIsChecking(true);
    setHelperStatus("Checking helper...");
    try {
      const response = await fetch(`${REALTIME_HELPER_URL}/health`, {
        headers: { Accept: "application/json" }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = await response.json();
      const status = payload.status === "ok" ? "online" : String(payload.status || "unknown");
      setHelperStatus(`Helper ${status}. Model: ${payload.model_type || "unknown"}.`);
    } catch (error) {
      setHelperStatus(`Helper check failed: ${error.message || "offline"}.`);
    } finally {
      setIsChecking(false);
    }
  };

  const streamSrc = isConnected
    ? `${streamUrl}${streamUrl.includes("?") ? "&" : "?"}v=${streamVersion}`
    : "";

  return (
    <article className="panel stream-panel">
      <div className="panel-heading">
        <div>
          <h2>{isExteriorMode ? "Exterior Building Screening" : "Deep Columns/Beams Stream"}</h2>
          <p>{isConnected ? streamUrl : isExteriorMode ? "Connect the outside building damage guide." : "Connect the deep structural inspection helper."}</p>
        </div>
        <StatusBadge value={isExteriorMode ? "exterior" : "deep"} tone={isConnected ? "success" : "neutral"} />
      </div>

      <div className={`stream-preview ${isConnected ? "connected" : ""}`}>
        {isConnected ? <img src={streamSrc} alt="Realtime detected drone stream" /> : null}
        {!isConnected ? (
          <div className="stream-empty">
            <Radio size={44} />
            <strong>No realtime stream</strong>
            <span>Start the helper, set the screen region, then connect.</span>
          </div>
        ) : null}
      </div>

      <form className="stream-form" onSubmit={connectStream}>
        <div className="mode-switch" role="group" aria-label="Realtime detection mode">
          <button
            className={`secondary-button dense ${isExteriorMode ? "active" : ""}`}
            type="button"
            onClick={() => switchMode("building_exterior")}
          >
            Exterior: building damage
          </button>
          <button
            className={`secondary-button dense ${!isExteriorMode ? "active" : ""}`}
            type="button"
            onClick={() => switchMode("columns_beams")}
          >
            Deep: columns/beams
          </button>
        </div>
        <label className="stream-url-field">
          Stream URL
          <input value={streamUrl} type="url" onChange={(event) => setStreamUrl(event.target.value)} />
        </label>
        <div className="preset-row">
          <button className="secondary-button dense" type="button" onClick={() => applyPreset("stable")}>
            Stable
          </button>
          <button className="secondary-button dense" type="button" onClick={() => applyPreset("balanced")}>
            Balanced
          </button>
          <button className="secondary-button dense" type="button" onClick={() => applyPreset("lowLatency")}>
            Low Latency
          </button>
        </div>
        <label>
          Left
          <input type="number" step="1" value={settings.left} onChange={(event) => updateSetting("left", event.target.value)} />
        </label>
        <label>
          Top
          <input type="number" step="1" value={settings.top} onChange={(event) => updateSetting("top", event.target.value)} />
        </label>
        <label>
          Width
          <input min="160" type="number" step="1" value={settings.width} onChange={(event) => updateSetting("width", event.target.value)} />
        </label>
        <label>
          Height
          <input min="120" type="number" step="1" value={settings.height} onChange={(event) => updateSetting("height", event.target.value)} />
        </label>
        <label>
          FPS
          <input min="1" max="30" type="number" step="1" value={settings.fps} onChange={(event) => updateSetting("fps", event.target.value)} />
        </label>
        <label>
          Confidence
          <input min="0.01" max="1" type="number" step="0.01" value={settings.conf} onChange={(event) => updateSetting("conf", event.target.value)} />
        </label>
        <div className="stream-actions">
          <button className="primary-button" type="submit">
            <Wifi size={17} />
            Connect Stream
          </button>
          <button className="secondary-button" type="button" onClick={() => setIsConnected(false)}>
            <WifiOff size={17} />
            Stop Stream
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={() => onCaptureHelper(settings)}
            disabled={disabled || isCapturing || isExteriorMode}
            title={isExteriorMode ? "Switch to Deep mode to capture a floor frame for Laravel analysis." : undefined}
          >
            {isCapturing ? <Loader2 className="spin" size={17} /> : <Radio size={17} />}
            Detect / Analyze Current View
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={() => onCaptureExterior(settings)}
            disabled={exteriorDisabled || isCapturingExterior || !isExteriorMode}
            title={!isExteriorMode ? "Switch to Exterior mode to capture a building overview." : undefined}
          >
            {isCapturingExterior ? <Loader2 className="spin" size={17} /> : <Building2 size={17} />}
            Detect Exterior Current View
          </button>
          <button className="secondary-button" type="button" onClick={saveSettings}>
            <Save size={17} />
            Save Settings
          </button>
          <button className="secondary-button" type="button" onClick={copyUrl}>
            <ClipboardCheck size={17} />
            Copy URL
          </button>
          <button className="secondary-button" type="button" onClick={checkHelper} disabled={isChecking}>
            {isChecking ? <Loader2 className="spin" size={17} /> : <Server size={17} />}
            Check Helper
          </button>
        </div>
      </form>
      <p className="helper-status">{helperStatus}</p>
    </article>
  );
}

function LiveInspectionPage({
  inspection,
  workflow,
  currentFloor,
  floorIndex,
  floorData,
  token,
  socketStatus,
  processingLog,
  refreshing,
  isUploading,
  isCapturing,
  isExteriorRunning,
  isStarting,
  isGenerating,
  buildings,
  onStartInspection,
  onUploadFrame,
  onRunExteriorDetection,
  onCaptureHelper,
  onCaptureExterior,
  onRefresh,
  onNextFloor,
  onStopInspection,
  onGenerateReport,
  onReviewAssessment,
  onBackToBuildings
}) {
  const [draft, setDraft] = useState(defaultInspectionDraft);
  const [reportTitle, setReportTitle] = useState("");
  const [reportLanguage, setReportLanguage] = useState("en");
  const floors = inspection?.floor_sessions || [];
  const latestFrame = useMemo(() => {
    const ordered = [...floorData.media].sort(
      (left, right) => new Date(right.created_at || 0) - new Date(left.created_at || 0)
    );
    return ordered.find((asset) => asset.capture_source === "drone_stream") || ordered[0] || null;
  }, [floorData.media]);
  const pendingPredictions = floorData.predictions.filter((prediction) => prediction.status === "pending").length;
  const failedPredictions = floorData.predictions.filter((prediction) => prediction.status === "failed");
  const readonly = workflow === "readonly";
  const active = workflow === "active";

  if (!inspection) {
    return (
      <>
      <PageHeader
        title="Live Drone Inspection"
        subtitle="Start a field session before uploading floor frames"
          actions={
            <button className="secondary-button" type="button" onClick={onBackToBuildings}>
              <ArrowLeft size={18} />
              Buildings
            </button>
          }
        />
        <section className="setup-band">
          <div className="setup-copy">
            <span className="eyebrow">Session Setup</span>
            <h2>No active inspection selected</h2>
            <p>Use existing building details or enter a new building record to create floor sessions.</p>
          </div>
          <InspectionStartForm
            draft={draft}
            setDraft={setDraft}
            onStart={onStartInspection}
            isStarting={isStarting}
          />
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h2>Recent Buildings</h2>
          </div>
          <div className="quick-grid">
            {buildings.slice(0, 4).map((building) => (
              <button className="quick-building" key={building.id} type="button" onClick={() => onStartInspection(building)}>
                <Building2 size={20} />
                <span>
                  <strong>{building.name}</strong>
                  <small>{building.city}</small>
                </span>
              </button>
            ))}
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Live Drone Inspection"
        subtitle={`${inspection.building?.name || "Inspection"} · ${floorLabel(currentFloor)}`}
        actions={
          <>
            <button className="secondary-button" type="button" onClick={onRefresh} disabled={refreshing}>
              {refreshing ? <Loader2 className="spin" size={18} /> : <RefreshCw size={18} />}
              Refresh
            </button>
            <button className="secondary-button" type="button" onClick={onBackToBuildings}>
              <ArrowLeft size={18} />
              Buildings
            </button>
          </>
        }
      />

      <section className="status-strip">
        <StatusBadge value="API connected" tone="success" icon={Server} />
        <StatusBadge
          value={socketStatus}
          tone={socketStatus.toLowerCase().includes("subscribed") ? "success" : "warning"}
          icon={socketStatus.toLowerCase().includes("disconnect") ? WifiOff : Wifi}
        />
        <StatusBadge value={active ? "Polling active" : workflow} tone={active ? "success" : "neutral"} icon={Radio} />
        <StatusBadge value={`${floorIndex + 1}/${Math.max(floors.length, 1)} floors`} tone="neutral" icon={Building2} />
        <StatusBadge value={`${pendingPredictions} pending`} tone={pendingPredictions ? "warning" : "success"} icon={Zap} />
      </section>

      <section className="live-grid">
        <div className="main-stack">
          {!readonly ? (
            <RealtimeStreamPanel
              onCaptureHelper={onCaptureHelper}
              onCaptureExterior={onCaptureExterior}
              isCapturing={isCapturing}
              isCapturingExterior={isExteriorRunning}
              disabled={!currentFloor || !active}
              exteriorDisabled={!inspection?.id || !active}
            />
          ) : null}

          {!readonly ? (
            <ExteriorOverviewPanel
              inspectionMedia={floorData.inspectionMedia}
              inspectionPredictions={floorData.inspectionPredictions}
              token={token}
              onRunExteriorDetection={onRunExteriorDetection}
              isRunning={isExteriorRunning}
              disabled={!inspection?.id || !active}
            />
          ) : null}

          <article className="panel frame-panel">
            <div className="panel-heading">
              <div>
                <h2>Last Saved Detection Frame</h2>
                <p>{latestFrame ? `${latestFrame.original_filename || "frame"} · ${latestFrame.width || "?"}x${latestFrame.height || "?"}` : "Waiting for upload"}</p>
              </div>
              <StatusBadge value={`${floorData.elements.length} elements`} tone="neutral" />
            </div>
            <FrameViewer latestFrame={latestFrame} elements={floorData.elements} token={token} />
            {!readonly ? (
              <div className="frame-actions">
                <UploadFrameForm onUpload={onUploadFrame} disabled={!currentFloor || !active} isUploading={isUploading} />
              </div>
            ) : null}
          </article>
        </div>

        <aside className="side-stack">
          <article className="panel">
            <div className="panel-heading">
              <h2>Floor Control</h2>
              <StatusBadge value={currentFloor?.status || workflow} />
            </div>
            <div className="metric-grid">
              <Metric label="Frames" value={floorData.media.length} />
              <Metric label="Columns" value={floorData.elements.filter((item) => item.type === "column").length} />
              <Metric label="Beams" value={floorData.elements.filter((item) => item.type === "beam").length} />
              <Metric label="Damage" value={floorData.assessments.length} />
            </div>
            {!readonly ? (
              <div className="control-row">
                <button className="secondary-button" type="button" onClick={onNextFloor} disabled={!active || floorIndex >= floors.length - 1}>
                  <ChevronRight size={17} />
                  Next Floor
                </button>
                <button className="danger-button" type="button" onClick={onStopInspection} disabled={!active}>
                  <Square size={16} />
                  Stop Inspection
                </button>
              </div>
            ) : null}
          </article>

          <article className="panel">
            <div className="panel-heading">
              <h2>AI Results</h2>
              <StatusBadge value={failedPredictions.length ? `${failedPredictions.length} failed` : "running"} tone={failedPredictions.length ? "danger" : "success"} />
            </div>
            <ResultLists elements={floorData.elements} assessments={floorData.assessments} failedPredictions={failedPredictions} />
          </article>

          <ReviewPanel reviewQueue={floorData.reviewQueue} onReviewAssessment={onReviewAssessment} readonly={readonly} />

          <article className="panel">
            <div className="panel-heading">
              <h2>Processing Log</h2>
            </div>
            <div className="log-list">
              {processingLog.length === 0 ? <EmptyState icon={ClipboardCheck} label="No processing events yet" /> : null}
              {processingLog.map((entry) => (
                <div className={`log-row ${entry.tone}`} key={entry.id}>
                  <span>{formatDate(entry.time)}</span>
                  <strong>{entry.message}</strong>
                </div>
              ))}
            </div>
          </article>

          {!readonly && workflow === "stopped" ? (
            <article className="panel">
              <div className="panel-heading">
                <h2>Export Report</h2>
                <StatusBadge value={floorData.reviewQueue.length ? "reviews required" : "ready"} />
              </div>
              <form
                className="report-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  onGenerateReport({ language: reportLanguage, title: reportTitle });
                }}
              >
                <select value={reportLanguage} onChange={(event) => setReportLanguage(event.target.value)}>
                  <option value="en">English</option>
                  <option value="ar">Arabic</option>
                </select>
                <input
                  placeholder={`Inspection Report - ${inspection.building?.name || "Building"}`}
                  value={reportTitle}
                  onChange={(event) => setReportTitle(event.target.value)}
                />
                <button className="primary-button" type="submit" disabled={isGenerating || floorData.reviewQueue.length > 0}>
                  {isGenerating ? <Loader2 className="spin" size={17} /> : <FileText size={17} />}
                  Export Report
                </button>
              </form>
            </article>
          ) : null}
        </aside>
      </section>
    </>
  );
}

function Metric({ label, value }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ResultLists({ elements, assessments, failedPredictions }) {
  return (
    <div className="result-stack">
      <div>
        <h3>Structural Elements</h3>
        {elements.length === 0 ? <p className="muted">No columns or beams detected yet.</p> : null}
        {elements.slice(0, 8).map((element) => (
          <div className="compact-row" key={element.id}>
            <span>
              <strong>{element.production_id || `Element ${element.id}`}</strong>
              <small>{element.type}</small>
            </span>
            <StatusBadge value={formatPercent(element.confidence)} tone={element.type === "beam" ? "warning" : "success"} />
          </div>
        ))}
      </div>
      <div>
        <h3>Damage Assessments</h3>
        {assessments.length === 0 ? <p className="muted">Damage jobs have not returned results.</p> : null}
        {assessments.slice(0, 8).map((assessment) => (
          <div className="compact-row" key={assessment.id}>
            <span>
              <strong>{assessment.structural_element?.production_id || `Element ${assessment.structural_element_id}`}</strong>
              <small>
                Grade {assessment.adjusted_grade || assessment.raw_grade || assessment.raw_label || "-"} · {formatPercent(assessment.confidence)}
              </small>
            </span>
            <StatusBadge value={assessment.review_status || assessment.risk_level || "review"} />
          </div>
        ))}
      </div>
      {failedPredictions.length ? (
        <div>
          <h3>Failures</h3>
          {failedPredictions.map((prediction) => (
            <div className="compact-row failure" key={prediction.id}>
              <span>
                <strong>Prediction {prediction.id}</strong>
                <small>{prediction.error_message || "AI processing failed"}</small>
              </span>
              <StatusBadge value="failed" tone="danger" />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ReviewPanel({ reviewQueue, onReviewAssessment, readonly }) {
  const [drafts, setDrafts] = useState({});

  useEffect(() => {
    setDrafts((current) => {
      const next = { ...current };
      reviewQueue.forEach((assessment) => {
        if (!next[assessment.id]) {
          next[assessment.id] = {
            adjusted_grade: assessment.adjusted_grade || normalizeGrade(assessment.raw_grade || assessment.raw_label),
            adjustment_reason: assessment.adjustment_reason || ""
          };
        }
      });
      return next;
    });
  }, [reviewQueue]);

  return (
    <article className="panel">
      <div className="panel-heading">
        <h2>Engineering Review</h2>
        <StatusBadge value={`${reviewQueue.length} required`} tone={reviewQueue.length ? "warning" : "success"} />
      </div>
      {reviewQueue.length === 0 ? <EmptyState icon={CheckCircle2} label="No required reviews" /> : null}
      <div className="review-list">
        {reviewQueue.map((assessment) => {
          const draft = drafts[assessment.id] || {};
          return (
            <form
              className="review-row"
              key={assessment.id}
              onSubmit={(event) => {
                event.preventDefault();
                onReviewAssessment(assessment.id, draft);
              }}
            >
              <div>
                <strong>{assessment.structural_element?.production_id || `Element ${assessment.structural_element_id}`}</strong>
                <span>
                  {assessment.structural_element?.type || "element"} · raw {assessment.raw_grade || assessment.raw_label || "-"} · risk{" "}
                  {assessment.risk_level || "-"}
                </span>
              </div>
              <select
                value={draft.adjusted_grade || "G2"}
                disabled={readonly}
                onChange={(event) =>
                  setDrafts((current) => ({
                    ...current,
                    [assessment.id]: { ...draft, adjusted_grade: event.target.value }
                  }))
                }
              >
                {REVIEW_GRADES.map((grade) => (
                  <option value={grade} key={grade}>
                    {grade}
                  </option>
                ))}
              </select>
              <input
                placeholder="Adjustment reason"
                value={draft.adjustment_reason || ""}
                disabled={readonly}
                onChange={(event) =>
                  setDrafts((current) => ({
                    ...current,
                    [assessment.id]: { ...draft, adjustment_reason: event.target.value }
                  }))
                }
              />
              {!readonly ? (
                <button className="secondary-button" type="submit">
                  <Save size={16} />
                  Approve
                </button>
              ) : null}
            </form>
          );
        })}
      </div>
    </article>
  );
}

function HistoryPage({ buildings, reports, sessionsByBuilding, loading, onLoadHistory, onOpenSession, focusBuildingId }) {
  const rows = buildings.flatMap((building) =>
    (sessionsByBuilding[building.id] || []).map((session) => ({
      building,
      session,
      report: reports.find((item) => item.inspection_session_id === session.id)
    }))
  );
  const sessionsThisMonth = rows.filter(({ session }) => {
    const date = new Date(session.started_at || session.created_at || 0);
    const now = new Date();
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  }).length;

  useEffect(() => {
    onLoadHistory();
  }, [onLoadHistory]);

  return (
    <>
      <PageHeader
        title="Inspection History"
        subtitle="View all previous inspection sessions and their results"
        actions={
          <button className="secondary-button" type="button" onClick={onLoadHistory}>
            <RefreshCw size={18} />
            Refresh
          </button>
        }
      />
      <section className="overview-stats">
        <Metric label="Total Sessions" value={rows.length} />
        <Metric label="Floors Reviewed" value={rows.reduce((sum, row) => sum + Number(row.session.floor_sessions?.length || 0), 0)} />
        <Metric label="Reports Generated" value={reports.length} />
        <Metric label="This Month" value={sessionsThisMonth} />
      </section>
      <section className="panel">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Building</th>
                <th>Session</th>
                <th>Floors</th>
                <th>Status</th>
                <th>Report</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6">
                    <InlineLoading label="Loading history" />
                  </td>
                </tr>
              ) : null}
              {!loading && rows.length === 0 ? (
                <tr>
                  <td colSpan="6">
                    <EmptyState icon={History} label="No inspection sessions found" />
                  </td>
                </tr>
              ) : null}
              {rows
                .filter((row) => !focusBuildingId || String(row.building.id) === String(focusBuildingId))
                .map(({ building, session, report }) => (
                  <tr key={session.id}>
                    <td>
                      <strong>{building.name}</strong>
                      <span>{building.city}</span>
                    </td>
                    <td>
                      <strong>{session.session_code || `#${session.id}`}</strong>
                      <span>{formatDate(session.started_at || session.created_at)}</span>
                    </td>
                    <td>{session.floor_sessions?.length || 0}</td>
                    <td>
                      <StatusBadge value={session.status || "unknown"} />
                    </td>
                    <td>{report ? <StatusBadge value={report.status || "generated"} /> : "No report"}</td>
                    <td>
                      <button className="secondary-button dense" type="button" onClick={() => onOpenSession(session)}>
                        <Eye size={16} />
                        Open
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function CloudLoginForm({ cloudToken, isLoading, onLogin, onLogout }) {
  const [email, setEmail] = useState("engineer@example.com");
  const [password, setPassword] = useState("password");

  if (cloudToken) {
    return (
      <div className="cloud-auth-row">
        <span>
          <strong>VPS session connected</strong>
          <small>Sync and publish actions use the cloud API.</small>
        </span>
        <button className="secondary-button dense" type="button" onClick={onLogout}>
          <XCircle size={15} />
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <form
      className="cloud-login-form"
      onSubmit={(event) => {
        event.preventDefault();
        onLogin({ email, password });
      }}
    >
      <label>
        VPS Email
        <input value={email} type="email" onChange={(event) => setEmail(event.target.value)} />
      </label>
      <label>
        VPS Password
        <input value={password} type="password" onChange={(event) => setPassword(event.target.value)} />
      </label>
      <button className="primary-button" type="submit" disabled={isLoading}>
        {isLoading ? <Loader2 className="spin" size={17} /> : <Server size={17} />}
        Connect VPS
      </button>
    </form>
  );
}

function ReportsPage({
  reports,
  loading,
  cloudStatus,
  cloudReports,
  cloudToken,
  cloudSyncState,
  cloudBusyReportId,
  cloudAuthLoading,
  onRefresh,
  onRefreshCloud,
  onDownload,
  onSyncCloud,
  onCloudLogin,
  onCloudLogout,
  onPublish,
  onUnpublish
}) {
  const [selectedReport, setSelectedReport] = useState(null);
  const selectedCloudState = selectedReport ? cloudSyncState[selectedReport.id] || {} : {};
  const selectedCloudReportId = selectedCloudState.cloud_finalized_report_id;
  const selectedCloudStatus =
    selectedCloudState.cloud_report_status || selectedCloudState.cloud_sync_status || "local only";
  const selectedPublished = selectedCloudStatus === "published";
  const selectedBusy = selectedReport ? cloudBusyReportId === selectedReport.id : false;

  useEffect(() => {
    if (selectedReport) {
      const fresh = reports.find((report) => report.id === selectedReport.id);
      if (fresh) {
        setSelectedReport(fresh);
      }
    }
  }, [reports, selectedReport]);

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Finalized local reports, VPS sync, and community publishing"
        actions={
          <>
            <button className="secondary-button" type="button" onClick={onRefresh}>
              <RefreshCw size={18} />
              Refresh Local
            </button>
            <button className="secondary-button" type="button" onClick={onRefreshCloud}>
              <Server size={18} />
              Check VPS
            </button>
          </>
        }
      />
      <section className="content-grid two-column reports-layout">
        <article className="panel">
          <div className="panel-heading">
            <h2>Generated Reports</h2>
            <StatusBadge value={`${reports.length} total`} tone="neutral" />
          </div>
          {loading ? <InlineLoading label="Loading reports" /> : null}
          {!loading && reports.length === 0 ? <EmptyState icon={FileText} label="No finalized reports yet" /> : null}
          <div className="record-list">
            {reports.map((report) => {
              const building = report.inspection_session?.building;
              const cloudMeta = cloudSyncState[report.id] || {};
              const cloudValue = cloudMeta.cloud_report_status || cloudMeta.cloud_sync_status || "local only";
              return (
                <div className="record-row" key={report.id}>
                  <div>
                    <strong>{report.title || `Report ${report.id}`}</strong>
                    <span>
                      {building?.name || `Session ${report.inspection_session_id}`} · {report.language || "en"}
                    </span>
                    <small>
                      Damage {Number(report.damage_score || 0).toFixed(2)}% · Repairability{" "}
                      {Number(report.repairability_score || 0).toFixed(2)}%
                    </small>
                  </div>
                  <div className="row-actions">
                    <StatusBadge value={report.status || "unpublished"} />
                    <StatusBadge value={`VPS ${cloudValue}`} />
                    <button className="icon-button light" type="button" onClick={() => setSelectedReport(report)} aria-label="View report">
                      <Eye size={18} />
                    </button>
                    <button className="icon-button filled" type="button" onClick={() => onDownload(report)} aria-label="Download report">
                      <Download size={18} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </article>

        <article className="panel detail-panel">
          <div className="panel-heading">
            <h2>Report Detail</h2>
            {selectedReport ? <StatusBadge value={`VPS ${selectedCloudStatus}`} /> : null}
          </div>
          {selectedReport ? (
            <div className="report-detail">
              <img src={ASSETS.frameScan} alt="" />
              <CloudLoginForm
                cloudToken={cloudToken}
                isLoading={cloudAuthLoading}
                onLogin={onCloudLogin}
                onLogout={onCloudLogout}
              />
              <dl>
                <div>
                  <dt>Title</dt>
                  <dd>{selectedReport.title || `Report ${selectedReport.id}`}</dd>
                </div>
                <div>
                  <dt>Building</dt>
                  <dd>{selectedReport.inspection_session?.building?.name || "Unknown"}</dd>
                </div>
                <div>
                  <dt>Risk Level</dt>
                  <dd>{selectedReport.risk_level || "Not calculated"}</dd>
                </div>
                <div>
                  <dt>Finalized</dt>
                  <dd>{formatDate(selectedReport.finalized_at || selectedReport.created_at)}</dd>
                </div>
                <div>
                  <dt>VPS Report</dt>
                  <dd>{selectedCloudReportId ? `#${selectedCloudReportId}` : "Not synced"}</dd>
                </div>
                <div>
                  <dt>VPS Status</dt>
                  <dd>{selectedCloudStatus}</dd>
                </div>
              </dl>
              <div className="control-row">
                <button className="primary-button" type="button" onClick={() => onDownload(selectedReport)}>
                  <Download size={17} />
                  Download PDF
                </button>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => onSyncCloud(selectedReport)}
                  disabled={!cloudToken || selectedBusy}
                >
                  {selectedBusy && !selectedCloudReportId ? <Loader2 className="spin" size={17} /> : <Send size={17} />}
                  {selectedCloudReportId ? "Re-sync VPS" : "Sync to VPS"}
                </button>
                {selectedPublished ? (
                  <button className="secondary-button" type="button" onClick={() => onUnpublish(selectedReport)} disabled={!cloudToken || selectedBusy}>
                    <XCircle size={17} />
                    Unpublish
                  </button>
                ) : (
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => onPublish(selectedReport)}
                    disabled={!cloudToken || !selectedCloudReportId || selectedBusy}
                  >
                    {selectedBusy && selectedCloudReportId ? <Loader2 className="spin" size={17} /> : <CheckCircle2 size={17} />}
                    Publish VPS
                  </button>
                )}
              </div>
            </div>
          ) : (
            <EmptyState icon={FileText} label="Select a report" />
          )}
          <div className="tool-note">
            VPS cloud: <strong>{cloudStatus}</strong> · public reports visible: <strong>{cloudReports.length}</strong>
            <br />
            Cloud origin: <strong>{CLOUD_BACKEND_ORIGIN}</strong>
            <br />
            Sync endpoint: <strong>{CLOUD_API_BASE_URL}/sync/inspection-packages</strong>
          </div>
        </article>
      </section>
    </>
  );
}

function LocalToolsPage({
  services,
  devices,
  selectedDevice,
  setSelectedDevice,
  loading,
  error,
  onRefreshServices,
  onStartServices,
  onStopServices,
  onRefreshDevices,
  onEnableWirelessAdb,
  onConnectWirelessAdb,
  onDisconnectWirelessAdb,
  onStartScrcpy,
  onStopScrcpy
}) {
  const serviceRows = Object.values(services || {});
  const [wirelessPort, setWirelessPort] = useState("5555");
  const [wirelessHost, setWirelessHost] = useState("");

  return (
    <>
      <PageHeader
        title="Local Tools"
        subtitle="Laptop-only demo services kept separate from inspection records"
        actions={
          <button className="secondary-button" type="button" onClick={onRefreshServices}>
            <RefreshCw size={18} />
            Refresh
          </button>
        }
      />
      {error ? <div className="alert warning">{error}</div> : null}
      <section className="content-grid two-column">
        <article className="panel">
          <div className="panel-heading">
            <h2>Service Control</h2>
            <StatusBadge value={loading ? "checking" : "local"} tone={loading ? "warning" : "neutral"} />
          </div>
          <div className="control-row">
            <button className="primary-button" type="button" onClick={onStartServices} disabled={loading}>
              <Play size={17} />
              Start Services
            </button>
            <button className="danger-button" type="button" onClick={onStopServices} disabled={loading}>
              <Square size={16} />
              Stop Services
            </button>
          </div>
          <div className="service-grid">
            {serviceRows.length === 0 ? <EmptyState icon={Server} label="No service status loaded" /> : null}
            {serviceRows.map((service) => (
              <div className="service-row" key={service.key || service.label}>
                <span>
                  <strong>{service.label || service.key}</strong>
                  <small>{service.key}</small>
                </span>
                <StatusBadge value={service.status || "unknown"} />
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <h2>Phone Mirror</h2>
            <StatusBadge value={`${devices.length} devices`} tone="neutral" />
          </div>
          <div className="control-row">
            <button className="secondary-button" type="button" onClick={onRefreshDevices} disabled={loading}>
              <RefreshCw size={17} />
              ADB Devices
            </button>
            <button className="primary-button" type="button" onClick={onStartScrcpy} disabled={loading || !selectedDevice}>
              <Radio size={17} />
              Start Scrcpy
            </button>
            <button className="secondary-button" type="button" onClick={onStopScrcpy} disabled={loading}>
              <Square size={16} />
              Stop Scrcpy
            </button>
          </div>
          <select value={selectedDevice} onChange={(event) => setSelectedDevice(event.target.value)}>
            <option value="">Select device</option>
            {devices.map((device) => (
              <option value={device.id} key={device.id} disabled={device.status !== "device"}>
                {device.id} ({device.status})
              </option>
            ))}
          </select>
          <div className="tool-note">
            Helper endpoint: <strong>{REALTIME_HELPER_URL}</strong>
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <h2>WiFi ADB</h2>
            <StatusBadge value={selectedDevice ? selectedDevice : "no device"} tone={selectedDevice ? "success" : "neutral"} />
          </div>
          <div className="wifi-adb-grid">
            <label>
              ADB port
              <input value={wirelessPort} type="number" min="1" max="65535" onChange={(event) => setWirelessPort(event.target.value)} />
            </label>
            <button
              className="secondary-button"
              type="button"
              onClick={() => onEnableWirelessAdb({ device_id: selectedDevice, port: wirelessPort })}
              disabled={loading || !selectedDevice}
            >
              <Wifi size={17} />
              Enable WiFi ADB
            </button>
            <label>
              Phone IP
              <input value={wirelessHost} placeholder="192.168.43.30" onChange={(event) => setWirelessHost(event.target.value)} />
            </label>
            <button
              className="primary-button"
              type="button"
              onClick={() => onConnectWirelessAdb({ host: wirelessHost, port: wirelessPort })}
              disabled={loading || !wirelessHost}
            >
              <Wifi size={17} />
              Connect WiFi ADB
            </button>
            <button
              className="danger-button wifi-disconnect"
              type="button"
              onClick={() => onDisconnectWirelessAdb({ device_id: selectedDevice })}
              disabled={loading || !selectedDevice}
            >
              <WifiOff size={17} />
              Disconnect WiFi ADB
            </button>
          </div>
          <div className="tool-note">
            If a phone is unauthorized, approve USB debugging on the device, then refresh phone devices.
          </div>
        </article>
      </section>
    </>
  );
}

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_STORAGE_KEY) || "");
  const [cloudToken, setCloudToken] = useState(() => localStorage.getItem(CLOUD_TOKEN_STORAGE_KEY) || "");
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [activeView, setActiveView] = useState("buildings");
  const [globalError, setGlobalError] = useState("");
  const [notice, setNotice] = useState("");
  const [buildings, setBuildings] = useState([]);
  const [reports, setReports] = useState([]);
  const [sessionsByBuilding, setSessionsByBuilding] = useState({});
  const [focusHistoryBuildingId, setFocusHistoryBuildingId] = useState("");
  const [globalLoading, setGlobalLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [inspection, setInspection] = useState(null);
  const [workflow, setWorkflow] = useState("idle");
  const [floorIndex, setFloorIndex] = useState(0);
  const [floorData, setFloorData] = useState(emptyFloorData);
  const [refreshingFloor, setRefreshingFloor] = useState(false);
  const [processingLog, setProcessingLog] = useState([]);
  const [socketStatus, setSocketStatus] = useState("Realtime idle");
  const [isStarting, setIsStarting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isExteriorRunning, setIsExteriorRunning] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [services, setServices] = useState({});
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState("");
  const [toolsLoading, setToolsLoading] = useState(false);
  const [toolsError, setToolsError] = useState("");
  const [cloudStatus, setCloudStatus] = useState("offline");
  const [cloudReports, setCloudReports] = useState([]);
  const [cloudSyncState, setCloudSyncState] = useState(loadCloudSyncState);
  const [cloudBusyReportId, setCloudBusyReportId] = useState(null);
  const [cloudAuthLoading, setCloudAuthLoading] = useState(false);
  const socketRef = useRef(null);

  const currentFloor = useMemo(() => {
    const floors = inspection?.floor_sessions || [];
    return floors[floorIndex] || null;
  }, [inspection, floorIndex]);

  const addLog = useCallback((message, tone = "info") => {
    setProcessingLog((current) =>
      [
        {
          id: `${Date.now()}-${Math.random()}`,
          time: new Date().toISOString(),
          message,
          tone
        },
        ...current
      ].slice(0, 80)
    );
  }, []);

  useEffect(() => {
    localStorage.setItem(CLOUD_SYNC_STORAGE_KEY, JSON.stringify(cloudSyncState));
  }, [cloudSyncState]);

  const updateReportCloudState = useCallback((reportId, patch) => {
    setCloudSyncState((current) => ({
      ...current,
      [reportId]: {
        ...(current[reportId] || {}),
        ...patch
      }
    }));
  }, []);

  const clearCloudAuth = useCallback((message = "") => {
    localStorage.removeItem(CLOUD_TOKEN_STORAGE_KEY);
    setCloudToken("");
    if (message) {
      setGlobalError(message);
    }
  }, []);

  const clearAuth = useCallback((message = "") => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(CLOUD_TOKEN_STORAGE_KEY);
    setToken("");
    setCloudToken("");
    setUser(null);
    setInspection(null);
    setWorkflow("idle");
    setFloorData(emptyFloorData);
    setAuthError(message);
  }, []);

  const handleApiError = useCallback(
    (error, target = "global") => {
      const message = messageFromError(error);
      if (error instanceof ApiError && error.status === 401) {
        clearAuth("Session expired. Sign in again.");
        return;
      }

      if (target === "tools") {
        setToolsError(message);
      } else if (target === "auth") {
        setAuthError(message);
      } else {
        setGlobalError(message);
      }

      addLog(`Error: ${message}`, "danger");
    },
    [addLog, clearAuth]
  );

  const handleCloudError = useCallback(
    (error, reportId = null) => {
      const message = messageFromError(error);
      if (reportId) {
        updateReportCloudState(reportId, {
          cloud_sync_status: "failed",
          cloud_error: message,
          cloud_synced_at: new Date().toISOString()
        });
      }

      if (error instanceof ApiError && error.status === 401) {
        clearCloudAuth("VPS session expired. Sign in to the VPS again.");
      } else {
        setGlobalError(message);
      }

      setCloudStatus("failed");
      addLog(`VPS error: ${message}`, "danger");
    },
    [addLog, clearCloudAuth, updateReportCloudState]
  );

  const loadGlobalData = useCallback(
    async (activeToken = token) => {
      if (!activeToken) {
        return;
      }

      setGlobalLoading(true);
      setGlobalError("");
      try {
        const [buildingsPayload, reportsPayload] = await Promise.all([
          apiRequest("/api/v1/buildings", { token: activeToken }),
          apiRequest("/api/v1/finalized-reports", { token: activeToken })
        ]);
        setBuildings(unwrapArray(buildingsPayload));
        setReports(unwrapArray(reportsPayload));
      } catch (error) {
        handleApiError(error);
      } finally {
        setGlobalLoading(false);
      }
    },
    [handleApiError, token]
  );

  const checkCloudStatus = useCallback(async () => {
    setCloudStatus((current) => (["syncing", "synced", "published"].includes(current) ? current : "checking"));
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 4500);

    try {
      const payload = await cloudApiRequest("/community/reports", {
        signal: controller.signal
      });
      setCloudReports(unwrapArray(payload));
      setCloudStatus((current) => (["syncing", "synced", "published"].includes(current) ? current : "online"));
    } catch {
      setCloudReports([]);
      setCloudStatus((current) => (current === "syncing" ? "syncing" : "offline"));
    } finally {
      window.clearTimeout(timeout);
    }
  }, []);

  const refreshFloorData = useCallback(
    async (floorSessionId = currentFloor?.id, inspectionSessionId = inspection?.id, activeToken = token) => {
      if (!activeToken || !floorSessionId) {
        return;
      }

      setRefreshingFloor(true);
      try {
        const requests = [
          apiRequest(`/api/v1/floor-sessions/${floorSessionId}/media`, { token: activeToken }),
          apiRequest(`/api/v1/floor-sessions/${floorSessionId}/structural-elements`, { token: activeToken }),
          apiRequest(`/api/v1/floor-sessions/${floorSessionId}/element-damage-assessments`, { token: activeToken }),
          apiRequest(`/api/v1/ai-predictions?floor_session_id=${floorSessionId}`, { token: activeToken })
        ];

        if (inspectionSessionId) {
          requests.push(apiRequest(`/api/v1/inspection-sessions/${inspectionSessionId}/review-queue`, { token: activeToken }));
          requests.push(apiRequest(`/api/v1/inspection-sessions/${inspectionSessionId}/media`, { token: activeToken }));
          requests.push(apiRequest(`/api/v1/ai-predictions?inspection_session_id=${inspectionSessionId}`, { token: activeToken }));
        }

        const [
          mediaPayload,
          elementPayload,
          assessmentPayload,
          predictionPayload,
          reviewPayload,
          inspectionMediaPayload,
          inspectionPredictionPayload
        ] = await Promise.all(requests);

        setFloorData({
          media: unwrapArray(mediaPayload),
          inspectionMedia: inspectionMediaPayload ? unwrapArray(inspectionMediaPayload) : [],
          elements: unwrapArray(elementPayload),
          assessments: unwrapArray(assessmentPayload),
          predictions: unwrapArray(predictionPayload),
          inspectionPredictions: inspectionPredictionPayload ? unwrapArray(inspectionPredictionPayload) : [],
          reviewQueue: reviewPayload ? unwrapArray(reviewPayload) : []
        });
      } catch (error) {
        handleApiError(error);
      } finally {
        setRefreshingFloor(false);
      }
    },
    [currentFloor?.id, handleApiError, inspection?.id, token]
  );

  useEffect(() => {
    let active = true;

    async function restoreSession() {
      if (!token) {
        setAuthChecked(true);
        return;
      }

      try {
        const payload = await apiRequest("/api/v1/auth/me", { token });
        if (!active) {
          return;
        }
        setUser(payload.data?.user || payload.data || null);
        await loadGlobalData(token);
      } catch {
        if (active) {
          clearAuth("Saved session could not be restored.");
        }
      } finally {
        if (active) {
          setAuthChecked(true);
        }
      }
    }

    restoreSession();
    return () => {
      active = false;
    };
  }, [clearAuth, loadGlobalData, token]);

  useEffect(() => {
    checkCloudStatus();
    const interval = window.setInterval(checkCloudStatus, 30000);
    return () => window.clearInterval(interval);
  }, [checkCloudStatus]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, [activeView]);

  useEffect(() => {
    if (!token || !inspection?.id || workflow !== "active") {
      setSocketStatus("Realtime idle");
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      return undefined;
    }

    const protocol = REVERB.scheme === "wss" || REVERB.scheme === "https" ? "wss" : "ws";
    const socketUrl = `${protocol}://${REVERB.host}:${REVERB.port}/app/${REVERB.key}?protocol=7&client=frontend-dashboard&version=1.0&flash=false`;
    const socket = new WebSocket(socketUrl);
    socketRef.current = socket;
    let closed = false;

    setSocketStatus("Connecting");

    socket.addEventListener("open", () => {
      if (!closed) {
        setSocketStatus("Connected");
      }
    });

    socket.addEventListener("close", () => {
      if (!closed) {
        setSocketStatus("Disconnected");
      }
    });

    socket.addEventListener("error", () => {
      if (!closed) {
        setSocketStatus("Realtime error");
      }
    });

    socket.addEventListener("message", async (message) => {
      let packet;
      try {
        packet = JSON.parse(message.data);
      } catch {
        return;
      }

      const eventName = String(packet.event || "").replace(/^\./, "");

      if (eventName === "pusher:connection_established") {
        try {
          const connectionData = typeof packet.data === "string" ? JSON.parse(packet.data) : packet.data;
          const channelName = `private-inspection.${inspection.id}`;
          const auth = await apiRequest("/broadcasting/auth", {
            method: "POST",
            token,
            body: {
              socket_id: connectionData.socket_id,
              channel_name: channelName
            }
          });

          if (socket.readyState === WebSocket.OPEN) {
            socket.send(
              JSON.stringify({
                event: "pusher:subscribe",
                data: {
                  auth: auth.auth,
                  channel: channelName
                }
              })
            );
          }
        } catch (error) {
          handleApiError(error);
        }
        return;
      }

      if (eventName === "pusher_internal:subscription_succeeded") {
        setSocketStatus("Subscribed");
        addLog(`Realtime subscribed to inspection ${inspection.id}`, "success");
        return;
      }

      if (["ColumnsBeamsDetectionCompleted", "ElementDamageAssessmentCompleted", "AiProcessingFailed"].includes(eventName)) {
        addLog(eventName, eventName === "AiProcessingFailed" ? "danger" : "success");
        await refreshFloorData();
      }
    });

    return () => {
      closed = true;
      socket.close();
      if (socketRef.current === socket) {
        socketRef.current = null;
      }
    };
  }, [addLog, handleApiError, inspection?.id, refreshFloorData, token, workflow]);

  useEffect(() => {
    if (!token || !currentFloor?.id || workflow !== "active") {
      return undefined;
    }

    const interval = window.setInterval(() => {
      if (!document.hidden) {
        refreshFloorData();
      }
    }, socketStatus === "Subscribed" ? 5000 : 3500);

    return () => window.clearInterval(interval);
  }, [currentFloor?.id, refreshFloorData, socketStatus, token, workflow]);

  const handleLogin = async ({ email, password }) => {
    setAuthLoading(true);
    setAuthError("");
    try {
      const payload = await apiRequest("/api/v1/auth/login", {
        method: "POST",
        body: { email, password }
      });
      const accessToken = payload.data?.access_token;
      localStorage.setItem(TOKEN_STORAGE_KEY, accessToken);
      setToken(accessToken);
      setUser(payload.data?.user || null);
      setActiveView("buildings");
      await loadGlobalData(accessToken);
    } catch (error) {
      handleApiError(error, "auth");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleCloudLogin = async ({ email, password }) => {
    setCloudAuthLoading(true);
    setGlobalError("");
    try {
      const payload = await cloudApiRequest("/auth/login", {
        method: "POST",
        body: { email, password }
      });
      const accessToken = payload.data?.access_token || payload.data?.token || payload.access_token || payload.token;
      if (!accessToken) {
        throw new ApiError("VPS login did not return an access token.", { payload });
      }

      localStorage.setItem(CLOUD_TOKEN_STORAGE_KEY, accessToken);
      setCloudToken(accessToken);
      setCloudStatus("online");
      setNotice("VPS session connected.");
      await checkCloudStatus();
    } catch (error) {
      handleCloudError(error);
    } finally {
      setCloudAuthLoading(false);
    }
  };

  const handleCloudLogout = () => {
    clearCloudAuth();
    setNotice("VPS session disconnected.");
  };

  const handleLogout = async () => {
    if (token) {
      try {
        await apiRequest("/api/v1/auth/logout", { method: "POST", token });
      } catch {
        // Local token cleanup is still the source of truth for this dashboard session.
      }
    }

    clearAuth();
    setActiveView("buildings");
  };

  const startInspection = async (draftOrBuilding) => {
    setIsStarting(true);
    setGlobalError("");
    setNotice("");
    try {
      const draft = {
        ...defaultInspectionDraft,
        ...draftOrBuilding,
        number_of_floors: draftOrBuilding.number_of_floors || draftOrBuilding.floors || 1
      };
      const payload = await apiRequest("/api/v1/inspection-sessions/start", {
        method: "POST",
        token,
        body: buildInspectionPayload(draft)
      });
      const session = payload.data?.inspection_session;
      const floorSessions = sortFloorSessions(session?.floor_sessions || []);
      const normalizedSession = { ...session, floor_sessions: floorSessions };
      setInspection(normalizedSession);
      setWorkflow("active");
      setFloorIndex(0);
      setFloorData(emptyFloorData);
      setProcessingLog([]);
      setActiveView("live");
      addLog(`Inspection ${session.id} started`, "success");
      await refreshFloorData(floorSessions[0]?.id, session.id, token);
      await loadGlobalData(token);
    } catch (error) {
      handleApiError(error);
    } finally {
      setIsStarting(false);
    }
  };

  const uploadFrame = async ({ file, latitude, longitude, altitude_m }) => {
    if (!currentFloor?.id) {
      return;
    }

    setIsUploading(true);
    setGlobalError("");
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("captured_at", new Date().toISOString());
      if (latitude) form.append("latitude", latitude);
      if (longitude) form.append("longitude", longitude);
      if (altitude_m) form.append("altitude_m", altitude_m);

      const payload = await apiRequest(`/api/v1/floor-sessions/${currentFloor.id}/stream-image`, {
        method: "POST",
        token,
        body: form
      });

      addLog(`Upload queued as media ${payload.media_asset_id}`, "success");
      await refreshFloorData();
    } catch (error) {
      handleApiError(error);
      throw error;
    } finally {
      setIsUploading(false);
    }
  };

  const runExteriorDetection = async (file) => {
    if (!inspection?.id) {
      return;
    }

    setIsExteriorRunning(true);
    setGlobalError("");
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("type", "building_overview");
      form.append("captured_at", new Date().toISOString());

      const uploadPayload = await apiRequest(`/api/v1/inspection-sessions/${inspection.id}/media`, {
        method: "POST",
        token,
        body: form
      });
      const mediaAsset = uploadPayload.data?.media_asset;

      addLog(`Exterior overview uploaded as media ${mediaAsset?.id || "unknown"}`, "success");

      if (mediaAsset?.id) {
        await apiRequest("/api/v1/ai-predictions", {
          method: "POST",
          token,
          body: {
            ai_model_type: "building_damage_detection",
            media_asset_id: mediaAsset.id
          }
        });
        addLog("Building exterior detection queued", "success");
      }

      await refreshFloorData();
    } catch (error) {
      handleApiError(error);
      throw error;
    } finally {
      setIsExteriorRunning(false);
    }
  };

  const captureHelper = async (captureSettings = {}) => {
    if (!currentFloor?.id) {
      return;
    }

    setIsCapturing(true);
    setGlobalError("");
    try {
      const response = await fetch(`${REALTIME_HELPER_URL}/capture-upload`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          backend_url: API_BASE_URL,
          floor_session_id: Number(currentFloor.id),
          token,
          capture_settings: captureSettings
        })
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.detail?.message || payload.detail || payload.message || "Realtime helper capture failed.");
      }

      const mediaId = payload.media_asset_id || payload.backend_response?.media_asset_id || "unknown";
      addLog(`Detect/analyze queued as media ${mediaId}`, "success");
      await refreshFloorData();
    } catch (error) {
      handleApiError(error);
    } finally {
      setIsCapturing(false);
    }
  };

  const captureExteriorHelper = async (captureSettings = {}) => {
    if (!inspection?.id) {
      return;
    }

    setIsExteriorRunning(true);
    setGlobalError("");
    try {
      const response = await fetch(`${REALTIME_HELPER_URL}/capture-exterior-upload`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          backend_url: API_BASE_URL,
          inspection_session_id: Number(inspection.id),
          token,
          capture_settings: {
            left: Number(captureSettings.left ?? realtimeDefaults.left),
            top: Number(captureSettings.top ?? realtimeDefaults.top),
            width: Number(captureSettings.width ?? realtimeDefaults.width),
            height: Number(captureSettings.height ?? realtimeDefaults.height)
          }
        })
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.detail?.message || payload.detail || payload.message || "Exterior helper capture failed.");
      }

      const mediaId = payload.media_asset_id || payload.backend_response?.media_asset_id || "unknown";
      addLog(`Exterior detection queued as media ${mediaId}`, "success");
      await refreshFloorData();
    } catch (error) {
      handleApiError(error);
    } finally {
      setIsExteriorRunning(false);
    }
  };

  const nextFloor = async () => {
    const nextIndex = floorIndex + 1;
    const floors = inspection?.floor_sessions || [];
    if (nextIndex >= floors.length) {
      return;
    }

    const hasFrame = floorData.media.length > 0;
    const hasPending = floorData.predictions.some((prediction) => prediction.status === "pending");
    if (!hasFrame && !window.confirm("No frame has been uploaded for this floor. Move to the next floor?")) {
      return;
    }

    if (hasPending && !window.confirm("AI processing is still pending. Move to the next floor?")) {
      return;
    }

    setFloorIndex(nextIndex);
    setFloorData(emptyFloorData);
    addLog(`Moved to ${floorLabel(floors[nextIndex])}`);
    await refreshFloorData(floors[nextIndex].id, inspection.id, token);
  };

  const stopInspection = () => {
    setWorkflow("stopped");
    addLog("Inspection stopped. Final review is ready.", "warning");
  };

  const generateReport = async ({ language, title }) => {
    if (!inspection?.id) {
      return;
    }

    setIsGenerating(true);
    setGlobalError("");
    try {
      const payload = await apiRequest(`/api/v1/inspection-sessions/${inspection.id}/finalized-reports`, {
        method: "POST",
        token,
        body: {
          language,
          title: title || `Inspection Report - ${inspection.building?.name || "Building"}`
        }
      });
      const report = payload.data?.finalized_report;
      addLog(`Final report ${report.id} generated`, "success");
      setNotice(`Final report ${report.id} generated.`);
      await loadGlobalData(token);
      setActiveView("reports");
    } catch (error) {
      handleApiError(error);
    } finally {
      setIsGenerating(false);
    }
  };

  const reviewAssessment = async (assessmentId, draft) => {
    setGlobalError("");
    try {
      await apiRequest(`/api/v1/element-damage-assessments/${assessmentId}/review`, {
        method: "PATCH",
        token,
        body: {
          adjusted_grade: draft.adjusted_grade,
          review_status: "approved",
          adjustment_reason: draft.adjustment_reason || "Engineer reviewed and approved adjusted grade."
        }
      });
      addLog(`Assessment ${assessmentId} approved`, "success");
      await refreshFloorData();
    } catch (error) {
      handleApiError(error);
    }
  };

  const loadHistory = useCallback(async () => {
    if (!token || buildings.length === 0) {
      return;
    }

    setHistoryLoading(true);
    setGlobalError("");
    try {
      const entries = await Promise.all(
        buildings.map(async (building) => {
          const payload = await apiRequest(`/api/v1/buildings/${building.id}/inspection-sessions`, { token });
          return [building.id, unwrapArray(payload)];
        })
      );
      setSessionsByBuilding(Object.fromEntries(entries));
    } catch (error) {
      handleApiError(error);
    } finally {
      setHistoryLoading(false);
    }
  }, [buildings, handleApiError, token]);

  const openHistoricalSession = async (session) => {
    const floorSessions = sortFloorSessions(session.floor_sessions || []);
    setInspection({ ...session, floor_sessions: floorSessions });
    setWorkflow("readonly");
    setFloorIndex(0);
    setFloorData(emptyFloorData);
    setProcessingLog([]);
    setActiveView("live");
    addLog(`Opened read-only session ${session.id}`);
    await refreshFloorData(floorSessions[0]?.id, session.id, token);
  };

  const downloadReport = async (report) => {
    try {
      const blob = await downloadRequest(`/api/v1/finalized-reports/${report.id}/download`, token);
      saveBlob(blob, `${slugify(report.title, `structrepair-report-${report.id}`)}.pdf`);
      setNotice(`Report ${report.id} downloaded.`);
    } catch (error) {
      handleApiError(error);
    }
  };

  const collectReportSyncData = async (report) => {
    const session = findSessionForReport(report, inspection, sessionsByBuilding);
    const floorSessions = sortFloorSessions(session?.floor_sessions || []);
    const floorPackages = await Promise.all(
      floorSessions.map(async (floorSession) => {
        if (!floorSession?.id) {
          return { floorSession, elements: [], assessments: [] };
        }

        try {
          const [elementsPayload, assessmentsPayload] = await Promise.all([
            apiRequest(`/api/v1/floor-sessions/${floorSession.id}/structural-elements`, { token }),
            apiRequest(`/api/v1/floor-sessions/${floorSession.id}/element-damage-assessments`, { token })
          ]);

          return {
            floorSession,
            elements: unwrapArray(elementsPayload),
            assessments: unwrapArray(assessmentsPayload)
          };
        } catch (error) {
          addLog(`Could not include floor ${floorSession.id} details in VPS manifest: ${messageFromError(error)}`, "warning");
          return { floorSession, elements: [], assessments: [] };
        }
      })
    );

    return { session, floorPackages };
  };

  const syncReportToCloud = async (report) => {
    if (!cloudToken) {
      setGlobalError("Sign in to the VPS before syncing a report.");
      return;
    }

    setCloudBusyReportId(report.id);
    setCloudStatus("syncing");
    updateReportCloudState(report.id, {
      cloud_sync_status: "syncing",
      cloud_error: ""
    });

    try {
      const [reportPdfBlob, syncData] = await Promise.all([
        downloadRequest(`/api/v1/finalized-reports/${report.id}/download`, token),
        collectReportSyncData(report)
      ]);
      const manifest = buildCloudSyncManifest(report, syncData.session, syncData.floorPackages);
      const form = new FormData();
      form.append("manifest", JSON.stringify(manifest));
      form.append("report_pdf", reportPdfBlob, `${slugify(report.title, `structrepair-report-${report.id}`)}.pdf`);

      const payload = await cloudApiRequest("/sync/inspection-packages", {
        method: "POST",
        token: cloudToken,
        body: form
      });
      const data = payload.data || payload;
      const cloudReportId = data.finalized_report_id || data.cloud_finalized_report_id || data.finalized_report?.id;
      const cloudInspectionId = data.cloud_inspection_session_id || data.inspection_session?.id;
      const cloudReportStatus = data.finalized_report?.status || "synced";

      updateReportCloudState(report.id, {
        cloud_inspection_session_id: cloudInspectionId,
        cloud_finalized_report_id: cloudReportId,
        cloud_sync_status: cloudReportStatus === "published" ? "published" : data.status || "synced",
        cloud_report_status: cloudReportStatus,
        cloud_synced_at: new Date().toISOString(),
        cloud_error: ""
      });
      setCloudStatus(cloudReportStatus === "published" ? "published" : "synced");
      setNotice(`Report ${report.id} synced to VPS${cloudReportId ? ` as cloud report ${cloudReportId}` : ""}.`);
      await checkCloudStatus();
    } catch (error) {
      handleCloudError(error, report.id);
    } finally {
      setCloudBusyReportId(null);
    }
  };

  const publishReport = async (report) => {
    const cloudReportId = cloudSyncState[report.id]?.cloud_finalized_report_id;
    if (!cloudToken) {
      setGlobalError("Sign in to the VPS before publishing.");
      return;
    }
    if (!cloudReportId) {
      setGlobalError("Sync this report to the VPS before publishing.");
      return;
    }

    setCloudBusyReportId(report.id);
    try {
      await cloudApiRequest(`/finalized-reports/${cloudReportId}/publish`, { method: "POST", token: cloudToken });
      updateReportCloudState(report.id, {
        cloud_sync_status: "published",
        cloud_report_status: "published",
        cloud_published_at: new Date().toISOString(),
        cloud_error: ""
      });
      setCloudStatus("published");
      setNotice(`Cloud report ${cloudReportId} published to the community API.`);
      await checkCloudStatus();
    } catch (error) {
      handleCloudError(error, report.id);
    } finally {
      setCloudBusyReportId(null);
    }
  };

  const unpublishReport = async (report) => {
    const cloudReportId = cloudSyncState[report.id]?.cloud_finalized_report_id;
    if (!cloudToken) {
      setGlobalError("Sign in to the VPS before unpublishing.");
      return;
    }
    if (!cloudReportId) {
      setGlobalError("Sync this report to the VPS before unpublishing.");
      return;
    }

    setCloudBusyReportId(report.id);
    try {
      await cloudApiRequest(`/finalized-reports/${cloudReportId}/unpublish`, { method: "POST", token: cloudToken });
      updateReportCloudState(report.id, {
        cloud_sync_status: "synced",
        cloud_report_status: "unpublished",
        cloud_unpublished_at: new Date().toISOString(),
        cloud_error: ""
      });
      setCloudStatus("synced");
      setNotice(`Cloud report ${cloudReportId} unpublished.`);
      await checkCloudStatus();
    } catch (error) {
      handleCloudError(error, report.id);
    } finally {
      setCloudBusyReportId(null);
    }
  };

  const refreshServices = useCallback(async () => {
    if (!token) {
      return;
    }

    setToolsLoading(true);
    setToolsError("");
    try {
      const payload = await apiRequest("/api/v1/field-demo/services", { token });
      setServices(payload.data?.services || {});
    } catch (error) {
      handleApiError(error, "tools");
    } finally {
      setToolsLoading(false);
    }
  }, [handleApiError, token]);

  const startServices = async () => {
    setToolsLoading(true);
    setToolsError("");
    try {
      const payload = await apiRequest("/api/v1/field-demo/services/start", { method: "POST", token, body: {} });
      setServices(payload.data?.services || {});
      setNotice("Local demo services started.");
    } catch (error) {
      handleApiError(error, "tools");
    } finally {
      setToolsLoading(false);
    }
  };

  const stopServices = async () => {
    setToolsLoading(true);
    setToolsError("");
    try {
      const payload = await apiRequest("/api/v1/field-demo/services/stop", { method: "POST", token, body: {} });
      setServices(payload.data?.services || {});
      setNotice("Local demo services stopped.");
    } catch (error) {
      handleApiError(error, "tools");
    } finally {
      setToolsLoading(false);
    }
  };

  const refreshDevices = async () => {
    setToolsLoading(true);
    setToolsError("");
    try {
      const payload = await apiRequest("/api/v1/field-demo/adb/devices", { token });
      setDevices(payload.data?.devices || []);
    } catch (error) {
      handleApiError(error, "tools");
    } finally {
      setToolsLoading(false);
    }
  };

  const enableWirelessAdb = async ({ device_id, port }) => {
    if (!device_id) {
      return;
    }

    setToolsLoading(true);
    setToolsError("");
    try {
      await apiRequest("/api/v1/field-demo/adb/wireless/enable", {
        method: "POST",
        token,
        body: {
          device_id,
          port: Number(port || 5555)
        }
      });
      setNotice(`WiFi ADB enabled on ${device_id}.`);
      await refreshDevices();
    } catch (error) {
      handleApiError(error, "tools");
    } finally {
      setToolsLoading(false);
    }
  };

  const connectWirelessAdb = async ({ host, port }) => {
    if (!host) {
      return;
    }

    setToolsLoading(true);
    setToolsError("");
    try {
      await apiRequest("/api/v1/field-demo/adb/wireless/connect", {
        method: "POST",
        token,
        body: {
          host,
          port: Number(port || 5555)
        }
      });
      setNotice(`WiFi ADB connected to ${host}:${port || 5555}.`);
      await refreshDevices();
    } catch (error) {
      handleApiError(error, "tools");
    } finally {
      setToolsLoading(false);
    }
  };

  const disconnectWirelessAdb = async ({ device_id }) => {
    if (!device_id) {
      return;
    }

    setToolsLoading(true);
    setToolsError("");
    try {
      await apiRequest("/api/v1/field-demo/adb/wireless/disconnect", {
        method: "POST",
        token,
        body: { device_id }
      });
      setNotice(`WiFi ADB disconnected from ${device_id}.`);
      await refreshDevices();
    } catch (error) {
      handleApiError(error, "tools");
    } finally {
      setToolsLoading(false);
    }
  };

  const startScrcpy = async () => {
    if (!selectedDevice) {
      return;
    }

    setToolsLoading(true);
    setToolsError("");
    try {
      const payload = await apiRequest("/api/v1/field-demo/scrcpy/start", {
        method: "POST",
        token,
        body: { device_id: selectedDevice }
      });
      setServices(payload.data?.services || {});
      setNotice("Phone mirror started.");
    } catch (error) {
      handleApiError(error, "tools");
    } finally {
      setToolsLoading(false);
    }
  };

  const stopScrcpy = async () => {
    setToolsLoading(true);
    setToolsError("");
    try {
      const payload = await apiRequest("/api/v1/field-demo/scrcpy/stop", { method: "POST", token, body: {} });
      setServices(payload.data?.services || {});
      setNotice("Phone mirror stopped.");
    } catch (error) {
      handleApiError(error, "tools");
    } finally {
      setToolsLoading(false);
    }
  };

  useEffect(() => {
    if (activeView === "tools" && token) {
      refreshServices();
    }
  }, [activeView, refreshServices, token]);

  const navigateHistory = (buildingId) => {
    setFocusHistoryBuildingId(buildingId ? String(buildingId) : "");
    setActiveView("history");
  };

  if (!authChecked) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <LoginPage onLogin={handleLogin} error={authError} isLoading={authLoading} />;
  }

  let page;
  if (activeView === "buildings") {
    page = (
      <BuildingsPage
        buildings={buildings}
        loading={globalLoading}
        onRefresh={() => loadGlobalData(token)}
        onStartInspection={startInspection}
        isStarting={isStarting}
        onNavigateHistory={navigateHistory}
      />
    );
  } else if (activeView === "live") {
    page = (
      <LiveInspectionPage
        inspection={inspection}
        workflow={workflow}
        currentFloor={currentFloor}
        floorIndex={floorIndex}
        floorData={floorData}
        token={token}
        socketStatus={socketStatus}
        processingLog={processingLog}
        refreshing={refreshingFloor}
        isUploading={isUploading}
        isCapturing={isCapturing}
        isExteriorRunning={isExteriorRunning}
        isStarting={isStarting}
        isGenerating={isGenerating}
        buildings={buildings}
        onStartInspection={startInspection}
        onUploadFrame={uploadFrame}
        onRunExteriorDetection={runExteriorDetection}
        onCaptureHelper={captureHelper}
        onCaptureExterior={captureExteriorHelper}
        onRefresh={() => refreshFloorData()}
        onNextFloor={nextFloor}
        onStopInspection={stopInspection}
        onGenerateReport={generateReport}
        onReviewAssessment={reviewAssessment}
        onBackToBuildings={() => setActiveView("buildings")}
      />
    );
  } else if (activeView === "history") {
    page = (
      <HistoryPage
        buildings={buildings}
        reports={reports}
        sessionsByBuilding={sessionsByBuilding}
        loading={historyLoading}
        onLoadHistory={loadHistory}
        onOpenSession={openHistoricalSession}
        focusBuildingId={focusHistoryBuildingId}
      />
    );
  } else if (activeView === "reports") {
    page = (
      <ReportsPage
        reports={reports}
        loading={globalLoading}
        cloudStatus={cloudStatus}
        cloudReports={cloudReports}
        cloudToken={cloudToken}
        cloudSyncState={cloudSyncState}
        cloudBusyReportId={cloudBusyReportId}
        cloudAuthLoading={cloudAuthLoading}
        onRefresh={() => loadGlobalData(token)}
        onRefreshCloud={checkCloudStatus}
        onDownload={downloadReport}
        onSyncCloud={syncReportToCloud}
        onCloudLogin={handleCloudLogin}
        onCloudLogout={handleCloudLogout}
        onPublish={publishReport}
        onUnpublish={unpublishReport}
      />
    );
  } else {
    page = (
      <LocalToolsPage
        services={services}
        devices={devices}
        selectedDevice={selectedDevice}
        setSelectedDevice={setSelectedDevice}
        loading={toolsLoading}
        error={toolsError}
        onRefreshServices={refreshServices}
        onStartServices={startServices}
        onStopServices={stopServices}
        onRefreshDevices={refreshDevices}
        onEnableWirelessAdb={enableWirelessAdb}
        onConnectWirelessAdb={connectWirelessAdb}
        onDisconnectWirelessAdb={disconnectWirelessAdb}
        onStartScrcpy={startScrcpy}
        onStopScrcpy={stopScrcpy}
      />
    );
  }

  return (
    <AppShell
      activeView={activeView}
      user={user}
      cloudStatus={cloudStatus}
      cloudReportCount={cloudReports.length}
      onNavigate={setActiveView}
      onLogout={handleLogout}
    >
      {globalError ? (
        <div className="alert danger">
          <AlertTriangle size={18} />
          {globalError}
        </div>
      ) : null}
      {notice ? (
        <div className="alert success">
          <CheckCircle2 size={18} />
          {notice}
          <button type="button" onClick={() => setNotice("")}>
            Dismiss
          </button>
        </div>
      ) : null}
      {page}
    </AppShell>
  );
}
