'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Download, Printer } from 'lucide-react';

type Washer = { id: string; name: string };

export function WasherQrCards({ washers }: { washers: Washer[] }) {
  const [origin, setOrigin] = useState('');
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [error, setError] = useState('');

  useEffect(() => setOrigin(window.location.origin), []);

  useEffect(() => {
    if (!origin || !washers.length) return;
    let cancelled = false;
    Promise.all(washers.map(async (washer) => {
      const url = `${origin}/washer/${encodeURIComponent(washer.id)}`;
      const dataUrl = await QRCode.toDataURL(url, {
        width: 720,
        margin: 2,
        errorCorrectionLevel: 'H',
        color: { dark: '#17211b', light: '#ffffff' },
      });
      return [washer.id, dataUrl] as const;
    })).then((entries) => {
      if (!cancelled) {
        setCodes(Object.fromEntries(entries));
        setError('');
      }
    }).catch(() => {
      if (!cancelled) setError('QR 코드를 만들지 못했습니다. 페이지를 새로고침해 주세요.');
    });
    return () => { cancelled = true; };
  }, [origin, washers]);

  function download(washer: Washer) {
    const dataUrl = codes[washer.id];
    if (!dataUrl) return;
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `laundry-${washer.id}-qr.png`;
    link.click();
  }

  return <section className="qr-generator section">
    <div className="section-head qr-screen-only">
      <div><h2>세탁기 QR 코드</h2><p className="lead">인쇄해 각 세탁기 앞에 붙이세요. 사용자는 설치된 앱의 QR 스캔 화면에서 세탁기를 찾을 수 있어요.</p></div>
    </div>
    <div className="qr-help qr-screen-only"><strong>사용자는 이렇게 이용해요</strong><span>① 앱 설치</span><span>② 앱에서 QR 스캔</span><span>③ 사용 등록</span></div>
    {error && <p className="error qr-screen-only">{error}</p>}
    <div className="qr-print-grid">
      {washers.map((washer) => <article className="qr-print-card" key={washer.id}>
        <p className="qr-card-kicker">기숙사 공용 세탁실</p>
        <h3>{washer.name}</h3>
        {codes[washer.id] ? <img className="qr-image" src={codes[washer.id]} alt={`${washer.name} 이용 페이지 QR 코드`} /> : <div className="qr-placeholder" aria-label="QR 코드 생성 중">QR 생성 중…</div>}
        <p className="qr-instruction">‘세탁실’ 앱의 QR 스캔 화면에서 스캔하세요.</p>
        <p className="qr-short-url">{origin}/washer/{washer.id}</p>
        <button className="button small secondary qr-screen-only" disabled={!codes[washer.id]} onClick={() => download(washer)}><Download size={15}/> QR 이미지 저장</button>
      </article>)}
    </div>
    <div className="qr-toolbar qr-screen-only">
      <button className="button" disabled={!washers.length || washers.some((washer) => !codes[washer.id])} onClick={() => window.print()}><Printer size={17}/> QR 안내 카드 인쇄</button>
      <p className="muted">인쇄된 카드는 QR이 선명하도록 원본 크기로 출력해 주세요.</p>
    </div>
  </section>;
}
