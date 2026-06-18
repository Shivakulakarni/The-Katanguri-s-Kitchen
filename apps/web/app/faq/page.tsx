'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

const faqs = [
  {
    q: 'How do I place an order?',
    a: 'Browse our menu, add dishes to your cart, and proceed to checkout. You can pay online or opt for COD.',
  },
  {
    q: 'What are your delivery hours?',
    a: 'We operate from 10:00 AM to 11:00 PM every day. Last order is accepted at 10:30 PM.',
  },
  {
    q: 'How long does delivery take?',
    a: 'Typical delivery time is 30–45 minutes depending on your location and order volume.',
  },
  {
    q: 'Can I track my order?',
    a: 'Yes! Use the Track Order page with your order ID to see real-time updates and rider location.',
  },
  {
    q: 'What if my order is late?',
    a: 'If your order exceeds the estimated delivery time by more than 15 minutes, please contact support.',
  },
  {
    q: 'How do I cancel an order?',
    a: 'Orders can be cancelled within 5 minutes of placing. Contact support for cancellations after that.',
  },
  {
    q: 'Do you offer bulk or catering orders?',
    a: 'Yes, contact us directly for bulk and catering orders with special pricing.',
  },
  {
    q: 'Is my payment information secure?',
    a: 'Absolutely. We use Stripe for payment processing. Your card details never touch our servers.',
  },
];

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map((f) => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
};

function useHeightAnimation(open: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (ref.current) {
      setHeight(open ? ref.current.scrollHeight : 0);
    }
  }, [open]);

  return { ref, height };
}

function AccordionItem({
  faq,
  index,
  isOpen,
  onToggle,
}: {
  faq: { q: string; a: string };
  index: number;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const { ref, height } = useHeightAnimation(isOpen);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onToggle();
      }
    },
    [onToggle]
  );

  return (
    <div
      style={{
        borderBottom: '1px solid #eee',
        padding: '16px 0',
      }}
    >
      <div
        role="button"
        tabIndex={0}
        aria-expanded={isOpen ? 'true' : 'false'}
        aria-controls={`faq-${index}`}
        id={`faq-btn-${index}`}
        onClick={onToggle}
        onKeyDown={handleKeyDown}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <h3 style={{ margin: 0, fontSize: '1.05rem' }}>{faq.q}</h3>
        <span
          style={{
            fontSize: '1.2rem',
            transition: 'transform 0.2s ease',
            transform: isOpen ? 'rotate(45deg)' : 'rotate(0deg)',
          }}
        >
          +
        </span>
      </div>
      <div
        id={`faq-${index}`}
        role="region"
        aria-labelledby={`faq-btn-${index}`}
        style={{
          overflow: 'hidden',
          transition: 'height 0.3s ease, opacity 0.3s ease',
          height: height + 'px',
          opacity: isOpen ? 1 : 0,
        }}
      >
        <div ref={ref}>
          <p style={{ marginTop: 12, color: '#555', lineHeight: 1.6 }}>{faq.a}</p>
        </div>
      </div>
    </div>
  );
}

export default function FAQPage() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <div style={{ paddingTop: 80, maxWidth: 800, margin: '0 auto', padding: '100px 20px 40px' }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <h1 style={{ fontSize: '2rem', marginBottom: 8 }}>Frequently Asked Questions</h1>
      <p style={{ color: '#666', marginBottom: 32 }}>Everything you need to know about The Katanguri&apos;s Kitchen.</p>

      {faqs.map((faq, i) => (
        <AccordionItem
          key={i}
          faq={faq}
          index={i}
          isOpen={openIdx === i}
          onToggle={() => setOpenIdx(openIdx === i ? null : i)}
        />
      ))}
    </div>
  );
}
