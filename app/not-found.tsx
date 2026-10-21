import Link from 'next/link';

export default function NotFound() {
  return <div className="app-startup">
    <h1>페이지를 찾을 수 없어요</h1>
    <span>주소를 확인하거나 홈에서 세탁기를 선택해주세요.</span>
    <Link className="button" href="/">홈으로</Link>
  </div>;
}
