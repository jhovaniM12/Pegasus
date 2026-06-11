export type Fair = {
  id: string;
  name: string;
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
  registrationNumber: string;
  trackPosition: number;
  riderName: string;
  riderDocumentNumber: string;
  participate: boolean;
  fairSequence: number;
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
    riderDocumentNumber: string;
  };
  title: {
    name: string | null;
  } | null;
};

export type FairStaff = {
  id: string;
  person: {
    name: string;
    lastName: string;
    telephone: string | null;
    phone: string | null;
    email: string | null;
  };
  role: {
    name: string | null;
  };
};

