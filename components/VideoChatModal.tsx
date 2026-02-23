'use client';

import { type FormEvent, useEffect, useMemo, useState } from 'react';

interface VideoChatModalProps {
  open: boolean;
  onClose: () => void;
}

interface IntakeFormState {
  name: string;
  email: string;
  firm: string;
  role: string;
  topic: string;
  context: string;
  urgency: string;
}

const roleOptions = ['Deal Partner', 'Operating Partner', 'Portfolio Ops', 'HR / Talent', 'Management Team', 'Other'];

const topicOptions = [
  'Leadership risk',
  'CEO transition',
  'First 100 days',
  'Execution cadence',
  'Portfolio comparison',
  'Exit readiness',
  'Other'
];

const urgencyOptions = ['Today', 'This week', 'Flexible'];

const timeSlots = ['Today · 3:00 PM', 'Today · 4:30 PM', 'Tomorrow · 10:00 AM', 'Tomorrow · 1:30 PM', 'Thu · 11:00 AM'];

const initialFormState: IntakeFormState = {
  name: '',
  email: '',
  firm: '',
  role: '',
  topic: '',
  context: '',
  urgency: ''
};

export function VideoChatModal({ open, onClose }: VideoChatModalProps) {
  const [form, setForm] = useState<IntakeFormState>(initialFormState);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [submitted, setSubmitted] = useState(false);

  // Prototype modal behavior: supports escape and backdrop-close while simulating a lightweight intake flow.
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (open) return;

    setForm(initialFormState);
    setSelectedSlot('');
    setSubmitted(false);
  }, [open]);

  const isEmailValid = useMemo(() => {
    const trimmed = form.email.trim();
    return trimmed.includes('@') && trimmed.includes('.');
  }, [form.email]);

  const isFormComplete = useMemo(() => {
    return Boolean(
      form.name.trim() &&
        isEmailValid &&
        form.firm.trim() &&
        form.role &&
        form.topic &&
        form.urgency &&
        selectedSlot
    );
  }, [form, isEmailValid, selectedSlot]);

  const updateField = <K extends keyof IntakeFormState>(key: K, value: IntakeFormState[K]) => {
    setForm((previous) => ({ ...previous, [key]: value }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isFormComplete) return;
    setSubmitted(true);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4" onClick={onClose} role="presentation">
      <div
        className="w-full max-w-2xl rounded-xl border border-brand-line bg-white p-5 shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="video-chat-title"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-muted">Prototype Flow</p>
            <h3 id="video-chat-title" className="mt-1.5 text-xl font-medium text-brand-ink">
              Book a 10-minute specialist call
            </h3>
            <p className="mt-2 text-sm leading-[1.5] text-brand-muted">
              Share a few details so we can route you to the right Entromy specialist.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-sm border border-brand-line px-2 py-1 text-xs text-brand-muted transition hover:bg-brand-panel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
            aria-label="Close modal"
          >
            Close
          </button>
        </div>

        {submitted ? (
          <div className="mt-6 rounded-md border border-brand-greenLine bg-brand-greenTint p-4">
            <h4 className="text-base font-medium text-brand-ink">Call requested</h4>
            <p className="mt-2 text-sm leading-[1.55] text-brand-muted">
              We’ve captured your request and a specialist will follow up shortly with a calendar invite.
            </p>
            <p className="mt-2 text-xs leading-[1.5] text-brand-muted">
              For urgent decisions, include portfolio company and timeline context in the note.
            </p>
            <div className="mt-4 flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md bg-brand-green px-4 py-2.5 text-[13px] font-medium text-white transition-colors hover:bg-brand-greenHover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="call-name" className="text-xs font-medium uppercase tracking-[0.1em] text-brand-muted">
                  Name
                </label>
                <input
                  id="call-name"
                  value={form.name}
                  onChange={(event) => updateField('name', event.target.value)}
                  className="mt-1.5 h-10 w-full rounded-md border border-brand-line bg-white px-3 text-sm text-brand-ink outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
                  required
                />
              </div>
              <div>
                <label htmlFor="call-email" className="text-xs font-medium uppercase tracking-[0.1em] text-brand-muted">
                  Work email
                </label>
                <input
                  id="call-email"
                  type="email"
                  value={form.email}
                  onChange={(event) => updateField('email', event.target.value)}
                  className="mt-1.5 h-10 w-full rounded-md border border-brand-line bg-white px-3 text-sm text-brand-ink outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
                  required
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="call-firm" className="text-xs font-medium uppercase tracking-[0.1em] text-brand-muted">
                  Firm / portfolio company
                </label>
                <input
                  id="call-firm"
                  value={form.firm}
                  onChange={(event) => updateField('firm', event.target.value)}
                  className="mt-1.5 h-10 w-full rounded-md border border-brand-line bg-white px-3 text-sm text-brand-ink outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
                  required
                />
              </div>
              <div>
                <label htmlFor="call-role" className="text-xs font-medium uppercase tracking-[0.1em] text-brand-muted">
                  Role
                </label>
                <select
                  id="call-role"
                  value={form.role}
                  onChange={(event) => updateField('role', event.target.value)}
                  className="mt-1.5 h-10 w-full rounded-md border border-brand-line bg-white px-3 text-sm text-brand-ink outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
                  required
                >
                  <option value="">Select role</option>
                  {roleOptions.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="call-topic" className="text-xs font-medium uppercase tracking-[0.1em] text-brand-muted">
                  Topic
                </label>
                <select
                  id="call-topic"
                  value={form.topic}
                  onChange={(event) => updateField('topic', event.target.value)}
                  className="mt-1.5 h-10 w-full rounded-md border border-brand-line bg-white px-3 text-sm text-brand-ink outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
                  required
                >
                  <option value="">Select topic</option>
                  {topicOptions.map((topic) => (
                    <option key={topic} value={topic}>
                      {topic}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.1em] text-brand-muted">Urgency</p>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {urgencyOptions.map((urgency) => (
                    <button
                      key={urgency}
                      type="button"
                      onClick={() => updateField('urgency', urgency)}
                      className={`rounded-full border px-3 py-1.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green ${
                        form.urgency === urgency
                          ? 'border-brand-green bg-brand-greenTint text-brand-ink'
                          : 'border-brand-line bg-white text-brand-muted hover:bg-brand-panel'
                      }`}
                    >
                      {urgency}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="call-context" className="text-xs font-medium uppercase tracking-[0.1em] text-brand-muted">
                Optional context
              </label>
              <textarea
                id="call-context"
                value={form.context}
                onChange={(event) => updateField('context', event.target.value)}
                className="mt-1.5 min-h-[90px] w-full rounded-md border border-brand-line bg-white px-3 py-2.5 text-sm text-brand-ink outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
                placeholder="We’re 45 days post-close and seeing leadership turnover in a key function..."
              />
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-[0.1em] text-brand-muted">Available slots</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {timeSlots.map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => setSelectedSlot(slot)}
                    className={`rounded-md border px-3 py-2 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green ${
                      selectedSlot === slot
                        ? 'border-brand-green bg-brand-greenTint text-brand-ink'
                        : 'border-brand-line bg-white text-brand-muted hover:bg-brand-panel'
                    }`}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2.5 pt-1">
              <button
                type="submit"
                disabled={!isFormComplete}
                className="rounded-md bg-brand-green px-4 py-2.5 text-[13px] font-medium text-white transition-colors hover:bg-brand-greenHover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green disabled:cursor-not-allowed disabled:bg-[#89b86a]"
              >
                Confirm call
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-brand-line px-4 py-2.5 text-[13px] font-medium text-brand-muted transition-colors hover:bg-brand-panel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
