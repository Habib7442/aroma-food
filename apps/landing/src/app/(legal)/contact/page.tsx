"use client";

import { useState } from "react";
import { ArrowRightIcon } from "@/components/icons";

const PHONE_NUMBER = "917637989226";

const CONTACT_INFO = [
  {
    icon: "📞",
    title: "Phone & WhatsApp Support",
    value: "+91 7637989226",
    href: `https://wa.me/${PHONE_NUMBER}?text=${encodeURIComponent("Hi Zaavo Team, I have an inquiry regarding Zaavo food delivery.")}`,
    subtitle: "Direct WhatsApp line for customer & partner support",
  },
  {
    icon: "✉️",
    title: "Email Us",
    value: "aromamobiledevelopment@gmail.com",
    href: "mailto:aromamobiledevelopment@gmail.com",
    subtitle: "We usually respond within a few hours",
  },
  {
    icon: "📍",
    title: "Office Address",
    value: "2nd Link Road, Silchar, Assam, 788015, India",
    href: "https://maps.google.com/?q=2nd+Link+Road,+Silchar,+Assam,+788015",
    subtitle: "Zaavo Headquarters in Silchar",
  },
  {
    icon: "🕒",
    title: "Support Hours",
    value: "9:00 AM – 10:00 PM IST",
    subtitle: "Available 7 days a week",
  },
];

export default function ContactPage() {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [message, setMessage] = useState("");

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    const prefilledText = `Hi Zaavo Team,\n\nName: ${name || "Customer"}\nContact: ${contact || "N/A"}\nMessage: ${message || "I have an inquiry regarding Zaavo."}`;
    const whatsappUrl = `https://wa.me/${PHONE_NUMBER}?text=${encodeURIComponent(prefilledText)}`;
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
  };

  const partnerPrefilledText = "Hi Zaavo Team, I am a restaurant owner in Silchar and I would like to partner with Zaavo to list my restaurant!";
  const partnerWhatsappUrl = `https://wa.me/${PHONE_NUMBER}?text=${encodeURIComponent(partnerPrefilledText)}`;

  return (
    <article className="space-y-12">
      {/* Header Section */}
      <div className="space-y-4">
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-semibold text-primary">
          <span className="h-2 w-2 rounded-full bg-primary" />
          Get In Touch
        </span>
        <h1 className="font-display text-4xl font-extrabold tracking-[-0.02em] text-on-surface sm:text-5xl">
          We&apos;re here to help in <span className="text-primary">Silchar.</span>
        </h1>
        <p className="max-w-xl text-base leading-relaxed text-on-surface-variant sm:text-lg">
          Have a question about an order, restaurant partnership, or feedback?
          Reach out directly to our WhatsApp support in Silchar.
        </p>
      </div>

      {/* Contact Cards Grid */}
      <div className="grid gap-6 sm:grid-cols-2">
        {CONTACT_INFO.map((item) => (
          <div
            key={item.title}
            className="group flex flex-col justify-between rounded-xl border bg-surface-container-lowest p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-md"
            style={{ borderColor: "var(--color-card-border)" }}
          >
            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-container-low text-2xl">
                {item.icon}
              </div>
              <h2 className="mt-4 font-display text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                {item.title}
              </h2>
              {item.href ? (
                <a
                  href={item.href}
                  target={item.href.startsWith("http") ? "_blank" : undefined}
                  rel={item.href.startsWith("http") ? "noopener noreferrer" : undefined}
                  className="mt-1 block font-display text-base font-bold text-on-surface hover:text-primary hover:underline break-words"
                >
                  {item.value}
                </a>
              ) : (
                <p className="mt-1 font-display text-base font-bold text-on-surface break-words">
                  {item.value}
                </p>
              )}
              <p className="mt-1 text-xs text-on-surface-variant">{item.subtitle}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Message Form (Connected to WhatsApp) */}
      <div className="rounded-2xl border border-[var(--color-card-border)] bg-surface-container-lowest p-8 shadow-sm sm:p-10">
        <h2 className="font-display text-2xl font-bold text-on-surface">
          Send us a message on WhatsApp
        </h2>
        <p className="mt-1 text-sm text-on-surface-variant">
          Fill out the details below and clicking send will open a prefilled WhatsApp chat with our team.
        </p>

        <form onSubmit={handleSendMessage} className="mt-8 space-y-6">
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label htmlFor="name" className="block text-xs font-semibold text-on-surface">
                Your Name
              </label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                className="mt-2 w-full rounded-lg border border-outline-variant/60 bg-surface-container-lowest px-4 py-3 text-sm text-on-surface placeholder-outline focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-on-surface">
                Email Address or Phone
              </label>
              <input
                type="text"
                id="email"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="Enter your email or phone"
                className="mt-2 w-full rounded-lg border border-outline-variant/60 bg-surface-container-lowest px-4 py-3 text-sm text-on-surface placeholder-outline focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label htmlFor="message" className="block text-xs font-semibold text-on-surface">
              Message
            </label>
            <textarea
              id="message"
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="How can we help you?"
              className="mt-2 w-full rounded-lg border border-outline-variant/60 bg-surface-container-lowest px-4 py-3 text-sm text-on-surface placeholder-outline focus:border-primary focus:outline-none"
            />
          </div>

          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-8 py-3.5 font-display text-sm font-bold text-on-primary transition-all hover:opacity-95 active:scale-95 shadow-md"
          >
            <span>Send Message on WhatsApp</span>
            <ArrowRightIcon className="h-4 w-4" />
          </button>
        </form>
      </div>

      {/* Partner Banner (Connected to WhatsApp) */}
      <div className="rounded-xl border border-primary/20 bg-primary-container/20 p-6 text-on-surface sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-display text-lg font-bold text-on-surface">
              Are you a restaurant owner in Silchar?
            </h3>
            <p className="mt-1 text-sm text-on-surface-variant">
              Join Zaavo to start receiving orders from thousands of local customers.
            </p>
          </div>
          <a
            href={partnerWhatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-2 rounded-full bg-primary px-6 py-3 font-display text-sm font-bold text-on-primary transition-opacity hover:opacity-90 active:scale-95"
          >
            <span>Partner with Us on WhatsApp</span>
            <ArrowRightIcon className="h-4 w-4" />
          </a>
        </div>
      </div>
    </article>
  );
}
