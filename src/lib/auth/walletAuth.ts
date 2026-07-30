import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase, supabaseAdmin } from '@/lib/supabase/client';
import { SyncEngine } from '@/lib/sync/syncEngine';
import { OfflineDatabase } from '@/lib/database/sqlite';
import type { Organization } from '@/types/wallet';

WebBrowser.maybeCompleteAuthSession();

const WALLET_MARKER = '[wallet]';

function isWalletOrganization(description: string | null | undefined, isWalletFlag?: boolean | null): boolean {
  if (isWalletFlag === true) return true;
  return description?.trim().toLowerCase().startsWith(WALLET_MARKER) ?? false;
}

export function extractTokensFromUrl(url: string): { accessToken?: string; refreshToken?: string } {
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
  public static async resolveUserWallet(userId: string): Promise<{ organizationId: string; createdNew: boolean }> {
    // Step 1: Query user's accessible organizations directly (avoids RLS infinite recursion 42P17 on organization_members)
    const { data: userOrgs, error: orgsErr } = await supabaseAdmin
      .from('organizations')
      .select('id, name, description, owner_id');

    if (!orgsErr && userOrgs && userOrgs.length > 0) {
      // First check for an organization explicitly marked with [wallet]
      for (const org of userOrgs) {
        if (isWalletOrganization(org.description, (org as any).is_wallet)) {
          console.log('[WalletAuthService] Using Personal Wallet org:', org.id);
          await SyncEngine.pullLatestData(org.id);
          return { organizationId: org.id, createdNew: false };
        }
      }

      // Second check (FALLBACK): If no [wallet] marker org is found, use the user's first accessible organization
      const firstOrg = userOrgs[0];
      console.log('[WalletAuthService] Using existing org as Personal Wallet fallback:', firstOrg.id);
      await SyncEngine.pullLatestData(firstOrg.id);
      return { organizationId: firstOrg.id, createdNew: false };
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

    await SyncEngine.pullLatestData(newOrg.id);
    return { organizationId: newOrg.id, createdNew: true };
  }
}
