import { crowdLevel, kstHour, type CrowdLevel } from '@/lib/stats/overview';
import type { Overview } from '@/components/use-overview';

const crowdText: Record<CrowdLevel, string> = {
  quiet: '지금은 한산한 시간대예요',
  normal: '지금은 보통 시간대예요',
  busy: '지금은 붐비는 시간대예요',
  unknown: '이용 기록이 쌓이면 시간대별 혼잡도를 보여드려요',
};

export function TodayTile({ overview }: { overview: Overview | null }) {
  return <div className="summary-item">
    <span className="summary-label">오늘 이용</span>
    <strong className="summary-value">{overview ? overview.today.count : '–'}<small>회</small></strong>
    <span className="summary-note">{overview?.today.avgMinutes != null ? `평균 ${overview.today.avgMinutes}분` : '아직 끝난 세탁이 없어요'}</span>
  </div>;
}

export function CrowdChart({ overview, now = new Date() }: { overview: Overview | null; now?: Date }) {
  const hour = kstHour(now);
  const counts = overview?.hourly ?? [];
  const level = overview ? crowdLevel(counts, hour) : 'unknown';
  const max = Math.max(1, ...counts);
  return <section className="panel" aria-label="시간대별 혼잡도">
    <div className="panel-head"><h2>시간대별 혼잡도</h2><span className="panel-note">최근 30일</span></div>
    <p className={`crowd-level ${level}`}>{overview ? crowdText[level] : '불러오는 중이에요'}</p>
    {level !== 'unknown' && <>
      <div className="crowd-bars" role="img" aria-label={`${hour}시 기준 ${crowdText[level]}`}>
        {counts.map((count, index) => <span key={index} className={`crowd-bar${index === hour ? ' now' : ''}`} style={{ height: `${Math.max(6, (count / max) * 100)}%` }} />)}
      </div>
      <div className="crowd-axis" aria-hidden="true"><span>0시</span><span>6시</span><span>12시</span><span>18시</span><span>24시</span></div>
    </>}
  </section>;
}

function dateLabel(iso: string) {
  const date = new Date(iso);
  const day = date.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', timeZone: 'Asia/Seoul' });
  const time = date.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Seoul' });
  return `${day} ${time}`;
}

export function HistoryList({ overview }: { overview: Overview | null }) {
  return <section className="panel" aria-label="내 세탁 기록">
    <div className="panel-head"><h2>내 세탁 기록</h2></div>
    {overview && overview.history.length === 0 && <p className="panel-empty">아직 세탁 기록이 없어요. 첫 세탁이 끝나면 여기에 쌓여요.</p>}
    {overview && overview.history.length > 0 && <ul className="history">
      {overview.history.map((item) => <li key={item.id}>
        <span className="history-main"><strong>{item.washerName}</strong><span>{dateLabel(item.startedAt)}</span></span>
        <span className="history-minutes">{item.minutes != null ? `${item.minutes}분` : '진행 중'}</span>
      </li>)}
    </ul>}
  </section>;
}
