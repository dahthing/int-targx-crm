export type UserRole = 'admin' | 'partner' | 'tech';

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  active: boolean;
  created_at: string;
}
