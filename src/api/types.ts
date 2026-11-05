// 백엔드 응답 DTO와 같은 모양. 필드 이름은 각 서비스 presentation 계층의 record를 그대로 따른다.

export interface ApiErrorDetail {
  field: string;
  reason: string;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: ApiErrorDetail[];
}

export interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: ApiErrorBody;
}

export interface PageResponse<T> {
  items: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

// 회원, 인증 (account-service)
export interface SignUpRequest {
  loginId: string;
  password: string;
  name: string;
}
export interface SignUpResponse {
  userId: string;
  loginId: string;
  name: string;
  createdAt: string;
}
export interface LoginRequest {
  loginId: string;
  password: string;
}
export interface LoginResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
}

// 계좌 (account-service)
export interface AccountSummary {
  accountId: string;
  accountNumber: string;
  cashBalance: number;
  marginBalance: number;
  createdAt: string;
}
export interface Account extends AccountSummary {
  userId: string;
}
export interface DepositResponse {
  depositId: string;
  accountId: string;
  amount: number;
  cashBalance: number;
  marginBalance: number;
  createdAt: string;
}

// 공모주 (subscription-service)
export type IpoStatus = 'OPEN' | 'CLOSED' | 'ALLOCATED';

export interface IpoSummary {
  ipoId: string;
  name: string;
  offerPrice: number;
  retailQuantity: number;
  subscriptionStartAt: string;
  subscriptionEndAt: string;
  status: IpoStatus;
}
export interface Ipo extends IpoSummary {
  equalQuantity: number;
  minQuantity: number;
  maxQuantity: number;
  marginRate: number;
  refundDate: string;
}

// 청약 (subscription-service)
export type SubscriptionStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'REJECTED'
  | 'COMPENSATING'
  | 'CANCEL_REQUESTED'
  | 'CANCELLED'
  | 'ALLOCATED'
  | 'REFUNDED';
export type RejectReason = 'ALREADY_SUBSCRIBED' | 'INSUFFICIENT_BALANCE' | 'ACCOUNT_NOT_FOUND';
export type CancelReason = 'CONFIRM_FAILED' | 'TIMEOUT' | 'USER_CANCEL';

export interface SubscriptionCreateRequest {
  requestId: string;
  ipoId: string;
  accountId: string;
  requestedQuantity: number;
}
export interface SubscriptionAccepted {
  subscriptionId: string;
  requestId: string;
  status: 'ACCEPTED';
  statusUrl: string;
}
export interface SubscriptionSummary {
  subscriptionId: string;
  ipoId: string;
  ipoName: string;
  accountId: string;
  requestedQuantity: number;
  marginAmount: number;
  status: SubscriptionStatus;
  receivedAt: string;
  confirmedAt: string | null;
}
export interface Subscription extends SubscriptionSummary {
  requestId: string;
  rejectReason: RejectReason | null;
  cancelReason: CancelReason | null;
  allocatedQuantity: number | null;
  allocatedAmount: number | null;
  refundAmount: number | null;
}

// 배정 (allocation-service)
// 명세 3.5: 배정 진행 중(RUNNING)이면 수량 필드가 없다. 현재 allocation-service 코드는 status를 내리지 않고
// 배정이 끝나기 전에는 404를 주므로 둘 다 받을 수 있게 optional로 둔다.
export interface Allocation {
  ipoId: string;
  subscriptionId: string;
  status?: 'RUNNING' | 'DONE';
  equalAllocatedQuantity?: number;
  proportionalAllocatedQuantity?: number;
  allocatedQuantity?: number;
  allocatedAmount?: number;
}
