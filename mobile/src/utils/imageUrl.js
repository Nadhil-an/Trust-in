import { Config } from '../constants/Config';

/**
 * Resolves any image URL (absolute R2/S3, relative media path, or local device URI)
 * to a fully qualified URL that React Native Image components can load across all devices.
 */
export const resolveImageUrl = (url) => {
  if (!url || typeof url !== 'string') return null;

  const trimmed = url.trim();
  if (!trimmed) return null;

  // Already a full remote URL or device URI
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('file://') ||
    trimmed.startsWith('content://') ||
    trimmed.startsWith('data:')
  ) {
    return trimmed;
  }

  // Relative path: resolve against server base host
  try {
    const apiBase = Config.API_BASE_URL || '';
    const origin = apiBase.replace(/\/api\/?$/, '');
    const cleanPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    return `${origin}${cleanPath}`;
  } catch (_) {
    return trimmed;
  }
};
