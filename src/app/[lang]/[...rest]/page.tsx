import { notFound } from "next/navigation";

/** Any address under /fr or /ar that matches no page shows the site's own 404 (with header and footer). */
export default function UnknownPage() {
  notFound();
}
