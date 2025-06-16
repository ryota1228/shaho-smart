export interface Company {
  companyId: string;
  name: string;
  address: string;
  postalCode: string;
  phone: string;
  healthType: string;
  insurerNumber: string;
  branchLink: string;

  isDeleted?: boolean;

  isApplicableToHealthInsurance?: boolean;
  isApplicableToPension?: boolean;
  totalEmployeeCount?: number;


  voluntaryHealthApplicable?: boolean;
  voluntaryPensionApplicable?: boolean;

  prefecture?: string;

  standardWeeklyHours?: number;

  isActuallyApplicableToHealthInsurance?: boolean;
  isActuallyApplicableToPension?: boolean;
  
  customRates?: {
    health?: CustomRate;
    pension?: CustomRate;
    care?: CustomRate;
  };
}


export interface CustomRate {
  employee: string;
  company: string;
}


export type NewCompany = Omit<Company, 'companyId'>;
