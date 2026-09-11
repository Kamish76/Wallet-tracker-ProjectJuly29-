import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, supabaseAdmin } from '@/lib/supabase/client';
import { SyncEngine } from '@/lib/sync/syncEngine';
import { OfflineDatabase } from '@/lib/database/sqlite';
import { RateLimiter, RateLimitPolicies } from '@/lib/security/rateLimiter';
import { SecurityService } from '@/lib/security/securityService';
import type { Organization } from '@/types/wallet';

WebBrowser.maybeCompleteAuthSession();

const WALLET_MARKER = '[wallet]';

function isWalletOrganization(description: string | null | undefined, isWalletFlag?: boolean | null): boolean {
  if (isWalletFlag === true) return true;
  return description?.trim().toLowerCase().startsWith(WALLET_MARKER) ?? false;
}

export function extractTokensFromUrl(url: string): { accessToken?: string; refreshToken?: string; error?: string; errorDescription?: string } {
  let accessToken: string | undefined;
  let refreshToken: string | undefined;
  let error: string | undefined;
  let errorDescription: string | undefined;
  const parts = url.split(/[?#]/);
  for (const part of parts) {
    const searchParams = new URLSearchParams(part);
    if (searchParams.get('access_token')) {
      accessToken = searchParams.get('access_token') || undefined;
    }
    if (searchParams.get('refresh_token')) {
      refreshToken = searchParams.get('refresh_token') || undefined;
    }
    if (searchParams.get('error')) {
      error = searchParams.get('error') || undefined;
    }
    if (searchParams.get('error_description')) {
      errorDescription = searchParams.get('error_description') || undefined;
    }
  }
  return { accessToken, refreshToken, error, errorDescription };
}

export class WalletAuthService {
  private static cachedOrgId: string | null = null;
  private static cachedCurrency: string | null = null;
  private static hasPulledInitialData = false;
  private static readonly PRIMARY_ORG_KEY = '@orgwallet_primary_org_id';
  private static readonly PRIMARY_ORG_CURRENCY_KEY = '@orgwallet_primary_org_currency';

  public static async getCachedOrgIdAsync(): Promise<string | null> {
    if (this.cachedOrgId) return this.cachedOrgId;
    try {
      const stored = await AsyncStorage.getItem(this.PRIMARY_ORG_KEY);
      if (stored) {
        this.cachedOrgId = stored;
        return stored;
      }
    } catch (e) {
      console.error('[WalletAuthService] Failed to read cached org ID:', e);
    }
    return null;
  }

  public static async getCachedCurrencyAsync(): Promise<string> {
    if (this.cachedCurrency) return this.cachedCurrency;
    try {
      const stored = await AsyncStorage.getItem(this.PRIMARY_ORG_CURRENCY_KEY);
      if (stored) {
        this.cachedCurrency = stored;
        return stored;
      }
    } catch (e) {
      console.error('[WalletAuthService] Failed to read cached currency:', e);
    }
    return 'USD';
  }

  private static async setCachedOrgId(orgId: string) {
    this.cachedOrgId = orgId;
    try {
      await AsyncStorage.setItem(this.PRIMARY_ORG_KEY, orgId);
    } catch (e) {
      console.error('[WalletAuthService] Failed to write cached org ID:', e);
    }
  }

  private static async setCachedCurrency(currency: string) {
    this.cachedCurrency = currency;
    try {
      await AsyncStorage.setItem(this.PRIMARY_ORG_CURRENCY_KEY, currency);
    } catch (e) {
      console.error('[WalletAuthService] Failed to write cached currency:', e);
    }
  }

  public static async clearCache() {
    this.cachedOrgId = null;
    this.cachedCurrency = null;
    this.hasPulledInitialData = false;
    try {
      await AsyncStorage.removeItem(this.PRIMARY_ORG_KEY);
      await AsyncStorage.removeItem(this.PRIMARY_ORG_CURRENCY_KEY);
    } catch (e) {}
  }

  public static async clearAllUserData() {
    this.clearCache();
    try {
      await OfflineDatabase.clearAllData();
      console.log('[WalletAuthService] All local user database data and caches cleared.');
    } catch (err) {
      console.error('[WalletAuthService] Failed to clear local database:', err);
    }
  }

  // --- Auth Actions ---
  public static async loginWithEmail(email: string, password: string) {
    await RateLimiter.assertAllowed('auth:login', RateLimitPolicies.AUTH_LOGIN);
    const sanitizedEmail = SecurityService.sanitizeEmail(email);
    if (!sanitizedEmail.isValid) {
      throw new Error(sanitizedEmail.error || 'Invalid email address.');
    }

    await this.clearAllUserData();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: sanitizedEmail.sanitized,
      password,
    });
    if (error) {
      await RateLimiter.recordAttempt('auth:login', RateLimitPolicies.AUTH_LOGIN);
      throw error;
    }
    await RateLimiter.reset('auth:login');
    return data;
  }

  public static async loginWithGoogle() {
    await RateLimiter.assertAllowed('auth:oauth', RateLimitPolicies.AUTH_OAUTH);
    await this.clearAllUserData();
    await supabase.auth.signOut(); // Clear any stale session
    
    // Web: use auth/callback for direct handling
    const redirectTo = Linking.createURL(Platform.OS === 'web' ? 'auth/callback' : 'auth/oauth');
    console.log('[WalletAuthService] Google OAuth redirectTo:', redirectTo);

    if (Platform.OS === 'web') {
      // On web, let Supabase handle the redirect automatically (no skipBrowserRedirect)
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
        },
      });
      if (error) {
        await RateLimiter.recordAttempt('auth:oauth', RateLimitPolicies.AUTH_OAUTH);
        throw error;
      }
      await RateLimiter.reset('auth:oauth');
      return data;
    }

    // Native: use manual WebBrowser flow
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        skipBrowserRedirect: true,
      },
    });
    if (error) {
      await RateLimiter.recordAttempt('auth:oauth', RateLimitPolicies.AUTH_OAUTH);
      throw error;
    }

    if (data?.url) {
      const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (res.type === 'success' && res.url) {
        const { accessToken, refreshToken, error, errorDescription } = extractTokensFromUrl(res.url);
        
        if (error || errorDescription) {
          throw new Error(errorDescription || error || 'Authentication failed during Google Sign-In.');
        }

        if (accessToken && refreshToken) {
          const { data: sessionData, error: sessionErr } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (sessionErr) {
            await RateLimiter.recordAttempt('auth:oauth', RateLimitPolicies.AUTH_OAUTH);
            throw sessionErr;
          }
          await RateLimiter.reset('auth:oauth');
          return sessionData;
        }
      }
    }
    await RateLimiter.reset('auth:oauth');
    return data;
  }

  public static async signOut() {
    await this.clearAllUserData();
    await supabase.auth.signOut();
  }

  public static async getSession() {
    const { data } = await supabase.auth.getSession();
    return data.session;
  }

  // --- Rule #1: Organization Membership Guard Verification ---
  public static async verifyWalletOrgAccess(organizationId: string, userId: string): Promise<boolean> {
    // 1. Check if user is owner of the organization using maybeSingle()
    const { data: org, error: orgErr } = await supabaseAdmin
      .from('organizations')
      .select('id')
      .eq('id', organizationId)
      .eq('owner_id', userId)
      .maybeSingle();

    if (org && !orgErr) return true;

    // 2. Otherwise check if user is an active member using maybeSingle()
    const { data: member, error: memberErr } = await supabaseAdmin
      .from('organization_members')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle();

    return !!member && !memberErr;
  }

  // --- Rule #2: Personal Wallet Resolution & Auto-Spawning ---
  public static async resolveUserWallet(userId: string): Promise<{ organizationId: string; currency: string; createdNew: boolean }> {
    const cachedId = await this.getCachedOrgIdAsync();
    const cachedCurrency = await this.getCachedCurrencyAsync();
    if (cachedId) {
      if (!this.hasPulledInitialData) {
        this.hasPulledInitialData = true;
        await SyncEngine.firstTimeAutoSync(cachedId);
      }
      return { organizationId: cachedId, currency: cachedCurrency, createdNew: false };
    }

    // Step 1: Query organizations owned by this specific userId OR where userId is an active member
    const { data: ownedOrgs } = await supabaseAdmin
      .from('organizations')
      .select('id, name, description, owner_id, currency')
      .eq('owner_id', userId);

    const { data: memberRows } = await supabaseAdmin
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', userId)
      .eq('is_active', true);

    const memberOrgIds = (memberRows || []).map((m) => m.organization_id);
    let memberOrgs: any[] = [];
    if (memberOrgIds.length > 0) {
      const { data: mOrgs } = await supabaseAdmin
        .from('organizations')
        .select('id, name, description, owner_id, currency')
        .in('id', memberOrgIds);
      if (mOrgs) memberOrgs = mOrgs;
    }

    const orgMap = new Map<string, any>();
    (ownedOrgs || []).forEach((o) => orgMap.set(o.id, o));
    memberOrgs.forEach((o) => orgMap.set(o.id, o));
    const userOrgs = Array.from(orgMap.values());
    const orgsErr = null;

    if (!orgsErr && userOrgs && userOrgs.length > 0) {
      // First check for an organization explicitly marked with [wallet]
      for (const org of userOrgs) {
        if (isWalletOrganization(org.description, (org as any).is_wallet)) {
          console.log('[WalletAuthService] Using Personal Wallet org:', org.id);
          await this.setCachedOrgId(org.id);
          await this.setCachedCurrency(org.currency || 'USD');
          if (!this.hasPulledInitialData) {
            this.hasPulledInitialData = true;
            await SyncEngine.firstTimeAutoSync(org.id);
          }
          return { organizationId: org.id, currency: org.currency || 'USD', createdNew: false };
        }
      }

      // Second check (FALLBACK): If no [wallet] marker org is found, use the user's first accessible organization
      const firstOrg = userOrgs[0];
      console.log('[WalletAuthService] Using existing org as Personal Wallet fallback:', firstOrg.id);
      await this.setCachedOrgId(firstOrg.id);
      await this.setCachedCurrency(firstOrg.currency || 'USD');
      if (!this.hasPulledInitialData) {
        this.hasPulledInitialData = true;
        await SyncEngine.firstTimeAutoSync(firstOrg.id);
      }
      return { organizationId: firstOrg.id, currency: firstOrg.currency || 'USD', createdNew: false };
    }

    // Step 2: Rule #2 Auto-Create Personal Wallet & Spawn Default 'Cash' Account (Only if user has 0 organizations!)
    console.log('[WalletAuthService] No Personal Wallet found. Creating new Personal Wallet org & default Cash account...');
    const { data: newOrg, error: createErr } = await supabaseAdmin
      .from('organizations')
      .insert({
        name: 'Personal Wallet',
        description: `${WALLET_MARKER} Personal Wallet`,
        owner_id: userId,
      })
      .select('id')
      .single();

    if (createErr || !newOrg) {
      throw new Error(`Failed to create Personal Wallet organization: ${createErr?.message}`);
    }

    // Add owner membership record
    await supabaseAdmin.from('organization_members').insert({
      organization_id: newOrg.id,
      user_id: userId,
      role: 'owner',
      is_active: true,
    });

    // Rule #2: Automatically spawn a default 'Cash' sub-account (starting_value: 0, is_active: true)
    const { data: defaultAcc, error: accErr } = await supabaseAdmin
      .from('wallet_accounts')
      .insert({
        organization_id: newOrg.id,
        name: 'Cash',
        starting_value: 0,
        is_active: true,
      })
      .select('id, organization_id, name, starting_value, is_active, created_at, updated_at')
      .single();

    if (defaultAcc && !accErr) {
      await OfflineDatabase.upsertAccount({
        id: defaultAcc.id,
        organization_id: defaultAcc.organization_id,
        name: defaultAcc.name,
        starting_value: Number(defaultAcc.starting_value || 0),
        is_active: Boolean(defaultAcc.is_active),
        created_at: defaultAcc.created_at,
        updated_at: defaultAcc.updated_at,
      }, 'synced');
    }

    await this.setCachedOrgId(newOrg.id);
    await this.setCachedCurrency('USD');
    this.hasPulledInitialData = true;
    await SyncEngine.firstTimeAutoSync(newOrg.id);
    return { organizationId: newOrg.id, currency: 'USD', createdNew: true };
  }
}
