'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { MessageCircle, Send, X } from 'lucide-react';
import { suggestedQuestions, type AssistantReply } from '@/lib/assistant/answers';

type Message = { id: number; from: 'user' | 'bot'; text: string; links?: AssistantReply['links'] };

const greeting: Message = { id: 0, from: 'bot', text: '안녕하세요, 세탁실 도우미예요. 아래 질문을 눌러 보세요.' };

export function ChatAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([greeting]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const nextId = useRef(1);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) bottom.current?.scrollIntoView({ block: 'end' });
  }, [open, messages, busy]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  function push(message: Omit<Message, 'id'>) {
    setMessages((current) => [...current, { ...message, id: nextId.current++ }]);
  }

  async function ask(label: string, body: { intent: string } | { text: string }) {
    if (busy) return;
    push({ from: 'user', text: label });
    setBusy(true);
    try {
      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${localStorage.getItem('laundry-token') ?? ''}` },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error('request failed');
      const data = await response.json();
      push({ from: 'bot', text: data.reply.text, links: data.reply.links });
    } catch {
      push({ from: 'bot', text: '답변을 가져오지 못했어요. 잠시 후 다시 시도해 주세요.' });
    } finally {
      setBusy(false);
    }
  }

  function submit() {
    const text = input.trim();
    if (!text) return;
    setInput('');
    void ask(text, { text });
  }

  return <>
    {!open && <button className="chat-fab" type="button" aria-label="세탁실 도우미 열기" aria-expanded={false} onClick={() => setOpen(true)}><MessageCircle size={24} /></button>}
    {open && <section className="chat-panel" role="dialog" aria-label="세탁실 도우미">
      <header className="chat-header">
        <div><strong>세탁실 도우미</strong><small>자주 묻는 질문에 바로 답해드려요</small></div>
        <button className="chat-close" type="button" aria-label="닫기" onClick={() => setOpen(false)}><X size={20} /></button>
      </header>
      <div className="chat-log" aria-live="polite">
        {messages.map((message) => <div key={message.id} className={`chat-bubble ${message.from}`}>
          <p>{message.text}</p>
          {message.links?.map((link) => <Link key={link.href} className="chat-link" href={link.href} onClick={() => setOpen(false)}>{link.label} →</Link>)}
        </div>)}
        {busy && <div className="chat-bubble bot"><p className="muted">확인하는 중…</p></div>}
        <div ref={bottom} />
      </div>
      <div className="chat-suggestions">
        {suggestedQuestions.map((item) => <button key={item.intent} type="button" className="chat-chip" disabled={busy} onClick={() => void ask(item.label, { intent: item.intent })}>{item.label}</button>)}
      </div>
      <form className="chat-input" onSubmit={(event) => { event.preventDefault(); submit(); }}>
        <input aria-label="질문 입력" placeholder="궁금한 점을 입력하세요" maxLength={200} value={input} onChange={(event) => setInput(event.target.value)} />
        <button type="submit" aria-label="보내기" disabled={busy || !input.trim()}><Send size={18} /></button>
      </form>
    </section>}
  </>;
}
