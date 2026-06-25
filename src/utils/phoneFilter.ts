// Filters phone numbers, social media handles, emails, and URLs from in-call chat messages

const PHONE_PATTERNS = [
  /(\+91|0)?[6-9]\d{9}/g,                    // Indian mobile numbers
  /(\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,  // International format
  /\b\d{10,12}\b/g,                           // Any 10-12 digit sequence
];

const SOCIAL_PATTERNS = [
  /\b(?:insta(?:gram)?|ig)\s*[:@.\-_]\s*\S+/gi,        // instagram handles
  /\b(?:snap(?:chat)?|sc)\s*[:@.\-_]\s*\S+/gi,           // snapchat
  /\b(?:whats?\s*app|wa\.me)\s*[:@.\-_]?\s*\S*/gi,       // whatsapp
  /\b(?:telegram|t\.me)\s*[:@.\-_]?\s*\S*/gi,            // telegram
  /\b(?:facebook|fb)\s*[:@.\-_]?\s*\S*/gi,               // facebook
  /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g, // email addresses
  /https?:\/\/\S+/gi,                                      // URLs with protocol
  /www\.\S+/gi,                                            // URLs with www
  /@[a-zA-Z0-9._]{3,}/g,                                  // @handles (generic)
];

const ALL_PATTERNS = [...PHONE_PATTERNS, ...SOCIAL_PATTERNS];

export const filterSensitiveContent = (message: string): { filtered: string; wasFiltered: boolean } => {
  let filtered = message;
  let wasFiltered = false;

  for (const pattern of ALL_PATTERNS) {
    pattern.lastIndex = 0; // Reset regex state
    const newFiltered = filtered.replace(pattern, '***');
    if (newFiltered !== filtered) {
      wasFiltered = true;
      filtered = newFiltered;
    }
  }

  return { filtered, wasFiltered };
};

// Backward-compatible alias
export const filterPhoneNumbers = filterSensitiveContent;
