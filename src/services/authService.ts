import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface Invitation {
  id: string;
  email: string;
  token: string;
  invited_by_email: string | null;
  status: string;
  expires_at: string;
  created_at: string;
  accepted_at: string | null;
}

export const authService = {
  /**
   * Check if current user is an admin
   */
  async isAdmin(): Promise<boolean> {
    const user = await this.getCurrentUser();
    if (!user || !user.email) return false;
    const email = user.email.toLowerCase();
    return email.startsWith("admin@") || email === "coldfeet376@gmail.com";
  },

  /**
   * Send invitation to a new user
   */
  async sendInvitation(email: string): Promise<Invitation> {
    const user = await this.getCurrentUser();
    if (!user) throw new Error("Not authenticated");

    // Generate secure random token
    const token = crypto.randomUUID();
    const inviteUrl = `${window.location.origin}/signup?token=${token}`;

    const { data, error } = await supabase
      .from("invitations")
      .insert({
        email: email.toLowerCase(),
        token,
        invited_by: user.id,
        invited_by_email: user.email,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new Error("An invitation for this email already exists");
      }
      throw error;
    }

    // Send email with invite link
    try {
      const displayName = this.getUserDisplayName(user);
      const response = await fetch("/api/send-invite-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.toLowerCase(),
          inviteUrl,
          invitedByName: displayName,
        }),
      });

      if (!response.ok) {
        console.warn("Failed to send invite email:", await response.text());
        // Don't throw - invitation record is created, email is optional
      }
    } catch (emailError) {
      console.warn("Email send failed:", emailError);
      // Continue - invitation record exists even if email fails
    }

    return data as Invitation;
  },

  /**
   * Get all invitations (admin only)
   */
  async getInvitations(): Promise<Invitation[]> {
    const { data, error } = await supabase
      .from("invitations")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data as Invitation[]) || [];
  },

  /**
   * Validate invitation token
   */
  async validateInvitation(token: string): Promise<{ valid: boolean; email?: string }> {
    const { data, error } = await supabase
      .from("invitations")
      .select("*")
      .eq("token", token)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (error) throw error;
    
    if (!data) {
      return { valid: false };
    }

    return { valid: true, email: data.email };
  },

  /**
   * Accept invitation and mark as used
   */
  async acceptInvitation(token: string): Promise<void> {
    const { error } = await supabase
      .from("invitations")
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
      })
      .eq("token", token);

    if (error) throw error;
  },

  /**
   * Cancel invitation (admin only)
   */
  async cancelInvitation(invitationId: string): Promise<void> {
    const { error } = await supabase
      .from("invitations")
      .update({ status: "cancelled" })
      .eq("id", invitationId);

    if (error) throw error;
  },

  /**
   * Sign up a new user with display name
   */
  async signUp(email: string, password: string, displayName: string): Promise<User> {
    const emailLower = email.toLowerCase();
    const isAdmin = emailLower.startsWith("admin@") || emailLower === "coldfeet376@gmail.com";
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName,
        },
        emailRedirectTo: undefined,
        // Skip email confirmation for admin accounts
        ...(isAdmin && { 
          emailConfirm: false,
        }),
      },
    });

    if (error) throw error;
    if (!data.user) throw new Error("Failed to create user");

    return data.user;
  },

  /**
   * Sign in an existing user
   */
  async signIn(email: string, password: string): Promise<User> {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    if (!data.user) throw new Error("Failed to sign in");

    return data.user;
  },

  /**
   * Sign out the current user
   */
  async signOut(): Promise<void> {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    
    // Clear remember me flag
    localStorage.removeItem("warehouse_remember_me");
  },

  /**
   * Get current session
   */
  async getSession(): Promise<Session | null> {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  },

  /**
   * Get current user
   */
  async getCurrentUser(): Promise<User | null> {
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        // Don't throw if it's just a missing session (user not logged in yet)
        if (error.message?.includes("session missing") || error.name === "AuthSessionMissingError") {
          return null;
        }
        throw error;
      }
      return data.user;
    } catch (error: any) {
      if (error.message?.includes("session missing") || error.name === "AuthSessionMissingError") {
        return null;
      }
      throw error;
    }
  },

  /**
   * Get user display name
   */
  getUserDisplayName(user: User | null): string {
    if (!user) return "Unknown";
    return user.user_metadata?.display_name || user.email?.split("@")[0] || "Unknown";
  },

  /**
   * Send password reset email
   */
  async resetPassword(email: string): Promise<void> {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) throw error;
  },

  /**
   * Update user password (after reset)
   */
  async updatePassword(newPassword: string): Promise<void> {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) throw error;
  },

  /**
   * Check if user has "remember me" enabled
   */
  hasRememberMe(): boolean {
    return localStorage.getItem("warehouse_remember_me") === "true";
  },

  /**
   * Subscribe to auth state changes
   */
  onAuthStateChange(callback: (session: Session | null) => void) {
    return supabase.auth.onAuthStateChange((_event, session) => {
      callback(session);
    });
  },

  /**
   * Generate a 6-digit verification code for 2FA
   */
  generate2FACode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  },

  /**
   * Store 2FA code temporarily (5 minute expiry)
   */
  async store2FACode(email: string, code: string): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 5); // 5 minute expiry

    const { error } = await (supabase as any)
      .from("two_factor_codes")
      .upsert({
        email: email.toLowerCase(),
        code,
        expires_at: expiresAt.toISOString(),
        created_at: new Date().toISOString(),
      }, {
        onConflict: "email"
      });

    if (error) throw error;
  },

  /**
   * Verify 2FA code
   */
  async verify2FACode(email: string, code: string): Promise<boolean> {
    const { data, error } = await (supabase as any)
      .from("two_factor_codes")
      .select("*")
      .eq("email", email.toLowerCase())
      .eq("code", code)
      .single();

    if (error || !data) return false;

    // Check expiry
    const expiresAt = new Date(data.expires_at);
    const now = new Date();
    
    if (now > expiresAt) {
      // Code expired, delete it
      await (supabase as any)
        .from("two_factor_codes")
        .delete()
        .eq("email", email.toLowerCase());
      return false;
    }

    // Code is valid, delete it (one-time use)
    await (supabase as any)
      .from("two_factor_codes")
      .delete()
      .eq("email", email.toLowerCase());

    return true;
  },

  /**
   * Send 2FA code via email
   */
  async send2FACode(email: string, code: string, userName?: string): Promise<void> {
    try {
      const response = await fetch("/api/send-2fa-code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.toLowerCase(),
          code,
          userName,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to send verification code");
      }
    } catch (error) {
      console.error("Failed to send 2FA code:", error);
      throw new Error("Failed to send verification code. Please try again.");
    }
  },
};
