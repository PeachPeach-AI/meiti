import type { Config } from "tailwindcss"

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // 与主站（自媒体工作站）同步：主色阶 blue-* 统一替换为主站 accent 珊瑚红 #F4554D
        blue: {
          50: '#FEEDEC',
          100: '#FCD9D7',
          200: '#F9BBB7',
          300: '#F5948D',
          400: '#F4746B',
          500: '#F4554D',
          600: '#F4554D',
          700: '#D9443C',
          800: '#B3392F',
          900: '#8C2B23',
          950: '#5E1C17',
        },
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
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'PingFang SC', 'HarmonyOS Sans SC', 'Source Han Sans SC', 'Microsoft YaHei', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'JetBrains Mono', 'Consolas', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
      }
    },
  },
  plugins: [],
}
export default config
