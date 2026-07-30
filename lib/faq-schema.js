/**
 * Derives FAQPage structured data from the rendered view markup so the schema can
 * never drift out of sync with the visible questions.
 *
 * Expects the pattern used across the views:
 *   <details class="faq-item"><summary>Q</summary><div class="faq-body">…A…</div></details>
 */

const ITEM_RE =
  /<details class="faq-item"[^>]*>\s*<summary>([\s\S]*?)<\/summary>\s*<div class="faq-body">([\s\S]*?)<\/div>\s*<\/details>/g;

function decodeEntities(s) {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function toPlainText(html) {
  return decodeEntities(
    html
      .replace(/<\/(p|li|div|h[2-6])>/gi, ' ')
      .replace(/<li>/gi, ' • ')
      .replace(/<[^>]+>/g, ''),
  )
    .replace(/\s+/g, ' ')
    .trim();
}

/** @returns {object|null} FAQPage schema, or null when the view has no FAQ items. */
export function faqSchemaFromView(html) {
  const entities = [];
  for (const match of html.matchAll(ITEM_RE)) {
    const question = toPlainText(match[1]);
    const answer = toPlainText(match[2]);
    if (question && answer) {
      entities.push({
        '@type': 'Question',
        name: question,
        acceptedAnswer: { '@type': 'Answer', text: answer },
      });
    }
  }
  if (!entities.length) return null;

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: entities,
  };
}
