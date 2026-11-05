import { describe, expect, it } from 'vitest';
import { ipoPhase, progressStep, requiredMargin } from './domain';
import { remaining, won } from './format';

const ipo = (status: 'OPEN' | 'CLOSED' | 'ALLOCATED') => ({
  status,
  subscriptionStartAt: '2026-11-05T10:00:00+09:00',
  subscriptionEndAt: '2026-11-06T16:00:00+09:00',
});

describe('ipoPhase', () => {
  it('OPEN이라도 시작 전이면 청약 예정', () => {
    expect(ipoPhase(ipo('OPEN'), new Date('2026-11-05T00:59:59Z'))).toBe('UPCOMING');
  });
  it('시작 시각부터 청약 중 (start <= now)', () => {
    expect(ipoPhase(ipo('OPEN'), new Date('2026-11-05T01:00:00Z'))).toBe('OPEN_NOW');
  });
  it('마감 시각이 되면 청약 중이 아니다 (now < end)', () => {
    expect(ipoPhase(ipo('OPEN'), new Date('2026-11-06T07:00:00Z'))).toBe('CLOSED');
  });
  it('서버 상태가 CLOSED, ALLOCATED면 시각과 관계없이 그대로', () => {
    expect(ipoPhase(ipo('CLOSED'), new Date('2026-11-05T05:00:00Z'))).toBe('CLOSED');
    expect(ipoPhase(ipo('ALLOCATED'), new Date('2026-11-05T05:00:00Z'))).toBe('ALLOCATED');
  });
});

describe('requiredMargin', () => {
  it('청약 수량 x 공모가 x 증거금률 (명세 예시: 100주 x 15,000원 x 1.00 = 1,500,000)', () => {
    expect(requiredMargin(100, 15000, 1)).toBe(1_500_000);
  });
  it('증거금률이 100%가 아니어도 원 단위 정수', () => {
    expect(requiredMargin(101, 15000, 0.5)).toBe(757_500);
  });
});

describe('progressStep', () => {
  it('상태별 진행 단계', () => {
    expect(progressStep('PENDING')).toBe(1);
    expect(progressStep('REJECTED')).toBe(1);
    expect(progressStep('CONFIRMED')).toBe(2);
    expect(progressStep('ALLOCATED')).toBe(3);
    expect(progressStep('REFUNDED')).toBe(4);
  });
});

describe('format', () => {
  it('남은 시간', () => {
    expect(remaining(0)).toBe('00:00:00');
    expect(remaining(-5)).toBe('00:00:00');
    expect(remaining(((4 * 60 + 12) * 60 + 36) * 1000)).toBe('04:12:36');
    expect(remaining((86400 + 3600) * 1000)).toBe('1일 01:00:00');
  });
  it('금액 쉼표', () => {
    expect(won(1500000)).toBe('1,500,000');
  });
});
