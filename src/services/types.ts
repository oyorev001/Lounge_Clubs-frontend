// Domain types mirroring the LoungeClubsApi DTOs.

export type AppRole = "Admin" | "Officer" | "BusinessOwner";

export type EstablishmentType = "Lounge" | "Bar" | "Club" | "Nightclub";

export type EstablishmentStatus =
  "PendingReview" | "Approved" | "Rejected" | "Suspended" | "NonCompliant" | "Closed";

export type LevyStatus = "Pending" | "Paid" | "Overdue" | "Waived";
export type PaymentStatus =
  "Pending" | "AwaitingConfirmation" | "Successful" | "Failed" | "Cancelled" | "Refunded";
export type CertificateStatus = "Active" | "Expired" | "Revoked";
export type InspectionOutcome = "Compliant" | "Issues" | "Critical";
export type InspectionType = "Registration" | "Routine" | "Complaint" | "Enforcement";
export type FineStatus = "Unpaid" | "Paid" | "Waived";
export type DocumentType =
  "CacCertificate" | "GovernmentId" | "VenuePhoto" | "UtilityBill" | "Other";
export type NotificationType =
  | "General"
  | "LevyDue"
  | "PaymentConfirmed"
  | "CertificateIssued"
  | "CertificateExpiring"
  | "ApplicationStatus"
  | "InspectionScheduled"
  | "FineIssued";

export interface CurrentUser {
  id: string;
  userName: string | null;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  roles: string[];
  permissions: string[];
  createdAt: string;
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: AppRole;
  roles: string[];
  emailConfirmed?: boolean;
}

export interface LicenseTier {
  id: string;
  code: string;
  name: string;
  description: string | null;
  annualFee: number;
  sortOrder: number;
  minScore: number;
  isActive?: boolean;
}

export interface EstablishmentListItem {
  id: string;
  registrationNumber: string;
  name: string;
  type: EstablishmentType;
  additionalTypes: EstablishmentType[];
  status: EstablishmentStatus;
  lga: string;
  address: string;
  tierCode: string | null;
  tierName: string | null;
  suggestedTierScore: number | null;
  createdAt: string;
}

export interface EstablishmentDocument {
  id: string;
  documentType: DocumentType;
  fileUrl: string;
  fileName: string | null;
  uploadedAt: string;
}

export interface EstablishmentDetail extends EstablishmentListItem {
  additionalTypes: EstablishmentType[];
  description: string | null;
  landmark: string | null;
  contactPhone: string;
  contactEmail: string | null;
  cacNumber: string | null;
  ownerNin: string | null;
  latitude: number | null;
  longitude: number | null;
  capacity: number;
  staffCount: number;
  floorAreaSqm: number | null;
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
  parkingSpaces: number | null;
  operatingHours: string | null;
  rejectionReason: string | null;
  nonCompliantReason?: string | null;
  approvedAt: string | null;
  ownerName?: string | null;
  ownerEmail?: string | null;
  documents: EstablishmentDocument[];
}

export interface LevyAssessment {
  id: string;
  reference: string;
  establishmentId: string;
  establishmentName: string;
  lga?: string;
  tierCode: string;
  tierName: string;
  year: number;
  amount: number;
  dueDate: string;
  status: LevyStatus;
  paidAt: string | null;
  hasCertificate: boolean;
  certificateId: string | null;
}

export interface Certificate {
  id: string;
  certificateNumber: string;
  establishmentName: string;
  establishmentType?: EstablishmentType;
  lga?: string;
  tierName: string | null;
  levyYear: number;
  amountPaid: number;
  issueDate: string;
  expiryDate: string;
  status: CertificateStatus;
  isValid: boolean;
}

export interface TransactionInit {
  transactionId: string;
  reference: string;
  amount: number;
  status: PaymentStatus;
  checkoutUrl: string | null;
  expiresAt: string | null;
}

export interface PaymentStatusResult {
  reference: string;
  status: PaymentStatus;
  amount: number;
  context: "Levy" | "Fine";
  paidAt: string | null;
  certificateId: string | null;
  certificateNumber: string | null;
  failureReason?: string | null;
}

export interface Inspection {
  id: string;
  establishmentId: string;
  establishmentName: string;
  officerId: string;
  officerName: string | null;
  type: InspectionType;
  scheduledFor: string | null;
  conductedAt: string | null;
  outcome: InspectionOutcome | null;
  notes: string | null;
  evidenceUrls: string | null;
}

export interface Fine {
  id: string;
  reference: string;
  establishmentId: string;
  establishmentName: string;
  issuedByName?: string;
  fineType: string;
  amount: number;
  reason: string;
  status: FineStatus;
  paidAt: string | null;
  createdAt: string;
}

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface DashboardStats {
  establishments: {
    total: number;
    pendingReview: number;
    approved: number;
    suspended: number;
    nonCompliant: number;
  };
  tiers: { code: string; name: string; count: number }[];
  levies: {
    currentYear: number;
    issued: number;
    paid: number;
    overdue: number;
    waived: number;
    expectedRevenue: number;
    collectedRevenue: number;
  };
  certificates: { active: number; expired: number; revoked: number };
  fines: { unpaid: number; paid: number; outstandingAmount: number; collectedAmount: number };
  inspections: { scheduledUpcoming: number; awaitingReport: number; completedThisMonth: number };
  openComplaints: number;
  payments: { totalTransactions: number; successfulAmount: number };
}

export interface Defaulter {
  id: string;
  registrationNumber: string;
  name: string;
  type: EstablishmentType;
  lga: string;
  tierCode: string | null;
  ownerName: string | null;
  ownerPhone: string | null;
  ownerEmail: string | null;
  overdueLeviesCount: number;
  daysSinceExpiryOrDue: number | null;
}

export interface AuditLogItem {
  id: string;
  userId: string | null;
  type: string;
  tableName: string;
  primaryKey: string;
  oldValues: string | null;
  newValues: string | null;
  ipAddress: string | null;
  userAgent?: string | null;
  timestamp: string;
}

export interface Paginated<T> {
  data: T[];
  meta: {
    current_page: number;
    from: number | null;
    to: number | null;
    last_page: number;
    per_page: number;
    total: number;
  };
}

export interface VerifyCertificateResult {
  establishmentStatus?: EstablishmentStatus | null;
  found: boolean;
  certificateNumber?: string;
  establishmentName?: string;
  establishmentType?: string;
  lga?: string;
  tierName?: string;
  levyYear?: number;
  issueDate?: string;
  expiryDate?: string;
  status?: string;
  isValid?: boolean;
}

export interface Complaint {
  id: string;
  establishmentId: string | null;
  establishmentName: string | null;
  lga: string | null;
  venueDescription: string | null;
  category: string;
  details: string;
  complainantName: string | null;
  complainantPhone: string | null;
  status: "New" | "UnderReview" | "InspectionScheduled" | "Resolved" | "Dismissed";
  resolutionNote: string | null;
  inspectionId: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export type ComplaintStatus =
  "New" | "UnderReview" | "InspectionScheduled" | "Resolved" | "Dismissed";

export interface PaginatedComplaints extends Paginated<Complaint> {
  meta: Paginated<Complaint>["meta"] & { counts?: Partial<Record<ComplaintStatus, number>> };
}

export interface RegistryVenue {
  id: string;
  name: string;
  type: string;
  additionalTypes: string[];
  lga: string;
  address: string;
  status: string;
  isLicensed: boolean;
  certificateNumber: string | null;
  validUntil: string | null;
}

export interface PendingConfirmation {
  id: string;
  reference: string;
  amount: number;
  context: "Levy" | "Fine";
  contextId: string;
  externalReference: string | null;
  narration: string | null;
  recordedById: string | null;
  establishmentName: string | null;
  createdAt: string;
}
