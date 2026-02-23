import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './data/**/*.{js,ts,jsx,tsx,mdx}'
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: '#F7F7F5',
          surface: '#FFFFFF',
          ink: '#2F2F2F',
          muted: '#5A5A5A',
          line: '#E6E7E3',
          panel: '#F4F7F8',
          green: '#4E9A06',
          greenHover: '#448805',
          greenTint: '#EEF7E8',
          greenLine: '#8AC25B',
          navy: '#2F2F2F',
          blue: '#4E9A06',
          accent: '#448805',
          sky: '#EEF7E8',
          slate: '#5A5A5A'
        }
      },
      boxShadow: {
        card: '0 1px 2px rgba(26, 32, 23, 0.06), 0 8px 24px rgba(26, 32, 23, 0.03)'
      },
      borderRadius: {
        xl2: '0.5rem'
      }
    }
  },
  plugins: []
};

export default config;
