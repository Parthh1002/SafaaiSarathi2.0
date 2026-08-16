import React, { useState } from 'react';

export interface FaqItem {
  question: string;
  answer: React.ReactNode;
}

export interface FaqAccordionProps extends React.HTMLAttributes<HTMLDivElement> {
  items?: FaqItem[];
  title?: string;
}

function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}

const SAFAAI_FAQ_ITEMS: FaqItem[] = [
  {
    question: 'How does Safaai Sarathi automatically verify waste complaints?',
    answer:
      'When you upload a live photo, our custom-trained YOLOv8 deep learning model instantly detects the waste category (garbage pile, overflowing bin, medical waste, etc.) and assigns a confidence score. High-confidence reports are auto-approved directly for collection truck dispatch without bureaucratic delays.',
  },
  {
    question: 'What are Green Credits and how do citizens redeem them?',
    answer:
      'Every verified civic report that gets cleaned up by our municipal drivers awards you +20 Green Credits in your citizen wallet. You can redeem these credits for municipal tax rebates, park entry discounts, and grocery/utility vouchers.',
  },
  {
    question: 'How does the 30-Minute Emergency SLA work for hazardous waste?',
    answer:
      'High-risk reports like dead animals, burning waste, sewage overflow, and biohazardous medical waste trigger an instant priority alert on the Ward Officer console and nearest collection truck, ensuring dispatch within 30 minutes.',
  },
  {
    question: 'Can I track the collection truck in real-time on a map?',
    answer:
      'Yes! Once a driver accepts your complaint, you can view the live GPS location of the garbage compactor truck moving along its optimized 2-opt route directly inside the Citizen Portal.',
  },
  {
    question: 'What languages does the AI Safaai Sahayak Assistant support?',
    answer:
      'Our AI chatbot understands and responds in English, Hindi (हिन्दी), and Gujarati (ગુજરાતી) to guide you on wet vs dry waste segregation, ward helpline numbers, and ticket tracking.',
  },
  {
    question: 'How do municipal officers and drivers access their portals?',
    answer:
      'Drivers and Ward Officers have dedicated, secure login gateways (/driver and /officer) with role-based access control, automated route solvers, shift fuel logs, and live ward analytics.',
  },
];

export function FaqAccordion({
  items = SAFAAI_FAQ_ITEMS,
  title = 'Frequently Asked Questions',
  className,
  ...props
}: FaqAccordionProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const toggleItem = (index: number) => {
    setActiveIndex(activeIndex === index ? null : index);
  };

  return (
    <div className={cn('w-full max-w-4xl mx-auto py-8 relative font-sans', className)} {...props}>
      {title && (
        <div className="text-center mb-10 space-y-2">
          <h2 className="font-bold text-2xl md:text-4xl text-ink tracking-tight">
            {title}
          </h2>
          <p className="text-fluid-xs text-muted max-w-xl mx-auto">
            Everything you need to know about Safaai Sarathi's AI-driven civic waste management ecosystem.
          </p>
        </div>
      )}

      <ul className="w-full mx-auto list-none p-0 flex flex-col space-y-2">
        {items.map((item, index) => {
          const isActive = activeIndex === index;
          return (
            <li
              key={index}
              className={cn(
                'w-full relative transition-all duration-300 ease-in rounded-2xl overflow-hidden border border-line bg-surface shadow-xs',
                isActive ? 'border-brand/40 ring-1 ring-brand/20' : 'hover:border-line/80'
              )}
            >
              <button
                type="button"
                className={cn(
                  'flex flex-row items-center justify-start w-full min-h-[64px] py-4 relative m-0 px-4 pl-14 cursor-pointer',
                  'border-l-[6px] md:border-l-[8px] transition-colors duration-200 text-left outline-none text-base md:text-lg',
                  isActive
                    ? 'border-l-brand bg-brand/5 text-ink font-bold'
                    : 'border-l-line bg-transparent text-muted hover:border-l-brand/60 hover:text-ink hover:bg-sunken/40'
                )}
                onClick={() => toggleItem(index)}
                aria-expanded={isActive}
              >
                {/* Plus/Minus Icon */}
                <span
                  className={cn(
                    'absolute left-4 md:left-5 top-1/2 -translate-y-1/2 transition-all duration-200 leading-none',
                    isActive
                      ? 'text-[28px] md:text-[36px] font-semibold text-brand'
                      : 'text-[22px] md:text-[28px] font-normal text-muted'
                  )}
                >
                  {isActive ? '−' : '+'}
                </span>

                <span className="pr-8 text-fluid-sm font-bold text-ink leading-snug">{item.question}</span>

                {/* Chevron */}
                <span
                  className={cn(
                    'absolute right-6 block w-2.5 h-2.5 border-t-2 border-r-2 transition-transform duration-200 ease-in-out',
                    isActive
                      ? 'rotate-[-45deg] border-brand'
                      : 'rotate-[135deg] border-muted'
                  )}
                />
              </button>

              <div
                className={cn(
                  'grid transition-all duration-300 ease-in-out w-full',
                  'border-l-[6px] md:border-l-[8px]',
                  isActive
                    ? 'grid-rows-[1fr] border-l-brand bg-brand/5'
                    : 'grid-rows-[0fr] border-l-line bg-transparent'
                )}
              >
                <div className="overflow-hidden">
                  <div className="flex flex-row items-start justify-start w-full px-4 pl-14 pb-6 pt-1 text-fluid-xs sm:text-fluid-sm font-normal text-muted leading-relaxed">
                    <span>{item.answer}</span>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default FaqAccordion;
