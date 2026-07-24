export type Person = {
  id: string;
  name: string;
  lastName: string | null;
  fullName: string;
  email: string | null;
  documentNumber?: string | null;
  accessRole: string | null;
  accessRoleLabel: string | null;
};
