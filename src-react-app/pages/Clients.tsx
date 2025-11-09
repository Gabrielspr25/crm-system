import { useState, useEffect, useCallback, useMemo } from "react";

interface ClientRowSummary {
  clientId: number;
  clientName: string;
  businessName: string | null;
  vendorId: number | null;
  vendorName: string | null;
  totalBans: number;
  totalSubscribers: number;
  primaryBanNumber: string;
  primarySubscriberPhone: string;
  primaryContractEndDate: string | null;
  primarySubscriberCreatedAt: string | null;
  daysUntilExpiry: number;
  status: 'expired' | 'critical' | 'warning' | 'good' | 'no-date';
  isBeingFollowed: boolean;
  wasCompleted: boolean;
  followUpProspectId?: number;
  banNumbers: string[];
  subscriberPhones: string[];
  includesBan: boolean;
}
