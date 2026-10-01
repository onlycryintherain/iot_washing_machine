import Image from 'next/image';

export default function Loading() {
  return <div className="app-startup" role="status" aria-label="화면을 여는 중">
    <Image src="/icons/brand-mark.png" alt="" width={96} height={96} className="startup-logo" unoptimized />
    <span>세탁실을 여는 중…</span>
  </div>;
}
