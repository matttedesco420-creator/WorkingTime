/* ===================== Zeiterfassung — app.js ===================== */
(function () {
  "use strict";

  /* ---------------------------------------------------------------- */
  /* Icons (inline SVG strings, stroke-based, inherit button color)   */
  /* ---------------------------------------------------------------- */
  const ICONS = {
    plus: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    trash: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>',
    check: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
    x: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    play: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M8 5v14l11-7z"/></svg>',
    pause: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>',
    flag: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22V4"/><path d="M4 4h13l-2 4 2 4H4"/></svg>',
    pencil: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
    download: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>',
    printer: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V3h12v6"/><rect x="4" y="9" width="16" height="8" rx="1"/><path d="M6 17v4h12v-4"/></svg>',
    user: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>',
    reset: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>',
  };

  /* ---------------------------------------------------------------- */
  /* Helpers                                                          */
  /* ---------------------------------------------------------------- */
  const uid = () =>
    (window.crypto && window.crypto.randomUUID)
      ? window.crypto.randomUUID()
      : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
        });
  const todayISO = () => new Date().toISOString().slice(0, 10);
  const fmtDate = (iso) => {
    if (!iso) return "";
    const [y, m, d] = iso.split("-");
    return `${d}.${m}.${y}`;
  };
  const fmtClock = () => new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  const fmtHeaderDate = () => new Date().toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" });
  const computeHours = (start, end) => {
    if (!start || !end) return null;
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    let mins = eh * 60 + em - (sh * 60 + sm);
    if (mins < 0) mins += 24 * 60;
    return Math.round((mins / 60) * 100) / 100;
  };
  const deriveHours = (start, end, pause) => {
    const base = computeHours(start, end);
    if (base === null) return null;
    const p = Number(pause) || 0;
    return Math.max(0, Math.round((base - p) * 100) / 100);
  };
  const formatElapsed = (ms) => {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const h = String(Math.floor(totalSec / 3600)).padStart(2, "0");
    const m = String(Math.floor((totalSec % 3600) / 60)).padStart(2, "0");
    const s = String(totalSec % 60).padStart(2, "0");
    return `${h}:${m}:${s}`;
  };
  const elapsedMs = (t) => (t.status === "running" && t.startedAt ? t.accumulatedMs + (Date.now() - t.startedAt) : t.accumulatedMs);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const freshTimer = (worker, isOwner) => ({
    id: uid(), isOwner: !!isOwner, worker: worker || "", projectId: "",
    status: "idle", startedAt: null, accumulatedMs: 0, sessionDate: null, sessionStartClock: null,
  });

  const STORAGE_KEY = "zeiterfassung-app-v1";
  const APP_VERSION = "v1.5";
  const PALETTE = ["#2E6F63", "#B8562F", "#3D5A80", "#7A5C3E", "#6B7A3D", "#8C4B6B", "#4B7A8C", "#A0522D"];

  /* ---------------------------------------------------------------- */
  /* Supabase (optional cloud sync — only active if config.js has     */
  /* real credentials; otherwise the app stays fully local as before) */
  /* ---------------------------------------------------------------- */
  const SUPABASE_URL = (window.APP_CONFIG && window.APP_CONFIG.SUPABASE_URL) || "";
  const SUPABASE_ANON_KEY = (window.APP_CONFIG && window.APP_CONFIG.SUPABASE_ANON_KEY) || "";
  const supabaseEnabled = !!(SUPABASE_URL && SUPABASE_ANON_KEY && window.supabase);
  const sb = supabaseEnabled ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
  let currentUser = null;
  let realtimeChannel = null;

  const toIso = (ms) => (ms ? new Date(ms).toISOString() : null);
  const fromIso = (iso) => (iso ? new Date(iso).getTime() : null);

  async function loadFromCloud() {
    if (!sb || !currentUser) return;
    const uidq = currentUser.id;
    try {
      const [profRes, projRes, workRes, entRes, timRes] = await Promise.all([
        sb.from("profiles").select("*").eq("user_id", uidq).maybeSingle(),
        sb.from("projects").select("*").eq("user_id", uidq).order("created_at"),
        sb.from("workers").select("*").eq("user_id", uidq).order("position"),
        sb.from("entries").select("*").eq("user_id", uidq).order("date"),
        sb.from("timers").select("*").eq("user_id", uidq),
      ]);
      if (profRes.data) {
        state.profile = {
          firstName: profRes.data.first_name || "",
          lastName: profRes.data.last_name || "",
          role: profRes.data.role || "",
        };
      }
      state.projects = (projRes.data || []).map((r) => ({
        id: r.id, code: r.code || "", name: r.name, description: r.description || "",
        color: r.color || PALETTE[0],
      }));
      state.workers = (workRes.data || []).map((r) => ({ id: r.id, name: r.name })).filter((w) => w.name && w.name.trim());
      state.entries = (entRes.data || []).map((r) => ({
        id: r.id, date: r.date, projectId: r.project_id || "", worker: r.worker,
        start: r.start_time || "", end: r.end_time || "", pause: Number(r.pause_hours) || 0,
        hours: Number(r.hours) || 0,
        activities: (r.activities && r.activities.length) ? r.activities : (r.activity ? [{ id: uid(), desc: r.activity, hours: "" }] : []),
        materials: r.materials || [],
      }));
      state.timers = (timRes.data || []).map((r) => ({
        id: r.id, isOwner: r.is_owner, worker: r.worker || "", projectId: r.project_id || "",
        status: r.status, startedAt: fromIso(r.started_at), accumulatedMs: Number(r.accumulated_ms) || 0,
        sessionDate: r.session_date, sessionStartClock: r.session_start_clock,
      }));
    } catch (e) {
      console.warn("Cloud-Laden fehlgeschlagen:", e);
    }
  }

  // ---- per-entity write-through (called right after each local mutation) ----
  async function cloudUpsertProfile() {
    if (!sb || !currentUser) return;
    try {
      await sb.from("profiles").upsert({
        user_id: currentUser.id, first_name: state.profile.firstName, last_name: state.profile.lastName,
        role: state.profile.role, updated_at: new Date().toISOString(),
      });
    } catch (e) { console.warn("Cloud: Profil speichern fehlgeschlagen:", e); }
  }
  async function cloudInsertProject(p) {
    if (!sb || !currentUser) return;
    try { await sb.from("projects").insert({ id: p.id, user_id: currentUser.id, code: p.code, name: p.name, description: p.description, color: p.color }); }
    catch (e) { console.warn("Cloud: Projekt anlegen fehlgeschlagen:", e); }
  }
  async function cloudUpdateProject(p) {
    if (!sb || !currentUser) return;
    try { await sb.from("projects").update({ code: p.code, name: p.name, description: p.description }).eq("id", p.id); }
    catch (e) { console.warn("Cloud: Projekt aktualisieren fehlgeschlagen:", e); }
  }
  async function cloudDeleteProject(id) {
    if (!sb || !currentUser) return;
    try { await sb.from("projects").delete().eq("id", id); }
    catch (e) { console.warn("Cloud: Projekt löschen fehlgeschlagen:", e); }
  }
  async function cloudInsertWorker(w) {
    if (!sb || !currentUser) return;
    try { await sb.from("workers").insert({ id: w.id, user_id: currentUser.id, name: w.name, position: state.workers.findIndex((x) => x.id === w.id) }); }
    catch (e) { console.warn("Cloud: Mitarbeiter anlegen fehlgeschlagen:", e); }
  }
  async function cloudUpdateWorker(w) {
    if (!sb || !currentUser) return;
    try { await sb.from("workers").update({ name: w.name }).eq("id", w.id); }
    catch (e) { console.warn("Cloud: Mitarbeiter aktualisieren fehlgeschlagen:", e); }
  }
  async function cloudDeleteWorker(id) {
    if (!sb || !currentUser) return;
    try { await sb.from("workers").delete().eq("id", id); }
    catch (e) { console.warn("Cloud: Mitarbeiter löschen fehlgeschlagen:", e); }
  }
  async function cloudInsertEntry(e) {
    if (!sb || !currentUser) return;
    try {
      await sb.from("entries").insert({
        id: e.id, user_id: currentUser.id, project_id: e.projectId || null, worker: e.worker, date: e.date,
        start_time: e.start || null, end_time: e.end || null, pause_hours: e.pause || 0, hours: e.hours || 0,
        activities: e.activities || [], materials: e.materials || [],
      });
    } catch (err) { console.warn("Cloud: Eintrag anlegen fehlgeschlagen:", err); }
  }
  async function cloudUpdateEntry(e) {
    if (!sb || !currentUser) return;
    try {
      await sb.from("entries").update({
        project_id: e.projectId || null, worker: e.worker, date: e.date, start_time: e.start || null,
        end_time: e.end || null, pause_hours: e.pause || 0, hours: e.hours || 0, activities: e.activities || [],
        materials: e.materials || [], updated_at: new Date().toISOString(),
      }).eq("id", e.id);
    } catch (err) { console.warn("Cloud: Eintrag aktualisieren fehlgeschlagen:", err); }
  }
  async function cloudDeleteEntry(id) {
    if (!sb || !currentUser) return;
    try { await sb.from("entries").delete().eq("id", id); }
    catch (e) { console.warn("Cloud: Eintrag löschen fehlgeschlagen:", e); }
  }
  async function cloudInsertTimer(t) {
    if (!sb || !currentUser) return;
    try {
      await sb.from("timers").insert({
        id: t.id, user_id: currentUser.id, is_owner: t.isOwner, worker: t.worker || "", project_id: t.projectId || null,
        status: t.status, started_at: toIso(t.startedAt), accumulated_ms: t.accumulatedMs,
        session_date: t.sessionDate, session_start_clock: t.sessionStartClock,
      });
    } catch (e) { console.warn("Cloud: Timer anlegen fehlgeschlagen:", e); }
  }
  async function cloudUpdateTimer(t) {
    if (!sb || !currentUser) return;
    try {
      await sb.from("timers").update({
        worker: t.worker || "", project_id: t.projectId || null, status: t.status, started_at: toIso(t.startedAt),
        accumulated_ms: t.accumulatedMs, session_date: t.sessionDate, session_start_clock: t.sessionStartClock,
        updated_at: new Date().toISOString(),
      }).eq("id", t.id);
    } catch (e) { console.warn("Cloud: Timer aktualisieren fehlgeschlagen:", e); }
  }
  async function cloudDeleteTimer(id) {
    if (!sb || !currentUser) return;
    try { await sb.from("timers").delete().eq("id", id); }
    catch (e) { console.warn("Cloud: Timer löschen fehlgeschlagen:", e); }
  }

  // ---- realtime: a second device signed into the same account picks up changes ----
  let realtimeReloadTimeout = null;
  function scheduleRealtimeReload() {
    clearTimeout(realtimeReloadTimeout);
    realtimeReloadTimeout = setTimeout(async () => {
      // Never clobber a form the person is actively filling in.
      const formOpen = state.showManualForm || state.showEditForm || state.showAddPanel || state.timers.some((t) => t.status === "finishing");
      if (formOpen) return;
      await loadFromCloud();
      render();
    }, 600);
  }
  function subscribeRealtime() {
    if (!sb || !currentUser || realtimeChannel) return;
    const uidq = currentUser.id;
    realtimeChannel = sb.channel("app-data-" + uidq);
    ["profiles", "projects", "workers", "entries", "timers"].forEach((table) => {
      realtimeChannel.on("postgres_changes", { event: "*", schema: "public", table, filter: `user_id=eq.${uidq}` }, scheduleRealtimeReload);
    });
    realtimeChannel.subscribe();
  }

  function showAuthGate() {
    document.getElementById("boot-screen").style.display = "none";
    document.getElementById("auth-gate").style.display = "flex";
    document.getElementById("app-shell").style.display = "none";
    document.getElementById("bottom-nav").style.display = "none";
  }
  function showApp() {
    document.getElementById("boot-screen").style.display = "none";
    document.getElementById("auth-gate").style.display = "none";
    document.getElementById("app-shell").style.display = "";
    document.getElementById("bottom-nav").style.display = "";
    render();
  }

  function buildProjectMaterialMatrix(project, entries) {
    const projEntries = entries.filter((e) => e.projectId === project.id);
    const matMap = new Map();
    const dateSet = new Set();
    projEntries.forEach((e) => {
      dateSet.add(e.date);
      (e.materials || []).forEach((m) => {
        if (!m.name) return;
        const key = m.name.trim().toLowerCase();
        if (!matMap.has(key)) matMap.set(key, { name: m.name.trim(), unit: m.unit || "" });
      });
    });
    const dates = Array.from(dateSet).sort();
    const rows = Array.from(matMap.entries()).map(([key, info]) => {
      let total = 0;
      const byDate = dates.map((d) => {
        let sum = 0;
        projEntries.filter((e) => e.date === d).forEach((e) => {
          (e.materials || []).forEach((m) => {
            if (m.name && m.name.trim().toLowerCase() === key) sum += Number(m.qty) || 0;
          });
        });
        total += sum;
        return sum;
      });
      return { name: info.name, unit: info.unit, byDate, total: Math.round(total * 100) / 100 };
    });
    return { dates, rows };
  }

  // Hours worked per person, broken down by day — vertical, person-grouped
  // layout (owner first, then workers) so it stays readable in the PDF export
  // even with many dates, instead of a wide day-by-day table.
  function buildProjectDailyBreakdown(project, entries) {
    const projEntries = entries.filter((e) => e.projectId === project.id);
    const owner = ownerDisplayName();
    const peopleSet = new Set(projEntries.map((e) => e.worker));
    const rest = Array.from(peopleSet).filter((p) => p !== owner).sort();
    const people = peopleSet.has(owner) ? [owner, ...rest] : rest;

    const sections = people.map((person) => {
      const byDate = {};
      projEntries.filter((e) => e.worker === person).forEach((e) => {
        byDate[e.date] = (byDate[e.date] || 0) + Number(e.hours || 0);
      });
      const days = Object.keys(byDate).sort().map((d) => ({ date: d, hours: Math.round(byDate[d] * 100) / 100 }));
      const total = Math.round(days.reduce((s, d) => s + d.hours, 0) * 100) / 100;
      return { person, days, total };
    });
    const grandTotal = Math.round(sections.reduce((s, sec) => s + sec.total, 0) * 100) / 100;
    return { sections, grandTotal };
  }

  /* ---------------------------------------------------------------- */
  /* State                                                            */
  /* ---------------------------------------------------------------- */
  const state = {
    profile: { firstName: "", lastName: "", role: "" },
    projects: [],
    workers: [], // additional team members (not the owner)
    entries: [],
    timers: [], // 1 permanent owner card + up to 3 others
    view: "timer",
    showProfilePanel: false,
    showAddPanel: false,
    showManualForm: false,
    showEditForm: false,
    editingEntryId: null,
    showAddWorkerSettings: false,
    overviewProjectId: null,
    deleteConfirmId: null,
    removeTimerConfirmId: null,
    resetTimerConfirmId: null,
  };

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data.profile) state.profile = data.profile;
        if (data.projects) state.projects = data.projects;
        if (data.workers) {
          state.workers = (data.workers || [])
            .map((w) => (typeof w === "string" ? { id: uid(), name: w.trim() } : { id: w.id || uid(), name: (w.name || "").trim() }))
            .filter((w) => w.name);
        }
        if (data.entries) {
          state.entries = (data.entries || []).map((e) => {
            if (e.activities) return e;
            const { activity, ...rest } = e;
            return { ...rest, activities: activity ? [{ id: uid(), desc: activity, hours: "" }] : [] };
          });
        }
        if (data.timers) state.timers = data.timers;
      }
    } catch (e) { /* no stored data yet */ }
  }
  let saveTimeout = null;
  function persist() {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          profile: state.profile, projects: state.projects, workers: state.workers,
          entries: state.entries, timers: state.timers,
        }));
      } catch (e) { /* best effort */ }
    }, 250);
  }

  function ensureOwnerTimer() {
    if (!state.timers.some((t) => t.isOwner)) {
      const t = freshTimer("", true);
      state.timers = [t, ...state.timers];
      return t; // newly created — caller may need to insert it in the cloud
    }
    return null;
  }

  /* ---------------------------------------------------------------- */
  /* Derived getters                                                  */
  /* ---------------------------------------------------------------- */
  const ownerDisplayName = () => {
    const full = [state.profile.firstName.trim(), state.profile.lastName.trim()].filter(Boolean).join(" ");
    return full || "Du";
  };
  const ownerInitials = () => {
    const f = state.profile.firstName.trim();
    const l = state.profile.lastName.trim();
    if (!f && !l) return null;
    return `${f ? f[0] : ""}${l ? l[0] : ""}`.toUpperCase();
  };
  const projectById = (id) => state.projects.find((p) => p.id === id);
  const projectName = (id) => projectById(id)?.name || "(gelöscht)";
  const teamWorkers = () => state.workers.filter((w) => w && w.name && w.name.trim()).map((w) => w.name);
  const allNames = () => [ownerDisplayName(), ...teamWorkers()];
  const ownerTimer = () => state.timers.find((t) => t.isOwner);
  const otherTimers = () => state.timers.filter((t) => !t.isOwner);
  const availableForAdd = () => {
    const ot = otherTimers();
    return teamWorkers().filter((w) => !ot.some((t) => t.worker === w));
  };
  const cloneMaterials = (materials) => materials.map((m) => ({ id: uid(), name: m.name, qty: m.qty, unit: m.unit }));

  /* ---------------------------------------------------------------- */
  /* Timer actions                                                    */
  /* ---------------------------------------------------------------- */
  function startTimer(id) {
    const t = state.timers.find((x) => x.id === id);
    if (!t) return;
    t.status = "running";
    t.startedAt = Date.now();
    t.sessionStartClock = t.sessionStartClock || fmtClock();
    t.sessionDate = t.sessionDate || todayISO();
    cloudUpdateTimer(t);
  }
  function pauseTimer(id) {
    const t = state.timers.find((x) => x.id === id);
    if (!t || t.status !== "running") return;
    t.accumulatedMs += Date.now() - t.startedAt;
    t.startedAt = null;
    t.status = "paused";
    cloudUpdateTimer(t);
  }
  function resumeTimer(id) {
    const t = state.timers.find((x) => x.id === id);
    if (!t) return;
    t.status = "running";
    t.startedAt = Date.now();
    cloudUpdateTimer(t);
  }
  function resetTimer(id) {
    const t = state.timers.find((x) => x.id === id);
    if (!t) return;
    t.status = "idle";
    t.startedAt = null;
    t.accumulatedMs = 0;
    t.sessionDate = null;
    t.sessionStartClock = null;
    cloudUpdateTimer(t);
  }
  function clickFeierabend(id) {
    const t = state.timers.find((x) => x.id === id);
    if (!t) return;
    if (t.status === "running") t.accumulatedMs += Date.now() - t.startedAt;
    t.startedAt = null;
    t.status = "finishing";
    cloudUpdateTimer(t);
  }
  function cancelFinish(id) {
    const t = state.timers.find((x) => x.id === id);
    if (!t) return;
    t.status = "paused";
    cloudUpdateTimer(t);
  }
  function confirmFinishData(t, projectId, activities, materials) {
    const entry = {
      id: uid(),
      date: t.sessionDate || todayISO(),
      worker: t.isOwner ? ownerDisplayName() : t.worker,
      projectId,
      start: t.sessionStartClock || "",
      end: fmtClock(),
      pause: 0,
      hours: Math.round((t.accumulatedMs / 3600000) * 100) / 100,
      activities,
      materials,
    };
    state.entries.push(entry);
    cloudInsertEntry(entry);
    if (t.isOwner) {
      t.projectId = "";
      t.status = "idle";
      t.startedAt = null;
      t.accumulatedMs = 0;
      t.sessionDate = null;
      t.sessionStartClock = null;
      cloudUpdateTimer(t);
    } else {
      state.timers = state.timers.filter((x) => x.id !== t.id);
      cloudDeleteTimer(t.id);
    }
  }

  /* ---------------------------------------------------------------- */
  /* DOM read helpers (forms are mostly uncontrolled; read on submit) */
  /* ---------------------------------------------------------------- */
  function readTimeFieldsRaw(block) {
    return {
      start: block.querySelector('[data-field="start"]').value,
      end: block.querySelector('[data-field="end"]').value,
      pause: block.querySelector('[data-field="pause"]').value,
      hours: block.querySelector('[data-field="hours"]').value,
    };
  }
  function readMaterialRows(root) {
    return Array.from(root.querySelectorAll("[data-material-id]")).map((row) => {
      const name = row.querySelector('[data-field="name"]').value.trim();
      const qty = Number(row.querySelector('[data-field="qty"]').value) || 0;
      const unit = row.querySelector('[data-field="unit"]').value.trim();
      return { id: uid(), name, qty, unit };
    }).filter((m) => m.name);
  }
  function readActivityRows(root) {
    return Array.from(root.querySelectorAll("[data-activity-id]")).map((row) => {
      const desc = row.querySelector('[data-field="desc"]').value.trim();
      const hours = row.querySelector('[data-field="ahours"]').value;
      return { id: uid(), desc, hours: hours === "" ? "" : Number(hours) || 0 };
    }).filter((a) => a.desc);
  }
  // Total worked hours for whichever person-block (owner / extra worker / timer
  // card) an activity row's ±20% button lives in — used to size the nudge.
  function findPersonTotalHours(withinEl) {
    const personBlock = withinEl.closest("[data-person-block]");
    if (!personBlock) return 0;
    const hoursInput = personBlock.querySelector('[data-field="hours"]');
    if (hoursInput) return Number(hoursInput.value) || 0;
    const totalAttr = personBlock.getAttribute("data-total-hours");
    return totalAttr ? Number(totalAttr) || 0 : 0;
  }
  // How many hours are still free to assign to activities in this block, i.e.
  // the person's total work time minus what other activity rows already use.
  function remainingActivityAllowance(activitiesBlock, excludeRow) {
    const total = findPersonTotalHours(activitiesBlock);
    const others = Array.from(activitiesBlock.querySelectorAll("[data-activity-id]"))
      .filter((r) => r !== excludeRow)
      .reduce((s, r) => s + (Number(r.querySelector('[data-field="ahours"]').value) || 0), 0);
    return Math.max(0, Math.round((total - others) * 100) / 100);
  }
  function activityHoursSum(activities) {
    return Math.round(activities.reduce((s, a) => s + (Number(a.hours) || 0), 0) * 100) / 100;
  }
  function recalcTimeFields(block) {
    const start = block.querySelector('[data-field="start"]').value;
    const end = block.querySelector('[data-field="end"]').value;
    const pause = block.querySelector('[data-field="pause"]').value;
    const hoursEl = block.querySelector('[data-field="hours"]');
    const labelEl = block.querySelector("[data-hours-label]");
    const h = deriveHours(start, end, pause);
    if (h !== null) {
      hoursEl.value = h;
      hoursEl.disabled = true;
      if (labelEl) labelEl.textContent = "Std. (berechnet)";
    } else {
      hoursEl.disabled = false;
      if (labelEl) labelEl.textContent = "Std. (manuell)";
    }
  }
  function refreshExtraWorkerOptions(formRoot) {
    if (!formRoot) return;
    const selects = Array.from(formRoot.querySelectorAll('[data-role="extra-worker-select"]'));
    const chosen = selects.map((s) => s.value).filter(Boolean);
    selects.forEach((sel) => {
      Array.from(sel.options).forEach((opt) => {
        if (!opt.value) return;
        opt.disabled = chosen.includes(opt.value) && sel.value !== opt.value;
      });
    });
  }
  function updateAddExtraButtonVisibility() {
    const container = document.getElementById("extra-workers-container");
    const btn = document.getElementById("add-extra-worker-btn");
    if (!container || !btn) return;
    btn.style.display = container.children.length >= 3 ? "none" : "";
  }

  /* ---------------------------------------------------------------- */
  /* Templates                                                        */
  /* ---------------------------------------------------------------- */
  function materialRowHTML(m) {
    m = m || {};
    return `
    <div class="material-row" data-material-id="${uid()}">
      <div class="field name-field"><input type="text" placeholder="Material" data-field="name" value="${esc(m.name || "")}"></div>
      <div class="field qty-field"><input type="number" step="any" placeholder="Menge" data-field="qty" value="${esc(m.qty ?? "")}"></div>
      <div class="field unit-field"><input type="text" list="unit-options" placeholder="Einheit" data-field="unit" value="${esc(m.unit || "")}"></div>
      <button type="button" class="btn-icon danger" data-action="remove-material-row" title="Zeile entfernen">${ICONS.trash}</button>
    </div>`;
  }
  function materialEditorHTML(materials) {
    const list = materials && materials.length ? materials : [{}];
    return `
    <div class="materials-block" data-materials-block>
      <label class="small-label">Materialliste</label>
      <div data-material-rows>${list.map(materialRowHTML).join("")}</div>
      <datalist id="unit-options">
        <option value="Stk"></option><option value="m"></option><option value="m²"></option>
        <option value="kg"></option><option value="l"></option><option value="Pauschal"></option>
      </datalist>
      <button type="button" class="btn btn-ghost" data-action="add-material-row">${ICONS.plus} Material hinzufügen</button>
    </div>`;
  }
  function activityRowHTML(a) {
    a = a || {};
    return `
    <div class="activity-row" data-activity-id="${uid()}">
      <div class="field name-field"><input type="text" placeholder="Tätigkeit" data-field="desc" value="${esc(a.desc || "")}"></div>
      <div class="field hours-field"><input type="number" step="0.25" min="0" placeholder="Std." data-field="ahours" value="${esc(a.hours ?? "")}"></div>
      <button type="button" class="btn-icon adjust-btn" data-action="adjust-activity-hours" data-delta="-20" title="−20 % der Gesamtstunden">−20%</button>
      <button type="button" class="btn-icon adjust-btn" data-action="adjust-activity-hours" data-delta="20" title="+20 % der Gesamtstunden">+20%</button>
      <button type="button" class="btn-icon danger" data-action="remove-activity-row" title="Zeile entfernen">${ICONS.trash}</button>
    </div>`;
  }
  function activityEditorHTML(activities) {
    const list = activities && activities.length ? activities : [{}];
    return `
    <div class="activities-block" data-activities-block>
      <label class="small-label">Tätigkeiten</label>
      <div data-activity-rows>${list.map(activityRowHTML).join("")}</div>
      <button type="button" class="btn btn-ghost" data-action="add-activity-row">${ICONS.plus} Tätigkeit hinzufügen</button>
    </div>`;
  }
  function timeFieldsHTML(value) {
    value = value || {};
    const computed = !!(value.start && value.end);
    return `
    <div class="field-row" data-time-fields>
      <div class="field"><label>Beginn</label><input type="time" data-field="start" value="${esc(value.start || "")}"></div>
      <div class="field"><label>Ende</label><input type="time" data-field="end" value="${esc(value.end || "")}"></div>
      <div class="field"><label>Pause (Std.)</label><input type="number" step="0.25" min="0" placeholder="0" data-field="pause" value="${esc(value.pause || "")}"></div>
      <div class="field"><label data-hours-label>Std. ${computed ? "(berechnet)" : "(manuell)"}</label><input type="number" step="0.25" min="0" data-field="hours" placeholder="z. B. 8" value="${esc(value.hours || "")}" ${computed ? "disabled" : ""}></div>
    </div>`;
  }
  function extraWorkerBlockHTML() {
    const options = teamWorkers().map((w) => `<option value="${esc(w)}">${esc(w)}</option>`).join("");
    return `
    <div class="extra-worker-block" data-extra-id="${uid()}" data-person-block>
      <div class="extra-worker-head">
        <div class="field">
          <label>Mitarbeiter</label>
          <select data-role="extra-worker-select"><option value="">– wählen –</option>${options}</select>
        </div>
        <button type="button" class="btn-icon danger" data-action="remove-extra-worker" title="Entfernen">${ICONS.trash}</button>
      </div>
      ${timeFieldsHTML({})}
      ${activityEditorHTML([])}
    </div>`;
  }
  function manualFormHTML() {
    const projectOptions = state.projects.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join("");
    const hasWorkers = teamWorkers().length > 0;
    return `
    <div class="add-panel" id="manual-form">
      <div class="field-row">
        <div class="field"><label>Datum</label><input type="date" data-field="date" value="${todayISO()}"></div>
        <div class="field"><label>Projekt</label><select data-field="projectId"><option value="">– wählen –</option>${projectOptions}</select></div>
      </div>
      <p class="small-label">DEINE ARBEITSZEIT (${esc(ownerDisplayName())})</p>
      <div data-owner-time data-person-block>
        ${timeFieldsHTML({})}
        ${activityEditorHTML([])}
      </div>
      <div id="extra-workers-container"></div>
      ${hasWorkers
        ? `<button type="button" class="btn btn-ghost" id="add-extra-worker-btn" data-action="add-extra-worker" style="margin-bottom:14px;">${ICONS.plus} Mitarbeiter hinzufügen</button>`
        : `<p class="hint">Noch keine weiteren Mitarbeiter angelegt. <button type="button" class="link-btn" data-action="goto-projects-view">Jetzt einrichten</button></p>`}
      <p class="hint" style="margin-top:4px;">Material wird nur einmal erfasst und dir (${esc(ownerDisplayName())}) zugerechnet.</p>
      ${materialEditorHTML([])}
      <p class="error-msg" data-form-error></p>
      <div class="field-row" style="margin-top:14px; margin-bottom:0;">
        <button type="button" class="btn btn-primary" data-action="save-manual-form">${ICONS.check} Eintrag speichern</button>
        <button type="button" class="btn btn-ghost" data-action="cancel-manual-form">${ICONS.x} Abbrechen</button>
      </div>
    </div>`;
  }
  function editFormHTML(entry) {
    const projectOptions = state.projects.map((p) => `<option value="${p.id}" ${p.id === entry.projectId ? "selected" : ""}>${esc(p.name)}</option>`).join("");
    const workerOptions = allNames().map((w) => `<option value="${esc(w)}" ${w === entry.worker ? "selected" : ""}>${esc(w)}</option>`).join("");
    return `
    <div class="add-panel" id="edit-form">
      <div class="field-row">
        <div class="field"><label>Datum</label><input type="date" data-field="date" value="${entry.date}"></div>
        <div class="field"><label>Projekt</label><select data-field="projectId"><option value="">– wählen –</option>${projectOptions}</select></div>
        <div class="field"><label>Mitarbeiter</label><select data-field="worker"><option value="">– wählen –</option>${workerOptions}</select></div>
      </div>
      <div data-person-block>
        ${timeFieldsHTML({ start: entry.start, end: entry.end, pause: entry.pause ? String(entry.pause) : "", hours: String(entry.hours ?? "") })}
        ${activityEditorHTML(entry.activities || [])}
      </div>
      ${materialEditorHTML(entry.materials || [])}
      <p class="error-msg" data-form-error></p>
      <div class="field-row" style="margin-top:14px; margin-bottom:0;">
        <button type="button" class="btn btn-primary" data-action="save-edit-form">${ICONS.check} Änderungen speichern</button>
        <button type="button" class="btn btn-ghost" data-action="cancel-edit-form">${ICONS.x} Abbrechen</button>
      </div>
    </div>`;
  }
  function entryCardHTML(e) {
    const p = projectById(e.projectId);
    const badgeColor = p?.color || "#8B958E";
    const badgeLabel = (p?.code || p?.name || "?").toString().slice(0, 6);
    const timeText = e.start && e.end ? `${e.start}–${e.end}` : "Ohne Zeitangabe";
    const pauseText = e.pause ? ` · Pause ${e.pause} h` : "";
    const materialsHtml = e.materials && e.materials.length
      ? `<div class="entry-materials">${e.materials.map((m) => `<span class="pill pill-neutral">${esc(m.name)}${m.qty ? ` · ${m.qty}${m.unit ? " " + esc(m.unit) : ""}` : ""}</span>`).join("")}</div>`
      : "";
    const activities = e.activities && e.activities.length ? e.activities : (e.activity ? [{ id: "legacy", desc: e.activity, hours: "" }] : []);
    const activitiesHtml = activities.length
      ? `<div class="entry-activities">${activities.map((a) => `<div class="activity-line"><span>${esc(a.desc)}</span>${a.hours !== "" && a.hours != null ? `<span class="num">${a.hours} h</span>` : ""}</div>`).join("")}</div>`
      : "";
    const deleteControls = state.deleteConfirmId === e.id
      ? `<button type="button" class="btn-icon danger" data-action="confirm-delete-entry" data-entry-id="${e.id}" title="Wirklich löschen">${ICONS.check}</button>
         <button type="button" class="btn-icon" data-action="cancel-delete-entry" title="Abbrechen">${ICONS.x}</button>`
      : `<button type="button" class="btn-icon danger" data-action="request-delete-entry" data-entry-id="${e.id}" title="Löschen">${ICONS.trash}</button>`;
    return `
    <div class="entry-card">
      <div class="entry-top">
        <div>
          <div class="entry-date">${fmtDate(e.date)} · ${esc(e.worker)}</div>
          <div class="entry-time">${timeText}${pauseText}</div>
        </div>
        <span class="pill" style="background:${badgeColor}">${esc(badgeLabel)} · ${Number(e.hours || 0).toFixed(2)} h</span>
      </div>
      ${activitiesHtml}
      ${materialsHtml}
      <div class="entry-actions">
        <button type="button" class="btn-icon" data-action="edit-entry" data-entry-id="${e.id}" title="Bearbeiten">${ICONS.pencil}</button>
        ${deleteControls}
      </div>
    </div>`;
  }
  function timerCardHTML(t, big) {
    const displayName = t.isOwner ? ownerDisplayName() : t.worker;
    const roleLabel = t.isOwner ? state.profile.role.trim() : "";
    const ms = elapsedMs(t);
    const statusLabelMap = { idle: "BEREIT", running: "LÄUFT", paused: "PAUSE", finishing: "ABSCHLUSS" };
    const statusClassMap = { idle: "idle", running: "running", paused: "paused", finishing: "paused" };
    const sizeClass = big ? "big" : "small";

    if (t.status === "finishing") {
      const projectField = state.projects.length === 0
        ? `<p class="hint">Noch keine Projekte angelegt. <button type="button" class="link-btn" data-action="goto-projects-view">Jetzt anlegen</button></p>`
        : `<div class="field"><label>Projekt</label><select data-field="finish-project"><option value="">– Projekt wählen –</option>${state.projects.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join("")}</select></div>`;
      return `
      <div class="timer-card finish-card ${sizeClass}" data-timer-card data-timer-id="${t.id}" data-person-block data-total-hours="${(ms / 3600000).toFixed(2)}">
        <div class="timer-top">
          <span class="status-dot ${statusClassMap[t.status]}"></span>
          <span class="status-label">${esc(displayName)} · Feierabend</span>
        </div>
        <p class="hint" style="margin:2px 0 12px 0;">${formatElapsed(ms)} erfasst</p>
        ${projectField}
        ${activityEditorHTML([])}
        ${materialEditorHTML([])}
        <div class="field-row" style="margin-top:14px;">
          <button type="button" class="btn btn-primary" data-action="confirm-finish" data-timer-id="${t.id}">${ICONS.check} Eintrag abschließen</button>
          <button type="button" class="btn btn-ghost" data-action="cancel-finish" data-timer-id="${t.id}">${ICONS.x} Zurück</button>
        </div>
      </div>`;
    }

    const resetBtn = (t.status === "running" || t.status === "paused")
      ? `<button type="button" class="btn-icon reset-timer" data-action="request-reset-timer" data-timer-id="${t.id}" title="Zeit zurücksetzen">${ICONS.reset}</button>`
      : "";
    const removeBtn = !t.isOwner
      ? `<button type="button" class="btn-icon remove-timer" data-action="request-remove-timer" data-timer-id="${t.id}" title="Entfernen">${ICONS.x}</button>`
      : "";
    const confirmRow = state.removeTimerConfirmId === t.id
      ? `<div class="inline-confirm"><span>Ohne Speichern entfernen?</span>
          <button type="button" class="link-btn" data-action="confirm-remove-timer" data-timer-id="${t.id}">Ja</button>
          <button type="button" class="link-btn" data-action="cancel-remove-timer">Abbrechen</button>
        </div>`
      : state.resetTimerConfirmId === t.id
      ? `<div class="inline-confirm"><span>Zeit auf 00:00:00 zurücksetzen?</span>
          <button type="button" class="link-btn" data-action="confirm-reset-timer" data-timer-id="${t.id}">Ja</button>
          <button type="button" class="link-btn" data-action="cancel-reset-timer">Abbrechen</button>
        </div>`
      : "";
    const nameLine = big ? `<p class="worker-name">${esc(displayName)}${roleLabel ? ` · ${esc(roleLabel)}` : ""}</p>` : "";

    let actions = "";
    if (t.status === "idle") {
      actions = `<button type="button" class="btn btn-primary wide" data-action="start-timer" data-timer-id="${t.id}">${ICONS.play} Arbeit starten</button>`;
    } else if (t.status === "running") {
      actions = `<button type="button" class="btn btn-secondary" data-action="pause-timer" data-timer-id="${t.id}">${ICONS.pause} Pause</button>
                 <button type="button" class="btn btn-outline-light" data-action="feierabend" data-timer-id="${t.id}">${ICONS.flag} Feierabend</button>`;
    } else if (t.status === "paused") {
      actions = `<button type="button" class="btn btn-secondary" data-action="resume-timer" data-timer-id="${t.id}">${ICONS.play} Fortsetzen</button>
                 <button type="button" class="btn btn-outline-light" data-action="feierabend" data-timer-id="${t.id}">${ICONS.flag} Feierabend</button>`;
    }

    return `
    <div class="timer-card ${sizeClass}" data-timer-card data-timer-id="${t.id}">
      <div class="timer-top">
        <span class="status-dot ${statusClassMap[t.status]}"></span>
        <span class="status-label">${statusLabelMap[t.status]}${!big ? ` · ${esc(displayName)}` : ""}</span>
        ${resetBtn}
        ${removeBtn}
      </div>
      ${confirmRow}
      ${nameLine}
      <p class="timer-digits ${sizeClass}" data-timer-digits="${t.id}">${formatElapsed(ms)}</p>
      <div class="timer-actions">${actions}</div>
    </div>`;
  }

  /* ---------------------------------------------------------------- */
  /* View renderers                                                   */
  /* ---------------------------------------------------------------- */
  function renderHeader() {
    document.getElementById("header-date").textContent = fmtHeaderDate();
    const btn = document.getElementById("btn-avatar");
    const initials = ownerInitials();
    btn.innerHTML = initials ? esc(initials) : ICONS.user;
  }
  function renderProfilePanel() {
    const slot = document.getElementById("profile-panel-slot");
    if (!state.showProfilePanel) { slot.innerHTML = ""; return; }
    const accountBlock = supabaseEnabled && currentUser
      ? `<div class="account-row">
           <span class="small-label">KONTO</span>
           <span class="hint" style="margin:0;">${esc(currentUser.email || "")} · in der Cloud gesichert</span>
           <button type="button" class="btn btn-ghost" data-action="logout" style="margin-top:6px; align-self:flex-start;">Abmelden</button>
         </div>`
      : "";
    slot.innerHTML = `
    <div class="add-panel" id="profile-panel">
      <p class="small-label">PROFIL</p>
      <div class="field-row">
        <div class="field"><label>Vorname</label><input type="text" data-field="firstName" value="${esc(state.profile.firstName)}"></div>
        <div class="field"><label>Nachname</label><input type="text" data-field="lastName" value="${esc(state.profile.lastName)}"></div>
      </div>
      <div class="field-row" style="margin-bottom:0;">
        <div class="field"><label>Berufung</label><input type="text" data-field="role" value="${esc(state.profile.role)}" placeholder="z. B. Elektriker"></div>
      </div>
      <div class="field-row" style="margin-top:12px; margin-bottom:0;">
        <button type="button" class="btn btn-primary" data-action="save-profile">${ICONS.check} Fertig</button>
      </div>
      ${accountBlock}
      <p class="app-version">WorkTime ${APP_VERSION}</p>
    </div>`;
  }
  function renderNav() {
    document.querySelectorAll(".nav-btn").forEach((btn) => btn.classList.toggle("active", btn.dataset.view === state.view));
  }

  function renderTimerView() {
    const root = document.getElementById("view-root");
    let html = "";
    const owner = ownerTimer();
    if (owner) html += timerCardHTML(owner, true);
    const others = otherTimers();
    if (others.length) html += `<div style="margin-top:4px;">${others.map((t) => timerCardHTML(t, false)).join("")}</div>`;

    if (state.showAddPanel) {
      const tw = teamWorkers();
      const avail = availableForAdd();
      if (tw.length === 0) {
        html += `<div class="add-panel"><p class="empty-note" style="border-top:none; padding-top:0;">Noch keine weiteren Mitarbeiter benannt. <button type="button" class="link-btn" data-action="goto-projects-view">Jetzt einrichten</button></p></div>`;
      } else if (avail.length === 0) {
        html += `<div class="add-panel"><p class="hint" style="margin:0;">Alle Mitarbeiter sind bereits aktiv, oder das Limit von 4 ist erreicht.</p></div>`;
      } else {
        html += `
        <div class="add-panel">
          <div class="field-row">
            <div class="field"><label>Mitarbeiter</label>
              <select id="add-worker-select"><option value="">– wählen –</option>${avail.map((w) => `<option value="${esc(w)}">${esc(w)}</option>`).join("")}</select>
            </div>
          </div>
          <div class="field-row" style="margin-bottom:0;">
            <button type="button" class="btn btn-primary" data-action="confirm-add-worker">${ICONS.check} Hinzufügen</button>
            <button type="button" class="btn btn-ghost" data-action="cancel-add-panel">${ICONS.x} Abbrechen</button>
          </div>
        </div>`;
      }
    } else if (others.length < 3) {
      html += `<button type="button" class="btn btn-dark-wide" data-action="toggle-add-panel" style="margin-bottom:18px;">${ICONS.plus} Mitarbeiter hinzufügen</button>`;
    }

    html += `<hr class="divider"><p class="small-label" style="margin-bottom:10px;">HEUTE</p>`;
    const todays = state.entries.filter((e) => e.date === todayISO());
    if (todays.length === 0) {
      html += `<p class="empty-note">Heute noch keine abgeschlossenen Einträge.</p>`;
    } else {
      html += todays.map((e) => {
        const p = projectById(e.projectId);
        return `<div class="today-row"><span>${esc(e.worker)} · ${esc(p?.name || projectName(e.projectId))}</span><span class="num">${Number(e.hours || 0).toFixed(2)} h</span></div>`;
      }).join("");
    }
    root.innerHTML = html;
  }

  function renderEntriesView() {
    const root = document.getElementById("view-root");
    const sorted = [...state.entries].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
    let html = `<h2 class="section-title">Alle Einträge</h2><p class="hint">Verlauf aller erfassten Arbeitseinträge.</p>`;

    if (!state.showManualForm && !state.showEditForm) {
      html += `<button type="button" class="btn btn-dark-wide" data-action="show-manual-form" style="margin-bottom:18px;">${ICONS.plus} Eintrag manuell erfassen</button>`;
    }
    if (state.showManualForm) html += manualFormHTML();
    if (state.showEditForm) {
      const entry = state.entries.find((e) => e.id === state.editingEntryId);
      if (entry) html += editFormHTML(entry);
    }
    html += sorted.length === 0
      ? `<p class="empty-note">Noch keine Einträge erfasst.</p>`
      : sorted.map(entryCardHTML).join("");

    root.innerHTML = html;
    updateAddExtraButtonVisibility();
  }

  function renderProjectsView() {
    const root = document.getElementById("view-root");
    let html = `
      <h2 class="section-title">Projekte</h2>
      <p class="hint">Projekte anlegen, umbenennen oder entfernen.</p>
      <div class="field-row">
        <div class="field" style="flex:0 0 76px;"><input type="text" id="new-project-code" placeholder="Kürzel"></div>
        <div class="field"><input type="text" id="new-project-name" placeholder="Neues Projekt…"></div>
      </div>
      <div class="field-row">
        <div class="field" style="flex:1 1 100%;"><textarea id="new-project-description" placeholder="Projektbeschreibung (optional)"></textarea></div>
      </div>
      <button type="button" class="btn btn-primary" data-action="add-project" style="margin-bottom:16px;">${ICONS.plus} Projekt hinzufügen</button>
    `;
    state.projects.forEach((p) => {
      html += `
      <div class="project-list-row" data-project-row data-project-id="${p.id}">
        <div class="project-list-top">
          <span class="color-dot" style="background:${p.color}"></span>
          <input type="text" class="code-input" data-project-field="code" value="${esc(p.code || "")}" placeholder="Kürzel">
          <input type="text" class="name-input" data-project-field="name" value="${esc(p.name)}">
          <button type="button" class="btn-icon danger" data-action="remove-project" data-project-id="${p.id}" title="Projekt entfernen">${ICONS.trash}</button>
        </div>
        <textarea data-project-field="description" placeholder="Projektbeschreibung (optional)">${esc(p.description || "")}</textarea>
      </div>`;
    });

    html += `<hr class="divider"><h2 class="section-title">Mitarbeiter</h2>
      <p class="hint">Weitere Mitarbeiter, die du zusätzlich zu dir in der Zeiterfassung hinzufügen kannst. Bis zu 3. Dein eigenes Profil bearbeitest du über das Symbol oben auf der Timer-Seite.</p>`;
    state.workers.forEach((w) => {
      html += `
      <div class="worker-row">
        <input type="text" data-worker-id="${w.id}" value="${esc(w.name)}" placeholder="Name">
        <button type="button" class="btn-icon danger" data-action="remove-worker" data-worker-id="${w.id}" title="Mitarbeiter entfernen">${ICONS.trash}</button>
      </div>`;
    });
    if (state.workers.length < 3) {
      html += state.showAddWorkerSettings
        ? `<div class="field-row" style="margin-top:10px; align-items:flex-end;">
             <div class="field"><input type="text" id="new-worker-name" placeholder="Name"></div>
             <button type="button" class="btn btn-primary" data-action="confirm-add-worker-settings">${ICONS.check} Speichern</button>
             <button type="button" class="btn btn-ghost" data-action="cancel-add-worker-settings">${ICONS.x}</button>
           </div>`
        : `<button type="button" class="btn btn-ghost" data-action="toggle-add-worker-settings" style="margin-top:10px;">${ICONS.plus} Mitarbeiter hinzufügen</button>`;
    }
    root.innerHTML = html;
  }

  function renderOverviewView() {
    const root = document.getElementById("view-root");
    const selected = state.overviewProjectId && projectById(state.overviewProjectId) ? state.overviewProjectId : "";
    if (state.overviewProjectId && !selected) state.overviewProjectId = ""; // selected project was deleted

    const projectOptions = state.projects.map((p) => `<option value="${p.id}" ${p.id === selected ? "selected" : ""}>${esc(p.name)}</option>`).join("");

    let html = `
      <h2 class="section-title">Projekt-Übersicht</h2>
      <p class="hint">Projekt wählen, um Stunden und Material für genau dieses Projekt zu sehen und zu exportieren.</p>
      <div class="field-row">
        <div class="field">
          <label>Projekt</label>
          <select id="overview-project-select">
            <option value="">– Projekt wählen –</option>
            ${projectOptions}
          </select>
        </div>
      </div>
      <div class="export-bar">
        <button type="button" class="btn btn-primary" data-action="export-excel" ${!selected ? "disabled" : ""}>${ICONS.download} Excel</button>
        <button type="button" class="btn btn-secondary" data-action="export-pdf" ${!selected ? "disabled" : ""}>${ICONS.printer} PDF</button>
      </div>
    `;

    if (!selected) {
      html += state.projects.length === 0
        ? `<p class="empty-note">Noch keine Projekte angelegt.</p>`
        : `<p class="empty-note">Bitte oben ein Projekt auswählen.</p>`;
      root.innerHTML = html;
      return;
    }

    const p = projectById(selected);
    const { dates, rows } = buildProjectMaterialMatrix(p, state.entries);
    const daily = buildProjectDailyBreakdown(p, state.entries);
    const totalHours = daily.grandTotal;

    const dailyHtml = daily.sections.length === 0
      ? `<p class="empty-note" style="padding:6px 0; margin-top:0;">Noch keine Stunden erfasst.</p>`
      : daily.sections.map((sec) => `
          <p class="daily-person-name">${esc(sec.person)}</p>
          ${sec.days.map((d) => `<div class="today-row"><span>${fmtDate(d.date)}</span><span class="num">${d.hours} h</span></div>`).join("")}
          <div class="today-row daily-person-total"><span>Gesamt ${esc(sec.person)}</span><span class="num">${sec.total} h</span></div>
        `).join("") + `<div class="today-row daily-grand-total"><span>Gesamt</span><span class="num">${daily.grandTotal} h</span></div>`;

    html += `
      <div id="print-area">
        <div class="overview-project">
          <div class="overview-head">
            <div class="overview-title"><span class="color-dot" style="background:${p.color}"></span>${esc(p.name)}</div>
            <span class="overview-hours">Gesamt: <span class="num">${totalHours.toFixed(2)} h</span></span>
          </div>
          ${p.description ? `<p class="overview-desc">${esc(p.description)}</p>` : ""}
          <p class="small-label">ARBEITSZEIT PRO TAG</p>
          ${dailyHtml}
          <p class="small-label" style="margin-top:14px;">MATERIAL</p>
          ${rows.length === 0
            ? `<p class="empty-note" style="padding:6px 0; margin-top:0;">Kein Material erfasst.</p>`
            : `<div style="overflow-x:auto;"><table><thead><tr><th>Material</th><th>Einh.</th>${dates.map((d) => `<th class="num">${fmtDate(d)}</th>`).join("")}<th>Gesamt</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${esc(r.name)}</td><td>${esc(r.unit)}</td>${r.byDate.map((v) => `<td class="num">${v ? v : "–"}</td>`).join("")}<td class="num" style="font-weight:600;">${r.total}</td></tr>`).join("")}</tbody></table></div>`}
        </div>
      </div>`;
    root.innerHTML = html;
  }

  function renderView() {
    switch (state.view) {
      case "timer": renderTimerView(); break;
      case "entries": renderEntriesView(); break;
      case "projects": renderProjectsView(); break;
      case "overview": renderOverviewView(); break;
    }
  }
  function render() {
    const createdOwner = ensureOwnerTimer();
    if (createdOwner) cloudInsertTimer(createdOwner);
    renderHeader();
    renderProfilePanel();
    renderView();
    renderNav();
    ensureTicking();
    persist();
  }

  /* ---------------------------------------------------------------- */
  /* Manual entry: create / edit                                      */
  /* ---------------------------------------------------------------- */
  function saveNewEntries() {
    const form = document.getElementById("manual-form");
    const date = form.querySelector('[data-field="date"]').value;
    const projectId = form.querySelector('[data-field="projectId"]').value;
    const errorEl = form.querySelector("[data-form-error]");
    if (!date || !projectId) { errorEl.textContent = "Bitte Datum und Projekt angeben."; return; }

    const materials = readMaterialRows(form.querySelector("[data-materials-block]"));
    const ownerBlock = form.querySelector("[data-owner-time]");
    const owner = readTimeFieldsRaw(ownerBlock);
    const ownerActivities = readActivityRows(ownerBlock);
    const ownerHours = Number(owner.hours) || 0;
    if (activityHoursSum(ownerActivities) > ownerHours + 0.001) {
      errorEl.textContent = `Die Tätigkeitsstunden übersteigen deine Gesamtarbeitszeit (${ownerHours} h).`;
      return;
    }

    const pendingExtras = [];
    for (const block of form.querySelectorAll("[data-extra-id]")) {
      const worker = block.querySelector('[data-role="extra-worker-select"]').value;
      if (!worker) continue;
      const tf = readTimeFieldsRaw(block);
      if (!tf.start && !tf.end && !tf.hours) continue;
      const workerActivities = readActivityRows(block);
      const workerHours = Number(tf.hours) || 0;
      if (activityHoursSum(workerActivities) > workerHours + 0.001) {
        errorEl.textContent = `Die Tätigkeitsstunden übersteigen die Gesamtarbeitszeit von ${worker} (${workerHours} h).`;
        return;
      }
      pendingExtras.push({ worker, tf, workerActivities });
    }

    const newEntries = [];
    let materialsAssigned = false; // material is only ever attributed once (to the owner if possible)
    if (owner.start || owner.end || owner.hours) {
      newEntries.push({
        id: uid(), date, projectId, worker: ownerDisplayName(),
        start: owner.start, end: owner.end, pause: Number(owner.pause) || 0, hours: ownerHours,
        activities: ownerActivities, materials: cloneMaterials(materials),
      });
      materialsAssigned = true;
    }
    pendingExtras.forEach(({ worker, tf, workerActivities }) => {
      const giveMaterial = !materialsAssigned; // fallback: if there's no owner entry, the first worker entry gets it
      newEntries.push({
        id: uid(), date, projectId, worker,
        start: tf.start, end: tf.end, pause: Number(tf.pause) || 0, hours: Number(tf.hours) || 0,
        activities: workerActivities, materials: giveMaterial ? cloneMaterials(materials) : [],
      });
      if (giveMaterial) materialsAssigned = true;
    });

    if (newEntries.length === 0) { errorEl.textContent = "Bitte mindestens eine Arbeitszeit eintragen."; return; }
    state.entries.push(...newEntries);
    state.showManualForm = false;
    render();
    newEntries.forEach(cloudInsertEntry);
  }
  function saveEditedEntry() {
    const form = document.getElementById("edit-form");
    const date = form.querySelector('[data-field="date"]').value;
    const projectId = form.querySelector('[data-field="projectId"]').value;
    const worker = form.querySelector('[data-field="worker"]').value;
    const errorEl = form.querySelector("[data-form-error]");
    if (!date || !projectId || !worker) { errorEl.textContent = "Bitte Datum, Projekt und Mitarbeiter angeben."; return; }

    const personBlock = form.querySelector("[data-person-block]");
    const tf = readTimeFieldsRaw(personBlock);
    const activities = readActivityRows(personBlock);
    const entryHours = Number(tf.hours) || 0;
    if (activityHoursSum(activities) > entryHours + 0.001) {
      errorEl.textContent = `Die Tätigkeitsstunden übersteigen die Gesamtarbeitszeit (${entryHours} h).`;
      return;
    }
    const materials = readMaterialRows(form.querySelector("[data-materials-block]"));
    const entry = state.entries.find((e) => e.id === state.editingEntryId);
    if (!entry) return;
    entry.date = date; entry.projectId = projectId; entry.worker = worker;
    entry.start = tf.start; entry.end = tf.end; entry.pause = Number(tf.pause) || 0; entry.hours = entryHours;
    entry.activities = activities; entry.materials = materials;
    delete entry.activity; // migrate away from the old single-string field

    state.showEditForm = false;
    state.editingEntryId = null;
    render();
    cloudUpdateEntry(entry);
  }

  /* ---------------------------------------------------------------- */
  /* Excel export                                                     */
  /* ---------------------------------------------------------------- */
  function exportExcel() {
    const p = projectById(state.overviewProjectId);
    if (!p) return;

    const wb = XLSX.utils.book_new();
    const projectEntries = [...state.entries].filter((e) => e.projectId === p.id).sort((a, b) => a.date.localeCompare(b.date));

    const rows = projectEntries.map((e) => ({
      Datum: fmtDate(e.date),
      Mitarbeiter: e.worker,
      Start: e.start || "",
      Ende: e.end || "",
      "Pause (Std.)": Number(e.pause || 0),
      "Std.": Number(e.hours || 0),
      "Tätigkeit": (e.activities || []).map((a) => `${a.desc}${a.hours !== "" && a.hours != null ? ` (${a.hours} h)` : ""}`).join("; "),
      Materialien: (e.materials || []).map((m) => `${m.name}${m.qty ? ` (${m.qty}${m.unit ? " " + m.unit : ""})` : ""}`).join(", "),
    }));
    const ws1 = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws1, "Zeiterfassung");

    const workerTotals = {};
    projectEntries.forEach((e) => { workerTotals[e.worker] = (workerTotals[e.worker] || 0) + Number(e.hours || 0); });
    const totalHours = Object.values(workerTotals).reduce((s, h) => s + h, 0);
    const aoa = [
      ["Projekt", p.name],
      ["Kürzel", p.code || ""],
      ["Beschreibung", p.description || ""],
      ["Gesamtstunden", Math.round(totalHours * 100) / 100],
      [],
      ["Mitarbeiter", "Stunden"],
      ...Object.entries(workerTotals).map(([w, h]) => [w, Math.round(h * 100) / 100]),
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(aoa);
    XLSX.utils.book_append_sheet(wb, ws2, "Übersicht");

    const { dates, rows: matRows } = buildProjectMaterialMatrix(p, state.entries);
    if (matRows.length > 0) {
      const header = ["Material", "Einheit", ...dates.map(fmtDate), "Gesamt"];
      const body = matRows.map((r) => [r.name, r.unit, ...r.byDate.map((v) => (v ? v : "")), r.total]);
      const wsMat = XLSX.utils.aoa_to_sheet([header, ...body]);
      XLSX.utils.book_append_sheet(wb, wsMat, "Material");
    }

    const safeName = (p.name || "Projekt").replace(/[:\\/?*[\]]/g, "").slice(0, 40);

    XLSX.writeFile(wb, `WorkTime_${safeName}_${todayISO()}.xlsx`);
  }

  /* ---------------------------------------------------------------- */
  /* Ticking (updates only the digit text nodes — never re-renders)   */
  /* ---------------------------------------------------------------- */
  let tickInterval = null;
  function ensureTicking() {
    const anyRunning = state.timers.some((t) => t.status === "running");
    if (anyRunning && !tickInterval) {
      tickInterval = setInterval(updateTimerDigits, 1000);
    } else if (!anyRunning && tickInterval) {
      clearInterval(tickInterval);
      tickInterval = null;
    }
  }
  function updateTimerDigits() {
    document.querySelectorAll("[data-timer-digits]").forEach((el) => {
      const t = state.timers.find((x) => x.id === el.getAttribute("data-timer-digits"));
      if (t) el.textContent = formatElapsed(elapsedMs(t));
    });
  }

  /* ---------------------------------------------------------------- */
  /* Event delegation                                                 */
  /* ---------------------------------------------------------------- */
  document.addEventListener("click", (e) => {
    const navBtn = e.target.closest(".nav-btn");
    if (navBtn) {
      state.view = navBtn.dataset.view;
      state.showManualForm = false;
      state.showEditForm = false;
      state.editingEntryId = null;
      state.showAddPanel = false;
      state.deleteConfirmId = null;
      state.removeTimerConfirmId = null;
      state.resetTimerConfirmId = null;
      render();
      return;
    }

    const actionEl = e.target.closest("[data-action]");
    if (!actionEl) return;
    const action = actionEl.dataset.action;

    switch (action) {
      case "goto-projects-view":
        state.view = "projects";
        state.showAddPanel = false;
        render();
        break;

      case "toggle-profile-panel":
        state.showProfilePanel = !state.showProfilePanel;
        render();
        break;
      case "save-profile": {
        const panel = document.getElementById("profile-panel");
        state.profile.firstName = panel.querySelector('[data-field="firstName"]').value;
        state.profile.lastName = panel.querySelector('[data-field="lastName"]').value;
        state.profile.role = panel.querySelector('[data-field="role"]').value;
        state.showProfilePanel = false;
        render();
        cloudUpsertProfile();
        break;
      }

      case "add-material-row": {
        const rowsContainer = actionEl.closest("[data-materials-block]").querySelector("[data-material-rows]");
        rowsContainer.insertAdjacentHTML("beforeend", materialRowHTML({}));
        break;
      }
      case "remove-material-row":
        actionEl.closest("[data-material-id]").remove();
        break;

      case "add-activity-row": {
        const rowsContainer = actionEl.closest("[data-activities-block]").querySelector("[data-activity-rows]");
        rowsContainer.insertAdjacentHTML("beforeend", activityRowHTML({}));
        break;
      }
      case "remove-activity-row":
        actionEl.closest("[data-activity-id]").remove();
        break;
      case "adjust-activity-hours": {
        const row = actionEl.closest("[data-activity-id]");
        const block = actionEl.closest("[data-activities-block]");
        const hoursInput = row.querySelector('[data-field="ahours"]');
        const total = findPersonTotalHours(block);
        const maxAllowed = remainingActivityAllowance(block, row);
        const delta = (total * Number(actionEl.dataset.delta)) / 100;
        const next = Math.min(maxAllowed, Math.max(0, Math.round(((Number(hoursInput.value) || 0) + delta) * 100) / 100));
        hoursInput.value = next;
        break;
      }

      case "toggle-add-panel":
        state.showAddPanel = true;
        render();
        break;
      case "cancel-add-panel":
        state.showAddPanel = false;
        render();
        break;
      case "confirm-add-worker": {
        const sel = document.getElementById("add-worker-select");
        const name = sel ? sel.value : "";
        if (!name || otherTimers().length >= 3) return;
        const t = freshTimer(name, false);
        state.timers.push(t);
        state.showAddPanel = false;
        render();
        cloudInsertTimer(t);
        break;
      }

      case "start-timer": startTimer(actionEl.dataset.timerId); render(); break;
      case "pause-timer": pauseTimer(actionEl.dataset.timerId); render(); break;
      case "resume-timer": resumeTimer(actionEl.dataset.timerId); render(); break;
      case "feierabend": clickFeierabend(actionEl.dataset.timerId); render(); break;
      case "cancel-finish": cancelFinish(actionEl.dataset.timerId); render(); break;
      case "confirm-finish": {
        const id = actionEl.dataset.timerId;
        const t = state.timers.find((x) => x.id === id);
        const card = actionEl.closest("[data-timer-card]");
        const projSel = card.querySelector('[data-field="finish-project"]');
        const projectId = projSel ? projSel.value : "";
        const showFinishError = (msg) => {
          let err = card.querySelector(".error-msg");
          if (!err) {
            err = document.createElement("p");
            err.className = "error-msg";
            actionEl.closest(".field-row").insertAdjacentElement("beforebegin", err);
          }
          err.textContent = msg;
        };
        if (!projectId) { showFinishError("Bitte ein Projekt wählen."); return; }
        const activities = readActivityRows(card);
        const totalHours = Math.round((t.accumulatedMs / 3600000) * 100) / 100;
        if (activityHoursSum(activities) > totalHours + 0.001) {
          showFinishError(`Die Tätigkeitsstunden übersteigen die erfasste Arbeitszeit (${totalHours} h).`);
          return;
        }
        const materials = readMaterialRows(card);
        confirmFinishData(t, projectId, activities, materials);
        render();
        break;
      }
      case "request-remove-timer":
        state.removeTimerConfirmId = actionEl.dataset.timerId;
        render();
        break;
      case "confirm-remove-timer": {
        const tid = actionEl.dataset.timerId;
        state.timers = state.timers.filter((x) => x.id !== tid);
        state.removeTimerConfirmId = null;
        render();
        cloudDeleteTimer(tid);
        break;
      }
      case "cancel-remove-timer":
        state.removeTimerConfirmId = null;
        render();
        break;

      case "request-reset-timer":
        state.resetTimerConfirmId = actionEl.dataset.timerId;
        render();
        break;
      case "confirm-reset-timer": {
        const tid = actionEl.dataset.timerId;
        resetTimer(tid);
        state.resetTimerConfirmId = null;
        render();
        break;
      }
      case "cancel-reset-timer":
        state.resetTimerConfirmId = null;
        render();
        break;

      case "show-manual-form":
        state.showManualForm = true;
        state.showEditForm = false;
        render();
        break;
      case "cancel-manual-form":
        state.showManualForm = false;
        render();
        break;
      case "add-extra-worker": {
        const container = document.getElementById("extra-workers-container");
        if (container.children.length >= 3) return;
        container.insertAdjacentHTML("beforeend", extraWorkerBlockHTML());
        refreshExtraWorkerOptions(document.getElementById("manual-form"));
        updateAddExtraButtonVisibility();
        break;
      }
      case "remove-extra-worker":
        actionEl.closest("[data-extra-id]").remove();
        refreshExtraWorkerOptions(document.getElementById("manual-form"));
        updateAddExtraButtonVisibility();
        break;
      case "save-manual-form": saveNewEntries(); break;

      case "edit-entry":
        state.editingEntryId = actionEl.dataset.entryId;
        state.showEditForm = true;
        state.showManualForm = false;
        render();
        break;
      case "cancel-edit-form":
        state.showEditForm = false;
        state.editingEntryId = null;
        render();
        break;
      case "save-edit-form": saveEditedEntry(); break;

      case "request-delete-entry":
        state.deleteConfirmId = actionEl.dataset.entryId;
        render();
        break;
      case "confirm-delete-entry": {
        const eid = actionEl.dataset.entryId;
        state.entries = state.entries.filter((e) => e.id !== eid);
        state.deleteConfirmId = null;
        render();
        cloudDeleteEntry(eid);
        break;
      }
      case "cancel-delete-entry":
        state.deleteConfirmId = null;
        render();
        break;

      case "add-project": {
        const code = document.getElementById("new-project-code").value.trim();
        const name = document.getElementById("new-project-name").value.trim();
        const desc = document.getElementById("new-project-description").value.trim();
        if (!name) return;
        const p = { id: uid(), name, code, description: desc, color: PALETTE[state.projects.length % PALETTE.length] };
        state.projects.push(p);
        render();
        cloudInsertProject(p);
        break;
      }
      case "remove-project": {
        const pid = actionEl.dataset.projectId;
        state.projects = state.projects.filter((p) => p.id !== pid);
        render();
        cloudDeleteProject(pid);
        break;
      }

      case "toggle-add-worker-settings":
        state.showAddWorkerSettings = true;
        render();
        break;
      case "cancel-add-worker-settings":
        state.showAddWorkerSettings = false;
        render();
        break;
      case "confirm-add-worker-settings": {
        const input = document.getElementById("new-worker-name");
        const name = input.value.trim();
        if (!name || state.workers.length >= 3) return;
        const w = { id: uid(), name };
        state.workers.push(w);
        state.showAddWorkerSettings = false;
        render();
        cloudInsertWorker(w);
        break;
      }
      case "remove-worker": {
        const wid = actionEl.dataset.workerId;
        state.workers = state.workers.filter((w) => w.id !== wid);
        render();
        cloudDeleteWorker(wid);
        break;
      }

      case "export-excel": exportExcel(); break;
      case "export-pdf": window.print(); break;

      case "logout":
        if (sb) sb.auth.signOut().then(() => location.reload());
        break;
    }
  });

  document.addEventListener("input", (e) => {
    if (e.target.matches('[data-field="start"], [data-field="end"], [data-field="pause"]')) {
      const block = e.target.closest("[data-time-fields]");
      if (block) recalcTimeFields(block);
    }
  });

  document.addEventListener("change", (e) => {
    const t = e.target;
    if (t.matches("[data-project-field]")) {
      const id = t.closest("[data-project-row]").dataset.projectId;
      const proj = state.projects.find((p) => p.id === id);
      if (proj) { proj[t.dataset.projectField] = t.value; persist(); cloudUpdateProject(proj); }
      return;
    }
    if (t.matches("[data-worker-id]")) {
      const w = state.workers.find((x) => x.id === t.dataset.workerId);
      if (w) { w.name = t.value; persist(); cloudUpdateWorker(w); }
      return;
    }
    if (t.matches('[data-role="extra-worker-select"]')) {
      refreshExtraWorkerOptions(t.closest("#manual-form"));
      return;
    }
    if (t.matches('[data-field="ahours"]')) {
      const row = t.closest("[data-activity-id]");
      const block = t.closest("[data-activities-block]");
      const maxAllowed = remainingActivityAllowance(block, row);
      if ((Number(t.value) || 0) > maxAllowed) t.value = maxAllowed;
      return;
    }
    if (t.id === "overview-project-select") {
      state.overviewProjectId = t.value;
      renderOverviewView();
      return;
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.id === "new-worker-name") {
      e.preventDefault();
      document.querySelector('[data-action="confirm-add-worker-settings"]')?.click();
    }
  });

  document.getElementById("btn-avatar")?.addEventListener("click", () => {
    state.showProfilePanel = !state.showProfilePanel;
    render();
  });

  /* ---------------------------------------------------------------- */
  /* Auth form (only relevant when Supabase is configured)            */
  /* ---------------------------------------------------------------- */
  let authMode = "signin";
  const authForm = document.getElementById("form-auth");
  if (authForm) {
    const emailEl = document.getElementById("auth-email");
    const passwordEl = document.getElementById("auth-password");
    const errorEl = document.getElementById("auth-error");
    const infoEl = document.getElementById("auth-info");
    const submitBtn = document.getElementById("btn-auth-submit");
    const toggleBtn = document.getElementById("btn-auth-toggle");

    authForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!sb) return;
      errorEl.style.display = "none";
      infoEl.style.display = "none";
      submitBtn.disabled = true;
      const email = emailEl.value.trim();
      const password = passwordEl.value;
      try {
        if (authMode === "signin") {
          const { error } = await sb.auth.signInWithPassword({ email, password });
          if (error) throw error;
          // onAuthStateChange below picks up the session and shows the app.
        } else {
          const { error } = await sb.auth.signUp({ email, password });
          if (error) throw error;
          infoEl.textContent = "Konto erstellt. Falls eine Bestätigungs-Mail nötig ist, prüfe dein Postfach und melde dich danach an.";
          infoEl.style.display = "block";
        }
      } catch (err) {
        errorEl.textContent = (err && err.message) || "Das hat nicht geklappt. Bitte prüfe deine Angaben.";
        errorEl.style.display = "block";
      } finally {
        submitBtn.disabled = false;
      }
    });

    toggleBtn.addEventListener("click", () => {
      authMode = authMode === "signin" ? "signup" : "signin";
      submitBtn.textContent = authMode === "signin" ? "Anmelden" : "Registrieren";
      toggleBtn.textContent = authMode === "signin" ? "Noch kein Konto? Registrieren" : "Bereits registriert? Anmelden";
      errorEl.style.display = "none";
      infoEl.style.display = "none";
    });
  }

  /* ---------------------------------------------------------------- */
  /* Init                                                              */
  /* ---------------------------------------------------------------- */
  async function init() {
    load(); // local cache first, so the app never starts truly empty
    ensureOwnerTimer();

    if (supabaseEnabled) {
      // onAuthStateChange fires immediately with the current session on subscribe,
      // and again on every sign-in/sign-out — this alone drives the whole
      // auth UI, so a fresh login also switches to the app without a manual reload.
      sb.auth.onAuthStateChange(async (_event, session) => {
        const user = session ? session.user : null;
        const isNewLogin = user && (!currentUser || currentUser.id !== user.id);
        currentUser = user;

        if (user) {
          try {
            if (isNewLogin) {
              await loadFromCloud();
              const createdOwner = ensureOwnerTimer();
              if (createdOwner) await cloudInsertTimer(createdOwner);
              subscribeRealtime();
            }
            showApp();
          } catch (e) {
            console.warn("Supabase nicht erreichbar, starte im lokalen Modus:", e);
            showApp();
          }
        } else {
          showAuthGate();
        }
      });
    } else {
      showApp();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("service-worker.js").catch(() => {});
    });
  }
})();
