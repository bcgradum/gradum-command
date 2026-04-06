import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import Sidebar from "@/components/command/Sidebar";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

// Matches exact location names stored in the bookings database
const FACILITIES = [
  "Austin", "Broward", "Carrollton", "Cary", "Charleston", "Charlotte",
  "Fort Myers", "Fort Worth", "Frisco", "Houston", "Jacksonville", "Jupiter",
  "Nocatee", "Port Saint Lucie", "South Charlotte", "South Miami",
  "Spring", "Tampa", "Wake Forest", "Wesley Chapel", "Winter Garden",
];

// ─── TYPES ────────────────────────────────────────────────────────────────────

interface Booking {
  id: number;
  location: string;
  dateBooked: string;
  evalDate: string;
  evalTime: string;
  leadName: string;
  igHandle?: string;
  phone?: string;
  assignedRep?: string;
  showStatus?: string | null;
  closeStatus?: string | null;
  revenue?: number | null;
  rescheduleDate?: string | null;
  rescheduleTime?: string | null;
  notes?: string;
  createdAt: string;
}

interface Followup {
  id: number;
  location: string;
  date: string;
  igUsername: string;
  assignedRep?: string;
  notes?: string;
  status: string;
  createdAt: string;
}

interface SalesStats {
  total_booked: number;
  shows: number;
  closes: number;
  no_sales: number;
  reschedules: number;
  cancels: number;
  revenue: number;
  by_location: {
    location: string;
    booked: number;
    shows: number;
    closes: number;
    no_sales: number;
    reschedules: number;
    cancels: number;
    revenue: number;
  }[];
}

// ─── STYLE HELPERS ────────────────────────────────────────────────────────────

const S = {
  bg: "hsl(222, 20%, 7%)",
  card: "hsl(222, 18%, 10%)",
  border: "hsl(222, 15%, 18%)",
  borderDim: "hsl(222, 15%, 14%)",
  textPrimary: "hsl(210, 15%, 88%)",
  textMuted: "hsl(210, 10%, 45%)",
  textDim: "hsl(210, 10%, 35%)",
  cyan: "#33d4e0",
  cyanDim: "rgba(51, 212, 224, 0.08)",
  green: "#2cba6e",
  red: "#f45c6b",
  amber: "#f59e0b",
  orange: "#f97316",
  mono: "var(--font-mono, 'JetBrains Mono', 'Fira Mono', monospace)",
};

function inputStyle(extra: React.CSSProperties = {}): React.CSSProperties {
  return {
    background: S.borderDim,
    border: `1px solid ${S.border}`,
    color: S.textPrimary,
    borderRadius: 8,
    padding: "6px 10px",
    fontSize: 13,
    outline: "none",
    width: "100%",
    ...extra,
  };
}

function labelStyle(): React.CSSProperties {
  return {
    display: "block",
    color: S.textMuted,
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    marginBottom: 4,
  };
}

function ShowBadge({ status, evalDate, computedStatus }: { status?: string | null; evalDate?: string | null; computedStatus?: string | null }) {
  // Determine display status
  const today = new Date().toISOString().split('T')[0];
  let displayStatus = status;
  if (!status) {
    // Check computed status from notes field or derive from date
    if (computedStatus === 'tba') {
      displayStatus = 'tba';
    } else if (computedStatus === 'pending') {
      displayStatus = 'pending';
    } else if (evalDate) {
      const evalDateStr = evalDate.replace(/(\/)/g, '-');
      displayStatus = evalDate > today ? 'tba' : 'pending';
    } else {
      displayStatus = 'pending';
    }
  }
  if (!displayStatus) return <span style={{ color: S.textDim, fontFamily: S.mono, fontSize: 12 }}>—</span>;
  const map: Record<string, { label: string; color: string; bg: string }> = {
    show: { label: "Show", color: S.green, bg: "rgba(44,186,110,0.12)" },
    no_show: { label: "No Show", color: S.red, bg: "rgba(244,92,107,0.12)" },
    reschedule: { label: "Reschedule", color: S.amber, bg: "rgba(245,158,11,0.12)" },
    cancel: { label: "Cancel", color: "hsl(210,10%,50%)", bg: "rgba(100,100,120,0.15)" },
    tba: { label: "TBA", color: "#33d4e0", bg: "rgba(51,212,224,0.10)" },
    pending: { label: "Pending", color: "#f5a623", bg: "rgba(245,166,35,0.10)" },
  };
  const cfg = map[displayStatus] || { label: displayStatus, color: S.textMuted, bg: S.cyanDim };
  return (
    <span style={{
      display: "inline-block", padding: "2px 7px", borderRadius: 4,
      fontSize: 11, fontWeight: 600, fontFamily: S.mono,
      color: cfg.color, background: cfg.bg,
    }}>
      {cfg.label}
    </span>
  );
}

function CloseBadge({ status }: { status?: string | null }) {
  if (!status) return <span style={{ color: S.textDim, fontFamily: S.mono, fontSize: 12 }}>—</span>;
  const map: Record<string, { label: string; color: string; bg: string }> = {
    close: { label: "Close", color: S.cyan, bg: "rgba(51,212,224,0.10)" },
    no_sale: { label: "No Sale", color: S.orange, bg: "rgba(249,115,22,0.12)" },
  };
  const cfg = map[status] || { label: status, color: S.textMuted, bg: S.cyanDim };
  return (
    <span style={{
      display: "inline-block", padding: "2px 7px", borderRadius: 4,
      fontSize: 11, fontWeight: 600, fontFamily: S.mono,
      color: cfg.color, background: cfg.bg,
    }}>
      {cfg.label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { color: string; bg: string }> = {
    active: { color: S.cyan, bg: "rgba(51,212,224,0.10)" },
    booked: { color: S.green, bg: "rgba(44,186,110,0.12)" },
    cold: { color: "hsl(210,10%,50%)", bg: "rgba(100,100,120,0.15)" },
  };
  const cfg = map[status] || { color: S.textMuted, bg: S.cyanDim };
  return (
    <span style={{
      display: "inline-block", padding: "2px 7px", borderRadius: 4,
      fontSize: 11, fontWeight: 600, fontFamily: S.mono,
      color: cfg.color, background: cfg.bg, textTransform: "capitalize",
    }}>
      {status}
    </span>
  );
}

// ─── MODAL ────────────────────────────────────────────────────────────────────

function Modal({ onClose, children, title }: { onClose: () => void; children: React.ReactNode; title: string }) {
  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(10, 12, 18, 0.75)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: S.card, border: `1px solid ${S.border}`,
        borderRadius: 12, width: "100%", maxWidth: 540,
        maxHeight: "90vh", overflowY: "auto",
        boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
      }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px", borderBottom: `1px solid ${S.border}`,
        }}>
          <span style={{ color: S.textPrimary, fontWeight: 700, fontSize: 14 }}>{title}</span>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: S.textMuted, cursor: "pointer", fontSize: 18, lineHeight: 1 }}
          >
            ×
          </button>
        </div>
        <div style={{ padding: 20 }}>{children}</div>
      </div>
    </div>
  );
}

// ─── NEW BOOKING FORM ─────────────────────────────────────────────────────────

function NewBookingModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({
    location: FACILITIES[0],
    leadName: "",
    igHandle: "",
    phone: "",
    assignedRep: "",
    evalDate: "",
    evalTime: "",
    notes: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.leadName || !form.evalDate || !form.evalTime) {
      setError("Lead Name, Eval Date, and Eval Time are required.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await apiRequest("POST", "/api/bookings", {
        location: form.location,
        leadName: form.leadName,
        igHandle: form.igHandle || null,
        phone: form.phone || null,
        assignedRep: form.assignedRep || null,
        evalDate: form.evalDate,
        evalTime: form.evalTime,
        notes: form.notes || null,
        dateBooked: new Date().toISOString().split("T")[0],
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to create booking.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal onClose={onClose} title="New Booking">
      <form onSubmit={handleSubmit}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={labelStyle()}>Location</label>
            <select value={form.location} onChange={e => set("location", e.target.value)} style={inputStyle()}>
              {FACILITIES.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={labelStyle()}>Lead Name *</label>
            <input type="text" value={form.leadName} onChange={e => set("leadName", e.target.value)} style={inputStyle()} placeholder="Full name" required />
          </div>
          <div>
            <label style={labelStyle()}>IG Handle</label>
            <input type="text" value={form.igHandle} onChange={e => set("igHandle", e.target.value)} style={inputStyle()} placeholder="@username" />
          </div>
          <div>
            <label style={labelStyle()}>Phone</label>
            <input type="tel" value={form.phone} onChange={e => set("phone", e.target.value)} style={inputStyle()} placeholder="(555) 000-0000" />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={labelStyle()}>Assigned Rep</label>
            <input type="text" value={form.assignedRep} onChange={e => set("assignedRep", e.target.value)} style={inputStyle()} placeholder="Rep name" />
          </div>
          <div>
            <label style={labelStyle()}>Eval Date *</label>
            <input type="date" value={form.evalDate} onChange={e => set("evalDate", e.target.value)} style={inputStyle()} required />
          </div>
          <div>
            <label style={labelStyle()}>Eval Time *</label>
            <input type="time" value={form.evalTime} onChange={e => set("evalTime", e.target.value)} style={inputStyle()} required />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={labelStyle()}>Notes</label>
            <textarea value={form.notes} onChange={e => set("notes", e.target.value)} style={{ ...inputStyle(), resize: "vertical", minHeight: 72 }} placeholder="Optional notes..." />
          </div>
        </div>
        {error && <div style={{ color: S.red, fontSize: 12, marginTop: 10 }}>{error}</div>}
        <div style={{ display: "flex", gap: 10, marginTop: 18, justifyContent: "flex-end" }}>
          <button type="button" onClick={onClose} style={{
            background: "none", border: `1px solid ${S.border}`, color: S.textMuted,
            borderRadius: 8, padding: "7px 16px", cursor: "pointer", fontSize: 13,
          }}>
            Cancel
          </button>
          <button type="submit" disabled={loading} style={{
            background: loading ? S.borderDim : S.cyan, color: "#0d1117",
            border: "none", borderRadius: 8, padding: "7px 18px",
            fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", fontSize: 13,
          }}>
            {loading ? "Saving..." : "Create Booking"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── OUTCOME PANEL (admin only) ───────────────────────────────────────────────

function OutcomeModal({
  booking, onClose, onSuccess,
}: {
  booking: Booking;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [showStatus, setShowStatus] = useState<string>(booking.showStatus || "");
  const [closeStatus, setCloseStatus] = useState<string>(booking.closeStatus || "");
  const [revenue, setRevenue] = useState<string>(booking.revenue != null ? String(booking.revenue) : "");
  const [rescheduleDate, setRescheduleDate] = useState<string>(booking.rescheduleDate || "");
  const [rescheduleTime, setRescheduleTime] = useState<string>(booking.rescheduleTime || "");
  const [notes, setNotes] = useState<string>(booking.notes || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await apiRequest("PATCH", `/api/bookings/${booking.id}`, {
        showStatus: showStatus || null,
        closeStatus: showStatus === "show" ? (closeStatus || null) : null,
        revenue: showStatus === "show" && closeStatus === "close" && revenue ? parseFloat(revenue) : null,
        rescheduleDate: showStatus === "reschedule" ? (rescheduleDate || null) : null,
        rescheduleTime: showStatus === "reschedule" ? (rescheduleTime || null) : null,
        notes: notes || null,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to update booking.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal onClose={onClose} title={`Outcomes — ${booking.leadName}`}>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 12, padding: 12, borderRadius: 8, background: S.bg, border: `1px solid ${S.borderDim}` }}>
          <div style={{ fontSize: 12, color: S.textMuted }}>
            {booking.location} · {booking.evalDate} {booking.evalTime}
          </div>
          {booking.igHandle && <div style={{ fontSize: 12, color: S.textDim, marginTop: 2 }}>@{booking.igHandle.replace(/^@/, "")}</div>}
        </div>

        <div style={{ display: "grid", gap: 14 }}>
          <div>
            <label style={labelStyle()}>Show Status</label>
            <select value={showStatus} onChange={e => { setShowStatus(e.target.value); if (e.target.value !== "show") setCloseStatus(""); }} style={inputStyle()}>
              <option value="">— Pending —</option>
              <option value="show">Show</option>
              <option value="no_show">No Show</option>
              <option value="reschedule">Reschedule</option>
              <option value="cancel">Cancel</option>
            </select>
          </div>

          {showStatus === "reschedule" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={labelStyle()}>New Date (or leave blank = TBD)</label>
                <input type="date" value={rescheduleDate} onChange={e => setRescheduleDate(e.target.value)} style={inputStyle()} />
              </div>
              <div>
                <label style={labelStyle()}>New Time</label>
                <input type="time" value={rescheduleTime} onChange={e => setRescheduleTime(e.target.value)} style={inputStyle()} />
              </div>
            </div>
          )}

          {showStatus === "show" && (
            <div>
              <label style={labelStyle()}>Close Status</label>
              <select value={closeStatus} onChange={e => { setCloseStatus(e.target.value); if (e.target.value !== "close") setRevenue(""); }} style={inputStyle()}>
                <option value="">— Pending —</option>
                <option value="close">Close</option>
                <option value="no_sale">No Sale</option>
              </select>
            </div>
          )}

          {showStatus === "show" && closeStatus === "close" && (
            <div>
              <label style={labelStyle()}>Revenue ($)</label>
              <input
                type="number" min="0" step="0.01"
                value={revenue} onChange={e => setRevenue(e.target.value)}
                style={inputStyle()} placeholder="0.00"
              />
            </div>
          )}

          <div>
            <label style={labelStyle()}>Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} style={{ ...inputStyle(), resize: "vertical", minHeight: 72 }} placeholder="Optional notes..." />
          </div>
        </div>

        {error && <div style={{ color: S.red, fontSize: 12, marginTop: 10 }}>{error}</div>}
        <div style={{ display: "flex", gap: 10, marginTop: 18, justifyContent: "flex-end" }}>
          <button type="button" onClick={onClose} style={{
            background: "none", border: `1px solid ${S.border}`, color: S.textMuted,
            borderRadius: 8, padding: "7px 16px", cursor: "pointer", fontSize: 13,
          }}>
            Cancel
          </button>
          <button type="submit" disabled={loading} style={{
            background: loading ? S.borderDim : S.cyan, color: "#0d1117",
            border: "none", borderRadius: 8, padding: "7px 18px",
            fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", fontSize: 13,
          }}>
            {loading ? "Saving..." : "Save Outcomes"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── NEW FOLLOW-UP FORM ───────────────────────────────────────────────────────

function NewFollowupModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({
    location: FACILITIES[0],
    igUsername: "",
    assignedRep: "",
    notes: "",
    status: "active",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.igUsername) {
      setError("IG Username is required.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await apiRequest("POST", "/api/followups", {
        location: form.location,
        igUsername: form.igUsername,
        assignedRep: form.assignedRep || null,
        notes: form.notes || null,
        status: form.status,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to add follow-up.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal onClose={onClose} title="Add Follow-Up">
      <form onSubmit={handleSubmit}>
        <div style={{ display: "grid", gap: 14 }}>
          <div>
            <label style={labelStyle()}>Location</label>
            <select value={form.location} onChange={e => set("location", e.target.value)} style={inputStyle()}>
              {FACILITIES.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle()}>IG Username *</label>
            <input type="text" value={form.igUsername} onChange={e => set("igUsername", e.target.value)} style={inputStyle()} placeholder="@username" required />
          </div>
          <div>
            <label style={labelStyle()}>Assigned Rep</label>
            <input type="text" value={form.assignedRep} onChange={e => set("assignedRep", e.target.value)} style={inputStyle()} placeholder="Rep name" />
          </div>
          <div>
            <label style={labelStyle()}>Status</label>
            <select value={form.status} onChange={e => set("status", e.target.value)} style={inputStyle()}>
              <option value="active">Active</option>
              <option value="booked">Booked</option>
              <option value="cold">Cold</option>
            </select>
          </div>
          <div>
            <label style={labelStyle()}>Notes</label>
            <textarea value={form.notes} onChange={e => set("notes", e.target.value)} style={{ ...inputStyle(), resize: "vertical", minHeight: 72 }} placeholder="Optional notes..." />
          </div>
        </div>
        {error && <div style={{ color: S.red, fontSize: 12, marginTop: 10 }}>{error}</div>}
        <div style={{ display: "flex", gap: 10, marginTop: 18, justifyContent: "flex-end" }}>
          <button type="button" onClick={onClose} style={{
            background: "none", border: `1px solid ${S.border}`, color: S.textMuted,
            borderRadius: 8, padding: "7px 16px", cursor: "pointer", fontSize: 13,
          }}>
            Cancel
          </button>
          <button type="submit" disabled={loading} style={{
            background: loading ? S.borderDim : S.cyan, color: "#0d1117",
            border: "none", borderRadius: 8, padding: "7px 18px",
            fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", fontSize: 13,
          }}>
            {loading ? "Saving..." : "Add Follow-Up"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── BOOKINGS TAB ─────────────────────────────────────────────────────────────

function BookingsTab({ isAdmin }: { isAdmin: boolean }) {
  const qc = useQueryClient();
  const [showNewModal, setShowNewModal] = useState(false);
  const [outcomeBooking, setOutcomeBooking] = useState<Booking | null>(null);
  const [locationFilter, setLocationFilter] = useState("");
  const [noSaleOnly, setNoSaleOnly] = useState(false);

  const { data: bookings = [], isLoading } = useQuery<Booking[]>({
    queryKey: ["/api/bookings", locationFilter],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/bookings${locationFilter ? `?location=${encodeURIComponent(locationFilter)}` : ""}`);
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const refresh = useCallback(() => qc.invalidateQueries({ queryKey: ["/api/bookings"] }), [qc]);

  const thStyle: React.CSSProperties = {
    padding: "8px 12px", fontSize: 11, fontWeight: 600,
    color: S.textMuted, textTransform: "uppercase", letterSpacing: "0.06em",
    textAlign: "left", whiteSpace: "nowrap",
    borderBottom: `1px solid ${S.border}`,
  };
  const tdStyle: React.CSSProperties = {
    padding: "9px 12px", fontSize: 13, color: S.textPrimary,
    borderBottom: `1px solid ${S.borderDim}`, verticalAlign: "middle",
  };
  const monoTd: React.CSSProperties = { ...tdStyle, fontFamily: S.mono };

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <button
          onClick={() => setShowNewModal(true)}
          style={{
            background: S.cyan, color: "#0d1117", border: "none",
            borderRadius: 8, padding: "7px 14px", fontWeight: 700,
            fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
          }}
        >
          <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> New Booking
        </button>
        <select
          value={locationFilter}
          onChange={e => setLocationFilter(e.target.value)}
          style={{ ...inputStyle({ width: "auto" }), minWidth: 160 }}
        >
          <option value="">All Locations</option>
          {FACILITIES.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
        {/* No Sale Follow-Up quick filter */}
        <button
          onClick={() => setNoSaleOnly(!noSaleOnly)}
          style={{
            background: noSaleOnly ? "rgba(249,115,22,0.15)" : S.surface,
            color: noSaleOnly ? S.orange : S.textMuted,
            border: `1px solid ${noSaleOnly ? S.orange : S.border}`,
            borderRadius: 8, padding: "7px 14px", fontSize: 12,
            cursor: "pointer", fontWeight: noSaleOnly ? 700 : 400,
            display: "flex", alignItems: "center", gap: 6,
          }}
          data-testid="button-no-sale-filter"
        >
          {noSaleOnly ? "✕" : ""} No Sale Follow-Ups
          {noSaleOnly && <span style={{ fontSize: 10 }}>({bookings.filter(b => b.closeStatus === "no_sale").length})</span>}
        </button>
        <div style={{ marginLeft: "auto", color: S.textMuted, fontSize: 12 }}>
          {noSaleOnly
            ? `${bookings.filter(b => b.closeStatus === "no_sale").length} no-sale leads`
            : `${bookings.length} bookings`}
        </div>
      </div>

      {/* Table */}
      <div style={{ borderRadius: 10, border: `1px solid ${S.border}`, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ background: S.card }}>
              <tr>
                <th style={thStyle}>Location</th>
                <th style={thStyle}>Lead Name</th>
                <th style={thStyle}>IG Handle</th>
                <th style={thStyle}>Phone</th>
                <th style={thStyle}>Rep</th>
                <th style={thStyle}>Eval Date</th>
                <th style={thStyle}>Time</th>
                {isAdmin && <th style={thStyle}>Show</th>}
                {isAdmin && <th style={thStyle}>Close</th>}
                {isAdmin && <th style={{ ...thStyle, textAlign: "right" }}>Revenue</th>}
                <th style={{ ...thStyle, textAlign: "center" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={isAdmin ? 11 : 8} style={{ ...tdStyle, textAlign: "center", color: S.textMuted, padding: 32 }}>
                    Loading...
                  </td>
                </tr>
              )}
              {!isLoading && bookings.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 11 : 8} style={{ ...tdStyle, textAlign: "center", color: S.textMuted, padding: 32 }}>
                    No bookings yet. Click "+ New Booking" to add one.
                  </td>
                </tr>
              )}
              {(noSaleOnly ? bookings.filter(b => b.closeStatus === "no_sale") : bookings).map(b => (
                <tr
                  key={b.id}
                  style={{ background: S.bg, transition: "background 0.1s" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "hsl(222, 20%, 9%)")}
                  onMouseLeave={e => (e.currentTarget.style.background = S.bg)}
                >
                  <td style={tdStyle}><span style={{ color: S.cyan, fontWeight: 600, fontSize: 12 }}>{b.location}</span></td>
                  <td style={tdStyle}>{b.leadName}</td>
                  <td style={{ ...monoTd, color: S.textMuted, fontSize: 12 }}>
                    {b.igHandle ? `@${b.igHandle.replace(/^@/, "")}` : "—"}
                  </td>
                  <td style={{ ...monoTd, color: S.textMuted, fontSize: 12 }}>{b.phone || "—"}</td>
                  <td style={{ ...tdStyle, color: S.textMuted }}>{b.assignedRep || "—"}</td>
                  <td style={monoTd}>{b.evalDate}</td>
                  <td style={{ ...monoTd, color: S.textMuted }}>{b.evalTime}</td>
                  {isAdmin && <td style={tdStyle}><ShowBadge status={b.showStatus} evalDate={b.evalDate} computedStatus={b.notes} /></td>}
                  {isAdmin && <td style={tdStyle}><CloseBadge status={b.closeStatus} /></td>}
                  {isAdmin && (
                    <td style={{ ...monoTd, textAlign: "right", color: b.revenue ? S.green : S.textDim }}>
                      {b.revenue != null && b.revenue !== 0 && !isNaN(Number(b.revenue)) ? `$${Number(b.revenue).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
                    </td>
                  )}
                  <td style={{ ...tdStyle, textAlign: "center" }}>
                    {isAdmin && (
                      <button
                        onClick={() => setOutcomeBooking(b)}
                        style={{
                          background: S.cyanDim, border: `1px solid rgba(51,212,224,0.2)`,
                          color: S.cyan, borderRadius: 6, padding: "3px 10px",
                          fontSize: 11, fontWeight: 600, cursor: "pointer",
                        }}
                      >
                        Outcomes
                      </button>
                    )}
                    {!isAdmin && <span style={{ color: S.textDim, fontSize: 11 }}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showNewModal && (
        <NewBookingModal onClose={() => setShowNewModal(false)} onSuccess={refresh} />
      )}
      {outcomeBooking && (
        <OutcomeModal booking={outcomeBooking} onClose={() => setOutcomeBooking(null)} onSuccess={refresh} />
      )}
    </div>
  );
}

// ─── FOLLOW-UPS TAB ───────────────────────────────────────────────────────────

function FollowUpsTab() {
  const qc = useQueryClient();
  const [showNewModal, setShowNewModal] = useState(false);
  const [locationFilter, setLocationFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");

  const { data: followups = [], isLoading } = useQuery<Followup[]>({
    queryKey: ["/api/followups", locationFilter],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/followups${locationFilter ? `?location=${encodeURIComponent(locationFilter)}` : ""}`);
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const refresh = useCallback(() => qc.invalidateQueries({ queryKey: ["/api/followups"] }), [qc]);

  const updateStatus = async (id: number, status: string) => {
    try {
      await apiRequest("PATCH", `/api/followups/${id}`, { status });
      refresh();
    } catch (e) { console.error(e); }
  };

  const filtered = followups.filter(f => statusFilter === "all" ? true : f.status === statusFilter);

  const thStyle: React.CSSProperties = {
    padding: "8px 12px", fontSize: 11, fontWeight: 600,
    color: S.textMuted, textTransform: "uppercase", letterSpacing: "0.06em",
    textAlign: "left", whiteSpace: "nowrap",
    borderBottom: `1px solid ${S.border}`,
  };
  const tdStyle: React.CSSProperties = {
    padding: "9px 12px", fontSize: 13, color: S.textPrimary,
    borderBottom: `1px solid ${S.borderDim}`, verticalAlign: "middle",
  };

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <button
          onClick={() => setShowNewModal(true)}
          style={{
            background: S.cyan, color: "#0d1117", border: "none",
            borderRadius: 8, padding: "7px 14px", fontWeight: 700,
            fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
          }}
        >
          <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Add Follow-Up
        </button>
        <select value={locationFilter} onChange={e => setLocationFilter(e.target.value)} style={{ ...inputStyle({ width: "auto" }), minWidth: 160 }}>
          <option value="">All Locations</option>
          {FACILITIES.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ ...inputStyle({ width: "auto" }), minWidth: 130 }}>
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="booked">Booked</option>
          <option value="cold">Cold</option>
        </select>
        <div style={{ marginLeft: "auto", color: S.textMuted, fontSize: 12 }}>
          {filtered.length} follow-ups
        </div>
      </div>

      {/* Table */}
      <div style={{ borderRadius: 10, border: `1px solid ${S.border}`, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ background: S.card }}>
              <tr>
                <th style={thStyle}>Location</th>
                <th style={thStyle}>IG Username</th>
                <th style={thStyle}>Rep</th>
                <th style={thStyle}>Date Added</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Notes</th>
                <th style={{ ...thStyle, textAlign: "center" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={7} style={{ ...tdStyle, textAlign: "center", color: S.textMuted, padding: 32 }}>Loading...</td>
                </tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ ...tdStyle, textAlign: "center", color: S.textMuted, padding: 32 }}>
                    No follow-ups found. Click "+ Add Follow-Up" to add one.
                  </td>
                </tr>
              )}
              {filtered.map(f => (
                <tr
                  key={f.id}
                  style={{ background: S.bg }}
                  onMouseEnter={e => (e.currentTarget.style.background = "hsl(222, 20%, 9%)")}
                  onMouseLeave={e => (e.currentTarget.style.background = S.bg)}
                >
                  <td style={tdStyle}><span style={{ color: S.cyan, fontWeight: 600, fontSize: 12 }}>{f.location}</span></td>
                  <td style={{ ...tdStyle, fontFamily: S.mono }}>@{f.igUsername.replace(/^@/, "")}</td>
                  <td style={{ ...tdStyle, color: S.textMuted }}>{f.assignedRep || "—"}</td>
                  <td style={{ ...tdStyle, fontFamily: S.mono, color: S.textMuted, fontSize: 12 }}>{f.date}</td>
                  <td style={tdStyle}><StatusBadge status={f.status} /></td>
                  <td style={{ ...tdStyle, color: S.textMuted, maxWidth: 200 }}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>{f.notes || "—"}</span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: "center" }}>
                    <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                      {f.status !== "booked" && (
                        <button
                          onClick={() => updateStatus(f.id, "booked")}
                          style={{
                            background: "rgba(44,186,110,0.10)", border: "1px solid rgba(44,186,110,0.25)",
                            color: S.green, borderRadius: 6, padding: "3px 9px",
                            fontSize: 11, fontWeight: 600, cursor: "pointer",
                          }}
                        >
                          Booked
                        </button>
                      )}
                      {f.status !== "cold" && (
                        <button
                          onClick={() => updateStatus(f.id, "cold")}
                          style={{
                            background: "rgba(100,100,120,0.12)", border: `1px solid ${S.border}`,
                            color: S.textMuted, borderRadius: 6, padding: "3px 9px",
                            fontSize: 11, fontWeight: 600, cursor: "pointer",
                          }}
                        >
                          Cold
                        </button>
                      )}
                      {f.status !== "active" && (
                        <button
                          onClick={() => updateStatus(f.id, "active")}
                          style={{
                            background: S.cyanDim, border: "1px solid rgba(51,212,224,0.2)",
                            color: S.cyan, borderRadius: 6, padding: "3px 9px",
                            fontSize: 11, fontWeight: 600, cursor: "pointer",
                          }}
                        >
                          Active
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showNewModal && (
        <NewFollowupModal onClose={() => setShowNewModal(false)} onSuccess={refresh} />
      )}
    </div>
  );
}

// ─── KPI CARD ─────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, color = S.textPrimary, large = false,
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
  large?: boolean;
}) {
  return (
    <div style={{
      background: S.card, border: `1px solid ${S.border}`,
      borderRadius: 10, padding: "16px 18px", flex: 1, minWidth: 0,
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: S.textMuted, marginBottom: 8 }}>
        {label}
      </div>
      <div style={{
        fontSize: large ? 28 : 22, fontWeight: 700,
        fontFamily: S.mono, color, lineHeight: 1,
      }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: S.textMuted, marginTop: 4, fontFamily: S.mono }}>
          {sub}
        </div>
      )}
    </div>
  );
}

// ─── DASHBOARD TAB ────────────────────────────────────────────────────────────

function DashboardTab() {
  const [period, setPeriod] = useState<"day" | "week" | "month" | "all">("all");

  const { data: stats, isLoading } = useQuery<SalesStats>({
    queryKey: ["/api/sales/stats", period],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/sales/stats?period=${period}`);
      return res.json();
    },
  });

  const periods: { key: "day" | "week" | "month" | "all"; label: string }[] = [
    { key: "day", label: "Today" },
    { key: "week", label: "Last 7 Days" },
    { key: "month", label: "Last 30 Days" },
    { key: "all", label: "All Time" },
  ];

  const pct = (num: number, denom: number) =>
    denom > 0 ? `${Math.round((num / denom) * 100)}%` : "—";

  const thStyle: React.CSSProperties = {
    padding: "8px 12px", fontSize: 11, fontWeight: 600,
    color: S.textMuted, textTransform: "uppercase", letterSpacing: "0.06em",
    textAlign: "left", whiteSpace: "nowrap",
    borderBottom: `1px solid ${S.border}`,
  };
  const tdStyle: React.CSSProperties = {
    padding: "9px 12px", fontSize: 13, color: S.textPrimary,
    borderBottom: `1px solid ${S.borderDim}`, verticalAlign: "middle",
    fontFamily: S.mono,
  };

  return (
    <div>
      {/* Period Selector */}
      <div style={{ display: "flex", gap: 6, marginBottom: 24 }}>
        {periods.map(p => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            style={{
              padding: "6px 14px", borderRadius: 8, border: "none",
              fontSize: 12, fontWeight: 600, cursor: "pointer",
              background: period === p.key ? S.cyan : S.card,
              color: period === p.key ? "#0d1117" : S.textMuted,
              transition: "all 0.15s",
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {isLoading && (
        <div style={{ color: S.textMuted, textAlign: "center", padding: 48 }}>Loading stats...</div>
      )}

      {stats && (
        <>
          {/* KPI Row */}
          <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
            <KpiCard label="Evals Booked" value={stats.total_booked} />
            <KpiCard
              label="Shows"
              value={stats.shows}
              sub={`${pct(stats.shows, stats.total_booked)} of booked`}
              color={S.green}
            />
            <KpiCard
              label="Closes"
              value={stats.closes}
              sub={`${pct(stats.closes, stats.shows)} of shows`}
              color={S.cyan}
            />
            <KpiCard label="No Sales" value={stats.no_sales} color={S.orange} />
            <KpiCard label="Reschedules" value={stats.reschedules} color={S.amber} />
            <KpiCard label="Cancels / No Shows" value={stats.cancels} color={S.red} />
            <KpiCard
              label="Revenue"
              value={`$${stats.revenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              color={S.green}
              large
            />
          </div>

          {/* By Location Table */}
          <div style={{ marginBottom: 8, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: S.textMuted }}>
            By Location
          </div>
          <div style={{ borderRadius: 10, border: `1px solid ${S.border}`, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead style={{ background: S.card }}>
                  <tr>
                    <th style={thStyle}>Location</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Booked</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Shows</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Closes</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>No Sales</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Reschedules</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Cancels</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.by_location.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ ...tdStyle, textAlign: "center", color: S.textMuted, padding: 28, fontFamily: "inherit" }}>
                        No data for this period.
                      </td>
                    </tr>
                  )}
                  {stats.by_location.map(row => (
                    <tr
                      key={row.location}
                      style={{ background: S.bg }}
                      onMouseEnter={e => (e.currentTarget.style.background = "hsl(222, 20%, 9%)")}
                      onMouseLeave={e => (e.currentTarget.style.background = S.bg)}
                    >
                      <td style={{ ...tdStyle, fontFamily: "inherit", fontWeight: 600, color: S.cyan }}>
                        {row.location}
                      </td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>{row.booked}</td>
                      <td style={{ ...tdStyle, textAlign: "right", color: row.shows > 0 ? S.green : S.textMuted }}>{row.shows}</td>
                      <td style={{ ...tdStyle, textAlign: "right", color: row.closes > 0 ? S.cyan : S.textMuted }}>{row.closes}</td>
                      <td style={{ ...tdStyle, textAlign: "right", color: row.no_sales > 0 ? S.orange : S.textMuted }}>{row.no_sales}</td>
                      <td style={{ ...tdStyle, textAlign: "right", color: row.reschedules > 0 ? S.amber : S.textMuted }}>{row.reschedules}</td>
                      <td style={{ ...tdStyle, textAlign: "right", color: row.cancels > 0 ? S.red : S.textMuted }}>{row.cancels}</td>
                      <td style={{ ...tdStyle, textAlign: "right", color: row.revenue > 0 ? S.green : S.textDim, fontWeight: row.revenue > 0 ? 700 : 400 }}>
                        {row.revenue > 0
                          ? `$${row.revenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── MAIN SALES PAGE ──────────────────────────────────────────────────────────

type TabKey = "bookings" | "followups" | "dashboard";

export default function Sales() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [tab, setTab] = useState<TabKey>("bookings");

  const tabs: { key: TabKey; label: string }[] = [
    { key: "bookings", label: "Bookings" },
    { key: "followups", label: "Follow-Ups" },
    { key: "dashboard", label: "Dashboard" },
  ];

  return (
    <div style={{ display: "flex", height: "100vh", background: S.bg, overflow: "hidden" }}>
      <Sidebar />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Header */}
        <div style={{
          padding: "16px 24px", borderBottom: `1px solid ${S.borderDim}`,
          display: "flex", alignItems: "center", gap: 12,
          background: S.card, flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: S.textPrimary }}>Sales Tracker</div>
            <div style={{ fontSize: 12, color: S.textMuted, marginTop: 1 }}>
              Eval bookings, follow-ups & revenue · {isAdmin ? "Admin view" : "Staff view"}
            </div>
          </div>
        </div>

        {/* Tab Bar */}
        <div style={{
          padding: "0 24px", borderBottom: `1px solid ${S.borderDim}`,
          display: "flex", alignItems: "flex-end", gap: 0,
          background: S.card, flexShrink: 0,
        }}>
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: "10px 18px", border: "none", background: "none",
                fontSize: 13, fontWeight: 600, cursor: "pointer",
                color: tab === t.key ? S.cyan : S.textMuted,
                borderBottom: tab === t.key ? `2px solid ${S.cyan}` : "2px solid transparent",
                transition: "color 0.15s",
                marginBottom: -1,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
          {tab === "bookings" && <BookingsTab isAdmin={isAdmin} />}
          {tab === "followups" && <FollowUpsTab />}
          {tab === "dashboard" && <DashboardTab />}
        </div>
      </div>
    </div>
  );
}
