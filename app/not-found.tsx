import type { Metadata } from "next";
import { NoticePage } from "@/components/layout/NoticePage";
import { Button } from "@/components/ui/Button";
import { ctaHref, ctaLabel } from "@/content/navigation";
import { opensBooking } from "@/lib/booking/openers";

const title = "Diese Seite gibt es nicht (mehr).";

export const metadata: Metadata = {
  title: title.replace(/\.$/, ""),
  robots: { index: false },
};

/** Deutsche 404 statt des englischen Standardtexts – mit dem Weg zum Termin. */
export default function NotFound() {
  return (
    <NoticePage title={title}>
      <Button href={ctaHref} {...opensBooking()} withArrow>
        {ctaLabel}
      </Button>
      <Button href="/" variant="outline">
        Zur Startseite
      </Button>
    </NoticePage>
  );
}
