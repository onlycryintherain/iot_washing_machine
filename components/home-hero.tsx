import type { WasherSummary } from '@/lib/washer/presentation';
import { WasherIllustration } from '@/components/washer-illustration';

export function HomeHero({ washers, loaded }: { washers: WasherSummary[]; loaded: boolean }) {
  const available = washers.filter((washer) => washer.state === 'IDLE').length;
  const using = washers.length - available;
  const running = washers.some((washer) => washer.state === 'RUNNING' || washer.state === 'MAYBE_FINISHED');
  const allBusy = loaded && washers.length > 0 && available === 0;
  return <section className="hero" aria-live="polite">
    <div className="hero-copy">
      <p className="hero-label">{allBusy ? '지금은 모두 사용 중이에요' : '지금 비어 있는 세탁기'}</p>
      <strong className="hero-number">{loaded ? available : '–'}<small>대</small></strong>
      <p className="hero-sub">{loaded ? `전체 ${washers.length}대 중 ${using}대 사용 중` : '상태를 불러오는 중이에요'}</p>
    </div>
    <div className="hero-art"><WasherIllustration state={running ? 'RUNNING' : 'IDLE'} size={136} onBlue /></div>
  </section>;
}
