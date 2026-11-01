/** WhatsApp "click to chat" links for staff (official wa.me links, free). Pure, unit-tested. */

/**
 * Client phone → international digits for wa.me. Moroccan numbers typed locally
 * (06…, 07…, 05…) get the 212 country code. Returns null when it cannot be a mobile/landline.
 */
export function waNumber(phone: string): string | null {
  const raw = phone.trim();
  let d = raw.replace(/\D/g, "");
  if (raw.startsWith("+")) {
    // already international
  } else if (d.startsWith("00")) {
    d = d.slice(2);
  } else if (/^0[5-7]\d{8}$/.test(d)) {
    d = `212${d.slice(1)}`;
  }
  if (d.startsWith("2120")) d = `212${d.slice(4)}`; // "+212 0612…" typo
  return /^[1-9]\d{7,14}$/.test(d) ? d : null;
}

/** Link that opens WhatsApp with a first message in the client's language. */
export function waLink(phone: string, reference: string, lang: string, staffName: string): string | null {
  const n = waNumber(phone);
  if (!n) return null;
  const who = staffName.trim().slice(0, 60);
  const text =
    lang === "ar"
      ? `السلام عليكم، معك ${who || "فريق"} GoodFly بخصوص طلب الحجز ${reference}.`
      : `Bonjour, ${who ? `${who} de ` : ""}GoodFly au sujet de votre demande de réservation ${reference}.`;
  return `https://wa.me/${n}?text=${encodeURIComponent(text)}`;
}
