import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 20, ...rest }: P) {
  return { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true, focusable: false, ...rest };
}

export const IconCheck = (p: P) => (<svg {...base(p)}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>);
export const IconPlus = (p: P) => (<svg {...base(p)}><path d="M12 5v14M5 12h14" /></svg>);
export const IconMinus = (p: P) => (<svg {...base(p)}><path d="M5 12h14" /></svg>);
export const IconClose = (p: P) => (<svg {...base(p)}><path d="M6 6l12 12M18 6L6 18" /></svg>);
export const IconArrow = (p: P) => (<svg {...base(p)} className={`arrow ${p.className ?? ''}`}><path d="M5 12h14M13 6l6 6-6 6" /></svg>);
export const IconBack = (p: P) => (<svg {...base(p)}><path d="M15 5l-7 7 7 7" /></svg>);
export const IconPrev = (p: P) => (<svg {...base(p)}><path d="M15 5l-7 7 7 7" /></svg>);
export const IconNext = (p: P) => (<svg {...base(p)}><path d="M9 5l7 7-7 7" /></svg>);
export const IconSpinner = (p: P) => (
  <svg {...base(p)} className={`spin ${p.className ?? ''}`}>
    <circle cx="12" cy="12" r="9" strokeOpacity="0.25" />
    <path d="M21 12a9 9 0 0 0-9-9" />
  </svg>
);
export const IconIpo = (p: P) => (<svg {...base(p)}><path d="M3 17l6-6 4 4 8-8M15 7h6v6" /></svg>);
export const IconReceipt = (p: P) => (<svg {...base(p)}><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3zM9 8h6M9 12h6" /></svg>);
export const IconWallet = (p: P) => (<svg {...base(p)}><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H18v3M3 7.5V18a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2H5.5A2.5 2.5 0 0 1 3 7.5zM16.5 14h1" /></svg>);
