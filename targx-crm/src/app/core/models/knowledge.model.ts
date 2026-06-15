export type ObjectionCategory = 'preco' | 'prazo' | 'tecnologia' | 'concorrencia' | 'outro';

export interface ObjectionPlaybook {
  id: string;
  category: ObjectionCategory;
  objection: string;
  response: string;
  context: string | null;
  tags: string[] | null;
  active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}
