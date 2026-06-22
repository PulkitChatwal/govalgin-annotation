// Country display metadata and languages for reference.
// The 7 fixed countries in the GovAlign benchmark.
export const COUNTRY_CONFIG = {
  'India':        { flag: '🇮🇳', langs: ['Hindi', 'Bengali', 'Telugu', 'Tamil', 'Marathi', 'English'] },
  'China':        { flag: '🇨🇳', langs: ['Mandarin Chinese'] },
  'Bangladesh':   { flag: '🇧🇩', langs: ['Bengali'] },
  'Bulgaria':     { flag: '🇧🇬', langs: ['Bulgarian'] },
  'Nigeria':      { flag: '🇳🇬', langs: ['English', 'Yoruba', 'Hausa', 'Igbo'] },
  'Egypt':        { flag: '🇪🇬', langs: ['Arabic'] },
  'Saudi Arabia': { flag: '🇸🇦', langs: ['Arabic'] },
}

export const COUNTRIES = Object.keys(COUNTRY_CONFIG)