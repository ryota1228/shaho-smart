import { elementAt } from "rxjs";
import { PremiumBreakdown } from "../utils/calculateInsurancePremiums";

export interface BonusPremiumRecord {
    bonusId: string;
    empNo: string;
    companyId: string;
    applicableDate: string;
    calculatedAt: string;
    applicableMonth: string;  
    standardBonusAmount: number;
    health?: PremiumBreakdown | null;
    pension?: PremiumBreakdown | null;
    care?: PremiumBreakdown | null;
  }

  export interface BonusRecordInput {
    applicableMonth: string;
    amount: number;
    health?: PremiumBreakdown | null;
    pension?: PremiumBreakdown | null;
    care?: PremiumBreakdown | null;
    includedInStandardBonus?: boolean;
    id?: string;
  }