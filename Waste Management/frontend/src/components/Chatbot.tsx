import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bot,
  MessageSquare,
  X,
  Send,
  Sparkles,
  User,
  HelpCircle,
  PhoneCall,
  Award,
  Trash2,
  Loader2,
  Zap,
  Camera,
  Calendar,
  AlertTriangle,
  MapPin,
  Gift,
  ArrowRight,
} from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { api, tokenStore } from '../lib/api';

interface ActionButton {
  label: string;
  url: string;
  icon: 'camera' | 'calendar' | 'emergency' | 'map' | 'reward';
  variant: 'primary' | 'danger' | 'warning' | 'info';
}

interface Message {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  timestamp: string;
  aiPowered?: boolean;
  actions?: ActionButton[];
}

const KNOWLEDGE_BASE = {
  en: {
    welcome:
      'Namaste! I am your AI Safaai Sahayak powered by Groq Llama 3.3. How can I help you today? You can ask me to file a waste complaint, pre-schedule bulk event pickup, track collection trucks, or check your Green Credits!',
    quickPrompts: [
      'Register complaint at my location',
      'Schedule event pickup for wedding',
      'Wet vs Dry waste segregation',
      'How do Green Credits work?',
      'Emergency helpline numbers',
    ],
  },
  hi: {
    welcome:
      'नमस्ते! मैं आपका AI सफाई सहायक हूँ (Groq Llama 3.3 द्वारा संचालित)। मैं कचरा रिपोर्ट करने, शादी/इवेंट के लिए पिकअप शेड्यूल करने, वैन ट्रैक करने या ग्रीन रिवॉर्ड पॉइंट्स में आपकी मदद कर सकता हूँ!',
    quickPrompts: [
      'मेरी लोकेशन पर कचरे की शिकायत दर्ज करें',
      'इवेंट कचरा पिकअप शेड्यूल करें',
      'गीला और सूखा कचरा नियम',
      'ग्रीन क्रेडिट्स कैसे मिलते हैं?',
      'आपातकालीन हेल्पलाइन नंबर',
    ],
  },
  gu: {
    welcome:
      'નમસ્તે! હું તમારો AI સફાઈ સહાયક છું (Groq Llama 3.3 દ્વારા સંચાલિત). હું કચરાની ફરિયાદ નોંધવા, લગ્ન/ઇવેન્ટ માટે પિકઅપ શિડ્યુલ કરવા કે ગ્રીન ક્રેડિટ્સ જાણવામાં તમારી મદદ કરી શકું છું!',
    quickPrompts: [
      'મારા લોકેશન પર કચરાની ફરિયાદ કરો',
      'ઇવેન્ટ પિકઅપ બુકિંગ કરો',
      'ભીનો અને સૂકો કચરો અલગ કરવાના નિયમો',
      'ગ્રીન ક્રેડિટ્સ કેવી રીતે મળે?',
      'ઇમરજન્સી હેલ્પલાઇન નંબર',
    ],
  },
};

function detectActions(text: string): ActionButton[] {
  const t = text.toLowerCase();
  const actions: ActionButton[] = [];

  if (
    t.includes('report') ||
    t.includes('complaint') ||
    t.includes('photo') ||
    t.includes('camera') ||
    t.includes('snap') ||
    t.includes('register') ||
    t.includes('फरियाद') ||
    t.includes('शिकायत') ||
    t.includes('કચરા') ||
    t.includes('कचरा')
  ) {
    actions.push({
      label: '📸 Snap Photo & Auto-File Report',
      url: '/app/report',
      icon: 'camera',
      variant: 'primary',
    });
  }

  if (
    t.includes('schedule') ||
    t.includes('event') ||
    t.includes('wedding') ||
    t.includes('party') ||
    t.includes('renovation') ||
    t.includes('advance') ||
    t.includes('પિકઅપ') ||
    t.includes('શિડ્યુલ')
  ) {
    actions.push({
      label: '🗓️ Pre-Schedule Event Pickup',
      url: '/app/schedule-pickup',
      icon: 'calendar',
      variant: 'warning',
    });
  }

  if (
    t.includes('emergency') ||
    t.includes('carcass') ||
    t.includes('dead animal') ||
    t.includes('toxic') ||
    t.includes('biohazard') ||
    t.includes('आपातकालीन') ||
    t.includes('ઈમરજન્સી')
  ) {
    actions.push({
      label: '🚨 30-Min Emergency Dispatch',
      url: '/app/emergency',
      icon: 'emergency',
      variant: 'danger',
    });
  }

  if (
    t.includes('track') ||
    t.includes('van') ||
    t.includes('truck') ||
    t.includes('status') ||
    t.includes('vehicle') ||
    t.includes('ટ્રેક') ||
    t.includes('ट्रैक')
  ) {
    actions.push({
      label: '📍 Track Complaints & Trucks',
      url: '/app/complaints',
      icon: 'map',
      variant: 'info',
    });
  }

  if (
    t.includes('reward') ||
    t.includes('credit') ||
    t.includes('point') ||
    t.includes('voucher') ||
    t.includes('રિવોર્ડ') ||
    t.includes('ક્રેડિટ') ||
    t.includes('क्रेडिट')
  ) {
    actions.push({
      label: '🎁 View Green Credits & Rewards',
      url: '/app/rewards',
      icon: 'reward',
      variant: 'info',
    });
  }

  return actions;
}

export function Chatbot() {
  const navigate = useNavigate();
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
      actions: [
        { label: '📸 Snap Photo & Report Waste', url: '/app/report', icon: 'camera', variant: 'primary' },
        { label: '🗓️ Pre-Schedule Event Pickup', url: '/app/schedule-pickup', icon: 'calendar', variant: 'warning' },
      ],
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

  function handleActionClick(action: ActionButton) {
    setIsOpen(false);
    const token = tokenStore.get('citizen');
    if (!token) {
      // Direct unauthenticated users to login or citizen app
      navigate(`/login?portal=citizen&redirect=${encodeURIComponent(action.url)}`);
    } else {
      navigate(action.url);
    }
  }

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
      // Use public chatbot endpoint to support both landing page & authenticated citizens
      const res = await api('citizen').post('/public/chatbot', { message: text, lang: currentLang });
      const botReply = res.data?.reply || 'I am your Safaai Sahayak. Please tap the Report tab to file a waste complaint.';
      const detected = detectActions(text + ' ' + botReply);

      const botMsg: Message = {
        id: String(Date.now() + 1),
        sender: 'bot',
        text: botReply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        aiPowered: res.data?.aiPowered ?? true,
        actions: detected.length > 0 ? detected : undefined,
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch {
      const fallbackReply =
        currentLang === 'gu'
          ? 'હું સફાઈ સહાયક છું. આપ નીચે Report ટેબથી કચરાની ફરિયાદ કરી શકો છો અથવા 079-23227900 પર સંપર્ક કરી શકો છો.'
          : currentLang === 'hi'
            ? 'मैं स्वच्छता सहायक हूँ। आप Report टैब से कचरे की शिकायत दर्ज कर सकते हैं या 079-23227900 पर संपर्क कर सकते हैं।'
            : 'I am here to help. Tap the Report tab to file a waste complaint with live photo proof, or call 079-23227900.';

      const detected = detectActions(text + ' ' + fallbackReply);

      const botMsg: Message = {
        id: String(Date.now() + 1),
        sender: 'bot',
        text: fallbackReply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        aiPowered: false,
        actions: detected.length > 0 ? detected : undefined,
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
        <div className="fixed bottom-20 right-4 z-50 flex h-[540px] max-h-[85vh] w-[94vw] max-w-[400px] flex-col overflow-hidden rounded-3xl border border-line bg-surface shadow-2xl md:bottom-6 md:right-6 animate-in fade-in slide-in-from-bottom-5 duration-200">
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
                <p className="text-[11px] opacity-85">Municipal 24/7 Action & Sanitation Agent</p>
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
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 leading-relaxed shadow-xs whitespace-pre-line ${
                    m.sender === 'user'
                      ? 'bg-brand text-brand-ink rounded-tr-none'
                      : 'bg-elevated border border-line text-ink rounded-tl-none'
                  }`}
                >
                  <p className="break-words font-normal">{m.text}</p>

                  {/* Interactive Action Buttons Triggered by AI Agent */}
                  {m.actions && m.actions.length > 0 && (
                    <div className="mt-2.5 space-y-1.5 pt-2 border-t border-line/60">
                      <p className="text-[10px] font-semibold text-muted uppercase tracking-wider">
                        ⚡ Recommended Action
                      </p>
                      {m.actions.map((act, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => handleActionClick(act)}
                          className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-[12px] font-bold transition shadow-xs cursor-pointer text-left ${
                            act.variant === 'danger'
                              ? 'bg-danger text-white hover:brightness-110'
                              : act.variant === 'warning'
                                ? 'bg-amber-600 text-white hover:brightness-110'
                                : 'bg-brand text-brand-ink hover:brightness-110'
                          }`}
                        >
                          <span>{act.label}</span>
                          <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="mt-1.5 flex items-center justify-between gap-2">
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
              placeholder="Type complaint, schedule, or query…"
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
