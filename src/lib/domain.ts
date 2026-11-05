import type { CancelReason, IpoSummary, RejectReason, SubscriptionStatus } from '../api/types';

/**
 * 화면 표시용 단계. 서버 상태값(OPEN/CLOSED/ALLOCATED)에 청약 기간을 함께 본다.
 * API 명세: "OPEN 상태라도 청약 시작 전이거나 마감 시각이 지나면 청약 신청이 불가능".
 * 서버의 마감 판단은 게이트웨이 도착 시각 기준이라, 여기 판단은 버튼 노출용일 뿐 최종 판정은 서버 응답(422 SUBSCRIPTION_CLOSED)이다.
 */
export type IpoPhase = 'UPCOMING' | 'OPEN_NOW' | 'CLOSED' | 'ALLOCATED';

export function ipoPhase(ipo: Pick<IpoSummary, 'status' | 'subscriptionStartAt' | 'subscriptionEndAt'>, now: Date): IpoPhase {
  if (ipo.status === 'ALLOCATED') return 'ALLOCATED';
  if (ipo.status === 'CLOSED') return 'CLOSED';
  const t = now.getTime();
  if (t < Date.parse(ipo.subscriptionStartAt)) return 'UPCOMING';
  if (t >= Date.parse(ipo.subscriptionEndAt)) return 'CLOSED'; // 마감 시각은 지났지만 서버 상태가 아직 OPEN
  return 'OPEN_NOW';
}

export const IPO_PHASE_LABEL: Record<IpoPhase, string> = {
  UPCOMING: '청약 예정',
  OPEN_NOW: '청약 중',
  CLOSED: '마감',
  ALLOCATED: '배정 완료',
};

export const SUBSCRIPTION_STATUS_LABEL: Record<SubscriptionStatus, string> = {
  PENDING: '접수됨',
  CONFIRMED: '확정',
  REJECTED: '거절',
  COMPENSATING: '보상 중',
  CANCEL_REQUESTED: '취소 요청',
  CANCELLED: '취소됨',
  ALLOCATED: '배정 완료',
  REFUNDED: '환불 완료',
};

export const REJECT_REASON_LABEL: Record<RejectReason, string> = {
  ALREADY_SUBSCRIBED: '이미 청약한 종목 (이중청약)',
  INSUFFICIENT_BALANCE: '예수금 부족',
  ACCOUNT_NOT_FOUND: '계좌를 찾을 수 없음',
};

export const CANCEL_REASON_LABEL: Record<CancelReason, string> = {
  CONFIRM_FAILED: '청약 확정 실패로 증거금 반환',
  TIMEOUT: '처리 시간 초과로 증거금 반환',
  USER_CANCEL: '투자자 취소',
};

/** 서버가 아직 처리 중인 상태: 상세 화면이 짧은 간격으로 다시 조회한다 */
export const IN_FLIGHT: SubscriptionStatus[] = ['PENDING', 'COMPENSATING', 'CANCEL_REQUESTED'];

/** 배정 결과가 있는 상태: 배정 결과 조회 API를 부른다 */
export const HAS_ALLOCATION: SubscriptionStatus[] = ['ALLOCATED', 'REFUNDED'];

/** 필요 증거금 = 청약 수량 x 공모가 x 증거금률 (원 단위 정수) */
export function requiredMargin(quantity: number, offerPrice: number, marginRate: number): number {
  return Math.round(quantity * offerPrice * marginRate);
}

/** 진행 단계 수: 접수 1, 확정 2, 배정 3, 환불 4 */
export function progressStep(status: SubscriptionStatus): number {
  switch (status) {
    case 'REFUNDED':
      return 4;
    case 'ALLOCATED':
      return 3;
    case 'CONFIRMED':
    case 'CANCEL_REQUESTED':
      return 2;
    default:
      return 1;
  }
}

export const isFailed = (s: SubscriptionStatus) => s === 'REJECTED' || s === 'CANCELLED' || s === 'COMPENSATING';
