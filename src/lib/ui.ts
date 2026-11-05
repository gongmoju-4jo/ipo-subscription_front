import type { CSSProperties } from 'react';

/** 목록이 나타날 때 항목마다 조금씩 늦게 올라오게 하는 순서 값 (.rise 와 함께 쓴다) */
export const stagger = (index: number): CSSProperties => ({ '--i': Math.min(index, 12) }) as CSSProperties;
