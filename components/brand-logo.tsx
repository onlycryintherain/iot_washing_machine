import Image from 'next/image';

export function BrandLogo() {
  return <span className="brand brand-lockup">
    <Image src="/icons/brand-mark.png" alt="" width={32} height={32} className="brand-symbol" unoptimized />
    <span>기숙사 세탁실</span>
  </span>;
}
