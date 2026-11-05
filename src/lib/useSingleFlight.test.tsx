import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { useSingleFlight } from './useSingleFlight';

function setup() {
  let flight!: ReturnType<typeof useSingleFlight>;
  function Probe() {
    flight = useSingleFlight();
    return null;
  }
  renderToStaticMarkup(<Probe />);
  return flight;
}

describe('useSingleFlight', () => {
  it('진행 중인 동안의 두 번째 호출(더블클릭)은 실행하지 않는다', async () => {
    const flight = setup();
    let runs = 0;
    let release!: () => void;
    const slow = () => new Promise<void>((r) => { runs += 1; release = r; });

    const first = flight(slow);
    void flight(slow); // 렌더를 거치지 않은 즉시 두 번째 클릭
    expect(runs).toBe(1);
    release();
    await first;
  });

  it('끝나면 다시 실행할 수 있다 (실패해도)', async () => {
    const flight = setup();
    let runs = 0;
    await flight(async () => { runs += 1; });
    await flight(async () => { runs += 1; }).catch(() => undefined);
    await flight(() => { runs += 1; return Promise.reject(new Error('x')); }).catch(() => undefined);
    await flight(async () => { runs += 1; });
    expect(runs).toBe(4);
  });
});
