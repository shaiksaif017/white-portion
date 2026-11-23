import { useState, useMemo, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Lock,
  LogOut,
  Calendar,
  Clock,
  User,
  Phone,
  Mail,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Download,
  Filter,
  Search,
  Settings,
  Shield,
  Eye,
  X,
  FileText,
  Video,
  MapPin,
  CalendarX,
  Check,
  Package,
  ShoppingBag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import {
  adminExportCsv,
  adminSendTestEmail,
  adminSetEmailPassword,
  adminLogin,
  adminLogout,
  adminSaveSettings,
  adminSetSlotBlocked,
  adminUpdateStatus,
  getAdminDashboard,
  getAdminSession,
} from "@/lib/booking-api";
import {
  type AppointmentRecord,
  type BookingStatus,
  type BookingSettings,
  defaultBookingSettings,
} from "@/lib/booking-types";
import { type NotificationLog, customerWhatsAppConfirmationUrl } from "@/lib/notifications";
import { brand } from "@/lib/brand";
import { AdminProducts } from "@/components/admin-products";
import { AdminOrders } from "@/components/admin-orders";
import { WHATSAPP_DISPLAY } from "@/lib/whatsapp";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: `Admin Booking Management | ${brand.name}` },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [serverConfigured, setServerConfigured] = useState(true);
  const [passcode, setPasscode] = useState("");
  const [authError, setAuthError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [appointments, setAppointments] = useState<AppointmentRecord[]>([]);
  const [settings, setSettings] = useState<BookingSettings>(defaultBookingSettings);
  const [notifications, setNotifications] = useState<NotificationLog[]>([]);

  const [activeTab, setActiveTab] = useState<"bookings" | "settings" | "notifications" | "products" | "orders">("bookings");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRecord, setSelectedRecord] = useState<AppointmentRecord | null>(null);

  // Slot blocking inputs
  const [blockDateInput, setBlockDateInput] = useState("");
  const [blockTimeInput, setBlockTimeInput] = useState("10:00");

  useEffect(() => {
    getAdminSession()
      .then((s) => {
        setServerConfigured(s.configured);
        if (s.authenticated) {
          setIsAuthenticated(true);
          void refreshData();
        }
      })
      .catch(() => setAuthError("Could not reach the server."))
      .finally(() => setSessionChecked(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- check the session once on page load
  }, []);

  // Any "session expired" answer from the server drops back to the login screen.
  function handleFailure(error: string) {
    if (/session has expired/i.test(error)) {
      setIsAuthenticated(false);
      setAuthError(error);
    } else {
      setActionError(error);
    }
  }

  async function refreshData() {
    try {
      const res = await getAdminDashboard();
      if (!res.ok) return handleFailure(res.error);
      setActionError(null);
      setAppointments(res.appointments);
      setSettings(res.settings);
      setNotifications(res.notifications);
    } catch {
      setActionError("Could not reach the server.");
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setIsLoggingIn(true);
    try {
      const res = await adminLogin({ data: { password: passcode } });
      if (res.ok) {
        setIsAuthenticated(true);
        setAuthError("");
        setPasscode("");
        await refreshData();
      } else {
        setAuthError(res.error);
      }
    } catch {
      setAuthError("Could not reach the server.");
    } finally {
      setIsLoggingIn(false);
    }
  }

  async function handleLogout() {
    try {
      await adminLogout();
    } finally {
      setIsAuthenticated(false);
      setAppointments([]);
      setNotifications([]);
      setSelectedRecord(null);
    }
  }

  async function handleStatusChange(recordId: string, newStatus: BookingStatus) {
    try {
      const res = await adminUpdateStatus({ data: { id: recordId, status: newStatus } });
      if (!res.ok) return handleFailure(res.error);
      if (newStatus === "Confirmed" || (selectedRecord && selectedRecord.id === recordId)) {
        setSelectedRecord(res.appointment);
      }
      await refreshData();
    } catch {
      setActionError("Could not reach the server.");
    }
  }

  const [testEmailRunning, setTestEmailRunning] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<string | null>(null);

  const [emailPassword, setEmailPassword] = useState("");

  async function handleSaveEmailPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!emailPassword) return;
    await handleTestEmail(emailPassword);
    setEmailPassword("");
  }

  async function handleTestEmail(newPassword?: string) {
    setTestEmailRunning(true);
    setTestEmailResult(null);
    try {
      const res = newPassword
        ? await adminSetEmailPassword({ data: { password: newPassword } })
        : await adminSendTestEmail();
      if (!res.ok) return handleFailure(res.error);
      const smtp = res.smtp
        ? [
            `Mail server: ${res.smtp.host}:${res.smtp.port}`,
            `Login: ${res.smtp.user}`,
            `From: ${res.smtp.from}`,
            `Password from: ${res.smtp.passwordSource}`,
            `Password loaded: ${res.smtp.passwordLength} characters${
              res.smtp.passwordWarnings.length
                ? ` - WARNING: ${res.smtp.passwordWarnings.join("; ")}`
                : " (no quotes, spaces or hidden characters)"
            }`,
            `Server last restarted: ${new Date(res.smtp.serverStartedAt).toLocaleString()}`,
          ].join("\n")
        : "Mail server: NOT CONFIGURED (enter the email password below, and check SMTP_HOST / SMTP_USER)";
      setTestEmailResult(
        `Result: ${res.result}\nSent to: ${res.to}\n${smtp}${res.error ? `\nReason: ${res.error}` : ""}`,
      );
      await refreshData();
    } catch {
      setTestEmailResult("Could not reach the server.");
    } finally {
      setTestEmailRunning(false);
    }
  }

  async function handleDownloadCSV() {
    try {
      const res = await adminExportCsv();
      if (!res.ok) return handleFailure(res.error);
      const blob = new Blob(["﻿" + res.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `wpw-appointments-${new Date().toISOString().split("T")[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      setActionError("Could not reach the server.");
    }
  }

  async function setSlotBlocked(date: string, time: string, blocked: boolean) {
    try {
      const res = await adminSetSlotBlocked({ data: { date, time, blocked } });
      if (!res.ok) return handleFailure(res.error);
      setSettings(res.settings);
    } catch {
      setActionError("Could not reach the server.");
    }
  }

  async function handleBlockSlot(e: React.FormEvent) {
    e.preventDefault();
    if (!blockDateInput || !blockTimeInput) return;
    await setSlotBlocked(blockDateInput, blockTimeInput, true);
    setBlockDateInput("");
  }

  function handleUnblockSlot(date: string, time: string) {
    void setSlotBlocked(date, time, false);
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await adminSaveSettings({ data: settings });
      if (!res.ok) return handleFailure(res.error);
      setSettings(res.settings);
      setActionError(null);
      alert("Booking settings saved successfully.");
    } catch {
      setActionError("Could not reach the server.");
    }
  }

  // Filtered and searched records
  const filteredAppointments = useMemo(() => {
    return appointments.filter((apt) => {
      const matchesStatus = statusFilter === "ALL" || apt.booking_status === statusFilter;
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        apt.full_name.toLowerCase().includes(q) ||
        apt.email.toLowerCase().includes(q) ||
        apt.booking_reference.toLowerCase().includes(q) ||
        apt.service.toLowerCase().includes(q) ||
        apt.phone.includes(q);

      return matchesStatus && matchesSearch;
    });
  }, [appointments, statusFilter, searchQuery]);

  // Metric stats
  const metrics = useMemo(() => {
    return {
      total: appointments.length,
      pending: appointments.filter((a) => a.booking_status === "Pending").length,
      confirmed: appointments.filter((a) => a.booking_status === "Confirmed").length,
      completed: appointments.filter((a) => a.booking_status === "Completed").length,
    };
  }, [appointments]);

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-charcoal text-paper flex flex-col justify-between">
        <SiteHeader isSolid />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-md bg-paper/5 border border-rule-light p-8 md:p-10 rounded shadow-2xl backdrop-blur-sm">
            <div className="text-center space-y-2 mb-8">
              <div className="w-12 h-12 bg-primary/20 text-gold-accent rounded-full flex items-center justify-center mx-auto mb-3 border border-gold-accent/30">
                <Shield className="w-6 h-6" />
              </div>
              <h1 className="text-2xl font-display font-medium text-paper">
                Administration Portal
              </h1>
              <p className="text-xs text-paper-soft">
                Protected area for {brand.name} coaching directors.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-paper-soft mb-2">
                  Security Passcode
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    placeholder="Enter admin passcode"
                    required
                    className="w-full p-3 rounded bg-charcoal border border-rule-light text-xs text-paper placeholder:text-paper-faint focus:border-gold-accent focus:outline-none"
                  />
                  <Lock className="w-4 h-4 text-paper-faint absolute right-3 top-3.5" />
                </div>
              </div>

              {authError && (
                <div className="p-3 rounded bg-destructive/20 border border-destructive/40 text-destructive-foreground text-xs">
                  {authError}
                </div>
              )}

              <Button type="submit" variant="hero" className="w-full !mt-6" disabled={isLoggingIn}>
                {isLoggingIn ? "CHECKING…" : "AUTHENTICATE ACCESS"}
              </Button>

              {sessionChecked && !serverConfigured && (
                <p className="text-[11px] text-paper-faint text-center pt-2">
                  Admin login is not configured on the server yet.
                </p>
              )}
            </form>
          </div>
        </div>
        <SiteFooter />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <SiteHeader isSolid />

      {/* Top Admin Header Bar */}
      <section className="bg-charcoal text-paper border-b border-rule-light py-8 px-6 md:px-12">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-bold tracking-widest text-gold-accent uppercase">
                COACHING DIRECTORS CONSOLE
              </span>
            </div>
            <h1 className="text-3xl font-display font-medium text-paper mt-1">
              Appointment Management
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={handleDownloadCSV}
              variant="outline"
              className="text-xs border-rule-light text-paper bg-transparent hover:bg-paper/10 flex items-center gap-2"
            >
              <Download className="w-4 h-4" /> Export CSV
            </Button>
            <Button
              onClick={handleLogout}
              variant="outline"
              className="text-xs border-rule-light text-paper bg-transparent hover:bg-destructive hover:text-white flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" /> Sign Out
            </Button>
          </div>
        </div>
      </section>

      {/* Metric Cards Row */}
      <div className="max-w-7xl mx-auto px-6 md:px-12 -mt-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-card border border-border p-5 rounded shadow-sm">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
              Total Requests
            </span>
            <span className="text-2xl md:text-3xl font-mono font-bold text-charcoal mt-1 block">
              {metrics.total}
            </span>
          </div>

          <div className="bg-card border-l-4 border-l-amber-500 border border-border p-5 rounded shadow-sm">
            <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider block">
              Pending Review
            </span>
            <span className="text-2xl md:text-3xl font-mono font-bold text-amber-600 mt-1 block">
              {metrics.pending}
            </span>
          </div>

          <div className="bg-card border-l-4 border-l-primary border border-border p-5 rounded shadow-sm">
            <span className="text-[11px] font-bold text-primary uppercase tracking-wider block">
              Confirmed Sessions
            </span>
            <span className="text-2xl md:text-3xl font-mono font-bold text-olive-deep mt-1 block">
              {metrics.confirmed}
            </span>
          </div>

          <div className="bg-card border-l-4 border-l-emerald-600 border border-border p-5 rounded shadow-sm">
            <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider block">
              Completed
            </span>
            <span className="text-2xl md:text-3xl font-mono font-bold text-emerald-700 mt-1 block">
              {metrics.completed}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-6 md:px-12 mt-8">
        <div className="flex border-b border-border space-x-8 text-xs font-bold uppercase tracking-wider overflow-x-auto whitespace-nowrap">
          <button
            type="button"
            onClick={() => setActiveTab("bookings")}
            className={`pb-3 cursor-pointer transition-colors ${
              activeTab === "bookings"
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-charcoal"
            }`}
          >
            All Bookings ({appointments.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("settings")}
            className={`pb-3 cursor-pointer transition-colors flex items-center gap-1.5 ${
              activeTab === "settings"
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-charcoal"
            }`}
          >
            <Settings className="w-3.5 h-3.5" /> Working Hours & Slot Blocking
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("notifications")}
            className={`pb-3 cursor-pointer transition-colors flex items-center gap-1.5 ${
              activeTab === "notifications"
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-charcoal"
            }`}
          >
            <Mail className="w-3.5 h-3.5" /> Email Notification Log ({notifications.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("products")}
            className={`pb-3 cursor-pointer transition-colors flex items-center gap-1.5 ${
              activeTab === "products"
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-charcoal"
            }`}
          >
            <Package className="w-3.5 h-3.5" /> Products
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("orders")}
            className={`pb-3 cursor-pointer transition-colors flex items-center gap-1.5 ${
              activeTab === "orders"
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-charcoal"
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" /> Orders
          </button>
        </div>
      </div>

      {/* Main Content Sections */}
      <div className="max-w-7xl mx-auto px-6 md:px-12 py-8">
        {actionError && (
          <div className="mb-6 p-3 rounded border border-destructive/40 bg-destructive/10 text-xs text-charcoal">
            {actionError}
          </div>
        )}

        {activeTab === "bookings" && (
          <div className="space-y-6">
            {/* Filters & Search Row */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {["ALL", "Pending", "Confirmed", "Completed", "Cancelled"].map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(st)}
                    className={`px-3 py-1.5 rounded text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                      statusFilter === st
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-muted-foreground hover:text-charcoal"
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>

              <div className="relative min-w-[280px]">
                <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by client, reference, or email..."
                  className="w-full pl-9 pr-4 py-2 rounded border border-border bg-card text-xs text-foreground focus:border-primary focus:outline-none"
                />
              </div>
            </div>

            {/* Appointments Table */}
            <div className="bg-card border border-border rounded overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-secondary/70 border-b border-border text-muted-foreground uppercase text-[10px] font-bold tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Ref #</th>
                      <th className="py-3 px-4">Client Details</th>
                      <th className="py-3 px-4">Service & Type</th>
                      <th className="py-3 px-4">Schedule</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredAppointments.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-12 text-muted-foreground">
                          No appointment records match the current filter criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredAppointments.map((apt) => {
                        const statusColors: Record<BookingStatus, string> = {
                          Pending: "bg-amber-100 text-amber-800 border-amber-300",
                          Confirmed: "bg-emerald-100 text-emerald-800 border-emerald-300",
                          Cancelled: "bg-rose-100 text-rose-800 border-rose-300",
                          Completed: "bg-blue-100 text-blue-800 border-blue-300",
                        };

                        return (
                          <tr key={apt.id} className="hover:bg-secondary/30 transition-colors">
                            <td className="py-4 px-4 font-mono font-bold text-charcoal">
                              {apt.booking_reference}
                            </td>

                            <td className="py-4 px-4">
                              <div className="font-semibold text-charcoal">{apt.full_name}</div>
                              <div className="text-[11px] text-muted-foreground">
                                {apt.email} · {apt.phone}
                              </div>
                            </td>

                            <td className="py-4 px-4">
                              <div className="font-medium text-charcoal">{apt.service}</div>
                              <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                {apt.appointment_type === "Online Consultation" ? (
                                  <>
                                    <Video className="w-3 h-3 text-primary" /> Online
                                  </>
                                ) : (
                                  <>
                                    <MapPin className="w-3 h-3 text-primary" /> In-Person Studio
                                  </>
                                )}
                              </div>
                            </td>

                            <td className="py-4 px-4">
                              <div className="font-semibold text-charcoal">
                                {apt.appointment_date}
                              </div>
                              <div className="text-[11px] text-muted-foreground">
                                {apt.appointment_time} ({apt.timezone})
                              </div>
                            </td>

                            <td className="py-4 px-4">
                              <span
                                className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${
                                  statusColors[apt.booking_status]
                                }`}
                              >
                                {apt.booking_status}
                              </span>
                            </td>

                            <td className="py-4 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setSelectedRecord(apt)}
                                  className="p-1.5 rounded hover:bg-secondary text-primary cursor-pointer"
                                  title="View Full Details"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>

                                {apt.booking_status === "Pending" && (
                                  <button
                                    type="button"
                                    onClick={() => handleStatusChange(apt.id, "Confirmed")}
                                    className="px-2 py-1 bg-primary text-primary-foreground rounded text-[11px] font-semibold hover:bg-olive-deep cursor-pointer"
                                    title="Confirm Booking"
                                  >
                                    Confirm
                                  </button>
                                )}

                                {apt.booking_status === "Confirmed" &&
                                  customerWhatsAppConfirmationUrl(apt, settings) && (
                                    <a
                                      href={customerWhatsAppConfirmationUrl(apt, settings) ?? undefined}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="px-2 py-1 bg-[#25D366] text-white rounded text-[11px] font-semibold hover:opacity-90"
                                      title="Send WhatsApp confirmation to the customer"
                                    >
                                      WhatsApp
                                    </a>
                                  )}

                                {apt.booking_status === "Confirmed" && (
                                  <button
                                    type="button"
                                    onClick={() => handleStatusChange(apt.id, "Completed")}
                                    className="px-2 py-1 bg-emerald-600 text-white rounded text-[11px] font-semibold hover:bg-emerald-700 cursor-pointer"
                                    title="Mark Completed"
                                  >
                                    Complete
                                  </button>
                                )}

                                {apt.booking_status !== "Cancelled" && (
                                  <button
                                    type="button"
                                    onClick={() => handleStatusChange(apt.id, "Cancelled")}
                                    className="p-1.5 text-muted-foreground hover:text-destructive cursor-pointer"
                                    title="Cancel"
                                  >
                                    <XCircle className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Settings & Slot Blocking */}
        {activeTab === "settings" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-7 bg-card border border-border p-6 md:p-8 rounded shadow-sm">
              <h3 className="text-xl font-display font-medium text-charcoal mb-4 pb-3 border-b border-border">
                Working Hours & Availability Rules
              </h3>

              <form onSubmit={handleSaveSettings} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-charcoal mb-1">
                      Day Starts At:
                    </label>
                    <input
                      type="time"
                      value={settings.startHour}
                      onChange={(e) => setSettings({ ...settings, startHour: e.target.value })}
                      className="w-full p-2.5 rounded border border-border bg-background text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-charcoal mb-1">
                      Day Ends At:
                    </label>
                    <input
                      type="time"
                      value={settings.endHour}
                      onChange={(e) => setSettings({ ...settings, endHour: e.target.value })}
                      className="w-full p-2.5 rounded border border-border bg-background text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-charcoal mb-1">
                      Session Duration (Minutes):
                    </label>
                    <input
                      type="number"
                      step={5}
                      value={settings.slotDurationMinutes}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          slotDurationMinutes: Number(e.target.value) || 30,
                        })
                      }
                      className="w-full p-2.5 rounded border border-border bg-background text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-charcoal mb-1">
                      Buffer Between Slots (Minutes):
                    </label>
                    <input
                      type="number"
                      step={5}
                      value={settings.bufferTimeMinutes}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          bufferTimeMinutes: Number(e.target.value) || 15,
                        })
                      }
                      className="w-full p-2.5 rounded border border-border bg-background text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-charcoal mb-1">
                    Studio Address (for In-Person Consultations):
                  </label>
                  <input
                    type="text"
                    value={settings.businessLocation}
                    onChange={(e) =>
                      setSettings({ ...settings, businessLocation: e.target.value })
                    }
                    className="w-full p-2.5 rounded border border-border bg-background text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-charcoal mb-1">
                    Concierge WhatsApp Phone:
                  </label>
                  <p className="w-full p-2.5 rounded border border-border bg-secondary/40 text-xs text-muted-foreground">
                    {WHATSAPP_DISPLAY} (set in the website code: src/lib/whatsapp.ts)
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-charcoal mb-1">
                    Administrator Notification Email:
                  </label>
                  <input
                    type="email"
                    value={settings.adminNotificationEmail}
                    onChange={(e) =>
                      setSettings({ ...settings, adminNotificationEmail: e.target.value })
                    }
                    className="w-full p-2.5 rounded border border-border bg-background text-xs"
                  />
                </div>

                <div className="pt-4">
                  <Button type="submit" variant="hero">
                    Save Working Hours Configuration
                  </Button>
                </div>
              </form>
            </div>

            {/* Block Slot Management */}
            <div className="lg:col-span-5 bg-card border border-border p-6 md:p-8 rounded shadow-sm space-y-6">
              <div>
                <h3 className="text-xl font-display font-medium text-charcoal mb-1">
                  Block Time Slot
                </h3>
                <p className="text-xs text-muted-foreground">
                  Prevent clients from booking specific times (e.g. coach travel, meetings).
                </p>
              </div>

              <form onSubmit={handleBlockSlot} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-charcoal mb-1">Date:</label>
                  <input
                    type="date"
                    required
                    value={blockDateInput}
                    onChange={(e) => setBlockDateInput(e.target.value)}
                    className="w-full p-2 rounded border border-border bg-background text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-charcoal mb-1">Time Slot:</label>
                  <input
                    type="time"
                    required
                    value={blockTimeInput}
                    onChange={(e) => setBlockTimeInput(e.target.value)}
                    className="w-full p-2 rounded border border-border bg-background text-xs"
                  />
                </div>

                <Button type="submit" variant="outline" className="w-full text-xs">
                  Block Selected Slot
                </Button>
              </form>

              <div className="pt-4 border-t border-border">
                <span className="text-xs font-bold text-charcoal uppercase tracking-wider block mb-3">
                  Currently Blocked Slots ({settings.blockedSlots.length})
                </span>

                {settings.blockedSlots.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">No custom blocked slots.</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {settings.blockedSlots.map((bs, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2 rounded bg-secondary/70 border border-border text-xs"
                      >
                        <span className="font-semibold text-charcoal">
                          {bs.date} at {bs.time}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleUnblockSlot(bs.date, bs.time)}
                          className="text-[11px] text-destructive hover:underline cursor-pointer"
                        >
                          Unblock
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Notification Logs */}
        {activeTab === "products" && (
          <div className="bg-card border border-border p-6 md:p-8 rounded shadow-sm">
            <AdminProducts onSessionExpired={handleFailure} />
          </div>
        )}

        {activeTab === "orders" && (
          <div className="bg-card border border-border p-6 md:p-8 rounded shadow-sm">
            <AdminOrders onSessionExpired={handleFailure} />
          </div>
        )}

        {activeTab === "notifications" && (
          <div className="bg-card border border-border p-6 md:p-8 rounded shadow-sm space-y-4">
            <div>
              <h3 className="text-xl font-display font-medium text-charcoal">
                Transactional Email Dispatch Log
              </h3>
              <p className="text-xs text-muted-foreground">
                All client acknowledgement and administrator intake notification events are logged here.
              </p>
              <form
                onSubmit={handleSaveEmailPassword}
                className="mt-4 p-4 rounded border border-border bg-secondary/30 space-y-2"
              >
                <label className="block text-xs font-bold text-charcoal">
                  Email account password (for care@officialwhiteportion.com)
                </label>
                <p className="text-[11px] text-muted-foreground">
                  Type the same password you use at mail.hostinger.com, without "care@" in front. It is
                  stored encrypted and never shown again.
                </p>
                <div className="flex flex-wrap gap-2">
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={emailPassword}
                    onChange={(e) => setEmailPassword(e.target.value)}
                    placeholder="Mailbox password"
                    className="flex-1 min-w-[200px] p-2.5 rounded border border-border bg-background text-xs"
                  />
                  <Button
                    type="submit"
                    variant="hero"
                    className="text-xs"
                    disabled={testEmailRunning || !emailPassword}
                  >
                    {testEmailRunning ? "Saving & testing…" : "Save & send test"}
                  </Button>
                </div>
              </form>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="text-xs"
                  disabled={testEmailRunning}
                  onClick={() => handleTestEmail()}
                >
                  {testEmailRunning ? "Sending test email…" : "Send test email"}
                </Button>
                <span className="text-[11px] text-muted-foreground">
                  Sends a test to the Administrator Notification Email and shows the result.
                </span>
              </div>
              {testEmailResult && (
                <pre className="mt-3 p-3 rounded border border-border bg-background text-[11px] whitespace-pre-wrap break-words">
                  {testEmailResult}
                </pre>
              )}
            </div>

            <div className="space-y-3 mt-6">
              {notifications.length === 0 ? (
                <p className="text-xs text-muted-foreground py-8 text-center">
                  No emails recorded yet. Each booking will appear here.
                </p>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className="p-4 rounded border border-border bg-secondary/30 space-y-2 text-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
                      <span className="font-bold text-primary tracking-wider">
                        {n.type}{" "}
                        <span
                          className={`ml-2 px-1.5 py-0.5 rounded text-[10px] ${
                            n.status === "SENT"
                              ? "bg-emerald-100 text-emerald-800"
                              : n.status === "FAILED"
                                ? "bg-red-100 text-red-800"
                                : "bg-amber-100 text-amber-800"
                          }`}
                          title={n.error ?? ""}
                        >
                          {n.status === "SKIPPED" ? "NOT SENT (email not configured)" : n.status}
                        </span>
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {new Date(n.sentAt).toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="font-semibold text-charcoal">Recipient:</span> {n.recipient}
                    </div>
                    <div>
                      <span className="font-semibold text-charcoal">Subject:</span> {n.subject}
                    </div>
                    {n.error && (
                      <div className="p-2 rounded bg-red-50 border border-red-200 text-red-800 break-words">
                        <span className="font-semibold">Reason:</span> {n.error}
                      </div>
                    )}
                    <pre className="p-3 rounded bg-background border border-border text-[11px] font-mono text-muted-foreground whitespace-pre-wrap max-h-40 overflow-y-auto">
                      {n.content}
                    </pre>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal for Selected Booking */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 bg-charcoal/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg shadow-2xl p-6 md:p-8 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div>
                <span className="text-xs font-bold text-primary font-mono">
                  {selectedRecord.booking_reference}
                </span>
                <h3 className="text-2xl font-display font-medium text-charcoal">
                  {selectedRecord.full_name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="p-1 rounded hover:bg-secondary text-muted-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-muted-foreground block">Email:</span>
                <span className="font-semibold text-charcoal">{selectedRecord.email}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Phone:</span>
                <span className="font-semibold text-charcoal">{selectedRecord.phone}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Service:</span>
                <span className="font-semibold text-charcoal">{selectedRecord.service}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Format:</span>
                <span className="font-semibold text-charcoal">{selectedRecord.appointment_type}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Requested Schedule:</span>
                <span className="font-semibold text-charcoal">
                  {selectedRecord.appointment_date} at {selectedRecord.appointment_time}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block">Status:</span>
                <span className="font-bold text-primary">{selectedRecord.booking_status}</span>
              </div>
            </div>

            <div className="p-4 rounded bg-secondary/60 space-y-2 text-xs">
              <span className="font-bold text-charcoal uppercase tracking-wider block">
                Intake Questionnaire & Health Background
              </span>
              <p>
                <strong>Fitness Goal:</strong> {selectedRecord.fitness_goal}
              </p>
              {selectedRecord.age && (
                <p>
                  <strong>Age:</strong> {selectedRecord.age}
                </p>
              )}
              {selectedRecord.gender && (
                <p>
                  <strong>Gender:</strong> {selectedRecord.gender}
                </p>
              )}
              {selectedRecord.current_weight && (
                <p>
                  <strong>Weight:</strong> {selectedRecord.current_weight}
                </p>
              )}
              {selectedRecord.height && (
                <p>
                  <strong>Height:</strong> {selectedRecord.height}
                </p>
              )}
              {selectedRecord.training_experience && (
                <p>
                  <strong>Training Experience:</strong> {selectedRecord.training_experience}
                </p>
              )}
              {selectedRecord.dietary_preferences && (
                <p>
                  <strong>Dietary Preferences:</strong> {selectedRecord.dietary_preferences}
                </p>
              )}
              {selectedRecord.additional_information && (
                <p>
                  <strong>Client Notes:</strong> {selectedRecord.additional_information}
                </p>
              )}
            </div>

            {selectedRecord.booking_status === "Confirmed" && (
              <div className="p-4 rounded border border-[#25D366]/40 bg-[#25D366]/10 space-y-3 text-xs">
                <p className="font-semibold text-charcoal">
                  ✅ Confirmed. A confirmation email is sent to {selectedRecord.email} automatically.
                </p>
                {customerWhatsAppConfirmationUrl(selectedRecord, settings) ? (
                  <>
                    <p className="text-muted-foreground">
                      Also let the client know on WhatsApp: the message is pre-written, just tap Send.
                    </p>
                    <a
                      href={customerWhatsAppConfirmationUrl(selectedRecord, settings) ?? undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded bg-[#25D366] text-white font-semibold hover:opacity-90"
                    >
                      Send WhatsApp confirmation to {selectedRecord.full_name.split(" ")[0]}
                    </a>
                  </>
                ) : (
                  <p className="text-muted-foreground">
                    The client's phone number doesn't look like a valid WhatsApp number, so please contact them directly.
                  </p>
                )}
              </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t border-border">
              <div className="flex gap-2">
                {selectedRecord.booking_status !== "Confirmed" && (
                  <Button
                    onClick={() => handleStatusChange(selectedRecord.id, "Confirmed")}
                    variant="hero"
                    className="text-xs"
                  >
                    Confirm Appointment
                  </Button>
                )}
                {selectedRecord.booking_status !== "Completed" && (
                  <Button
                    onClick={() => handleStatusChange(selectedRecord.id, "Completed")}
                    variant="outline"
                    className="text-xs"
                  >
                    Mark as Completed
                  </Button>
                )}
              </div>

              <Button
                onClick={() => setSelectedRecord(null)}
                variant="outline"
                className="text-xs"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      <SiteFooter />
    </main>
  );
}
