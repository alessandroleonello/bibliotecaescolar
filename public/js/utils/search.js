/**
 * Text normalization and search tokens generator
 */

export function normalizeText(str) {
  if (!str) return '';
  return str
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Generates an array of search tokens for Firestore array-contains queries
 */
export function generateSearchTokens(...fields) {
  const tokenSet = new Set();
  
  fields.forEach(field => {
    if (!field) return;
    const normalized = normalizeText(field);
    const words = normalized.split(/[\s,.-]+/);
    
    words.forEach(word => {
      if (word.length >= 2) {
        tokenSet.add(word);
        // Prefix tokens for typeahead
        for (let i = 2; i <= Math.min(word.length, 8); i++) {
          tokenSet.add(word.substring(0, i));
        }
      }
    });
  });

  return Array.from(tokenSet).slice(0, 50); // Safe limit for Firestore index
}
