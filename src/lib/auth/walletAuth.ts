import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from '@/lib/supabase/client';
import { SyncEngine } from '@/lib/sync/syncEngine';
import { OfflineDatabase } from '@/lib/database/sqlite';
import type { Organization } from '@/types/wallet';

WebBrowser.maybeCompleteAuthSession();

const WALLET_MARKER = '[wallet]';

function isWalletOrganization(description: string | null | undefined, isWalletFlag?: boolean | null): boolean {
  if (isWalletFlag === true) return true;
  return description?.trim().toLowerCase().startsWith(WALLET_MARKER) ?? false;
}

function extractTokensFromUrl(url: string): { accessToken?: string; refreshToken?: string } {
  let accessToken: string | undefined;
  let refreshToken: string | undefined;
  const parts = url.split(/[?#]/);
  for (const part of parts) {
    const searchParams = new URLSearchParams(part);
    if (searchParams.get('access_token')) {
      accessToken = searchParams.get('access_token') || undefined;
    }
    if (searchParams.get('refresh_token')) {
      refreshToken = searchParams.get('refresh_token') || undefined;
    }
  }
  return { accessToken, refreshToken };
}

export class WalletAuthService {
  // --- Auth Actions ---
  public static async loginWithEmail(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  }

  public static async loginWithGoogle() {
    const redirectTo = Linking.createURL('auth/callback');
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        skipBrowserRedirect: true,
      },
    });
    if (error) throw error;

    if (data?.url) {
      const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (res.type === 'success' && res.url) {
        const { accessToken, refreshToken } = extractTokensFromUrl(res.url);
        if (accessToken && refreshToken) {
          const { data: sessionData, error: sessionErr } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (sessionErr) throw sessionErr;
          return sessionData;
        }
      }
    }
    return data;
  }

  public static async signOut() {
    await supabase.auth.signOut();
  }

  public static async getSession() {
    const { data } = await supabase.auth.getSession();
    return data.session;
  }

  // --- Rule #1: Organization Membership Guard Verification ---
  public static async verifyWalletOrgAccess(organizationId: string, userId: string): Promise<boolean> {
    // 1. Check if user is owner of the organization using maybeSingle()
    const { data: org, error: orgErr } = await supabase
      .from('organizations')
      .select('id')
      .eq('id', organizationId)
      .eq('owner_id', userId)
      .maybeSingle();

    if (org && !orgErr) return true;

    // 2. Otherwise check if user is an active member using maybeSingle()
    const { data: member, error: memberErr } = await supabase
      .from('organization_members')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle();

    return !!member && !memberErr;
  }

  // --- Rule #2: Personal Wallet Resolution & Auto-Spawning ---
  public static async resolveUserWallet(userId: string): Promise<{ organizationId: string; createdNew: boolean }> {
    // Step 1: Check existing memberships
    const { data: memberships } = await supabase
      .from('organization_members')
      .select(`
        organization_id,
        is_active,
        organizations (
          id,
          name,
          description,
          owner_id,
          is_wallet
        )
      `)
      .eq('user_id', userId)
      .eq('is_active', true);

    if (memberships) {
      for (const m of memberships) {
        const orgData = Array.isArray(m.organizations) ? m.organizations[0] : m.organizations;
        if (orgData && isWalletOrganization((orgData as any).description, (orgData as any).is_wallet)) {
          // Verify access explicitly per Rule #1
          const hasAccess = await this.verifyWalletOrgAccess((orgData as any).id, userId);
          if (hasAccess) {
            await SyncEngine.pullLatestData((orgData as any).id);
            return { organizationId: (orgData as any).id, createdNew: false };
          }
        }
      }
    }

    // Step 2: Check owned organizations
    const { data: ownedWallets } = await supabase
      .from('organizations')
      .select('id, name, description, owner_id, is_wallet')
      .eq('owner_id', userId);

    if (ownedWallets) {
      for (const org of ownedWallets) {
        if (isWalletOrganization(org.description, org.is_wallet)) {
          await SyncEngine.pullLatestData(org.id);
          return { organizationId: org.id, createdNew: false };
        }
      }
    }

    // Step 3: Rule #2 Auto-Create Personal Wallet & Spawn Default 'Cash' Account
    console.log('[WalletAuthService] No Personal Wallet found. Creating new Personal Wallet org & default Cash account...');
    const { data: newOrg, error: createErr } = await supabase
      .from('organizations')
      .insert({
        name: 'Personal Wallet',
        description: `${WALLET_MARKER} Personal Wallet`,
        owner_id: userId,
        is_wallet: true,
      })
      .select('id')
      .single();

    if (createErr || !newOrg) {
      throw new Error(`Failed to create Personal Wallet organization: ${createErr?.message}`);
    }

    // Add owner membership record
    await supabase.from('organization_members').insert({
      organization_id: newOrg.id,
      user_id: userId,
      role: 'owner',
      is_active: true,
    });

    // Rule #2: Automatically spawn a default 'Cash' sub-account (starting_value: 0, is_active: true)
    const { data: defaultAcc, error: accErr } = await supabase
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

    await SyncEngine.pullLatestData(newOrg.id);
    return { organizationId: newOrg.id, createdNew: true };
  }
}
