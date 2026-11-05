import { request } from './client';
import type {
  Account,
  AccountSummary,
  Allocation,
  DepositResponse,
  Ipo,
  IpoSummary,
  LoginRequest,
  LoginResponse,
  PageResponse,
  SignUpRequest,
  SignUpResponse,
  Subscription,
  SubscriptionAccepted,
  SubscriptionCreateRequest,
  SubscriptionSummary,
} from './types';

export interface PageQuery {
  page?: number;
  size?: number; // 1~100
}

// 3.1 인증
export const signUp = (body: SignUpRequest) =>
  request<SignUpResponse>('/api/v1/users', { method: 'POST', body, auth: false });

export const login = (body: LoginRequest) =>
  request<LoginResponse>('/api/v1/auth/login', { method: 'POST', body, auth: false });

// 3.2 계좌
export const openAccount = (requestId: string) =>
  request<Account>('/api/v1/accounts', { method: 'POST', body: { requestId } });

export const listAccounts = (q: PageQuery = {}) =>
  request<PageResponse<AccountSummary>>('/api/v1/accounts', { query: { ...q } });

export const getAccount = (accountId: string) =>
  request<Account>(`/api/v1/accounts/${encodeURIComponent(accountId)}`);

export const deposit = (accountId: string, body: { requestId: string; amount: number }) =>
  request<DepositResponse>(`/api/v1/accounts/${encodeURIComponent(accountId)}/deposits`, {
    method: 'POST',
    body,
  });

// 3.3 공모주
export const listIpos = (q: PageQuery = {}) =>
  request<PageResponse<IpoSummary>>('/api/v1/ipos', { query: { ...q } });

export const getIpo = (ipoId: string) => request<Ipo>(`/api/v1/ipos/${encodeURIComponent(ipoId)}`);

// 3.4 청약
export const createSubscription = (body: SubscriptionCreateRequest) =>
  request<SubscriptionAccepted>('/api/v1/subscriptions', { method: 'POST', body });

export const listSubscriptions = (q: PageQuery = {}) =>
  request<PageResponse<SubscriptionSummary>>('/api/v1/subscriptions', { query: { ...q } });

export const getSubscription = (subscriptionId: string) =>
  request<Subscription>(`/api/v1/subscriptions/${encodeURIComponent(subscriptionId)}`);

// 3.5 배정
export const getAllocation = (subscriptionId: string) =>
  request<Allocation>(`/api/v1/allocations/subscriptions/${encodeURIComponent(subscriptionId)}`);
