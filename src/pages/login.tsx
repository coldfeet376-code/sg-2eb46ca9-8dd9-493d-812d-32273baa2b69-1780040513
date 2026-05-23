import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { authService } from "@/services/authService";
import { LogIn, UserPlus } from "lucide-react";

export default function LoginPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    // Check if user is already logged in
    const checkAuth = async () => {
      const session = await authService.getSession();
      if (session) {
        router.push("/");
      }
    };
    checkAuth();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignUp) {
        // Validate email domain for non-admin users
        const isAdmin = email.toLowerCase().startsWith("admin@");
        const hasCorrectDomain = email.toLowerCase().endsWith("@gistworld.com");
        
        if (!isAdmin && !hasCorrectDomain) {
          toast({
            title: "Invalid email domain",
            description: "Please use an @gistworld.com email address",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
        
        // Sign up with display name in metadata
        await authService.signUp(email, password, name);
        
        toast({
          title: "Account created",
          description: "Please check your email to verify your account",
        });
        
        // Auto switch to login after signup
        setIsSignUp(false);
      } else {
        // Sign in
        const user = await authService.signIn(email, password);
        
        // Store remember me preference
        if (rememberMe) {
          localStorage.setItem("warehouse_remember_me", "true");
        } else {
          localStorage.removeItem("warehouse_remember_me");
        }
        
        toast({
          title: "Welcome back!",
          description: `Logged in as ${user.email}`,
        });
        
        router.push("/");
      }
    } catch (error: any) {
      toast({
        title: isSignUp ? "Signup failed" : "Login failed",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-3xl font-condensed font-bold tracking-tight">
            GIST Warehouse Rota
          </CardTitle>
          <CardDescription className="font-sans">
            {isSignUp ? "Create your account to get started" : "Sign in to access the rota system"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
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
                  required={isSignUp}
                  className="font-sans"
                />
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="email" className="font-sans font-medium">
                Email
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
              {isSignUp && (
                <p className="text-xs text-muted-foreground font-sans">
                  Must be @gistworld.com email (admin emails excluded)
                </p>
              )}
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
              {isSignUp && (
                <p className="text-xs text-muted-foreground font-sans">
                  Minimum 6 characters
                </p>
              )}
            </div>

            {!isSignUp && (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="remember"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                />
                <Label
                  htmlFor="remember"
                  className="text-sm font-sans font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  Remember me
                </Label>
              </div>
            )}

            <Button
              type="submit"
              className="w-full font-sans font-medium gap-2"
              disabled={loading}
              size="lg"
            >
              {loading ? (
                "Please wait..."
              ) : isSignUp ? (
                <>
                  <UserPlus className="h-4 w-4" />
                  Create Account
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4" />
                  Sign In
                </>
              )}
            </Button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-sm font-sans text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline"
              >
                {isSignUp ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}