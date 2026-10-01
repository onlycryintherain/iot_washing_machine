'use client';

import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import Image from 'next/image';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

type Platform = 'ios' | 'android' | 'other';

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator && (navigator as Navigator & { standalone?: boolean }).standalone === true);
}

function getPlatform(): Platform {
  if (/iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/i.test(navigator.userAgent)) return 'android';
  return 'other';
}

export function useInstallPrompt() {
  const [ready, setReady] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [platform, setPlatform] = useState<Platform>('other');
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [justInstalled, setJustInstalled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setStandalone(isStandalone());
    setPlatform(getPlatform());
    setReady(true);

    const onBeforeInstallPrompt = (event: Event) => {
      if (getPlatform() === 'other') return;
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    };
    const onAppInstalled = () => {
      setJustInstalled(true);
      setPromptEvent(null);
    };
    const displayMode = window.matchMedia('(display-mode: standalone)');
    const onDisplayModeChange = () => setStandalone(isStandalone());

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);
    displayMode.addEventListener?.('change', onDisplayModeChange);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
      displayMode.removeEventListener?.('change', onDisplayModeChange);
    };
  }, []);

  async function install() {
    if (!promptEvent || busy) return;
    setBusy(true);
    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === 'accepted') setJustInstalled(true);
    } catch {
      // The browser may invalidate a deferred prompt; show its menu instructions instead.
    } finally {
      setPromptEvent(null);
      setBusy(false);
    }
  }

  return { ready, standalone, platform, canPrompt: !!promptEvent, justInstalled, busy, install };
}

export function InstallGate({ prompt }: { prompt: ReturnType<typeof useInstallPrompt> }) {
  return <div className="onboarding-backdrop">
    <section className="onboarding-card install-gate-card" aria-labelledby="install-gate-title">
      <div className="onboarding-icon"><Image src="/icons/brand-mark.png" alt="" width={40} height={40} unoptimized /></div>
      <p className="brand">기숙사 세탁실</p>
      <h1 id="install-gate-title">앱 설치 후 이용하세요</h1>
      <p className="lead">설치가 끝나면 홈 화면의 ‘세탁실’ 아이콘을 눌러 앱을 열어주세요.</p>

      {prompt.canPrompt && !prompt.justInstalled && <button className="button install-gate-action" type="button" onClick={prompt.install} disabled={prompt.busy}>
        <Download size={18} />{prompt.busy ? '설치 창 여는 중…' : '앱 설치하기'}
      </button>}

      {prompt.platform === 'ios' && <div className="install-gate-instructions">
        <strong>iPhone · iPad 설치 방법</strong>
        <ol>
          <li>Safari에서 이 사이트를 엽니다.</li>
          <li>공유 버튼을 누르고 ‘홈 화면에 추가’를 선택합니다.</li>
          <li>‘웹 앱으로 열기’를 켜고 ‘추가’를 누릅니다.</li>
        </ol>
      </div>}

      {prompt.platform === 'android' && !prompt.canPrompt && !prompt.justInstalled && <div className="install-gate-instructions">
        <strong>Android 설치 방법</strong>
        <p>Chrome의 메뉴(⋮)에서 ‘앱 설치’ 또는 ‘홈 화면에 추가’를 선택해주세요.</p>
      </div>}

      {prompt.justInstalled && <p className="install-gate-success" role="status">설치가 완료되었습니다. 홈 화면 또는 앱 목록에서 ‘세탁실’을 열어주세요.</p>}
      <p className="install-gate-footer">이미 설치했다면 브라우저 탭을 닫고 앱 아이콘으로 다시 열어주세요.</p>
    </section>
  </div>;
}
