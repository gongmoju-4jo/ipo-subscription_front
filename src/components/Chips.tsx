import type { SubscriptionStatus } from '../api/types';
import { IPO_PHASE_LABEL, SUBSCRIPTION_STATUS_LABEL, type IpoPhase } from '../lib/domain';

const PHASE_CLASS: Record<IpoPhase, string> = {
  OPEN_NOW: 'chip-open',
  UPCOMING: 'chip-upcoming',
  CLOSED: 'chip-closed',
  ALLOCATED: 'chip-done',
};

export function PhaseChip({ phase }: { phase: IpoPhase }) {
  return <span className={`chip ${PHASE_CLASS[phase]}`}>{IPO_PHASE_LABEL[phase]}</span>;
}

const STATUS_CLASS: Record<SubscriptionStatus, string> = {
  PENDING: 'chip-pending',
  CONFIRMED: 'chip-soft',
  ALLOCATED: 'chip-open',
  REFUNDED: 'chip-done',
  REJECTED: 'chip-warn',
  COMPENSATING: 'chip-warn',
  CANCEL_REQUESTED: 'chip-warn',
  CANCELLED: 'chip-closed',
};

export function StatusChip({ status, large = false }: { status: SubscriptionStatus; large?: boolean }) {
  return (
    <span className={`chip ${STATUS_CLASS[status]}${large ? ' chip-lg' : ''}`}>
      {SUBSCRIPTION_STATUS_LABEL[status]}
      {large && <span className="mono" style={{ fontWeight: 400, opacity: 0.8 }}> {status}</span>}
    </span>
  );
}
