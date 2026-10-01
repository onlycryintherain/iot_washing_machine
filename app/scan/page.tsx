'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Camera, CameraOff, ArrowLeft } from 'lucide-react';
import { BrandLogo } from '@/components/brand-logo';

export default function ScanPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const runningRef = useRef(false);
  const mountedRef = useRef(false);
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const stopCamera = useCallback(() => {
    runningRef.current = false;
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setActive(false);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopCamera();
    };
  }, [stopCamera]);

  async function startCamera() {
    if (busy || runningRef.current) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('이 기기에서 카메라를 사용할 수 없습니다. 홈에서 세탁기를 선택해주세요.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' } } });
      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      video.srcObject = stream;
      await video.play();
      runningRef.current = true;
      setActive(true);

      let lastScan = 0;
      const scanFrame = (time: number) => {
        if (!runningRef.current) return;
        if (time - lastScan >= 150 && video.videoWidth && video.videoHeight) {
          lastScan = time;
          const canvas = canvasRef.current;
          const context = canvas?.getContext('2d', { willReadFrequently: true });
          if (canvas && context) {
            const scale = Math.min(1, 640 / video.videoWidth);
            canvas.width = Math.round(video.videoWidth * scale);
            canvas.height = Math.round(video.videoHeight * scale);
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            const image = context.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(image.data, image.width, image.height, { inversionAttempts: 'dontInvert' });
            if (code) {
              let path = '';
              try {
                const url = new URL(code.data);
                if (url.origin === window.location.origin && /^\/washer\/[^/]+$/.test(url.pathname)) path = url.pathname;
              } catch {
                path = '';
              }
              stopCamera();
              if (path) router.push(path);
              else setError('세탁기 QR 코드가 아닙니다. 세탁기에 붙은 QR을 다시 스캔해주세요.');
              return;
            }
          }
        }
        frameRef.current = requestAnimationFrame(scanFrame);
      };
      frameRef.current = requestAnimationFrame(scanFrame);
    } catch {
      stopCamera();
      setError('카메라를 열지 못했습니다. 카메라 권한을 허용하거나 홈에서 세탁기를 선택해주세요.');
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  }

  return <>
    <div className="topline"><Link className="back" href="/" aria-label="홈으로 돌아가기"><ArrowLeft size={20} /></Link><BrandLogo /></div>
    <h1>세탁기 QR 스캔</h1>
    <p className="lead">세탁기에 붙은 QR을 앱 카메라로 비추면 해당 세탁기로 이동합니다.</p>
    <div className="scan-preview">
      <video ref={videoRef} playsInline muted aria-label="QR 스캔 카메라" />
      {!active && <div className="scan-placeholder"><Camera size={32} /><span>카메라를 켜고 QR을 비춰주세요</span></div>}
      {active && <div className="scan-target" aria-hidden="true" />}
    </div>
    <canvas ref={canvasRef} hidden aria-hidden="true" />
    {error && <p className="error" role="alert">{error}</p>}
    <button className="button scan-action" type="button" disabled={busy} onClick={active ? stopCamera : startCamera}>
      {active ? <CameraOff size={19} /> : <Camera size={19} />}{busy ? '카메라 여는 중…' : active ? '스캔 중지' : 'QR 스캔 시작'}
    </button>
  </>;
}
