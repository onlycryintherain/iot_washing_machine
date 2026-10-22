import { useId } from 'react';
import type { WasherState } from '@/lib/washer/state-machine';
import { washerPresentation } from '@/lib/washer/presentation';

type Props = {
  state: WasherState;
  size?: number;
  /** Draws the machine in white on a saturated background (the home hero). */
  onBlue?: boolean;
  label?: string;
};

// The drum keeps moving while the end of a cycle is still unconfirmed, since activity may resume.
const moving = new Set<WasherState>(['RUNNING', 'MAYBE_FINISHED']);

export function WasherIllustration({ state, size = 160, onBlue = false, label }: Props) {
  const id = useId();
  const tone = washerPresentation(state).tone;
  const finished = state === 'FINISHED';
  const needsPickup = state === 'WAITING_FOR_PICKUP';
  const water = moving.has(state) ? 'high' : finished || needsPickup ? 'low' : 'none';
  const wave = 'M0 94q10-8 20 0t20 0t20 0t20 0t20 0t20 0t20 0t20 0t20 0t20 0V140H0Z';

  return <svg
    className={`wm ${onBlue ? 'on-blue' : tone} ${moving.has(state) ? 'is-moving' : ''}`}
    viewBox="0 0 160 160" width={size} height={size}
    role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}
  >
    <defs><clipPath id={`${id}-glass`}><circle cx="80" cy="94" r="29" /></clipPath></defs>
    <ellipse className="wm-shadow" cx="80" cy="152" rx="46" ry="5" />
    <g className="wm-body">
      <rect className="wm-case" x="26" y="14" width="108" height="132" rx="22" />
      <path className="wm-panel" d="M26 36a22 22 0 0 1 22-22h64a22 22 0 0 1 22 22v10H26Z" />
      <circle className="wm-dot accent" cx="44" cy="30" r="4" />
      <circle className="wm-dot" cx="58" cy="30" r="4" />
      <rect className="wm-display" x="94" y="23" width="30" height="14" rx="7" />
      <circle className={`wm-door-pulse ${state === 'RESERVED' ? 'on' : ''}`} cx="80" cy="94" r="38" />
      <circle className="wm-ring" cx="80" cy="94" r="38" />
      <circle className="wm-glass" cx="80" cy="94" r="29" />
      <g clipPath={`url(#${id}-glass)`}>
        <g className={`wm-water ${water}`}><path className="wm-wave" d={wave} /></g>
        <g className="wm-spin"><rect className="wm-cloth" x="68" y="86" width="20" height="11" rx="5.5" /></g>
        <circle className="wm-bubble b1" cx="68" cy="118" r="3" />
        <circle className="wm-bubble b2" cx="84" cy="121" r="2.5" />
        <circle className="wm-bubble b3" cx="95" cy="117" r="3.5" />
      </g>
      <path className="wm-shine" d="M62 82a22 22 0 0 1 14-10" />
    </g>
    <rect className="wm-foot" x="38" y="146" width="18" height="6" rx="3" />
    <rect className="wm-foot" x="104" y="146" width="18" height="6" rx="3" />
    {(finished || needsPickup) && <g className={`wm-badge ${needsPickup ? 'warn' : ''}`}>
      <circle cx="128" cy="26" r="15" />
      {needsPickup
        ? <path d="M128 19v9M128 33v.5" />
        : <path d="m121 26 5 5 9-10" />}
    </g>}
  </svg>;
}
