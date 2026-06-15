export interface Client {
  id: string;
  name: string;
  nif: string | null;
  sector: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}
