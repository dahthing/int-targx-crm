import { Injectable, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseClient, User } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.client';
import { Profile, UserRole } from '../models/profile.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly #supabase = inject(SUPABASE_CLIENT);
  readonly #router = inject(Router);

  readonly currentUser = signal<User | null>(null);
  readonly currentProfile = signal<Profile | null>(null);
  readonly role = computed<UserRole | null>(() => this.currentProfile()?.role ?? null);
  readonly isAuthenticated = computed(() => this.currentUser() !== null);

  readonly initPromise: Promise<void>;

  constructor() {
    let resolveInit!: () => void;
    this.initPromise = new Promise<void>(r => (resolveInit = r));

    this.#supabase.auth.getSession().then(({ data: { session } }) => {
      this.currentUser.set(session?.user ?? null);
      if (session?.user) {
        this.#loadProfile(session.user.id).then(resolveInit);
      } else {
        resolveInit();
      }
    });

    this.#supabase.auth.onAuthStateChange((_event, session) => {
      this.currentUser.set(session?.user ?? null);
      if (session?.user) {
        this.#loadProfile(session.user.id);
      } else {
        this.currentProfile.set(null);
      }
    });
  }

  async signIn(email: string, password: string): Promise<{ error: string | null }> {
    const { error } = await this.#supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  }

  async signOut(): Promise<void> {
    await this.#supabase.auth.signOut();
    this.#router.navigate(['/login']);
  }

  async #loadProfile(userId: string): Promise<void> {
    const { data, error } = await this.#supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (!error && data) {
      this.currentProfile.set(data as Profile);
    }
  }
}
