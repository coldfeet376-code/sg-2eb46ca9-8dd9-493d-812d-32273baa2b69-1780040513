import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { authService } from "@/services/authService";
import { useToast } from "@/hooks/use-toast";
import { Shield } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"login" | "verify">("login");
  const [pendingEmail, setPendingEmail] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Step 1: Verify password
      await authService.signIn(email, password);

      // Step 2: Generate and send 2FA code
      const code = authService.generate2FACode();
      await authService.store2FACode(email, code);
      
      // Get user name for personalized email
      const user = await authService.getCurrentUser();
      const userName = user?.user_metadata?.full_name || user?.email?.split("@")[0];
      
      await authService.send2FACode(email, code, userName);

      // Sign out temporarily until 2FA is verified
      await authService.signOut();

      setPendingEmail(email);
      setStep("verify");
      
      toast({
        title: "Verification code sent",
        description: `Check your email (${email}) for the 6-digit code`,
      });

    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Login failed",
        description: error.message || "An error occurred during login",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Verify the 2FA code
      const isValid = await authService.verify2FACode(pendingEmail, verificationCode);

      if (!isValid) {
        toast({
          variant: "destructive",
          title: "Invalid code",
          description: "The verification code is incorrect or has expired",
        });
        setLoading(false);
        return;
      }

      // Code is valid, complete the login
      await authService.signIn(pendingEmail, password);

      toast({
        title: "Login successful",
        description: "Welcome back!",
      });

      router.push("/");

    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Verification failed",
        description: error.message || "An error occurred during verification",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setLoading(true);
    try {
      const code = authService.generate2FACode();
      await authService.store2FACode(pendingEmail, code);
      
      const user = await authService.getCurrentUser();
      const userName = user?.user_metadata?.full_name || user?.email?.split("@")[0];
      
      await authService.send2FACode(pendingEmail, code, userName);

      toast({
        title: "Code resent",
        description: "A new verification code has been sent to your email",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to resend code. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-2 justify-center mb-2">
            <Shield className="h-6 w-6 text-primary" />
            <CardTitle className="text-2xl font-bold">
              {step === "login" ? "Sign In" : "Verify Your Identity"}
            </CardTitle>
          </div>
          <CardDescription className="text-center">
            {step === "login" 
              ? "Enter your credentials to access the rota system"
              : "Enter the 6-digit code sent to your email"
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === "login" ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@gistworld.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Signing in..." : "Continue"}
              </Button>
              <div className="text-center text-sm">
                <Link href="/forgot-password" className="text-primary hover:underline">
                  Forgot password?
                </Link>
              </div>
            </form>
          ) : (
            <form onSubmit={handleVerify} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">Verification Code</Label>
                <Input
                  id="code"
                  type="text"
                  placeholder="000000"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  required
                  disabled={loading}
                  className="text-center text-2xl tracking-widest font-mono"
                  maxLength={6}
                  autoComplete="off"
                />
              </div>
              <div className="text-sm text-muted-foreground text-center">
                Code sent to: <strong>{pendingEmail}</strong>
              </div>
              <Button type="submit" className="w-full" disabled={loading || verificationCode.length !== 6}>
                {loading ? "Verifying..." : "Verify & Sign In"}
              </Button>
              <div className="text-center space-y-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleResendCode}
                  disabled={loading}
                >
                  Resend code
                </Button>
                <div>
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    onClick={() => {
                      setStep("login");
                      setVerificationCode("");
                      setPendingEmail("");
                    }}
                  >
                    ← Back to login
                  </Button>
                </div>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}