export interface Company {
  companyId: string;
  name: string;
  address: string;
  postalCode: string;
  phone: string;
  healthType: string;
  insurerNumber: string;
  branchLink: string;
  authorizedUsers: string[];
  isDeleted?: boolean;

  isApplicableToHealthInsurance?: boolean;
  isApplicableToPension?: boolean;
  totalEmployeeCount?: number;

  prefecture?: string;

  customRates?: {
    health?: CustomRate;
    pension?: CustomRate;
    care?: CustomRate;
  };
}

export interface CustomRate {
  employee: number;
  employer: number;
}

export type NewCompany = Omit<Company, 'companyId'>;
