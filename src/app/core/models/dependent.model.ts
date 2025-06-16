export interface Dependent {
    name: string;
    relation: string;
    birthday: Date | null;
    livesTogether: boolean;
    income: number | null;
    id?: string;
  }