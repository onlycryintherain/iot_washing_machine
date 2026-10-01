import type { Metadata,Viewport } from 'next';import './globals.css';import { AppFrame } from '@/components/app-frame';
export const metadata:Metadata={title:'기숙사 세탁실',description:'기숙사 공용 세탁기 상태를 확인하고 완료 알림을 받아보세요.',manifest:'/manifest.webmanifest',icons:{apple:'/apple-touch-icon.png'},appleWebApp:{capable:true,statusBarStyle:'default',title:'세탁실'}};
export const viewport:Viewport={themeColor:'#f2f4f6',width:'device-width',initialScale:1,viewportFit:'cover'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="ko"><body><AppFrame>{children}</AppFrame></body></html>}
