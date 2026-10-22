// Utilities for location & Kerala district formatting

export const KERALA_DISTRICTS = [
  'Alappuzha',
  'Ernakulam',
  'Idukki',
  'Kannur',
  'Kasaragod',
  'Kollam',
  'Kottayam',
  'Kozhikode',
  'Malappuram',
  'Palakkad',
  'Pathanamthitta',
  'Thiruvananthapuram',
  'Thrissur',
  'Wayanad',
];

export const formatDistrictKerala = (address) => {
  if (!address || typeof address !== 'string' || !address.trim()) {
    return 'Kerala';
  }
  const clean = address.trim();

  // 1. Search for any exact Kerala district name
  for (const d of KERALA_DISTRICTS) {
    if (new RegExp('\\b' + d + '\\b', 'i').test(clean)) {
      return `${d}, Kerala`;
    }
  }

  // 2. If it already contains Kerala
  if (/kerala/i.test(clean)) {
    return clean;
  }

  // 3. Fallback: take the primary locality and append ", Kerala"
  const parts = clean.split(/[,-]/).map((p) => p.trim()).filter(Boolean);
  if (parts.length > 0) {
    const candidate = parts[parts.length - 1];
    return `${candidate}, Kerala`;
  }

  return 'Kerala';
};
