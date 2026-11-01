/** Texts of the e-mails (pure, unit-tested in tests/staff). Every visitor value is escaped. */
import { bookingMessage, type BookingSummary } from "./booking-message.ts";

type Lang = "fr" | "ar";

export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
// One line, no control characters: the values come from the visitor.
const line = (s: string, max = 120) => s.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

function page(lang: Lang, body: string) {
  const dir = lang === "ar" ? "rtl" : "ltr";
  return `<!doctype html><html lang="${lang}" dir="${dir}"><body style="margin:0;padding:24px;background:#f4f6fb;font-family:Arial,Helvetica,sans-serif;color:#14213d">
<div style="max-width:520px;margin:0 auto;padding:28px;background:#ffffff;border-radius:16px">
<p style="margin:0 0 18px;font-size:20px;font-weight:bold;color:#0858f8">GoodFly</p>
${body}
</div></body></html>`;
}

const CODE = {
  fr: {
    subject: (code: string) => `Votre code GoodFly : ${code}`,
    intro: "Voici votre code pour confirmer votre adresse e-mail et envoyer votre demande de réservation :",
    valid: "Ce code est valable 10 minutes. Ne le communiquez à personne : GoodFly ne vous le demandera jamais par téléphone.",
    ignore: "Vous n'avez rien demandé ? Ignorez simplement ce message.",
  },
  ar: {
    subject: (code: string) => `رمز GoodFly الخاص بك: ${code}`,
    intro: "هذا هو الرمز لتأكيد بريدك الإلكتروني وإرسال طلب الحجز:",
    valid: "هذا الرمز صالح لمدة 10 دقائق. لا تعطه لأي أحد: GoodFly لن تطلبه منك أبدًا عبر الهاتف.",
    ignore: "لم تطلب شيئًا؟ تجاهل هذه الرسالة فقط.",
  },
};

/** The 6-digit code sent to the client. */
export function codeMail(lang: Lang, code: string) {
  const t = CODE[lang];
  return {
    subject: t.subject(code),
    text: `${t.intro}\n\n${code}\n\n${t.valid}\n\n${t.ignore}`,
    html: page(
      lang,
      `<p style="margin:0 0 16px">${esc(t.intro)}</p>
<p dir="ltr" style="margin:0 0 16px;font-size:34px;font-weight:bold;letter-spacing:8px;text-align:center">${esc(code)}</p>
<p style="margin:0 0 12px;color:#4a5578">${esc(t.valid)}</p>
<p style="margin:0;color:#4a5578">${esc(t.ignore)}</p>`,
    ),
  };
}

const DONE = {
  fr: {
    subject: (ref: string) => `Demande reçue : ${ref}`,
    hello: (name: string) => `Bonjour ${name},`,
    body: "Nous avons bien reçu votre demande. Un conseiller GoodFly vous rappelle au plus vite pour confirmer les détails et le prix. Rien n'est payé en ligne.",
    ref: "Votre référence (à donner au conseiller) :",
    trip: "Votre demande :",
    contact: "Une question ? Répondez à ce message ou appelez le 05 30 16 43 43.",
  },
  ar: {
    subject: (ref: string) => `تم استلام طلبك: ${ref}`,
    hello: (name: string) => `مرحبًا ${name}،`,
    body: "توصلنا بطلبك. سيتصل بك مستشار من GoodFly في أقرب وقت لتأكيد التفاصيل والسعر. لا يتم أي دفع عبر الإنترنت.",
    ref: "مرجعك (قدمه للمستشار):",
    trip: "طلبك:",
    contact: "عندك سؤال؟ أجب على هذه الرسالة أو اتصل بالرقم 05 30 16 43 43.",
  },
};

/** Confirmation sent to the client after the request is saved. */
export function confirmationMail(lang: Lang, name: string, b: BookingSummary) {
  const t = DONE[lang];
  const trip = line(b.program_title ?? "") || [line(b.from_place ?? ""), line(b.to_place ?? "")].filter(Boolean).join(" → ");
  const details = [trip, line(b.travel_dates ?? "")].filter(Boolean).join(" · ");
  const hello = t.hello(line(name, 60));
  return {
    subject: t.subject(b.reference),
    text: [hello, "", t.body, "", t.ref, b.reference, ...(details ? ["", t.trip, details] : []), "", t.contact].join("\n"),
    html: page(
      lang,
      `<p style="margin:0 0 12px">${esc(hello)}</p>
<p style="margin:0 0 16px">${esc(t.body)}</p>
<p style="margin:0 0 4px;color:#4a5578">${esc(t.ref)}</p>
<p dir="ltr" style="margin:0 0 16px;font-size:26px;font-weight:bold;letter-spacing:2px">${esc(b.reference)}</p>
${details ? `<p style="margin:0 0 4px;color:#4a5578">${esc(t.trip)}</p><p dir="auto" style="margin:0 0 16px">${esc(details)}</p>` : ""}
<p style="margin:0;color:#4a5578">${esc(t.contact)}</p>`,
    ),
  };
}

/** Alert to the agency mailbox and the Direction accounts: same content as the phone alert (no client contact details). */
export function staffBookingMail(b: BookingSummary, staffUrl?: string) {
  return { subject: `Nouvelle demande ${b.reference}`, text: bookingMessage(b, staffUrl) };
}

/** Alert between the two Direction accounts (removal / restore requests and decisions). */
export function directionMail(title: string, body: string, url?: string) {
  return { subject: `GoodFly : ${line(title)}`, text: [line(body, 300), ...(url ? ["", `Ouvrir : ${url}`] : [])].join("\n") };
}
