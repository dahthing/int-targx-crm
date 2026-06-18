import { definePreset } from '@primeng/themes';
import Aura from '@primeng/themes/aura';

export const TargXTheme = definePreset(Aura, {
  semantic: {
    primary: {
      50:  '#E8F8F6',
      100: '#CCEDE9',
      200: '#99DBD3',
      300: '#66C9BD',
      400: '#33C9AE',
      500: '#00B899',
      600: '#00917A',
      700: '#006B5C',
      800: '#00483E',
      900: '#002420',
      950: '#00120F',
    },
    colorScheme: {
      light: {
        surface: {
          0:   '#FFFFFF',
          50:  '#F9FAFB',
          100: '#F3F4F6',
          200: '#E5E7EB',
          300: '#D1D5DB',
          400: '#9CA3AF',
          500: '#6B7280',
          600: '#4B5563',
          700: '#374151',
          800: '#1F2533',
          900: '#111827',
          950: '#0D0F12',
        },
      },
    },
  },
  components: {
    button: {},
    card: {},
    inputtext: {},
    datatable: {},
  },
});
