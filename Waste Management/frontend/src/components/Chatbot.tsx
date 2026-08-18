import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bot,
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
  RotateCcw,
  Languages,
  Minus,
  MessageSquare,
} from 'lucide-react';
import { useI18n, type Locale } from '../lib/i18n';
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
    title: 'AI Safaai Sahayak',
    subtitle: 'Municipal 24/7 Sanitation Agent',
    welcome:
      'Namaste! I am your AI Safaai Sahayak powered by Groq Llama 3.3. How can I help you today? You can ask me to file a waste complaint, pre-schedule bulk event pickup, track collection trucks, or check your Green Credits!',
    placeholder: 'Ask anything or type your complaint…',
    quickPrompts: [
      '📸 File a complaint at my spot',
      '🗓️ Pre-schedule event waste pickup',
      '🌿 Wet vs Dry waste segregation',
      '🎁 How do Green Credits work?',
      '🚨 Emergency helpline numbers',
    ],
  },
  hi: {
    title: 'AI सफाई सहायक',
    subtitle: '24/7 नगर निगम स्वच्छता सलाहकार',
    welcome:
      'नमस्ते! मैं आपका AI सफाई सहायक हूँ (Groq Llama 3.3 द्वारा संचालित)। मैं कचरा रिपोर्ट करने, शादी/इवेंट के लिए पिकअप शेड्यूल करने, वैन ट्रैक करने या ग्रीन रिवॉर्ड पॉइंट्स में आपकी मदद कर सकता हूँ!',
    placeholder: 'कोई सवाल पूछें या शिकायत लिखें…',
    quickPrompts: [
      '📸 यहाँ कचरे की शिकायत दर्ज करें',
      '🗓️ शादी/इवेंट के लिए पिकअप शेड्यूल करें',
      '🌿 गीला और सूखा कचरा नियम',
      '🎁 ग्रीन क्रेडिट्स कैसे कमाएं?',
      '🚨 आपातकालीन हेल्पलाइन नंबर',
    ],
  },
  gu: {
    title: 'AI સફાઈ સહાયક',
    subtitle: '24/7 મ્યુનિસિપલ સ્વચ્છતા સહાયક',
    welcome:
      'નમસ્તે! હું તમારો AI સફાઈ સહાયક છું (Groq Llama 3.3 દ્વારા સંચાલિત). હું કચરાની ફરિયાદ નોંધવા, લગ્ન/ઇવેન્ટ માટે પિકઅપ શિડ્યુલ કરવા કે ગ્રીન ક્રેડિટ્સ જાણવામાં તમારી મદદ કરી શકું છું!',
    placeholder: 'કંઈપણ પૂછો અથવા ફરિયાદ લખો…',
    quickPrompts: [
      '📸 મારા લોકેશન પર ફરિયાદ નોંધાવો',
      '🗓️ ઇવેન્ટ માટે પિકઅપ બુક કરો',
      '🌿 ભીનો અને સૂકો કચરો અલગ કરવાના નિયમો',
      '🎁 ગ્રીન ક્રેડિટ્સ કેવી રીતે મળે?',
      '🚨 ઇમરજન્સી હેલ્પલાઇન નંબર',
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
  const { locale, setLocale } = useI18n();
  const currentLang = (locale === 'gu' || locale === 'hi' ? locale : 'en') as 'en' | 'hi' | 'gu';
  const localized = KNOWLEDGE_BASE[currentLang];

  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  // Update welcome message when user switches language
  useEffect(() => {
    setMessages((prev) => {
      if (prev.length === 1 && prev[0].id === 'welcome') {
        return [
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
        ];
      }
      return prev;
    });
  }, [currentLang]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
        inputRef.current?.focus();
      }, 100);
    }
  }, [messages, isOpen, isTyping]);

  function handleResetChat() {
    setMessages([
      {
        id: 'welcome-' + Date.now(),
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
  }

  function handleActionClick(action: ActionButton) {
    setIsOpen(false);
    const token = tokenStore.get('citizen');
    if (!token) {
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
        aria-label="Open AI Safaai Sahayak Chatbot"
        className={`fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-brand-ink shadow-2xl shadow-brand/40 transition-all duration-300 hover:scale-110 active:scale-95 md:bottom-6 md:right-6 cursor-pointer group ${
          isOpen ? 'hidden' : 'flex'
        }`}
      >
        <span className="relative">
          <Sparkles className="h-6 w-6 transition-transform duration-300 group-hover:rotate-12" />
          <span className="absolute -top-2 -right-2 flex h-4 w-4">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex h-4 w-4 rounded-full bg-emerald-500 border-2 border-white"></span>
          </span>
        </span>
      </button>

      {/* Universal Luxury Backdrop with Frosted Blur across Desktop & Mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/65 backdrop-blur-md transition-all duration-300 animate-in fade-in"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Floating Chat Window Modal (Bottom sheet on mobile, luxury floating card on desktop) */}
      {isOpen && (
        <div
          className="fixed inset-x-0 bottom-0 z-50 flex h-[92vh] max-h-[900px] w-full flex-col overflow-hidden rounded-t-[2.2rem] border-t sm:border border-line/80 bg-surface/98 shadow-[0_25px_70px_-15px_rgba(0,0,0,0.6),0_0_45px_rgba(16,185,129,0.25)] backdrop-blur-2xl sm:inset-x-auto sm:bottom-6 sm:right-6 sm:h-[620px] sm:w-[430px] sm:rounded-[2rem] sm:ring-1 sm:ring-white/20 dark:sm:ring-emerald-500/20 animate-in slide-in-from-bottom-8 zoom-in-95 duration-300 ease-out"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          {/* Top Indian Tricolor Ambient Strip */}
          <div className="flex h-1 w-full shrink-0">
            <div className="flex-1 bg-[#FF9933]" />
            <div className="flex-1 bg-white dark:bg-white/80" />
            <div className="flex-1 bg-[#138808]" />
          </div>

          {/* Mobile Sheet Drag Handle */}
          <div className="flex justify-center pt-2 pb-1 sm:hidden cursor-pointer" onClick={() => setIsOpen(false)}>
            <div className="h-1.5 w-12 rounded-full bg-muted/40 hover:bg-muted/60 transition" />
          </div>

          {/* Premium Chat Header */}
          <div className="flex items-center justify-between border-b border-emerald-700/30 bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 px-4 py-3 text-white shadow-md">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/15 backdrop-blur-md shadow-inner">
                <Bot className="h-6 w-6 text-emerald-100" />
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-emerald-800" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-fluid-sm font-extrabold tracking-tight truncate">{localized.title}</h3>
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-white/20 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-300 shrink-0 shadow-xs">
                    <Zap className="h-2.5 w-2.5 fill-amber-300" /> Groq AI
                  </span>
                </div>
                <p className="text-[11px] text-emerald-100/90 truncate">{localized.subtitle}</p>
              </div>
            </div>

            {/* Header Right Actions */}
            <div className="flex items-center gap-1 shrink-0">
              {/* Inline Language Switcher Pills */}
              <div className="flex items-center bg-black/20 rounded-xl p-0.5 text-[10px] font-bold">
                {(['en', 'hi', 'gu'] as const).map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setLocale(lang)}
                    className={`px-1.5 py-0.5 rounded-lg transition cursor-pointer uppercase ${
                      currentLang === lang ? 'bg-white text-emerald-800 shadow-xs' : 'text-white/75 hover:text-white'
                    }`}
                  >
                    {lang}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={handleResetChat}
                title="Restart Chat"
                className="rounded-xl p-1.5 text-white/80 transition hover:bg-white/20 hover:text-white cursor-pointer"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close Chat"
                className="rounded-xl p-1.5 text-white/80 transition hover:bg-white/20 hover:text-white cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Quick Action Navigation Bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto border-b border-line bg-sunken/50 px-3 py-2 no-scrollbar">
            <button
              type="button"
              onClick={() => handleActionClick({ label: 'Report', url: '/app/report', icon: 'camera', variant: 'primary' })}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-line bg-elevated px-2.5 py-1 text-[11px] font-bold text-ink shadow-2xs transition hover:border-brand hover:text-brand cursor-pointer"
            >
              <Camera className="h-3 w-3 text-brand" /> Report Waste
            </button>
            <button
              type="button"
              onClick={() => handleActionClick({ label: 'Schedule', url: '/app/schedule-pickup', icon: 'calendar', variant: 'warning' })}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-line bg-elevated px-2.5 py-1 text-[11px] font-bold text-ink shadow-2xs transition hover:border-brand hover:text-brand cursor-pointer"
            >
              <Calendar className="h-3 w-3 text-amber-600" /> Event Pickup
            </button>
            <button
              type="button"
              onClick={() => handleActionClick({ label: 'Emergency', url: '/app/emergency', icon: 'emergency', variant: 'danger' })}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-line bg-elevated px-2.5 py-1 text-[11px] font-bold text-danger shadow-2xs transition hover:border-danger hover:bg-danger/10 cursor-pointer"
            >
              <AlertTriangle className="h-3 w-3 text-danger" /> 30-Min Alert
            </button>
            <button
              type="button"
              onClick={() => handleActionClick({ label: 'Rewards', url: '/app/rewards', icon: 'reward', variant: 'info' })}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-line bg-elevated px-2.5 py-1 text-[11px] font-bold text-ink shadow-2xs transition hover:border-brand hover:text-brand cursor-pointer"
            >
              <Gift className="h-3 w-3 text-emerald-600" /> Green Credits
            </button>
          </div>

          {/* Chat Body Scroll Area */}
          <div className="flex-1 space-y-3.5 overflow-y-auto p-4 text-fluid-xs bg-surface/60">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex gap-2.5 ${m.sender === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-200`}
              >
                {m.sender === 'bot' && (
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-2xl bg-brand/10 text-brand mt-0.5 border border-brand/20 shadow-xs">
                    <Bot className="h-4 w-4" />
                  </span>
                )}
                <div
                  className={`max-w-[86%] sm:max-w-[82%] rounded-2xl px-4 py-3 leading-relaxed shadow-xs whitespace-pre-line text-[13px] ${
                    m.sender === 'user'
                      ? 'bg-brand text-brand-ink font-medium rounded-tr-none shadow-sm'
                      : 'bg-elevated border border-line text-ink rounded-tl-none shadow-xs'
                  }`}
                >
                  <p className="break-words">{m.text}</p>

                  {/* Interactive Action Buttons Triggered by AI Agent */}
                  {m.actions && m.actions.length > 0 && (
                    <div className="mt-3 space-y-1.5 pt-2.5 border-t border-line/70">
                      <p className="text-[10px] font-extrabold uppercase tracking-wider text-muted flex items-center gap-1">
                        <Sparkles className="h-3 w-3 text-brand" /> Quick Action
                      </p>
                      {m.actions.map((act, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => handleActionClick(act)}
                          className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl text-[12px] font-bold transition shadow-xs cursor-pointer text-left ${
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

                  <div className="mt-2 flex items-center justify-between gap-2 pt-1 border-t border-black/5 dark:border-white/5">
                    {m.sender === 'bot' && m.aiPowered && (
                      <span className="text-[9px] font-bold text-brand flex items-center gap-0.5">
                        <Zap className="h-2.5 w-2.5 text-amber-500 fill-amber-500" /> Groq Llama 3.3
                      </span>
                    )}
                    <span
                      className={`text-[10px] ml-auto font-mono ${
                        m.sender === 'user' ? 'text-brand-ink/75' : 'text-muted'
                      }`}
                    >
                      {m.timestamp}
                    </span>
                  </div>
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="flex items-center gap-2 text-muted animate-pulse">
                <span className="grid h-8 w-8 place-items-center rounded-2xl bg-brand/10 text-brand border border-brand/20 shadow-xs">
                  <Bot className="h-4 w-4" />
                </span>
                <span className="rounded-2xl border border-line bg-elevated px-4 py-2.5 text-[12px] flex items-center gap-2 text-ink shadow-xs">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-brand" />
                  <span className="font-medium">Sahayak is thinking with Groq AI…</span>
                </span>
              </div>
            )}
            <div ref={scrollRef} />
          </div>

          {/* Quick Suggestions Chips */}
          <div className="border-t border-line/70 bg-sunken/60 px-3 py-2">
            <p className="mb-1.5 text-[10px] font-bold text-muted uppercase tracking-wider">Suggested Questions</p>
            <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {localized.quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => handleSend(prompt)}
                  className="shrink-0 rounded-xl border border-line bg-elevated px-3 py-1.5 text-[11.5px] font-medium text-ink transition hover:border-brand hover:text-brand hover:bg-brand/5 cursor-pointer shadow-2xs"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          {/* Chat Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2 border-t border-line bg-surface p-3"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={localized.placeholder}
              className="field flex-1 rounded-2xl text-[13px] px-3.5 py-2.5"
            />
            <button
              type="submit"
              disabled={!input.trim() || isTyping}
              className="btn-primary rounded-2xl h-10 w-10 p-0 flex items-center justify-center disabled:opacity-40 shadow-sm cursor-pointer shrink-0"
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
