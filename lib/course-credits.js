const CREDIT_UNIT_PATTERN = /\b(ce|ceu|ceus|cde|credit|credits|contact hour|contact hours|hour|hours)\b/i;
const DATE_PATTERN = /(?:\b\d{4}-\d{1,2}-\d{1,2}\b|\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?(?:,\s*|\s+)\d{4}\b)/i;

function finitePositiveNumber(value) {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

export function isValidCreditsText(value) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text || DATE_PATTERN.test(text)) return false;
  if (/\b(not specified|n\/a|none|tbd|unknown)\b/i.test(text)) return false;

  const numericOnly = text.match(/^\d+(?:\.\d+)?$/);
  if (numericOnly) return Number(numericOnly[0]) > 0;

  return CREDIT_UNIT_PATTERN.test(text) && /\d+(?:\.\d+)?/.test(text);
}

export function normalizeCredits(creditsTextValue, creditsValue) {
  const text = String(creditsTextValue || '').replace(/\s+/g, ' ').trim();
  const textIsValid = isValidCreditsText(text);
  const explicitNumber = finitePositiveNumber(creditsValue);

  // When a populated label is malformed, do not trust a number derived from it.
  if (text && !textIsValid) {
    return { text: '', amount: null };
  }

  if (textIsValid) {
    const amountFromText = finitePositiveNumber(text.match(/\d+(?:\.\d+)?/)?.[0]);
    return { text, amount: explicitNumber || amountFromText };
  }

  return explicitNumber
    ? { text: `${explicitNumber} credit${explicitNumber === 1 ? '' : 's'}`, amount: explicitNumber }
    : { text: '', amount: null };
}

export function formatCreditsForDisplay(creditsTextValue, creditsValue) {
  const credits = normalizeCredits(creditsTextValue, creditsValue);
  if (!credits.text) return '';
  return /\b(ce|ceu|ceus|cde|credit|credits|hour|hours)\b/i.test(credits.text)
    ? credits.text
    : `${credits.text} credits`;
}
