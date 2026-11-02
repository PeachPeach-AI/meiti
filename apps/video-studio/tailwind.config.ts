import type { Config } from "tailwindcss"

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        app: {
          text: 'var(--app-text)',
          'text-secondary': 'var(--app-text-secondary)',
          'text-muted': 'var(--app-text-muted)',
          bg: 'var(--app-bg)',
          'bg-alt': 'var(--app-bg-alt)',
          'bg-hover': 'var(--app-bg-hover)',
          border: 'var(--app-border)',
          'border-light': 'var(--app-border-light)',
        }
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
      }
    },
  },
  plugins: [],
}
export default config
