import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { authService } from "@/services/authService";
import { Mail, ArrowLeft } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await authService.resetPassword(email);
      
      setEmailSent(true);
      toast({
        title: "Reset link sent",
        description: "Check your email for the password reset link",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send reset link",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (emailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 p-4">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="space-y-1 text-center">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Mail className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-2xl font-condensed font-bold tracking-tight">
              Check Your Email
            </CardTitle>
            <CardDescription className="font-sans">
              We've sent a password reset link to <br />
              <span className="font-semibold text-foreground">{email}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-muted/50 p-4 space-y-2">
              <p className="text-sm font-sans text-muted-foreground">
                Click the link in the email to reset your password. The link will expire in 1 hour.
              </p>
              <p className="text-xs font-sans text-muted-foreground">
                Didn't receive the email? Check your spam folder or try again.
              </p>
            </div>

            <div className="space-y-2">
              <Button
                onClick={() => setEmailSent(false)}
                variant="outline"
                className="w-full font-sans font-medium"
              >
                Send Another Link
              </Button>
              
              <Link href="/login">
                <Button
                  variant="ghost"
                  className="w-full font-sans font-medium gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Login
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-3xl font-condensed font-bold tracking-tight">
            Reset Password
          </CardTitle>
          <CardDescription className="font-sans">
            Enter your email and we'll send you a reset link
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="font-sans font-medium">
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="john@gistworld.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="font-sans"
              />
              <p className="text-xs text-muted-foreground font-sans">
                Must be your registered @gistworld.com email
              </p>
            </div>

            <Button
              type="submit"
              className="w-full font-sans font-medium gap-2"
              disabled={loading}
              size="lg"
            >
              {loading ? (
                "Sending..."
              ) : (
                <>
                  <Mail className="h-4 w-4" />
                  Send Reset Link
                </>
              )}
            </Button>

            <div className="text-center">
              <Link href="/login">
                <button
                  type="button"
                  className="text-sm font-sans text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline inline-flex items-center gap-1"
                >
                  <ArrowLeft className="h-3 w-3" />
                  Back to Login
                </button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}