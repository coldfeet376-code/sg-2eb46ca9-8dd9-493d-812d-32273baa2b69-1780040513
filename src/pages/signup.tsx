import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { authService } from "@/services/authService";
import { UserPlus, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function SignUpPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [inviteValid, setInviteValid] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const router = useRouter();
  const { toast } = useToast();
  const token = router.query.token as string;

  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setValidating(false);
        setInviteValid(false);
        return;
      }

      try {
        const result = await authService.validateInvitation(token);
        setInviteValid(result.valid);
        if (result.email) {
          setEmail(result.email);
          setInviteEmail(result.email);
        }
      } catch (error) {
        console.error("Error validating invitation:", error);
        setInviteValid(false);
      } finally {
        setValidating(false);
      }
    };

    validateToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Sign up with display name
      await authService.signUp(email, password, name);
      
      // Mark invitation as accepted
      if (token) {
        await authService.acceptInvitation(token);
      }
      
      toast({
        title: "Account created",
        description: "Please check your email to verify your account",
      });
      
      // Redirect to login
      router.push("/login");
    } catch (error: any) {
      toast({
        title: "Signup failed",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (validating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 p-4">
        <Card className="w-full max-w-md shadow-lg">
          <CardContent className="pt-12 pb-12">
            <div className="text-center space-y-4">
              <div className="h-8 w-8 mx-auto border-4 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-muted-foreground font-sans">Validating invitation...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!token || !inviteValid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 p-4">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="space-y-1 text-center">
            <div className="mx-auto w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle className="text-2xl font-condensed font-bold tracking-tight">
              Invalid Invitation
            </CardTitle>
            <CardDescription className="font-sans">
              This invitation link is invalid or has expired
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="font-sans text-sm">
                Invitation links are valid for 7 days and can only be used once.
              </AlertDescription>
            </Alert>
            <Link href="/login">
              <Button variant="outline" className="w-full font-sans font-medium">
                Back to Login
              </Button>
            </Link>
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
            Create Your Account
          </CardTitle>
          <CardDescription className="font-sans">
            You've been invited to join GIST Warehouse Rota
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="font-sans font-medium">
                Display Name
              </Label>
              <Input
                id="name"
                type="text"
                placeholder="John Smith"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="font-sans"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email" className="font-sans font-medium">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                disabled
                className="font-sans bg-muted"
              />
              <p className="text-xs text-muted-foreground font-sans">
                Invitation sent to this email address
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password" className="font-sans font-medium">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="font-sans"
              />
              <p className="text-xs text-muted-foreground font-sans">
                Minimum 6 characters
              </p>
            </div>

            <Button
              type="submit"
              className="w-full font-sans font-medium gap-2"
              disabled={loading}
              size="lg"
            >
              {loading ? (
                "Creating account..."
              ) : (
                <>
                  <UserPlus className="h-4 w-4" />
                  Create Account
                </>
              )}
            </Button>

            <div className="text-center">
              <Link href="/login">
                <button
                  type="button"
                  className="text-sm font-sans text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline"
                >
                  Already have an account? Sign in
                </button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}