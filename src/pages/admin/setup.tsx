import { useState } from "react";
import { useRouter } from "next/router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { authService } from "@/services/authService";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, AlertCircle, Loader2 } from "lucide-react";

export default function AdminSetupPage() {
  const [status, setStatus] = useState<"idle" | "creating" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [email, setEmail] = useState("admin@gist-rota.com");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("Admin");
  const router = useRouter();
  const { toast } = useToast();

  const createAdminAccount = async () => {
    if (!email || !password || password.length < 6) {
      toast({
        title: "Invalid input",
        description: "Email and password (min 6 chars) are required",
        variant: "destructive",
      });
      return;
    }

    setStatus("creating");
    setErrorMessage("");

    try {
      // Sign out any existing session first
      await authService.signOut().catch(() => {
        // Ignore sign out errors - user might not be logged in
      });

      // Create the account with email confirmation disabled
      const { data, error } = await supabase.auth.signUp({
        email: email,
        password: password,
        options: {
          data: {
            name: name || "Admin",
          },
          emailRedirectTo: undefined, // No email confirmation needed
        }
      });

      if (error) {
        throw error;
      }
      
      setStatus("success");
      toast({
        title: "Admin account created",
        description: "Redirecting to login...",
      });

      // Wait 2 seconds then redirect to login
      setTimeout(() => {
        router.push("/login");
      }, 2000);
    } catch (error: any) {
      // If user already exists, that's actually fine - they can just login
      if (error.message?.includes("already registered") || error.message?.includes("already exists")) {
        setStatus("success");
        toast({
          title: "Account already exists",
          description: "You can login with this email",
        });
        setTimeout(() => {
          router.push("/login");
        }, 2000);
      } else {
        setStatus("error");
        setErrorMessage(error.message || "Failed to create admin account");
        toast({
          title: "Setup failed",
          description: error.message || "Please try again",
          variant: "destructive",
        });
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-3xl font-condensed font-bold tracking-tight">
            Admin Account Setup
          </CardTitle>
          <CardDescription className="font-sans">
            Create your administrator account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {status === "idle" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="font-sans">Full Name</Label>
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Admin"
                  className="font-sans"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="font-sans">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  className="font-sans"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="font-sans">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="font-sans"
                  required
                  minLength={6}
                />
              </div>

              <div className="p-3 bg-primary/10 rounded-lg">
                <p className="text-xs font-sans text-muted-foreground">
                  This account will have full administrator privileges including staff management, rota generation, and system settings.
                </p>
              </div>

              <Button
                onClick={createAdminAccount}
                className="w-full font-sans font-medium gap-2"
                size="lg"
              >
                Create Admin Account
              </Button>
            </div>
          )}

          {status === "creating" && (
            <div className="text-center space-y-4 py-6">
              <Loader2 className="h-12 w-12 mx-auto text-primary animate-spin" />
              <div>
                <p className="text-sm font-sans font-medium">Creating account...</p>
                <p className="text-xs text-muted-foreground font-sans mt-1">
                  Please wait
                </p>
              </div>
            </div>
          )}

          {status === "success" && (
            <div className="text-center space-y-4 py-6">
              <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-primary" />
              </div>
              <div>
                <p className="text-sm font-sans font-medium">Admin account ready!</p>
                <p className="text-xs text-muted-foreground font-sans mt-1">
                  Redirecting to login...
                </p>
              </div>
            </div>
          )}

          {status === "error" && (
            <div className="space-y-4">
              <div className="text-center space-y-4 py-6">
                <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center">
                  <AlertCircle className="h-8 w-8 text-destructive" />
                </div>
                <div>
                  <p className="text-sm font-sans font-medium text-destructive">
                    Setup failed
                  </p>
                  <p className="text-xs text-muted-foreground font-sans mt-1">
                    {errorMessage}
                  </p>
                </div>
              </div>
              <Button
                onClick={createAdminAccount}
                className="w-full font-sans font-medium"
                variant="outline"
              >
                Try Again
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}