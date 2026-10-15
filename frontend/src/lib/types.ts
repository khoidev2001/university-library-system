/** Kiểu dữ liệu khớp với đặc tả API trong docs/design/SDD.md mục 5. */

export type Role = "READER" | "LIBRARIAN" | "ADMIN";
export type MemberType = "STUDENT" | "LECTURER";
export type CopyStatus = "AVAILABLE" | "BORROWED" | "LOST" | "MAINTENANCE" | "HELD";
export type LoanStatus = "ACTIVE" | "RETURNED" | "LOST";
export type FineType = "OVERDUE" | "LOST";

export interface User {
  id: number;
  email: string;
  fullName: string;
  role: Role;
  memberType: MemberType | null;
  memberCode: string | null;
  isActive: boolean;
  createdAt?: string;
  /** Nhận email nhắc hạn trả sách. */
  emailReminders?: boolean;
  /** Đang dùng mật khẩu tạm: phải đổi mật khẩu trước khi dùng tiếp. */
  mustChangePassword?: boolean;
  passwordChangedAt?: string | null;
  lastLoginAt?: string | null;
  previousLoginAt?: string | null;
}

/** Kết quả cấp mật khẩu tạm (tạo bạn đọc tại quầy / cấp lại mật khẩu): mật khẩu chỉ hiện một lần. */
export interface TemporaryPasswordResult {
  user: User;
  temporaryPassword: string;
  welcomeEmailQueued?: boolean;
}

export interface UserDetail extends User {
  activeLoans: number;
  overdueLoans: number;
  unpaidFines: number;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  bookCount?: number;
}

export interface Author {
  id: number;
  name: string;
  bookCount?: number;
}

export interface BookSummary {
  id: number;
  isbn: string | null;
  title: string;
  publisher: string | null;
  publishedYear: number | null;
  price: number;
  coverUrl: string | null;
  category: Category;
  authors: Author[];
  copiesTotal: number;
  copiesAvailable: number;
}

export interface BookDetail extends BookSummary {
  description: string | null;
  ratingAvg: number | null;
  ratingCount: number;
}

export interface BookCopy {
  id: number;
  bookId: number;
  barcode: string;
  status: CopyStatus;
  shelfLocation: string | null;
}

export interface Loan {
  id: number;
  copyId: number;
  userId: number;
  borrowedAt: string;
  dueAt: string;
  returnedAt: string | null;
  renewedCount: number;
  status: LoanStatus;
  predictedOverdueRisk: number | null;
  isOverdue: boolean;
  overdueDays: number;
  copy: BookCopy & { book: { id: number; title: string; coverUrl: string | null; price: number; categoryId: number } };
  user: { id: number; fullName: string; memberCode: string | null; memberType: MemberType | null };
  fines: Fine[];
}

export interface Fine {
  id: number;
  loanId: number;
  type: FineType;
  amount: number;
  paidAt: string | null;
  paidToId: number | null;
  createdAt: string;
  loan?: Loan;
}

export interface LoanPolicy {
  id: number;
  memberType: MemberType;
  maxBooks: number;
  loanDays: number;
  renewLimit: number;
  renewExtraDays: number;
  finePerDay: number;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface BorrowResult {
  loan: Loan;
  overdueRisk: number | null;
}

export interface ReturnResult {
  loan: Loan;
  fine: Fine | null;
  overdueDays: number;
}

export interface RecommendationItem {
  id: number;
  title: string;
  coverUrl: string | null;
  category: { id: number; name: string };
  authors: string[];
  copiesAvailable: number;
}

export interface RecommendationResult {
  items: RecommendationItem[];
  source: "MODEL" | "POPULAR" | "NONE";
  reason?: string;
}

export interface TopBookRow {
  book: { id: number; title: string; coverUrl: string | null };
  loanCount: number;
}

export interface OverdueRow {
  loanId: number;
  user: { id: number; fullName: string; memberCode: string | null };
  book: { id: number; title: string };
  dueAt: string;
  overdueDays: number;
  estimatedFine: number;
}

export interface MonthCount {
  month: string;
  count: number;
}

export interface InventoryRow {
  category: { id: number; name: string };
  total: number;
  available: number;
  borrowed: number;
  lost: number;
  maintenance: number;
  held: number;
}

export interface ImportReport {
  created: BookSummary[];
  skipped: { isbn: string; reason: "EXISTS" | "NOT_FOUND" }[];
}

export interface OverdueAccuracy {
  sampled: number;
  predictedHigh: number;
  actuallyLate: number;
  hitRate: number | null;
}

/** Số đo huấn luyện do dịch vụ gợi ý trả về qua /recommendations/metrics. */
export interface ModelMetrics {
  recommender: {
    books: number;
    users: number;
    interactions: number;
    precision_at_5: number | null;
    recall_at_5: number | null;
    evaluated_users: number;
    trained_at: string | null;
  } | null;
  overdue: {
    samples: number;
    positive_rate: number;
    chosen: string;
    logistic_regression: Record<string, number>;
    random_forest: Record<string, number>;
    trained_at: string | null;
  } | null;
  lastTraining: { status: string; at: string | null; error: string | null } | null;
  note?: string;
}

export type ReservationStatus = "WAITING" | "READY" | "FULFILLED" | "CANCELLED" | "EXPIRED";

export interface Reservation {
  id: number;
  userId: number;
  bookId: number;
  copyId: number | null;
  status: ReservationStatus;
  createdAt: string;
  readyAt: string | null;
  expiresAt: string | null;
  book: { id: number; title: string; coverUrl: string | null };
  copy: { id: number; barcode: string; shelfLocation: string | null } | null;
  user: { id: number; fullName: string; memberCode: string | null };
  /** Chỉ có ở "đặt trước của tôi": thứ tự trong hàng đợi (0 nếu đã có sách giữ). */
  queuePosition?: number;
}

export interface AppNotification {
  id: number;
  type: string;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}
