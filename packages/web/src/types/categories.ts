export type Category = {
  id: string;
  name: string;
  minAgeMonths: number;
  maxAgeMonths: number;
  sex: {
    name: string;
  } | null;
  gait: {
    id: string;
    name: string;
  } | null;
};

export type GaitOption = {
  id: string;
  name: string | null;
};

