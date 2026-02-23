const EMAIL_SHAPE_REGEX =
  /^(?=.{3,254}$)(?!.*\s)([A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+)@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+)$/;

// Format-only validation for UX and basic API hygiene; this does not verify mailbox existence or deliverability.
export function isValidEmailAddress(input: string): boolean {
  const email = input.trim();
  const match = email.match(EMAIL_SHAPE_REGEX);
  if (!match) return false;

  const localPart = match[1];
  const domainPart = match[2];

  if (localPart.startsWith('.') || localPart.endsWith('.') || localPart.includes('..')) {
    return false;
  }

  const labels = domainPart.split('.');
  if (labels.length < 2) return false;
  if (labels.some((label) => !label || label.startsWith('-') || label.endsWith('-'))) {
    return false;
  }

  const tld = labels[labels.length - 1];
  if (!/^[A-Za-z]{2,}$/.test(tld)) {
    return false;
  }

  return true;
}
