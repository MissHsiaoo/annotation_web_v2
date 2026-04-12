// Translation utility using Google Translate free API
// No API key required, more reliable than MyMemory

interface TranslationCache {
  [key: string]: string;
}

const translationCache: TranslationCache = {};

// Track request timing to implement rate limiting
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 200; // Minimum 200ms between requests (Google is more permissive)
const MAX_TRANSLATION_CHARS = 900;

// Simple sleep function
async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Google Translate free API with retry logic
async function fetchGoogleTranslate(text: string, maxRetries = 2): Promise<string | null> {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=zh-CN&dt=t&q=${encodeURIComponent(text)}`;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Enforce minimum interval between requests
      const now = Date.now();
      const timeSinceLastRequest = now - lastRequestTime;
      if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
        await sleep(MIN_REQUEST_INTERVAL - timeSinceLastRequest);
      }
      lastRequestTime = Date.now();

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 429) {
          const waitTime = Math.pow(2, attempt) * 500; // 500ms, 1s
          console.warn(`Rate limited (429). Waiting ${waitTime}ms before retry ${attempt + 1}/${maxRetries}...`);
          await sleep(waitTime);
          continue;
        }
        console.warn(`Google Translate API returned status ${response.status}`);
        return null;
      }

      const data = await response.json();
      
      // Google Translate returns format: [[["translated text", "original text", null, null, 10]], null, "en", ...]
      if (data && Array.isArray(data) && data[0] && Array.isArray(data[0])) {
        const translations = data[0]
          .filter((item: any) => Array.isArray(item) && item[0])
          .map((item: any) => item[0])
          .join('');
        
        return translations || null;
      }
      
      return null;
    } catch (error) {
      if (attempt === maxRetries - 1) {
        console.warn('Translation request failed after retries:', error);
        return null;
      }
      const waitTime = 300;
      await sleep(waitTime);
    }
  }
  
  return null;
}

function splitTextForTranslation(text: string, maxChars = MAX_TRANSLATION_CHARS): string[] {
  if (text.length <= maxChars) {
    return [text];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = Math.min(start + maxChars, text.length);

    if (end < text.length) {
      const window = text.slice(start, end);
      const breakCandidates = ['\n\n', '\n', '. ', '? ', '! ', '; ', '。', '？', '！', '；', ' '];
      let breakOffset = -1;

      for (const candidate of breakCandidates) {
        const candidateIndex = window.lastIndexOf(candidate);
        if (candidateIndex > breakOffset) {
          breakOffset = candidateIndex + candidate.length;
        }
      }

      if (breakOffset > Math.floor(maxChars * 0.5)) {
        end = start + breakOffset;
      }
    }

    const chunk = text.slice(start, end);
    if (chunk.trim()) {
      chunks.push(chunk);
    }

    start = end;
  }

  return chunks.length > 0 ? chunks : [text];
}

export async function translateToZhCN(text: string): Promise<string> {
  // Check cache first
  const cacheKey = text.trim();
  if (translationCache[cacheKey]) {
    return translationCache[cacheKey];
  }

  // Skip if already Chinese (contains Chinese characters)
  if (/[\u4e00-\u9fa5]/.test(text)) {
    translationCache[cacheKey] = text;
    return text;
  }

  // Skip if text is too short or empty
  if (text.trim().length < 2) {
    translationCache[cacheKey] = text;
    return text;
  }

  try {
    const chunks = splitTextForTranslation(text);
    const translatedChunks: string[] = [];

    for (const chunk of chunks) {
      const translated = await fetchGoogleTranslate(chunk);
      translatedChunks.push(translated ?? chunk);
    }

    const mergedTranslation = translatedChunks.join('');
    translationCache[cacheKey] = mergedTranslation || text;
    return translationCache[cacheKey];
  } catch (error) {
    console.error('Translation error:', error);
    // Return original text on error
    translationCache[cacheKey] = text;
    return text;
  }
}

export function clearTranslationCache() {
  Object.keys(translationCache).forEach(key => delete translationCache[key]);
}

// Batch translate multiple texts (with delay to avoid rate limiting)
export async function batchTranslate(texts: string[]): Promise<string[]> {
  const results: string[] = [];
  
  for (let i = 0; i < texts.length; i++) {
    const translated = await translateToZhCN(texts[i]);
    results.push(translated);
    // MIN_REQUEST_INTERVAL is already enforced in fetchGoogleTranslate
  }
  
  return results;
}
