'use client';

import Link from 'next/link';

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className="app-startup" role="alert">
    <h1>문제가 발생했어요</h1>
    <span>잠시 후 다시 시도해주세요.</span>
    <button className="button" type="button" onClick={reset}>다시 시도</button>
    <Link className="text-link" href="/">홈으로</Link>
  </div>;
}
