import { useState, useRef, useEffect } from 'react';
import { Bot, MessageSquare, X, Send, Sparkles, User, HelpCircle, PhoneCall, Award, Trash2, Loader2, Zap } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { api } from '../lib/api';
import { Card } from './ui';

interface Message {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  timestamp: string;
  aiPowered?: boolean;
}

const KNOWLEDGE_BASE = {
  en: {
    welcome: 'Namaste! I am your AI Safaai Sahayak powered by Groq Llama 3.3. How can I help you today with municipal sanitation, waste reporting, scheduled event pickups, or green reward points?',
    quickPrompts: [
      'How to report waste?',
      'Schedule event pickup',
      'Wet vs Dry waste segregation',
      'How do Green Credits work?',
      'Emergency helpline numbers',
    ],
  },
  hi: {
    welcome: 'नमस्ते! मैं आपका AI सफाई सहायक हूँ (Groq Llama 3.3 द्वारा संचालित)। नगर निगम स्वच्छता, कचरा रिपोर्टिंग, प्री-शेड्यूल्ड पिकअप या ग्रीन रिवॉर्ड पॉइंट्स में आपकी क्या मदद कर सकता हूँ?',
    quickPrompts: [
      'कचरे की शिकायत कैसे दर्ज करें?',
      'इवेंट कचरा पिकअप शेड्यूल करें',
      'गीला और सूखा कचरा नियम',
      'ग्रीन क्रेडिट्स कैसे मिलते हैं?',
      'आपातकालीन हेल्पलाइन नंबर',
    ],
  },
  gu: {
    welcome: 'નમસ્તે! હું તમારો AI સફાઈ સહાયક છું (Groq Llama 3.3 દ્વારા સંચાલિત). નગરપાલિકા સ્વચ્છતા, કચરાની ફરિયાદ, ઇવેન્ટ પિકઅપ કે ગ્રીન ક્રેડિટ્સ અંગે હું તમારી શું મદદ કરી શકું?',
    quickPrompts: [
      'કચરાની ફરિયાદ કેવી રીતે કરવી?',
      'ઇવેન્ટ પિકઅપ બુકિંગ કરો',
      'ભીનો અને સૂકો કચરો અલગ કરવાના નિયમો',
      'ગ્રીન ક્રેડિટ્સ કેવી રીતે મળે?',
      'ઇમરજન્સી હેલ્પલાઇન નંબર',
    ],
  },
};

export function Chatbot() {
  const { locale } = useI18n();
  const currentLang = locale === 'gu' || locale === 'hi' ? locale : 'en';
  const localized = KNOWLEDGE_BASE[currentLang];

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'bot',
      text: localized.welcome,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      aiPowered: true,
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isTyping]);

  async function handleSend(textToSend?: string) {
    const text = (textToSend || input).trim();
    if (!text) return;

    const userMsg: Message = {
      id: String(Date.now()),
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput('');
    setIsTyping(true);

    try {
      const res = await api('citizen').post('/citizen/chatbot', { message: text, lang: currentLang });
      const botReply = res.data?.reply || 'I am your Safaai Sahayak. Please tap the Report tab to file a waste complaint.';

      const botMsg: Message = {
        id: String(Date.now() + 1),
        sender: 'bot',
        text: botReply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        aiPowered: res.data?.aiPowered ?? true,
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch {
      const fallbackReply =
        currentLang === 'gu'
          ? 'હું સફાઈ સહાયક છું. આપ નીચે Report ટેબથી કચરાની ફરિયાદ કરી શકો છો અથવા 079-23227900 પર સંપર્ક કરી શકો છો.'
          : currentLang === 'hi'
            ? 'मैं स्वच्छता सहायक हूँ। आप Report टैब से कचरे की शिकायत दर्ज कर सकते हैं या 079-23227900 पर संपर्क कर सकते हैं।'
            : 'I am here to help. Tap the Report tab to file a waste complaint with live photo proof, or call 079-23227900.';

      const botMsg: Message = {
        id: String(Date.now() + 1),
        sender: 'bot',
        text: fallbackReply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        aiPowered: false,
      };
      setMessages((prev) => [...prev, botMsg]);
    } finally {
      setIsTyping(false);
    }
  }

  return (
    <>
      {/* Floating Action Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="AI Safaai Sahayak"
        className={`fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-brand-ink shadow-2xl shadow-brand/40 transition hover:scale-105 active:scale-95 md:bottom-6 md:right-6 cursor-pointer ${
          isOpen ? 'hidden' : 'flex'
        }`}
      >
        <Sparkles className="h-6 w-6" />
        <span className="absolute -top-1 -right-1 flex h-4 w-4">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ok opacity-75"></span>
          <span className="relative inline-flex h-4 w-4 rounded-full bg-ok"></span>
        </span>
      </button>

      {/* Floating Chat Window Modal */}
      {isOpen && (
        <div className="fixed bottom-20 right-4 z-50 flex h-[520px] max-h-[82vh] w-[92vw] max-w-[390px] flex-col overflow-hidden rounded-3xl border border-line bg-surface shadow-2xl md:bottom-6 md:right-6 animate-in fade-in slide-in-from-bottom-5 duration-200">
          {/* Chat Header */}
          <div className="flex items-center justify-between border-b border-line bg-brand px-4 py-3 text-brand-ink">
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/20 shadow-xs">
                <Bot className="h-5 w-5" />
              </span>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-fluid-sm font-bold leading-tight">AI Safaai Sahayak</h3>
                  <span className="inline-flex items-center gap-0.5 rounded-md bg-white/20 px-1.5 py-0.2 text-[9px] font-extrabold uppercase tracking-wider">
                    <Zap className="h-2.5 w-2.5 text-yellow-300 fill-yellow-300" /> Groq AI
                  </span>
                </div>
                <p className="text-[11px] opacity-85">Municipal 24/7 Sanitation Assistant</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-xl p-1.5 text-brand-ink/80 transition hover:bg-white/20 hover:text-brand-ink cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Chat Body */}
          <div className="flex-1 space-y-3 overflow-y-auto p-4 text-fluid-xs">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex gap-2 ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {m.sender === 'bot' && (
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand mt-0.5">
                    <Bot className="h-4 w-4" />
                  </span>
                )}
                <div
                  className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 leading-relaxed shadow-xs whitespace-pre-line ${
                    m.sender === 'user'
                      ? 'bg-brand text-brand-ink rounded-tr-none'
                      : 'bg-elevated border border-line text-ink rounded-tl-none'
                  }`}
                >
                  <p className="break-words">{m.text}</p>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    {m.sender === 'bot' && m.aiPowered && (
                      <span className="text-[9px] font-semibold text-brand flex items-center gap-0.5 opacity-80">
                        <Zap className="h-2.5 w-2.5" /> Llama 3.3
                      </span>
                    )}
                    <span
                      className={`text-[10px] ml-auto ${
                        m.sender === 'user' ? 'text-brand-ink/70 text-right' : 'text-faint'
                      }`}
                    >
                      {m.timestamp}
                    </span>
                  </div>
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="flex items-center gap-2 text-faint">
                <span className="grid h-7 w-7 place-items-center rounded-xl bg-brand/10 text-brand">
                  <Bot className="h-4 w-4" />
                </span>
                <span className="rounded-2xl border border-line bg-elevated px-3.5 py-2 text-[11px] flex items-center gap-1.5 text-muted shadow-xs">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-brand" />
                  <span>Sahayak is thinking with Groq AI…</span>
                </span>
              </div>
            )}
            <div ref={scrollRef} />
          </div>

          {/* Quick Prompts */}
          <div className="border-t border-line/60 bg-sunken/40 px-3 py-2">
            <p className="mb-1.5 text-[10px] font-semibold text-muted uppercase tracking-wider">Quick Suggestions</p>
            <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {localized.quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => handleSend(prompt)}
                  className="shrink-0 rounded-xl border border-line bg-elevated px-2.5 py-1 text-[11px] font-medium text-ink transition hover:border-brand hover:text-brand cursor-pointer shadow-2xs"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          {/* Chat Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2 border-t border-line bg-surface p-2.5"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask sanitation query or schedule…"
              className="flex-1 rounded-xl border border-line bg-elevated px-3 py-2 text-fluid-xs text-ink placeholder:text-faint focus:border-brand focus:outline-none"
            />
            <button
              type="submit"
              disabled={!input.trim() || isTyping}
              className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-brand-ink transition disabled:opacity-50 cursor-pointer shadow-xs"
            >
              {isTyping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </form>
        </div>
      )}
    </>
  );
}

export default Chatbot;
