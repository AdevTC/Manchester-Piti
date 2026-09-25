// Stroke icons drawn for the vestuario design (same paths as the Design canvas).
const PATHS = {
  home: <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z" />,
  cal: (<><rect x="3" y="4" width="18" height="18" rx="4" /><path d="M16 2v4M8 2v4M3 10h18" /></>),
  stats: (<><path d="M3 3v18h18" /><path d="m7 15 4-4 3 3 5-6" /></>),
  team: (<><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18.5 14a6 6 0 0 1 3 6" /></>),
  user: (<><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>),
  shield: <path d="M12 2 4 5v6c0 5 3.4 9.3 8 11 4.6-1.7 8-6 8-11V5Z" />,
  arrow: <path d="M7 17 17 7M8 7h9v9" />,
  send: <path d="M5 12h14M13 6l6 6-6 6" />,
  check: <path d="M20 6 9 17l-5-5" />,
  share: (<><path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" /><path d="M16 6l-4-4-4 4M12 2v14" /></>),
  ball: (<><circle cx="12" cy="12" r="9" /><path d="m12 7 4 3-1.5 4.5h-5L8 10Z" /></>),
  boot: (<><path d="M3 16h18v3H3z" /><path d="M4 16V6h6v4l10 3v3" /></>),
  star: <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z" />,
  crown: <path d="M3 8l4 4 5-7 5 7 4-4-2 11H5Z" />,
  flame: <path d="M12 22c4 0 7-3 7-7 0-5-5-7-5-12-3 2-5 5-5 8-1-1-2-2-2-4-2 2-2 5-2 8 0 4 3 7 7 7Z" />,
  lock: (<><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>),
  turn: (<><path d="M3 12a9 9 0 0 1 15.5-6.3L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-15.5 6.3L3 16" /><path d="M3 21v-5h5" /></>),
  logout: (<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5M21 12H9" /></>),
  plus: <path d="M12 5v14M5 12h14" />,
  down: <path d="m6 9 6 6 6-6" />,
  left: <path d="m15 6-6 6 6 6" />,
  pause: (<><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></>),
  play: <path d="M7 5v14l12-7Z" />,
  right: <path d="m9 6 6 6-6 6" />,
  flag: <path d="M5 21V4M5 4h11l-2 4 2 4H5" />,
  shuffle: <path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />,
  calPlus: (<><rect x="3" y="4" width="18" height="18" rx="4" /><path d="M16 2v4M8 2v4M3 10h18M12 13v6M9 16h6" /></>),
  padlock: (<><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>),
  radio: (<><circle cx="12" cy="12" r="2" /><path d="M16.2 7.8a6 6 0 0 1 0 8.4M7.8 16.2a6 6 0 0 1 0-8.4M19 5a10 10 0 0 1 0 14M5 19A10 10 0 0 1 5 5" /></>),
  x: <path d="M18 6 6 18M6 6l12 12" />,
  shirt: <path d="M8 3 3 6l2 5 2-1v11h10V10l2 1 2-5-5-3a4 4 0 0 1-8 0Z" />,
  search: (<><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>),
  swap: <path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" />,
  cake: (<><path d="M4 21h16v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2Z" /><path d="M4 16c2 1.5 4 1.5 6 0s4-1.5 6 0 3 1 4 .5M12 11V7" /></>),
};
export type IconName = keyof typeof PATHS;
export function Icon({ name, size = 20, stroke = 1.8 }: { name: IconName; size?: number; stroke?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}
