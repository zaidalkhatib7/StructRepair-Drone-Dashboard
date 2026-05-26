import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Building2,
  CalendarDays,
  CheckCircle2,
  Circle,
  Columns3,
  Download,
  Eye,
  FileText,
  Grid2X2,
  History,
  LayoutDashboard,
  LogOut,
  MapPin,
  Pause,
  Play,
  Radio,
  Settings,
  Square,
  Timer,
  Wifi,
  Zap
} from "lucide-react";

const ASSETS = {
  logo: "/assets/structrepair-logo.png",
  exterior: "/assets/building-drone-exterior.png",
  closeup: "/assets/drone-closeup.png",
  elements: "/assets/structural-elements.png",
  live: "/assets/live-inspection-room.png",
  assessment: "/assets/ai-assessment.png",
  droneScan: "/assets/drone-building-scan.png",
  damageScan: "/assets/damage-detection-scan.png",
  frameScan: "/assets/structural-frame-scan.png",
  reportAnalytics: "/assets/report-analytics-hero.png"
};

const severityTone = {
  Severe: "danger",
  Moderate: "warning",
  Minor: "success"
};

const buildings = [
  {
    id: "model-b",
    name: "Model B - Commercial Building",
    location: "Downtown District, Sector 7",
    lastInspection: "May 14, 2026",
    image: ASSETS.droneScan,
    reportImage: ASSETS.reportAnalytics,
    inspectionImages: [ASSETS.live, ASSETS.closeup, ASSETS.damageScan],
    severity: "Severe",
    columns: 8,
    beams: 5,
    elements: 13,
    issues: { minor: 5, moderate: 3, severe: 5 },
    confidence: 91,
    status: "Inspection active"
  },
  {
    id: "residential-a",
    name: "Residential Complex A",
    location: "North Avenue, Block 12",
    lastInspection: "May 13, 2026",
    image: ASSETS.damageScan,
    reportImage: ASSETS.damageScan,
    inspectionImages: [ASSETS.damageScan, ASSETS.closeup, ASSETS.frameScan],
    severity: "Moderate",
    columns: 12,
    beams: 8,
    elements: 20,
    issues: { minor: 12, moderate: 6, severe: 2 },
    confidence: 86,
    status: "Report pending"
  },
  {
    id: "office-c",
    name: "Office Tower C",
    location: "Business Park, Zone 3",
    lastInspection: "May 12, 2026",
    image: ASSETS.frameScan,
    reportImage: ASSETS.frameScan,
    inspectionImages: [ASSETS.frameScan, ASSETS.droneScan, ASSETS.live],
    severity: "Minor",
    columns: 6,
    beams: 4,
    elements: 10,
    issues: { minor: 8, moderate: 2, severe: 0 },
    confidence: 94,
    status: "Cleared"
  }
];

const sessions = [
  {
    id: "s-104",
    buildingId: "model-b",
    date: "May 14, 2026",
    time: "14:30",
    report: "Available"
  },
  {
    id: "s-103",
    buildingId: "residential-a",
    date: "May 13, 2026",
    time: "10:15",
    report: "Available"
  },
  {
    id: "s-102",
    buildingId: "office-c",
    date: "May 12, 2026",
    time: "16:45",
    report: "Available"
  },
  {
    id: "s-101",
    buildingId: "model-b",
    date: "May 10, 2026",
    time: "09:20",
    report: "Draft",
    override: {
      severity: "Moderate",
      elements: 11,
      issues: { minor: 6, moderate: 3, severe: 2 }
    }
  }
];

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "buildings", label: "Buildings", icon: Building2 },
  { id: "live", label: "Live Inspection", icon: Radio },
  { id: "history", label: "History", icon: History },
  { id: "reports", label: "Reports", icon: FileText },
  { id: "settings", label: "Settings", icon: Settings }
];

function getBuilding(id) {
  return buildings.find((building) => building.id === id) || buildings[0];
}

function StatCard({ label, value, icon: Icon, tone = "teal", footnote }) {
  return (
    <article className="stat-card">
      <div className="stat-top">
        <span>{label}</span>
        {Icon ? <Icon className={`stat-icon ${tone}`} size={24} /> : null}
      </div>
      <strong>{value}</strong>
      {footnote ? <small>{footnote}</small> : null}
    </article>
  );
}

function SeverityBadge({ severity }) {
  return <span className={`badge ${severityTone[severity]}`}>{severity}</span>;
}

function Sidebar({ activeView, onNavigate, onLogout }) {
  return (
    <aside className="sidebar">
      <div className="brand-panel">
        <div className="brand-card">
          <img src={ASSETS.logo} alt="StructRepair Drone" />
        </div>
      </div>
      <nav className="main-nav" aria-label="Main navigation">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              className={`nav-button ${activeView === item.id ? "active" : ""}`}
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
            >
              <Icon size={24} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
      <div className="sidebar-user">
        <div className="avatar">JD</div>
        <div>
          <strong>John Doe</strong>
          <span>Engineer</span>
        </div>
        <button className="icon-button subtle" type="button" onClick={onLogout} aria-label="Sign out">
          <LogOut size={24} />
        </button>
      </div>
    </aside>
  );
}

function PageShell({ activeView, onNavigate, onLogout, children }) {
  return (
    <div className="app-shell">
      <Sidebar activeView={activeView} onNavigate={onNavigate} onLogout={onLogout} />
      <main className="page">{children}</main>
    </div>
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

function LoginPage({ onSignIn }) {
  return (
    <main className="login-page">
      <section className="login-visual" aria-label="StructRepair Drone overview">
        <div className="login-inner">
          <img className="login-logo" src={ASSETS.logo} alt="StructRepair Drone" />
          <p className="login-tagline">AI-Powered Structural Damage Assessment</p>
          <ul className="feature-list">
            <li>Drone-based building inspection</li>
            <li>Real-time AI damage detection</li>
            <li>Automated structural analysis reports</li>
          </ul>
          <div className="hero-image-frame">
            <img src={ASSETS.reportAnalytics} alt="AI structural assessment dashboard illustration" />
          </div>
        </div>
      </section>
      <section className="login-form-wrap">
        <form
          className="login-form"
          onSubmit={(event) => {
            event.preventDefault();
            onSignIn();
          }}
        >
          <h1>Welcome Back</h1>
          <p>Sign in to access your StructRepair Drone dashboard</p>
          <label>
            Email Address
            <input defaultValue="engineer@structrepairdrone.com" type="email" />
          </label>
          <label>
            Password
            <input defaultValue="password" type="password" />
          </label>
          <div className="login-options">
            <label className="check-row compact">
              <input type="checkbox" defaultChecked />
              <span>Remember me</span>
            </label>
            <button className="link-button" type="button">
              Forgot password?
            </button>
          </div>
          <button className="primary-button full" type="submit">
            Sign In
          </button>
          <p className="request-access">
            Don't have an account? <button type="button">Request Access</button>
          </p>
        </form>
      </section>
    </main>
  );
}

function DashboardPage({ onNavigate, onStartInspection }) {
  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Monitor inspection readiness, structural risk, and report activity"
        actions={
          <button className="primary-button" type="button" onClick={() => onStartInspection(buildings[0].id)}>
            <Radio size={19} />
            Start Live Inspection
          </button>
        }
      />

      <section className="stats-grid">
        <StatCard label="Total Buildings" value="12" icon={Building2} />
        <StatCard label="Active Inspections" value="3" icon={AlertTriangle} tone="warning" />
        <StatCard label="Elements Detected" value={247} icon={Columns3} tone="mint" />
        <StatCard label="Critical Issues" value="8" icon={AlertTriangle} tone="danger" />
      </section>

      <section className="dashboard-grid">
        <article className="command-panel">
          <div className="command-media">
            <img src={ASSETS.reportAnalytics} alt="Structural assessment visualization" />
          </div>
          <div className="command-content">
            <div>
              <span className="eyebrow">Inspection Command</span>
              <h2>AI model and drone fleet are ready for field review</h2>
              <p>
                Current queue prioritizes severe column exposure at Model B with automated report generation enabled.
              </p>
            </div>
            <div className="command-metrics">
              <div>
                <strong>85%</strong>
                <span>Detection threshold</span>
              </div>
              <div>
                <strong>3</strong>
                <span>Drones available</span>
              </div>
              <div>
                <strong>4</strong>
                <span>Reports in queue</span>
              </div>
            </div>
          </div>
        </article>

        <article className="panel-card severity-panel">
          <div className="panel-title-row">
            <div>
              <h2>Severity Distribution</h2>
              <p>Open structural findings</p>
            </div>
            <BarChart3 size={24} />
          </div>
          {[
            ["Minor", 25, "success"],
            ["Moderate", 11, "warning"],
            ["Severe", 7, "danger"]
          ].map(([label, value, tone]) => (
            <div className="severity-meter" key={label}>
              <div>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
              <div className="meter-track">
                <span className={tone} style={{ width: `${Math.min(100, Number(value) * 4)}%` }} />
              </div>
            </div>
          ))}
        </article>

        <article className="panel-card watchlist-panel">
          <div className="panel-title-row">
            <div>
              <h2>Priority Watchlist</h2>
              <p>Buildings needing engineer attention</p>
            </div>
            <AlertTriangle size={24} />
          </div>
          <div className="watchlist">
            {buildings.map((building) => (
              <button
                className="watch-row"
                key={building.id}
                type="button"
                onClick={() => onNavigate("buildings")}
              >
                <span>
                  <strong>{building.name}</strong>
                  <small>{building.location}</small>
                </span>
                <SeverityBadge severity={building.severity} />
              </button>
            ))}
          </div>
        </article>

        <article className="panel-card recent-panel">
          <div className="panel-title-row">
            <div>
              <h2>Recent Inspection Sessions</h2>
              <p>Latest AI analysis output</p>
            </div>
            <History size={24} />
          </div>
          <div className="mini-table">
            {sessions.slice(0, 3).map((session) => {
              const building = getBuilding(session.buildingId);
              return (
                <button className="mini-row" key={session.id} type="button" onClick={() => onNavigate("history")}>
                  <span>
                    <strong>{building.name}</strong>
                    <small>
                      {session.date} - {session.time}
                    </small>
                  </span>
                  <span className="mini-value">{session.override?.elements || building.elements}</span>
                </button>
              );
            })}
          </div>
        </article>

        <article className="panel-card drone-panel">
          <div className="panel-title-row">
            <div>
              <h2>Live Drone Feed</h2>
              <p>Model B - Commercial Building</p>
            </div>
            <Wifi size={24} />
          </div>
          <div className="feed-preview">
            <img src={ASSETS.live} alt="Live inspection room preview" />
            <div className="feed-overlay">
              <Radio size={34} />
              <span>Stream ready</span>
            </div>
          </div>
        </article>
      </section>
    </>
  );
}

function BuildingCard({ building, onStartInspection }) {
  return (
    <article className="building-card">
      <div className="building-image">
        <img src={building.image} alt={`${building.name} inspection`} />
      </div>
      <div className="building-body">
        <div className="building-heading">
          <h2>{building.name}</h2>
          <SeverityBadge severity={building.severity} />
        </div>
        <p className="meta-line">
          <MapPin size={19} /> {building.location}
        </p>
        <p className="meta-line">
          <CalendarDays size={19} /> Last inspection: {building.lastInspection}
        </p>
        <div className="divider" />
        <div className="building-footer">
          <div>
            <Circle size={24} />
            <span>Columns</span>
            <strong>{building.columns}</strong>
          </div>
          <div>
            <Columns3 size={24} />
            <span>Beams</span>
            <strong>{building.beams}</strong>
          </div>
          <button className="icon-button filled" type="button" onClick={() => onStartInspection(building.id)} aria-label={`Start inspection for ${building.name}`}>
            <Play size={20} />
          </button>
        </div>
      </div>
    </article>
  );
}

function BuildingsPage({ onStartInspection }) {
  return (
    <>
      <PageHeader
        title="Buildings Overview"
        subtitle="Manage and monitor structural inspections across all buildings"
      />
      <section className="stats-grid">
        <StatCard label="Total Buildings" value="12" icon={Building2} />
        <StatCard label="Active Inspections" value="3" icon={AlertTriangle} tone="warning" />
        <StatCard label="Elements Detected" value="247" icon={Columns3} tone="mint" />
        <StatCard label="Critical Issues" value="8" icon={AlertTriangle} tone="danger" />
      </section>
      <section className="building-grid">
        {buildings.map((building) => (
          <BuildingCard building={building} key={building.id} onStartInspection={onStartInspection} />
        ))}
      </section>
    </>
  );
}

function DetectionBoxes({ active }) {
  if (!active) {
    return null;
  }

  return (
    <div className="detection-layer" aria-hidden="true">
      <div className="detection-box severe" style={{ left: "25%", top: "24%", width: "12%", height: "28%" }}>
        <span>Column - Severe</span>
      </div>
      <div className="detection-box minor" style={{ left: "34%", top: "31%", width: "14%", height: "30%" }}>
        <span>Column - Minor</span>
      </div>
      <div className="detection-box moderate" style={{ left: "61%", top: "36%", width: "15%", height: "14%" }}>
        <span>Beam - Moderate</span>
      </div>
    </div>
  );
}

function formatTimer(seconds) {
  const mins = String(Math.floor(seconds / 60)).padStart(2, "0");
  const secs = String(seconds % 60).padStart(2, "0");
  return `${mins}:${secs}`;
}

function LiveInspectionPage({ selectedBuildingId, liveStatus, onBack, onStart, onPause, onEnd }) {
  const building = getBuilding(selectedBuildingId);
  const [elapsed, setElapsed] = useState(liveStatus === "idle" ? 0 : 10);
  const isRunning = liveStatus === "running";
  const isPaused = liveStatus === "paused";
  const isScanning = isRunning || isPaused;
  const detections = isScanning && elapsed >= 15 ? building.issues : null;

  useEffect(() => {
    if (!isRunning) {
      return undefined;
    }
    const interval = window.setInterval(() => setElapsed((time) => time + 1), 1000);
    return () => window.clearInterval(interval);
  }, [isRunning]);

  useEffect(() => {
    if (liveStatus === "idle") {
      setElapsed(0);
    }
  }, [liveStatus]);

  return (
    <main className="live-page">
      <header className="live-header">
        <button className="back-button" type="button" onClick={onBack}>
          <ArrowLeft size={22} />
          Back
        </button>
        <div className="live-title">
          <h1>Live Drone Inspection</h1>
          <p>{building.name}</p>
        </div>
        <div className="live-controls">
          <span className="status-pill">
            <Zap size={18} /> AI: {isRunning ? "Grading" : isPaused ? "Paused" : "Ready"}
          </span>
          <span className="timer-pill">
            <Timer size={17} /> {formatTimer(elapsed)}
          </span>
          {liveStatus === "idle" ? (
            <button className="primary-button" type="button" onClick={onStart}>
              <Play size={19} />
              Start
            </button>
          ) : (
            <>
              <button className="warning-button" type="button" onClick={onPause}>
                <Pause size={18} />
                {isPaused ? "Resume" : "Pause"}
              </button>
              <button className="danger-button" type="button" onClick={onEnd}>
                <Square size={17} />
                End
              </button>
            </>
          )}
        </div>
      </header>
      <section className="live-workspace">
        <div className={`video-panel ${liveStatus}`}>
          <img src={ASSETS.live} alt="Live drone feed inside damaged building" />
          <div className="video-shade" />
          <DetectionBoxes active={liveStatus !== "idle"} />
          {liveStatus === "idle" ? (
            <div className="stream-ready">
              <Radio size={62} />
              <strong>Drone stream ready</strong>
              <span>Click Start to begin inspection</span>
            </div>
          ) : null}
          <div className="stream-info">
            <span>Stream Quality: 1080p HD</span>
            <span>GPS: 40.7128 N, 74.0060 W</span>
            <span>Altitude: 45m</span>
          </div>
        </div>
        <aside className="detected-panel">
          <div className="detected-header">
            <h2>Detected Elements</h2>
            <p>{detections ? building.elements : 0} elements found</p>
          </div>
          <div className="detected-content">
            {detections ? (
              <div className="detected-list">
                <DetectedItem label="Columns" count={building.columns} severity={building.severity} />
                <DetectedItem label="Beams" count={building.beams} severity="Moderate" />
                <DetectedItem label="Minor Damage" count={detections.minor} severity="Minor" />
                <DetectedItem label="Moderate Damage" count={detections.moderate} severity="Moderate" />
                <DetectedItem label="Severe Damage" count={detections.severe} severity="Severe" />
              </div>
            ) : (
              <div className="empty-state">
                <Grid2X2 size={58} />
                <span>{isScanning ? "Scanning for structural elements..." : "No elements detected yet"}</span>
              </div>
            )}
          </div>
        </aside>
      </section>
    </main>
  );
}

function DetectedItem({ label, count, severity }) {
  return (
    <div className="detected-item">
      <span>
        <strong>{label}</strong>
        <small>AI confidence aligned to {severity.toLowerCase()} threshold</small>
      </span>
      <span className={`count-chip ${severityTone[severity]}`}>{count}</span>
    </div>
  );
}

function HistoryPage({ onOpenReport }) {
  return (
    <>
      <PageHeader title="Inspection History" subtitle="View all previous inspection sessions and their results" />
      <section className="stats-grid history-stats">
        <StatCard label="Total Sessions" value="4" />
        <StatCard label="Elements Analyzed" value="54" />
        <StatCard label="Reports Generated" value="3" />
        <StatCard label="This Month" value="12" />
      </section>
      <section className="table-card">
        <div className="history-table">
          <div className="table-row table-head">
            <span>Building</span>
            <span>Date &amp; Time</span>
            <span>Elements</span>
            <span>Severity Summary</span>
            <span>Overall</span>
            <span>Report</span>
            <span>Actions</span>
          </div>
          {sessions.map((session) => {
            const building = getBuilding(session.buildingId);
            const issues = session.override?.issues || building.issues;
            const severity = session.override?.severity || building.severity;
            const elements = session.override?.elements || building.elements;
            return (
              <div className="table-row" key={session.id}>
                <span className="building-cell">
                  <Building2 size={19} />
                  <strong>{building.name}</strong>
                </span>
                <span className="date-cell">
                  <CalendarDays size={19} />
                  {session.date} -<br /> {session.time}
                </span>
                <strong>{elements}</strong>
                <span className="severity-summary">
                  <span className="success">{issues.minor} minor</span>
                  <span>.</span>
                  <span className="warning">{issues.moderate} moderate</span>
                  <span>.</span>
                  <span className="danger">{issues.severe} severe</span>
                </span>
                <SeverityBadge severity={severity} />
                <span className={session.report === "Available" ? "report-available" : ""}>
                  {session.report === "Available" ? <FileText size={18} /> : null}
                  {session.report}
                </span>
                <span className="table-actions">
                  <button className="icon-button subtle" type="button" aria-label="Preview session">
                    <Eye size={19} />
                  </button>
                  {session.report === "Available" ? (
                    <button className="icon-button subtle" type="button" onClick={() => onOpenReport(building.id)} aria-label="Open report">
                      <FileText size={19} />
                    </button>
                  ) : null}
                </span>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}

function ReportsPage({ onOpenReport }) {
  return (
    <>
      <PageHeader title="Reports" subtitle="View and download building assessment reports" />
      <section className="reports-grid">
        {buildings.map((building) => (
          <article className="report-card" key={building.id}>
            <div className="report-cover">
              <FileText size={72} />
            </div>
            <div className="report-body">
              <h2>{building.name}</h2>
              <p className="meta-line">
                <Building2 size={19} /> Session: {building.lastInspection}
              </p>
              <p className="meta-line">
                <CalendarDays size={19} /> Generated: {building.lastInspection}
              </p>
              <div className="divider" />
              <div className="report-summary">
                <span>
                  <small>Elements</small>
                  <strong>{building.elements}</strong>
                </span>
                <SeverityBadge severity={building.severity} />
              </div>
              <div className="report-actions">
                <button className="secondary-button" type="button" onClick={() => onOpenReport(building.id)}>
                  View Report
                </button>
                <button className="icon-button filled" type="button" onClick={() => downloadReport(building)} aria-label={`Download ${building.name} report`}>
                  <Download size={21} />
                </button>
              </div>
            </div>
          </article>
        ))}
      </section>
    </>
  );
}

const reportScores = {
  Severe: { overall: "58.87%", attention: "41.13%", risk: "Critical" },
  Moderate: { overall: "74.42%", attention: "25.58%", risk: "Elevated" },
  Minor: { overall: "91.36%", attention: "8.64%", risk: "Stable" }
};

const detailRows = [
  { id: "C1", type: "Column", location: "North Wing", severity: "Severe", confidence: "94.2%" },
  { id: "C2", type: "Column", location: "North Wing", severity: "Moderate", confidence: "87.5%" },
  { id: "C3", type: "Column", location: "East Wing", severity: "Minor", confidence: "92.1%" },
  { id: "B1", type: "Beam", location: "Central Hall", severity: "Moderate", confidence: "91.7%" },
  { id: "B2", type: "Beam", location: "West Wing", severity: "Minor", confidence: "88.4%" }
];

function ReportMetricCard({ label, value, tone, icon: Icon }) {
  return (
    <article className="report-metric">
      <span className={`metric-icon ${tone}`}>
        <Icon size={24} />
      </span>
      <small>{label}</small>
      <strong>{value}</strong>
    </article>
  );
}

function SeverityDonut({ issues }) {
  const total = Math.max(1, issues.minor + issues.moderate + issues.severe);
  const minor = (issues.minor / total) * 100;
  const moderate = (issues.moderate / total) * 100;
  const severe = (issues.severe / total) * 100;

  return (
    <div className="donut-wrap">
      <div
        className="severity-donut"
        style={{
          "--minor-end": `${minor}%`,
          "--moderate-end": `${minor + moderate}%`,
          "--severe-end": `${minor + moderate + severe}%`
        }}
      />
      <div className="severity-legend">
        {[
          ["Minor", issues.minor, "success"],
          ["Moderate", issues.moderate, "warning"],
          ["Severe", issues.severe, "danger"]
        ].map(([label, value, tone]) => (
          <div className="legend-row" key={label}>
            <span className={`legend-dot ${tone}`} />
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function ElementsByType({ building }) {
  const columnBars = [Math.ceil(building.columns * 0.38), Math.ceil(building.columns * 0.25), Math.ceil(building.columns * 0.37)];
  const beamBars = [Math.max(0, Math.floor(building.beams * 0.2)), Math.ceil(building.beams * 0.25), Math.ceil(building.beams * 0.4)];
  const max = Math.max(...columnBars, ...beamBars, 1);

  return (
    <div className="elements-chart">
      <div className="chart-area" style={{ "--max": max }}>
        <div className="axis-label">3</div>
        <div className="axis-line top" />
        <div className="axis-line mid" />
        <div className="bar-group">
          {columnBars.map((value, index) => (
            <span className={`chart-bar ${["danger", "warning", "success"][index]}`} style={{ height: `${(value / max) * 100}%` }} key={`c-${index}`} />
          ))}
        </div>
        <div className="bar-group">
          {beamBars.map((value, index) => (
            <span className={`chart-bar ${["danger", "warning", "success"][index]}`} style={{ height: `${(value / max) * 100}%` }} key={`b-${index}`} />
          ))}
        </div>
      </div>
      <div className="chart-labels">
        <span>Columns</span>
        <span>Beams</span>
      </div>
      <div className="type-totals">
        <span>
          <Circle size={20} /> Columns <strong>{building.columns}</strong>
        </span>
        <span>
          <Columns3 size={20} /> Beams <strong>{building.beams}</strong>
        </span>
      </div>
    </div>
  );
}

function ReportDetailPage({ buildingId, onBack }) {
  const building = getBuilding(buildingId);
  const score = reportScores[building.severity];

  return (
    <main className="report-detail-page">
      <header className="report-detail-top">
        <button className="back-button report-back" type="button" onClick={onBack}>
          <ArrowLeft size={18} />
          Back to Building
        </button>
        <div className="report-title-row">
          <div>
            <h1>Building Assessment Report</h1>
            <p>{building.name} | Session #01 | {building.lastInspection}</p>
          </div>
          <button className="primary-button" type="button" onClick={() => downloadReport(building)}>
            <Download size={20} />
            Download PDF Report
          </button>
        </div>
      </header>

      <article className="report-document">
        <section className="report-cover-hero">
          <div className="report-cover-copy">
            <span>AI FOR SAFER STRUCTURES</span>
            <h2>StructRepair Drone</h2>
            <h3>{building.name.split(" - ")[0]}</h3>
            <strong>Building Assessment Report</strong>
            <p>AI-Powered Drone for Building Damage Assessment</p>
            <div className="session-chip">
              <FileText size={18} />
              <span>Building Session 01</span>
            </div>
          </div>
          <div className="report-cover-image">
            <img src={building.reportImage} alt={`${building.name} report preview`} />
          </div>
        </section>

        <section className="report-section">
          <h2>Executive Summary</h2>
          <div className="report-metrics-grid">
            <ReportMetricCard label="Overall Score" value={score.overall} tone="success" icon={CheckCircle2} />
            <ReportMetricCard label="Needs Attention" value={score.attention} tone="warning" icon={AlertTriangle} />
            <ReportMetricCard label="Severe Structural Risk" value={score.risk} tone={building.severity === "Severe" ? "danger" : "warning"} icon={AlertTriangle} />
            <ReportMetricCard label="Elements Reviewed" value={building.elements} tone="teal" icon={FileText} />
          </div>

          <div className="report-analysis-grid">
            <div>
              <h3>Damage Severity Distribution</h3>
              <SeverityDonut issues={building.issues} />
            </div>
            <div>
              <h3>Elements by Type</h3>
              <ElementsByType building={building} />
            </div>
          </div>

          <h3>Inspection Imagery</h3>
          <div className="inspection-gallery">
            {building.inspectionImages.map((image, index) => (
              <figure key={image}>
                <img src={image} alt={`${building.name} inspection ${index + 1}`} />
              </figure>
            ))}
          </div>
        </section>

        <section className="report-section report-table-section">
          <h2>Detailed Element Highlights</h2>
          <div className="detail-table">
            <div className="detail-row detail-head">
              <span>ID</span>
              <span>Type</span>
              <span>Location</span>
              <span>Severity</span>
              <span>Confidence</span>
              <span>Status</span>
            </div>
            {detailRows.map((row) => (
              <div className="detail-row" key={row.id}>
                <strong>{row.id}</strong>
                <span>{row.type}</span>
                <span>{row.location}</span>
                <SeverityBadge severity={row.severity} />
                <span>{row.confidence}</span>
                <span className="reviewed-pill">Reviewed</span>
              </div>
            ))}
          </div>
        </section>

        <footer className="report-footer">Generated by StructRepair Drone | Prepared for presentation</footer>
      </article>
    </main>
  );
}

function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" subtitle="Configure your account and application preferences" />
      <section className="settings-stack">
        <article className="settings-card">
          <h2>Profile Information</h2>
          <label>
            Full Name
            <input defaultValue="John Doe" />
          </label>
          <label>
            Email Address
            <input defaultValue="john.doe@structrepair.com" />
          </label>
          <label>
            Role
            <input defaultValue="Structural Engineer" />
          </label>
        </article>
        <article className="settings-card">
          <h2>Organization</h2>
          <label>
            Organization Name
            <input defaultValue="StructRepair Drone Engineering Corp" />
          </label>
          <label>
            License Key
            <input defaultValue="STRUCT-2026-PRO-XXXX" />
          </label>
        </article>
        <article className="settings-card">
          <h2>AI Model Preferences</h2>
          <label>
            Detection Confidence Threshold
            <input className="range-input" type="range" min="50" max="100" defaultValue="85" />
          </label>
          <div className="range-labels">
            <span>50%</span>
            <span>85%</span>
            <span>100%</span>
          </div>
          <label className="check-row">
            <input type="checkbox" defaultChecked />
            <span>Enable real-time detection alerts</span>
          </label>
          <label className="check-row">
            <input type="checkbox" defaultChecked />
            <span>Auto-generate reports after inspection</span>
          </label>
        </article>
        <article className="settings-card">
          <h2>Report Preferences</h2>
          <label>
            Default Report Format
            <select defaultValue="pdf">
              <option value="pdf">PDF (Recommended)</option>
              <option value="docx">Word Document</option>
              <option value="xlsx">Spreadsheet Summary</option>
            </select>
          </label>
          <label className="check-row">
            <input type="checkbox" defaultChecked />
            <span>Include inspection photos in reports</span>
          </label>
          <label className="check-row">
            <input type="checkbox" defaultChecked />
            <span>Include probability breakdown charts</span>
          </label>
        </article>
      </section>
    </>
  );
}

function downloadReport(building) {
  const contents = [
    "StructRepair Drone Assessment Report",
    `Building: ${building.name}`,
    `Date: ${building.lastInspection}`,
    `Overall Severity: ${building.severity}`,
    `Elements: ${building.elements}`,
    `Columns: ${building.columns}`,
    `Beams: ${building.beams}`,
    `Minor: ${building.issues.minor}`,
    `Moderate: ${building.issues.moderate}`,
    `Severe: ${building.issues.severe}`
  ].join("\n");
  const blob = new Blob([contents], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${building.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-report.txt`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeView, setActiveView] = useState("dashboard");
  const [selectedBuildingId, setSelectedBuildingId] = useState("model-b");
  const [liveStatus, setLiveStatus] = useState("idle");

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, [activeView, isAuthenticated]);

  const openReport = (buildingId) => {
    setSelectedBuildingId(buildingId);
    setActiveView("report");
  };

  const startInspection = (buildingId = selectedBuildingId) => {
    setSelectedBuildingId(buildingId);
    setLiveStatus("running");
    setActiveView("live");
  };

  const navigate = (view) => {
    if (view === "live") {
      setLiveStatus("idle");
    }
    setActiveView(view);
  };

  const currentPage = useMemo(() => {
    switch (activeView) {
      case "dashboard":
        return <DashboardPage onNavigate={navigate} onStartInspection={startInspection} />;
      case "buildings":
        return <BuildingsPage onStartInspection={startInspection} />;
      case "history":
        return <HistoryPage onOpenReport={openReport} />;
      case "reports":
        return <ReportsPage onOpenReport={openReport} />;
      case "report":
        return null;
      case "settings":
        return <SettingsPage />;
      default:
        return <DashboardPage onNavigate={navigate} onStartInspection={startInspection} />;
    }
  }, [activeView]);

  if (!isAuthenticated) {
    return <LoginPage onSignIn={() => setIsAuthenticated(true)} />;
  }

  if (activeView === "live") {
    return (
      <>
        <LiveInspectionPage
          selectedBuildingId={selectedBuildingId}
          liveStatus={liveStatus}
          onBack={() => {
            setLiveStatus("idle");
            setActiveView("buildings");
          }}
          onStart={() => setLiveStatus("running")}
          onPause={() => setLiveStatus((status) => (status === "paused" ? "running" : "paused"))}
          onEnd={() => {
            setLiveStatus("idle");
            setActiveView("history");
          }}
        />
      </>
    );
  }

  if (activeView === "report") {
    return <ReportDetailPage buildingId={selectedBuildingId} onBack={() => setActiveView("reports")} />;
  }

  return (
    <PageShell
      activeView={activeView}
      onNavigate={navigate}
      onLogout={() => {
        setIsAuthenticated(false);
        setActiveView("dashboard");
        setLiveStatus("idle");
      }}
    >
      {currentPage}
    </PageShell>
  );
}
