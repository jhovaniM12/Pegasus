export type Fair = {
  id: string;
  name: string;
  startDate?: string | null;
  endDate?: string | null;
  city?: {
    name?: string;
  };
  grade?: {
    name?: string;
  };
};

export type FairDetail = {
  id: string;
  name: string | null;
  startDate: string | null;
  endDate: string | null;
  city: {
    name: string | null;
  } | null;
  grade: {
    name: string | null;
  } | null;
};

export type FairEntry = {
  id: string;
  inscriptionNumber: string | null;
  registrationNumber: string;
  horseId: string | null;
  trackPosition: number;
  riderName: string;
  riderDocumentNumber: string | null;
  receipt: string | null;
  participate: boolean;
  fairSequence: number;
  isChild: boolean | null;
  category: {
    id: string;
    name: string | null;
  } | null;
};

export type FairEntriesCategorySummary = {
  category: {
    id: string;
    name: string | null;
    minAgeMonths: number;
    maxAgeMonths: number;
  };
  totalEntries: number;
};

export type FairEntriesGaitSummary = {
  gait: {
    id: string;
    name: string | null;
  };
  totalEntries: number;
  categories: FairEntriesCategorySummary[];
};

export type FairResult = {
  id: string;
  positionObtained: number;
  score: number;
  fairEntry: {
    registrationNumber: string;
    riderName: string;
    riderDocumentNumber: string | null;
  };
  title: {
    name: string | null;
  } | null;
};

export type FairStaff = {
  id: string;
  person: {
    name: string;
    lastName: string | null;
    telephone: string | null;
    phone: string | null;
    email: string | null;
  };
  role: {
    name: string | null;
  };
};
