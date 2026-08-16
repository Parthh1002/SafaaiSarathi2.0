import { useState, useRef, useEffect } from 'react';
import { Bot, MessageSquare, X, Send, Sparkles, User, HelpCircle, PhoneCall, Award, Trash2 } from 'lucide-react';
import { useT, useI18n } from '../lib/i18n';
import { Card } from './ui';

interface Message {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  timestamp: string;
}

const KNOWLEDGE_BASE = {
  en: {
    welcome: 'Namaste! I am your AI Safaai Sahayak. How can I help you today with municipal sanitation, waste reporting, or reward points?',
    quickPrompts: [
      'How to file a report?',
      'Wet vs Dry waste rules',
      'How do Reward points work?',
      'Emergency helpline numbers',
    ],
    fallback: "I'm here to help with waste management and city sanitation. You can file a complaint with photo proof in the Report tab, track collection trucks in real-time, or call the 24/7 Helpline at 079-23227900.",
  },
  hi: {
    welcome: 'नमस्ते! मैं आपका AI सफाई सहायक हूँ। आज मैं नगर निगम स्वच्छता, कचरा रिपोर्टिंग या रिवॉर्ड पॉइंट्स में आपकी क्या मदद कर सकता हूँ?',
    quickPrompts: [
      'कचरे की शिकायत कैसे दर्ज करें?',
      'गीला और सूखा कचरा नियम',
      'रिवॉर्ड पॉइंट्स कैसे मिलते हैं?',
      'आपातकालीन हेल्पलाइन नंबर',
    ],
    fallback: 'मैं स्वच्छता और कचरा प्रबंधन में आपकी सहायता के लिए तैयार हूँ। आप "Report" टैब से लाइव फोटो के साथ शिकायत दर्ज कर सकते हैं या 079-23227900 पर संपर्क कर सकते हैं।',
  },
  gu: {
    welcome: 'નમસ્તે! હું તમારો AI સફાઈ સહાયક છું. નગરપાલિકા સ્વચ્છતા, કચરાની ફરિયાદ કે રિવોર્ડ પોઇન્ટ્સ અંગે હું તમારી શું મદદ કરી શકું?',
    quickPrompts: [
      'કચરાની ફરિયાદ કેવી રીતે કરવી?',
      'ભીનો અને સૂકો કચરો અલગ કરવાના નિયમો',
      'રિવોર્ડ પોઇન્ટ્સ કેવી રીતે મળે?',
      'ઇમરજન્સી હેલ્પલાઇન નંબર',
    ],
    fallback: 'હું સ્વચ્છતા સહાયક છું. તમે "Report" ટેબથી લાઈવ ફોટો પાડીને ફરિયાદ કરી શકો છો અથવા કલેક્શન વાન લાઈવ ટ્રેક કરી શકો છો.',
  }
};

function getBotReply(input: string, lang: 'en' | 'hi' | 'gu'): string {
  const query = input.toLowerCase();

  if (query.includes('report') || query.includes('complaint') || query.includes('शिकायत') || query.includes('ફરિયાદ')) {
    if (lang === 'gu') return 'ફરિયાદ કરવા માટે નીચે "Report" બટન દબાવો, કચરાનો લાઈવ ફોટો પાડો, અમારું AI ઓટોમેટિક કેટેગરી ઓળખી લેશે અને લાઈવ GPS લોકેશન સાથે સબમિટ કરી દો!';
    if (lang === 'hi') return 'शिकायत दर्ज करने के लिए नीचे "Report" टैब पर जाएँ, कचरे की लाइव फोटो लें, हमारा AI मॉडल अपने आप श्रेणी पहचान लेगा और GPS के साथ सबमिट कर दें!';
    return 'To report waste, tap the "+" (Report) tab at the bottom, take a live photo of the waste, verify the AI-detected category, and submit with your GPS location!';
  }

  if (query.includes('wet') || query.includes('dry') || query.includes('गीला') || query.includes('सूखा') || query.includes('ભીનો') || query.includes('સૂકો')) {
    if (lang === 'gu') return 'લીલી કચરાપેટી: ભીનો કચરો (રસોડાનો કચરો, શાકભાજી, ફળોની છાલ).\nભૂરી કચરાપેટી: સૂકો કચરો (પ્લાસ્ટિક, કાગળ, કાચ, ધાતુ).';
    if (lang === 'hi') return 'हरा कूड़ेदान: गीला कचरा (रसोई का कचरा, फल, सब्जियां, चायपत्ती).\nनीला कूड़ेदान: सूखा कचरा (प्लास्टिक, कागज, गत्ते, कांच, धातु).';
    return 'Green Bin: Wet/Biodegradable waste (food scraps, vegetable peels, garden waste).\nBlue Bin: Dry/Recyclable waste (plastic, paper, glass, cardboard, metal).';
  }

  if (query.includes('reward') || query.includes('point') || query.includes('credit') || query.includes('રિવોર્ડ') || query.includes('पॉइंट')) {
    if (lang === 'gu') return 'દરેક સાચી ફરિયાદ માટે તમને 50 ક્રેડિટ્સ અને વેરિફિકેશન પર વધારાના પોઈન્ટ્સ મળે છે. આ પોઈન્ટ્સ "Rewards" ટેબમાં મ્યુનિસિપલ કૂપન્સ અને ડિસ્કાઉન્ટ માટે રિડીમ કરી શકાય છે!';
    if (lang === 'hi') return 'प्रत्येक मान्य शिकायत दर्ज करने पर आपको 50 क्रेडिट्स और समाधान होने पर बोनस पॉइंट्स मिलते हैं। इन्हें "Rewards" टैब में जाकर रिडीम कर सकते हैं!';
    return 'You earn 50 Credits for every verified waste report and bonus points upon swift resolution! Redeem your points in the Rewards tab for property tax rebates or utility coupons.';
  }

  if (query.includes('help') || query.includes('phone') || query.includes('number') || query.includes('हेल्पलाइन') || query.includes('નંબર') || query.includes('emergency')) {
    if (lang === 'gu') return 'મ્યુનિસિપલ સ્વચ્છતા હેલ્પલાઇન: 079-23227900 | ફાયર બ્રિગેડ: 101 | એમ્બ્યુલન્સ: 108 | પોલીસ: 100. આપ "Directory" ટેબમાં તમામ વોર્ડ ઓફિસરના નંબર જોઈ શકો છો.';
    if (lang === 'hi') return 'नगरपालिका स्वच्छता हेल्पलाइन: 079-23227900 | फायर: 101 | एम्बुलेंस: 108 | पुलिस: 100. "Helpline" टैब में सभी वार्ड अधिकारियों के नंबर उपलब्ध हैं।';
    return 'Sanitation Control Room: 079-23227900 | Fire: 101 | Ambulance: 108 | Police: 100. Check the Helpline Directory tab for all zonal officer contacts.';
  }

  return KNOWLEDGE_BASE[lang]?.fallback || KNOWLEDGE_BASE.en.fallback;
}

export function Chatbot() {
  const { locale } = useI18n();
  const currentLang = (locale === 'gu' || locale === 'hi') ? locale : 'en';
  const localized = KNOWLEDGE_BASE[currentLang];

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'bot',
      text: localized.welcome,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  function handleSend(textToSend?: string) {
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

    setTimeout(() => {
      const reply = getBotReply(text, currentLang);
      const botMsg: Message = {
        id: String(Date.now() + 1),
        sender: 'bot',
        text: reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, botMsg]);
      setIsTyping(false);
    }, 600);
  }

  return (
    <>
      {/* Floating Action Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="AI Safaai Sahayak"
        className={`fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-brand-ink shadow-2xl shadow-brand/40 transition hover:scale-105 active:scale-95 md:bottom-6 md:right-6 ${
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
        <div className="fixed inset-x-3 bottom-20 z-50 mx-auto max-w-md md:inset-x-auto md:right-6 md:bottom-6 md:w-96 animate-in fade-in slide-in-from-bottom-5 duration-200">
          <Card className="flex h-[480px] flex-col overflow-hidden p-0 shadow-2xl border-brand/30 bg-surface">
            {/* Header */}
            <div className="flex items-center justify-between bg-brand px-4 py-3 text-brand-ink">
              <div className="flex items-center gap-2.5">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-ink/10">
                  <Bot className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-fluid-sm font-bold leading-tight">AI Safaai Sahayak</h3>
                  <p className="text-[11px] opacity-80 flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-ok"></span> 24/7 Sanitation Assistant
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-lg hover:bg-brand-ink/10 transition active:scale-95"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Chat Body */}
            <div className="flex-1 space-y-3 overflow-y-auto p-4 bg-sunken/30 text-fluid-xs">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex gap-2.5 ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {m.sender === 'bot' && (
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand/15 text-brand">
                      <Bot className="h-4 w-4" />
                    </span>
                  )}
                  <div
                    className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 shadow-sm whitespace-pre-line leading-relaxed ${
                      m.sender === 'user'
                        ? 'bg-brand text-brand-ink rounded-tr-none'
                        : 'bg-elevated border border-line text-ink rounded-tl-none'
                    }`}
                  >
                    <p>{m.text}</p>
                    <span
                      className={`block text-[9px] mt-1 text-right ${
                        m.sender === 'user' ? 'text-brand-ink/70' : 'text-muted'
                      }`}
                    >
                      {m.timestamp}
                    </span>
                  </div>
                </div>
              ))}

              {isTyping && (
                <div className="flex items-center gap-2 text-muted text-[11px]">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-brand/10 text-brand">
                    <Bot className="h-3.5 w-3.5" />
                  </span>
                  <span>AI is typing...</span>
                </div>
              )}
              <div ref={scrollRef} />
            </div>

            {/* Quick Prompt Chips */}
            <div className="flex gap-1.5 overflow-x-auto px-3 py-2 bg-surface border-t border-line/60 no-scrollbar">
              {localized.quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => handleSend(prompt)}
                  className="whitespace-nowrap rounded-full border border-brand/30 bg-brand/5 px-2.5 py-1 text-[11px] font-medium text-brand hover:bg-brand/15 transition active:scale-95 shrink-0"
                >
                  {prompt}
                </button>
              ))}
            </div>

            {/* Input Form */}
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
                placeholder="Ask about waste, rules, points..."
                className="flex-1 rounded-xl border border-line bg-sunken px-3 py-2 text-fluid-xs text-ink focus:border-brand focus:outline-none"
              />
              <button
                type="submit"
                disabled={!input.trim()}
                className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-brand-ink transition hover:opacity-90 disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </Card>
        </div>
      )}
    </>
  );
}
