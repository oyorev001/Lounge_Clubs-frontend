// Typed API surface — one object per backend feature area.

import { apiFetch, apiDownload } from "./client";
import type {
  AppNotification,
  AuditLogItem,
  Certificate,
  CertificateStatus,
  Complaint,
  DashboardStats,
  Defaulter,
  DocumentType,
  EstablishmentDetail,
  EstablishmentListItem,
  EstablishmentStatus,
  EstablishmentType,
  Fine,
  FineStatus,
  Inspection,
  InspectionOutcome,
  InspectionType,
  LevyAssessment,
  LevyStatus,
  LicenseTier,
  Paginated,
  PaginatedComplaints,
  ComplaintStatus,
  PaymentStatusResult,
  PendingConfirmation,
  RegistryVenue,
  TransactionInit,
  VerifyCertificateResult,
} from "./types";

const qs = (params: Record<string, unknown>) => {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
};

export const authApi = {
  updateProfile: (body: { firstName?: string; lastName?: string; phoneNumber?: string }) =>
    apiFetch("/users/profile", { method: "PUT", body: JSON.stringify(body) }),
  changePassword: (currentPassword: string, newPassword: string) =>
    apiFetch("/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
  verifyEmail: (email: string, code: string) =>
    apiFetch<{ message: string }>("/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ email, code }),
      anonymous: true,
    }),
  resendVerification: (email: string) =>
    apiFetch<{ message: string }>("/auth/resend-verification", {
      method: "POST",
      body: JSON.stringify({ email }),
      anonymous: true,
    }),
  register: (body: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone: string;
    businessName?: string;
  }) =>
    apiFetch<{ message: string }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(body),
      anonymous: true,
    }),

  login: (email: string, password: string) =>
    apiFetch<{ accessToken: string; refreshToken: string; expiration: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
      anonymous: true,
    }),

  forgotPassword: (email: string) =>
    apiFetch("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
      anonymous: true,
    }),

  resetPassword: (email: string, token: string, newPassword: string) =>
    apiFetch("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ email, token, newPassword }),
      anonymous: true,
    }),

  me: () =>
    apiFetch<{
      id: string;
      userName: string | null;
      email: string | null;
      firstName: string | null;
      lastName: string | null;
      phoneNumber: string | null;
      roles: string[];
      permissions: string[];
      emailConfirmed: boolean;
      createdAt: string;
    }>("/users/me"),
};

export interface RegisterEstablishmentPayload {
  name: string;
  types: EstablishmentType[];
  description?: string;
  address: string;
  lga: string;
  landmark?: string;
  latitude?: number;
  longitude?: number;
  contactPhone: string;
  contactEmail?: string;
  cacNumber: string;
  nin: string;
  capacity: number;
  staffCount: number;
  floorAreaSqm?: number;
  hasLiveBand: boolean;
  hasDj: boolean;
  hasVipArea: boolean;
  hasPoolTable: boolean;
  hasShisha: boolean;
  hasRooftop: boolean;
  hasRestaurant: boolean;
  hasOutdoorSpace: boolean;
  hasLodging: boolean;
  hasParking: boolean;
  parkingSpaces?: number;
  operatingHours?: string;
}

export const establishmentsApi = {
  register: (body: RegisterEstablishmentPayload) =>
    apiFetch<{
      id: string;
      registrationNumber: string;
      name: string;
      type: EstablishmentType;
      additionalTypes: EstablishmentType[];
      status: EstablishmentStatus;
      suggestedTierScore: number;
      suggestedTierName: string | null;
    }>("/establishments", { method: "POST", body: JSON.stringify(body) }),

  mine: () => apiFetch<EstablishmentListItem[]>("/establishments/mine"),

  getById: (id: string) => apiFetch<EstablishmentDetail>(`/establishments/${id}`),

  all: (params: {
    page?: number;
    per_page?: number;
    search?: string;
    status?: EstablishmentStatus;
    lga?: string;
    tierId?: string;
    type?: EstablishmentType;
  }) =>
    apiFetch<Paginated<EstablishmentListItem>>(
      `/establishments/all${qs({ ...params, tier_id: params.tierId, tierId: undefined })}`,
    ),

  withdraw: (id: string) => apiFetch<{ id: string }>(`/establishments/${id}`, { method: "DELETE" }),

  close: (id: string, reason?: string) =>
    apiFetch<{ id: string; status: string }>(`/establishments/${id}/close`, {
      method: "PUT",
      body: JSON.stringify({ reason }),
    }),

  uploadDocument: (id: string, file: File, documentType: DocumentType) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("documentType", documentType);
    return apiFetch<{ id: string; fileUrl: string; documentType: DocumentType }>(
      `/establishments/${id}/documents`,
      { method: "POST", body: fd },
    );
  },

  approve: (id: string, tierId: string, notes?: string) =>
    apiFetch<{
      establishmentId: string;
      status: string;
      tierName: string;
      levyAssessmentId?: string;
      levyAmount?: number;
    }>(`/establishments/${id}/approve`, { method: "PUT", body: JSON.stringify({ tierId, notes }) }),

  reject: (id: string, reason: string) =>
    apiFetch(`/establishments/${id}/reject`, { method: "PUT", body: JSON.stringify({ reason }) }),

  suspend: (id: string, reason: string) =>
    apiFetch(`/establishments/${id}/suspend`, { method: "PUT", body: JSON.stringify({ reason }) }),

  reclassifyTier: (id: string, tierId: string, reason: string) =>
    apiFetch(`/establishments/${id}/tier`, {
      method: "PUT",
      body: JSON.stringify({ tierId, reason }),
    }),
  clearCompliance: (id: string) =>
    apiFetch(`/establishments/${id}/compliance-clear`, { method: "PUT" }),
  reinstate: (id: string, notes?: string) =>
    apiFetch<{ establishmentId: string; status: string }>(`/establishments/${id}/reinstate`, {
      method: "PUT",
      body: JSON.stringify({ notes }),
    }),

  inspections: (id: string) => apiFetch<Inspection[]>(`/establishments/${id}/inspections`),
};

export const tiersApi = {
  list: () => apiFetch<LicenseTier[]>("/tiers", { anonymous: true }),
  create: (body: {
    code: string;
    name: string;
    description?: string;
    annualFee: number;
    sortOrder: number;
    minScore: number;
  }) => apiFetch<LicenseTier>("/tiers", { method: "POST", body: JSON.stringify(body) }),
  update: (
    id: string,
    body: {
      name: string;
      description?: string;
      annualFee: number;
      sortOrder: number;
      minScore: number;
      isActive: boolean;
    },
  ) => apiFetch<LicenseTier>(`/tiers/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  remove: (id: string) => apiFetch(`/tiers/${id}`, { method: "DELETE" }),
};

export const leviesApi = {
  mine: () => apiFetch<LevyAssessment[]>("/levies/mine"),
  all: (params: {
    page?: number;
    per_page?: number;
    year?: number;
    status?: LevyStatus;
    lga?: string;
    establishmentName?: string;
    establishment_id?: string;
  }) => apiFetch<Paginated<LevyAssessment>>(`/levies${qs(params)}`),
  getById: (id: string) => apiFetch<LevyAssessment & { transactionId?: string }>(`/levies/${id}`),
  generate: (year: number) =>
    apiFetch<{ year: number; created: number; skipped: number }>("/levies/generate", {
      method: "POST",
      body: JSON.stringify({ year }),
    }),
  waive: (id: string, reason: string) =>
    apiFetch(`/levies/${id}/waive`, { method: "PUT", body: JSON.stringify({ reason }) }),
  markPaid: (id: string, note?: string, externalReference?: string) =>
    apiFetch<{
      levyId: string;
      status: string;
      transactionReference: string;
    }>(`/levies/${id}/mark-paid`, {
      method: "PUT",
      body: JSON.stringify({ note, externalReference }),
    }),
};

export const paymentsApi = {
  initiateLevy: (levyAssessmentId: string, idempotencyKey?: string) =>
    apiFetch<TransactionInit>("/payments/levy", {
      method: "POST",
      body: JSON.stringify({
        levyAssessmentId,
        idempotencyKey,
        callbackUrl: `${window.location.origin}/payment-callback`,
      }),
    }),
  initiateFine: (fineId: string, idempotencyKey?: string) =>
    apiFetch<TransactionInit>("/payments/fine", {
      method: "POST",
      body: JSON.stringify({
        fineId,
        idempotencyKey,
        callbackUrl: `${window.location.origin}/payment-callback`,
      }),
    }),
  status: (reference: string) => apiFetch<PaymentStatusResult>(`/payments/${reference}`),
  receiptPdf: (transactionId: string) => apiDownload(`/payments/${transactionId}/receipt`),
  pendingConfirmations: () => apiFetch<PendingConfirmation[]>("/payments/pending-confirmation"),
  confirmManual: (id: string) => apiFetch(`/payments/${id}/confirm`, { method: "PUT" }),
  rejectManual: (id: string, reason?: string) =>
    apiFetch(`/payments/${id}/reject`, {
      method: "PUT",
      body: JSON.stringify({ reason: reason ?? null }),
    }),
  duplicates: () => apiFetch<unknown[]>("/admin/payments/duplicates"),
  refund: (id: string, reason: string) =>
    apiFetch(`/payments/${id}/refund`, { method: "PUT", body: JSON.stringify({ reason }) }),
};

export const exportsApi = {
  levies: () => apiDownload("/admin/levies.csv"),
  defaulters: () => apiDownload("/admin/defaulters.csv"),
  certificates: () => apiDownload("/admin/certificates.csv"),
};

export const complaintsApi = {
  submit: (body: {
    establishmentId?: string | null;
    venueDescription?: string | undefined;
    category: string;
    details: string;
    complainantName?: string | undefined;
    complainantPhone?: string | undefined;
  }) =>
    apiFetch<{ id: string; message: string }>("/complaints", {
      method: "POST",
      body: JSON.stringify(body),
      anonymous: true, // public form — never trigger an auth refresh/redirect
    }),
  list: (filters: {
    status?: string | undefined;
    category?: string | undefined;
    q?: string | undefined;
    establishmentId?: string | undefined;
    page?: number;
  }) =>
    apiFetch<PaginatedComplaints>(
      `/complaints?${qs({
        status: filters.status,
        category: filters.category,
        q: filters.q,
        establishment_id: filters.establishmentId,
        page: filters.page ?? 1,
        per_page: 50,
      })}`,
    ),
  resolve: (id: string, status: "Resolved" | "Dismissed" | "UnderReview", note?: string) =>
    apiFetch(`/complaints/${id}/resolve`, {
      method: "PUT",
      body: JSON.stringify({ status, note }),
    }),
  bulkStatus: (
    target:
      | { ids: string[] }
      | {
          allMatching: true;
          fromStatus?: ComplaintStatus;
          category?: string;
          q?: string;
        },
    status: "Resolved" | "Dismissed" | "UnderReview",
    note?: string,
  ) =>
    apiFetch<{ updated: number }>("/complaints/bulk-status", {
      method: "PUT",
      body: JSON.stringify({ ...target, status, note }),
    }),
  inspect: (id: string, body: { officerId?: string; scheduledFor?: string }) =>
    apiFetch<{ id: string }>(`/complaints/${id}/inspect`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
};

export const registryApi = {
  search: (params: { q?: string; lga?: string }) => {
    const usp = new URLSearchParams();
    if (params.q) usp.set("q", params.q);
    if (params.lga) usp.set("lga", params.lga);
    const qs = usp.toString();
    return apiFetch<RegistryVenue[]>(`/registry${qs ? `?${qs}` : ""}`);
  },
};

export const certificatesApi = {
  mine: () => apiFetch<Certificate[]>("/certificates/mine"),
  list: (params: {
    page?: number;
    per_page?: number;
    search?: string;
    status?: CertificateStatus;
    year?: number;
    establishment_id?: string;
    tier?: string;
    expiring_in_days?: number;
    issued_within_days?: number;
  }) => apiFetch<Paginated<Certificate>>(`/certificates${qs(params)}`),
  getById: (id: string) =>
    apiFetch<
      Certificate & {
        establishmentAddress: string;
        establishmentLga: string;
        revokedReason?: string | null;
        revokedAt?: string | null;
        isValid: boolean;
      }
    >(`/certificates/${id}`),
  pdf: (id: string) => apiDownload(`/certificates/${id}/pdf`),
  verify: (certOrToken: string) =>
    apiFetch<VerifyCertificateResult>(`/verify/${encodeURIComponent(certOrToken)}`, {
      anonymous: true,
    }),
  revoke: (id: string, reason: string) =>
    apiFetch(`/certificates/${id}/revoke`, { method: "PUT", body: JSON.stringify({ reason }) }),
  setStatus: (id: string, status: "Active" | "Expired" | "Revoked", reason: string) =>
    apiFetch<{ id: string; certificateNumber: string; status: string }>(
      `/certificates/${id}/status`,
      { method: "PUT", body: JSON.stringify({ status, reason }) },
    ),
};

export const inspectionsApi = {
  schedule: (body: {
    establishmentId: string;
    type: InspectionType;
    scheduledFor: string;
    notes?: string;
  }) => apiFetch<Inspection>("/inspections", { method: "POST", body: JSON.stringify(body) }),
  complete: (
    id: string,
    body: {
      outcome: InspectionOutcome;
      notes?: string;
      evidenceUrls?: string[];
      latitude?: number;
      longitude?: number;
    },
  ) => apiFetch(`/inspections/${id}/complete`, { method: "PUT", body: JSON.stringify(body) }),
  adhoc: (body: {
    establishmentId: string;
    type: InspectionType;
    outcome: InspectionOutcome;
    notes?: string;
    evidenceUrls?: string[];
  }) => apiFetch<Inspection>("/inspections/adhoc", { method: "POST", body: JSON.stringify(body) }),
  list: (params: {
    page?: number;
    per_page?: number;
    establishmentId?: string;
    outcome?: InspectionOutcome;
    officerId?: string;
  }) => apiFetch<Paginated<Inspection>>(`/inspections${qs(params)}`),
  mine: () => apiFetch<Inspection[]>("/inspections/mine"),
};

export const finesApi = {
  issue: (body: {
    establishmentId: string;
    fineType: string;
    amount: number;
    reason: string;
    inspectionId?: string;
  }) =>
    apiFetch<{ id: string; reference: string; amount: number; status: FineStatus }>("/fines", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  list: (params: {
    page?: number;
    per_page?: number;
    status?: FineStatus;
    establishmentId?: string;
  }) => apiFetch<Paginated<Fine>>(`/fines${qs(params)}`),
  mine: () => apiFetch<Fine[]>("/fines/mine"),
  waive: (id: string, reason: string) =>
    apiFetch(`/fines/${id}/waive`, { method: "PUT", body: JSON.stringify({ reason }) }),
  markPaid: (id: string, note?: string, externalReference?: string) =>
    apiFetch<{ fineId: string; status: string; transactionReference: string }>(
      `/fines/${id}/mark-paid`,
      { method: "PUT", body: JSON.stringify({ note, externalReference }) },
    ),
};

export interface AdminUserItem {
  id: string;
  userName: string | null;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  roles: string[];
  permissions: string[];
  isActive: boolean;
  assignedLgas?: string[] | null;
}

export const usersApi = {
  setJurisdiction: (id: string, lgas: string[]) =>
    apiFetch(`/users/${id}/jurisdiction`, { method: "PUT", body: JSON.stringify({ lgas }) }),
  list: (params: {
    page?: number;
    per_page?: number;
    search?: string;
    role?: string;
    current_roles_only?: boolean;
  }) =>
    apiFetch<Paginated<AdminUserItem>>(`/users${qs(params)}`),
  create: (body: {
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
    password: string;
    roles: string[];
  }) => apiFetch<string>("/users", { method: "POST", body: JSON.stringify(body) }),
  assignRole: (userId: string, roleName: string) =>
    apiFetch(`/users/${userId}/roles`, {
      method: "POST",
      body: JSON.stringify({ userId, roleName }),
    }),
  removeRole: (userId: string, roleName: string) =>
    apiFetch(`/users/${userId}/roles/${encodeURIComponent(roleName)}`, { method: "DELETE" }),
  deactivate: (id: string) => apiFetch(`/users/${id}/deactivate`, { method: "POST" }),
  reactivate: (id: string) => apiFetch(`/users/${id}/reactivate`, { method: "POST" }),
};

export const notificationsApi = {
  mine: (page = 1) =>
    apiFetch<{ items: Paginated<AppNotification>; unreadCount: number }>(
      `/notifications${qs({ page })}`,
    ),
  markRead: (id: string) => apiFetch(`/notifications/${id}/read`, { method: "PUT" }),
  markAllRead: () => apiFetch("/notifications/read-all", { method: "PUT" }),
};

export const adminApi = {
  dashboard: () => apiFetch<DashboardStats>("/admin/dashboard"),
  defaulters: (params: { page?: number; per_page?: number }) =>
    apiFetch<Paginated<Defaulter>>(`/admin/defaulters${qs(params)}`),
  auditLogs: (params: {
    page?: number;
    per_page?: number;
    tableName?: string;
    type?: string;
    userId?: string;
    from?: string;
    to?: string;
  }) => apiFetch<Paginated<AuditLogItem>>(`/admin/audit-logs${qs(params)}`),
};
