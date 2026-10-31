import { match } from "@formatjs/intl-localematcher";
import Negotiator from "negotiator";
import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale, locales } from "@/i18n/config";
import { updateSession } from "@/lib/supabase/proxy";

function preferredLocale(request: NextRequest): string {
  const headers = { "accept-language": request.headers.get("accept-language") ?? "" };
  const languages = new Negotiator({ headers }).languages();
  try {
    return match(languages, locales as unknown as string[], defaultLocale);
  } catch {
    return defaultLocale;
  }
}

const STAFF = new RegExp(`^/(${locales.join("|")})/espace(/|$)`);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // Staff area: keep the Supabase session fresh (public pages stay fully static).
  if (STAFF.test(pathname)) return updateSession(request);

  const hasLocale = locales.some(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
  );
  if (hasLocale) return;

  const url = request.nextUrl.clone();
  url.pathname = `/${preferredLocale(request)}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Skip Next internals, API routes and files with an extension (images, fonts, models).
  matcher: ["/((?!_next|api|.*\\..*).*)"],
};
