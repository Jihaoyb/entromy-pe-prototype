'use client';

import { FormEvent, useState } from 'react';
import Image from 'next/image';

interface SubscribeApiSuccess {
  ok: true;
  message: string;
}

interface SubscribeApiFailure {
  ok: false;
  error: string;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function Footer() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [subscribeError, setSubscribeError] = useState('');
  const [subscribeSuccess, setSubscribeSuccess] = useState('');

  const handleSubscribe = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedEmail = email.trim();
    const hasValidEmail = isValidEmail(normalizedEmail);

    if (!hasValidEmail) {
      setSubscribeSuccess('');
      setSubscribeError('Please enter a valid work email.');
      return;
    }

    setSubscribeError('');
    setIsSubmitting(true);
    setSubscribeSuccess('');

    try {
      const response = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail })
      });

      const data = (await response.json()) as SubscribeApiSuccess | SubscribeApiFailure;
      if (!response.ok || !data.ok) {
        setSubscribeError(data.ok ? 'Subscription failed. Please try again.' : data.error || 'Subscription failed. Please try again.');
        return;
      }

      setSubscribeSuccess(data.message);
      setEmail('');
    } catch (error) {
      console.error('[Footer] Subscribe request failed:', error);
      setSubscribeError('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <footer className="mt-10 border-t border-brand-line bg-[#f2f3f0] text-brand-ink">
      <section className="border-b border-brand-line bg-[radial-gradient(circle_at_top_left,_#f5f5f3_0,_#f2f3f0_40%,_#eceeeb_100%)] py-14">
        <div className="section-shell grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
          <div>
            <h3 className="text-4xl font-medium leading-tight md:text-5xl">Subscribe to our Newsletter</h3>
            <p className="mt-3 max-w-md text-sm leading-[1.55] text-brand-muted">
              Receive practical updates for diligence, leadership risk, and hold-period execution.
            </p>
          </div>
          <form className="grid grid-cols-1 gap-3 sm:grid-cols-2" onSubmit={handleSubscribe}>
            <input
              aria-label="First Name"
              className="h-11 rounded-md border border-[#d4d8d1] bg-white px-3 text-sm text-brand-ink outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
              placeholder="First Name"
            />
            <input
              aria-label="Last Name"
              className="h-11 rounded-md border border-[#d4d8d1] bg-white px-3 text-sm text-brand-ink outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
              placeholder="Last Name"
            />
            <input
              aria-label="Email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setSubscribeError('');
                if (subscribeSuccess) setSubscribeSuccess('');
              }}
              className="h-11 rounded-md border border-[#d4d8d1] bg-white px-3 text-sm text-brand-ink outline-none focus-visible:ring-2 focus-visible:ring-brand-green sm:col-span-2"
              placeholder="Email"
            />
            <input
              aria-label="Company"
              className="h-11 rounded-md border border-[#d4d8d1] bg-white px-3 text-sm text-brand-ink outline-none focus-visible:ring-2 focus-visible:ring-brand-green sm:col-span-2"
              placeholder="Company"
            />
            <input
              aria-label="City"
              className="h-11 rounded-md border border-[#d4d8d1] bg-white px-3 text-sm text-brand-ink outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
              placeholder="City"
            />
            <input
              aria-label="State"
              className="h-11 rounded-md border border-[#d4d8d1] bg-white px-3 text-sm text-brand-ink outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
              placeholder="State"
            />
            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-1 h-11 rounded-md border border-brand-green bg-white px-5 text-sm font-medium text-brand-ink transition-colors hover:bg-brand-greenTint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green disabled:cursor-not-allowed disabled:opacity-70 sm:w-fit"
            >
              {isSubmitting ? 'Subscribing...' : 'Subscribe'}
            </button>
            <div className="min-h-[20px] sm:col-span-2">
              {subscribeError ? <p className="text-xs text-[#af3f33]">{subscribeError}</p> : null}
              {subscribeSuccess ? <p className="text-xs text-brand-green">{subscribeSuccess}</p> : null}
            </div>
          </form>
        </div>
      </section>

      <div className="section-shell py-12">
        <div className="grid gap-10 md:grid-cols-[1.2fr_1fr_1fr_1fr_1fr]">
          <div>
            <a href="#" className="inline-flex items-center">
              <Image src="/company-logo.png" alt="Entromy" width={136} height={34} className="h-8 w-auto object-contain" />
            </a>
          </div>

          <div>
            <p className="text-[15px] font-medium text-brand-ink">Solutions</p>
            <ul className="mt-4 space-y-3 text-[15px] text-brand-muted">
              <li><a href="#capabilities" className="transition-colors hover:text-brand-ink">Organizational Health</a></li>
              <li><a href="#outcomes" className="transition-colors hover:text-brand-ink">Leadership Capability</a></li>
              <li><a href="#outcomes" className="transition-colors hover:text-brand-ink">Strategy Viability</a></li>
              <li><a href="#agent-module" className="transition-colors hover:text-brand-ink">Support</a></li>
            </ul>
          </div>

          <div>
            <p className="text-[15px] font-medium text-brand-ink">Why Entromy</p>
            <ul className="mt-4 space-y-3 text-[15px] text-brand-muted">
              <li><a href="#why-entromy" className="transition-colors hover:text-brand-ink">Private Equity</a></li>
              <li><a href="#why-entromy" className="transition-colors hover:text-brand-ink">Management Consultants</a></li>
              <li><a href="#why-entromy" className="transition-colors hover:text-brand-ink">Business Executives</a></li>
            </ul>
          </div>

          <div>
            <p className="text-[15px] font-medium text-brand-ink">Company</p>
            <ul className="mt-4 space-y-3 text-[15px] text-brand-muted">
              <li><a href="#" className="transition-colors hover:text-brand-ink">About Entromy</a></li>
              <li><a href="#" className="transition-colors hover:text-brand-ink">Insights</a></li>
              <li><a href="#cta" className="transition-colors hover:text-brand-ink">Contact</a></li>
            </ul>
          </div>

          <div>
            <p className="text-[15px] font-medium text-brand-ink">Legal</p>
            <ul className="mt-4 space-y-3 text-[15px] text-brand-muted">
              <li><a href="#" className="transition-colors hover:text-brand-ink">Privacy Policy</a></li>
              <li><a href="#" className="transition-colors hover:text-brand-ink">Terms and Conditions</a></li>
              <li><a href="#" className="transition-colors hover:text-brand-ink">GDPR</a></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-brand-line pt-6 text-sm text-brand-muted">
          <p>© {new Date().getFullYear()} Entromy. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
