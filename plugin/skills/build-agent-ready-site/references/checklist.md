# Checklist

## Metadata

- A distinct title per page, under 60 characters, saying what the page is.
- A meta description per page.
- An absolute, self-referencing canonical on every indexable page.
- `lang` on the html element.

## Headings and content

- One H1 per page, in the server HTML.
- Open each question heading with a one or two sentence answer that makes sense quoted alone.
- Specific facts and numbers with their sources; tables where the reader compares.

## Structured data

- JSON-LD in the server HTML, valid, with the properties its type requires.
- Organization on the home page: name, url, logo, sameAs, contact details.
- The page type's own schema (Product, Article, FAQPage, LocalBusiness) with values from the
  page.

## Links

- Plain `<a href>` links for navigation, not click handlers.
- Every money page within three clicks of the home page.
- Internal links point at final URLs, never at redirects; no internal nofollow.

## Crawl files

- `robots.txt` allows the search and answer crawlers on pages meant to be found: Googlebot,
  Bingbot, OAI-SearchBot, ChatGPT-User, Claude-User, PerplexityBot. Blocking training crawlers
  (GPTBot, ClaudeBot, Google-Extended, CCBot) is the owner's choice.
- `robots.txt` names the sitemap; the sitemap lists only indexable 200 pages.
- Optional: `/llms.txt` with an H1 site name, a one-line summary, and H2 sections linking the
  key pages with one line each.

## International

- hreflang on every locale version, each listing all the others and itself, with valid codes.

## Speed

- LCP under 2.5 s and CLS under 0.1: size images, preload the main one, reserve space for
  late content.

## Agent use

- Every control has an accessible name: a label, `aria-label` or link text.
- Key forms (quote, booking, search, contact) work without hover-only steps.
- Consider WebMCP for those forms: `toolname`, `tooldescription` and `toolparamdescription` on
  the form and its inputs.
- Real errors return real status codes: a missing page answers 404, not 200 with a "not found"
  message.
