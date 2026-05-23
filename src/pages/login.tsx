import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { authService } from "@/services/authService";
import { LogIn } from "lucide-react";

export default function LoginPage() {
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
    } catch (error: any) {
      toast({
        title: "Login failed",
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
            Sign in to access the rota system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="font-sans font-medium">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="your.email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="font-sans"
              />
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
              <div className="flex justify-end">
                <Link href="/forgot-password">
                  <button
                    type="button"
                    className="text-xs font-sans text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline"
                  >
                    Forgot password?
                  </button>
                </Link>
              </div>
            </div>

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

            <Button
              type="submit"
              className="w-full font-sans font-medium gap-2"
              disabled={loading}
              size="lg"
            >
              {loading ? (
                "Please wait..."
              ) : (
                <>
                  <LogIn className="h-4 w-4" />
                  Sign In
                </>
              )}
            </Button>

            <div className="text-center pt-2">
              <p className="text-xs font-sans text-muted-foreground">
                Don't have an account? Contact your administrator for an invitation
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}