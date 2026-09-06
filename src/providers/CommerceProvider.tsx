import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Platform } from 'react-native';
import { useTournament } from '@/providers/TournamentProvider';
import {
  fetchCertificateCatalog,
  fetchCreditPackages,
  fetchMyCertificates,
  fetchWalletSummary,
  purchaseCertificateWithCredits,
} from '@/services/commerce';
import type {
  CertificateCatalogItem,
  CreditPackage,
  DigitalCertificate,
  WalletSummary,
} from '@/services/commerce/types';
import {
  buyCreditPackage,
  endStorePurchases,
  initStorePurchases,
  productIdForPackageOnDevice,
  recoverPendingStorePurchases,
} from '@/hooks/useStorePurchases';
import { createId } from '@/utils/id';

type CommerceCtx = {
  ready: boolean;
  commerceAvailable: boolean;
  balanceCredits: number;
  packages: CreditPackage[];
  catalog: CertificateCatalogItem[];
  sentCertificates: DigitalCertificate[];
  receivedCertificates: DigitalCertificate[];
  ledger: WalletSummary['ledger'];
  refresh: () => Promise<void>;
  buyCredits: (
    pkg: CreditPackage
  ) => Promise<{ ok: boolean; error?: string }>;
  giftCertificate: (input: {
    catalogSlug: string;
    recipientId: string;
    reason?: string;
    competitionName?: string;
    teamName?: string;
  }) => Promise<{
    ok: boolean;
    certificate?: DigitalCertificate;
    error?: string;
    duplicate?: boolean;
  }>;
};

const CommerceContext = createContext<CommerceCtx | undefined>(undefined);

export function CommerceProvider({ children }: { children: ReactNode }) {
  const { currentUser, featureFlags } = useTournament();
  const [ready, setReady] = useState(false);
  const [commerceAvailable, setCommerceAvailable] = useState(false);
  const [balanceCredits, setBalanceCredits] = useState(0);
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [catalog, setCatalog] = useState<CertificateCatalogItem[]>([]);
  const [sentCertificates, setSentCertificates] = useState<DigitalCertificate[]>(
    []
  );
  const [receivedCertificates, setReceivedCertificates] = useState<
    DigitalCertificate[]
  >([]);
  const [ledger, setLedger] = useState<WalletSummary['ledger']>([]);
  const buyLock = useRef(false);
  const giftLock = useRef(false);

  const refresh = useCallback(async () => {
    if (!currentUser?.id || !featureFlags.commerceCreditsEnabled) {
      setCommerceAvailable(false);
      setReady(true);
      return;
    }
    try {
      const [pkgs, cat, wallet, certs] = await Promise.all([
        fetchCreditPackages(),
        fetchCertificateCatalog(),
        fetchWalletSummary(80),
        fetchMyCertificates(),
      ]);
      setPackages(pkgs);
      setCatalog(cat);
      setBalanceCredits(wallet.balanceCredits);
      setLedger(wallet.ledger);
      setSentCertificates(certs.sent);
      setReceivedCertificates(certs.received);
      setCommerceAvailable(pkgs.length > 0 && cat.length > 0);

      if (Platform.OS !== 'web' && pkgs.length > 0) {
        const ids = pkgs
          .map((p) => productIdForPackageOnDevice(p))
          .filter((x): x is string => !!x);
        await initStorePurchases(ids);
        await recoverPendingStorePurchases(pkgs);
      }
    } catch {
      setCommerceAvailable(false);
    } finally {
      setReady(true);
    }
  }, [currentUser?.id, featureFlags.commerceCreditsEnabled]);

  useEffect(() => {
    setReady(false);
    void refresh();
    return () => {
      void endStorePurchases();
    };
  }, [refresh]);

  const buyCredits = useCallback(
    async (pkg: CreditPackage) => {
      if (buyLock.current) return { ok: false, error: 'purchase_in_progress' };
      buyLock.current = true;
      try {
        const result = await buyCreditPackage(pkg);
        if (result.ok) await refresh();
        return result;
      } finally {
        buyLock.current = false;
      }
    },
    [refresh]
  );

  const giftCertificate = useCallback(
    async (input: {
      catalogSlug: string;
      recipientId: string;
      reason?: string;
      competitionName?: string;
      teamName?: string;
    }) => {
      if (giftLock.current) {
        return { ok: false, error: 'purchase_in_progress' };
      }
      giftLock.current = true;
      const idempotencyKey = createId('cert-buy');
      try {
        const result = await purchaseCertificateWithCredits({
          ...input,
          idempotencyKey,
        });
        if (result.ok) await refresh();
        return result;
      } finally {
        giftLock.current = false;
      }
    },
    [refresh]
  );

  const value = useMemo(
    () => ({
      ready,
      commerceAvailable,
      balanceCredits,
      packages,
      catalog,
      sentCertificates,
      receivedCertificates,
      ledger,
      refresh,
      buyCredits,
      giftCertificate,
    }),
    [
      ready,
      commerceAvailable,
      balanceCredits,
      packages,
      catalog,
      sentCertificates,
      receivedCertificates,
      ledger,
      refresh,
      buyCredits,
      giftCertificate,
    ]
  );

  return (
    <CommerceContext.Provider value={value}>{children}</CommerceContext.Provider>
  );
}

export function useCommerce() {
  const ctx = useContext(CommerceContext);
  if (!ctx) {
    throw new Error('useCommerce must be used within CommerceProvider');
  }
  return ctx;
}
