import type { Metadata } from "next";
import { NoticePage } from "@/components/layout/NoticePage";
import { Button } from "@/components/ui/Button";
import { ctaHref, ctaLabel } from "@/content/navigation";

const title = "Diese Seite gibt es nicht (mehr).";

export const metadata: Metadata = {
  title: title.replace(/\.$/, ""),
  robots: { index: false },
};

/** Deutsche 404 statt des englischen Standardtexts – mit dem Weg zum Termin. */
export default function NotFound() {
  return (
    <NoticePage title={title}>
      <Button href={ctaHref} withArrow>
        {ctaLabel}
      </Button>
      <Button href="/" variant="outline">
        Zur Startseite
      </Button>
    </NoticePage>
  );
}
