import { ArrowUpRight, Wind } from "lucide-react";
import Link from "next/link";
import { messages, type Locale, type Messages } from "../i18n/messages";

export function PlannerHeader({
  locale,
  onLanguage,
}: {
  locale: Locale;
  onLanguage: (locale: Locale) => void;
}) {
  const text = messages[locale];
  return (
    <>
      <a className="skip-link" href="#content">
        {text.skip}
      </a>
      <header className="masthead">
        <div className="site-width masthead-inner">
          <Link className="brand" href="/" aria-label={text.home}>
            <span>
              <Wind size={23} aria-hidden />
            </span>
            SmogShift
          </Link>
          <div className="masthead-actions">
            <span className="header-context">{text.header}</span>
            <label className="language-field">
              <span className="sr-only">{text.language}</span>
              <select
                value={locale}
                onChange={(event) =>
                  onLanguage(event.target.value === "hi" ? "hi" : "en")
                }
              >
                <option value="en" lang="en">
                  English
                </option>
                <option value="hi" lang="hi">
                  हिन्दी
                </option>
              </select>
            </label>
          </div>
        </div>
      </header>
    </>
  );
}

export function PlannerFooter({ text }: { text: Messages }) {
  return (
    <footer className="site-width footer">
      <span>{text.footer}</span>
      <a href="https://ews.tropmet.res.in/">
        {text.official} <ArrowUpRight size={14} aria-hidden />
      </a>
      <a href="https://ncdc.mohfw.gov.in/uploads/pdf/air7.pdf">
        {text.guidance} <ArrowUpRight size={14} aria-hidden />
      </a>
    </footer>
  );
}
