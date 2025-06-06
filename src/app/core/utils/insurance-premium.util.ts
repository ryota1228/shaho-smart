import { EmployeeInsurancePremiums } from '../models/insurance-premium.model';

export function isPremiumCalculated(data: EmployeeInsurancePremiums | null, method: keyof EmployeeInsurancePremiums): boolean {
  return !!data?.[method];
}

export function isPremiumDeleted(data: EmployeeInsurancePremiums | null): boolean {
  return data?.metadata?.deleted === true;
}

export function canCalculatePremium(data: EmployeeInsurancePremiums | null, method: keyof EmployeeInsurancePremiums): boolean {
  return !data?.[method] || isPremiumDeleted(data);
}

export function canDeletePremium(data: EmployeeInsurancePremiums | null, method: keyof EmployeeInsurancePremiums): boolean {
  return !!data?.[method] && !isPremiumDeleted(data);
}
