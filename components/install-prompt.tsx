'use client';

import { useEffect, useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const DISMISS_KEY = 'laundry-install-dismissed-until';
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000;

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator && (navigator as Navigator & { standalone?: boolean }).standalone === true);
}

function isIos() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function useInstallPrompt() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [showSteps, setShowSteps] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setInstalled(isStandalone());
    setIos(isIos());
    setDismissed(Number(localStorage.getItem(DISMISS_KEY) ?? 0) > Date.now());

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    };
    const onAppInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
    };
    const displayMode = window.matchMedia('(display-mode: standalone)');
    const onDisplayModeChange = () => setInstalled(isStandalone());

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);
    displayMode.addEventListener?.('change', onDisplayModeChange);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
      displayMode.removeEventListener?.('change', onDisplayModeChange);
    };
  }, []);

  const kind = installed || dismissed ? null : promptEvent ? 'native' : ios ? 'ios' : null;

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_MS));
    setDismissed(true);
  }

  async function install() {
    if (!promptEvent || busy) return;
    setBusy(true);
    setPromptEvent(null);
    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === 'accepted') setInstalled(true);
      else dismiss();
    } catch {
      dismiss();
    } finally {
      setBusy(false);
    }
  }

  return { kind, busy, showSteps, setShowSteps, install, dismiss };
}

export function InstallPrompt({ prompt }: { prompt: ReturnType<typeof useInstallPrompt> }) {
  if (!prompt.kind) return null;

  return <section className="install-prompt" aria-label="앱 설치 안내">
    <div className="install-prompt-icon">{prompt.kind === 'native' ? <Download size={20} /> : <Smartphone size={20} />}</div>
    <div className="install-prompt-content">
      <strong>세탁실 앱으로 더 편하게</strong>
      <p>{prompt.kind === 'native' ? '홈 화면에 추가하면 QR과 세탁 상태를 빠르게 확인할 수 있어요.' : 'iPhone에서는 Safari 공유 메뉴에서 홈 화면에 추가할 수 있어요.'}</p>
      <button className="install-prompt-action" type="button" disabled={prompt.busy} onClick={prompt.kind === 'native' ? prompt.install : () => prompt.setShowSteps(!prompt.showSteps)}>
        {prompt.kind === 'native' ? prompt.busy ? '설치 창 여는 중…' : '앱 설치하기' : prompt.showSteps ? '방법 접기' : '설치 방법 보기'}
      </button>
      {prompt.kind === 'ios' && prompt.showSteps && <ol className="install-prompt-steps">
        <li>Safari에서 이 사이트를 엽니다.</li>
        <li>하단의 공유 버튼을 누릅니다.</li>
        <li>‘홈 화면에 추가’를 누르고 ‘추가’를 선택합니다.</li>
        <li>홈 화면에 생긴 앱을 열어 등록합니다.</li>
      </ol>}
    </div>
    <button className="install-prompt-close" type="button" onClick={prompt.dismiss} aria-label="설치 안내 닫기"><X size={18} /></button>
  </section>;
}
