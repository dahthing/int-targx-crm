import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';
import { TargXTheme } from '../styles/primeng-theme';
import { SUPABASE_CLIENT, createSupabaseClient } from './core/supabase/supabase.client';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideAnimationsAsync(),
    providePrimeNG({
      theme: { preset: TargXTheme, options: { darkModeSelector: '.dark' } },
    }),
    {
      provide: SUPABASE_CLIENT,
      useFactory: createSupabaseClient,
    },
  ],
};
