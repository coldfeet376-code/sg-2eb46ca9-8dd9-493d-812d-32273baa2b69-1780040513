import { useState } from "react";
import { useRouter } from "next/router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SEO } from "@/components/SEO";

// Optimized icon imports
import Lock from "lucide-react/dist/esm/icons/lock";
import LayoutGrid from "lucide-react/dist/esm/icons/layout-grid";
import AlertCircle from "lucide-react/dist/esm/icons/alert-circle";

const CORRECT_PASSWORD = "warehouse2024"; // Generic password - can be changed or moved to .env

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    // Check if already logged in
    const isLoggedIn = localStorage.getItem("warehouse-auth");
    if (isLoggedIn === "true") {
      router.push("/");
    }
  }, [router]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password === CORRECT_PASSWORD) {
      localStorage.setItem("warehouse-auth", "true");
      router.push("/");
    } else {
      setError(true);
      setPassword("");
      setTimeout(() => setError(false), 3000);
    }
  };

  return (
    <div className="min-h-screen bg-background gradient-mesh flex items-center justify-center p-4">
      <SEO title="Login - Warehouse Rota" description="Access warehouse rota system" />
      
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto h-16 w-16 rounded-2xl gradient-primary flex items-center justify-center shadow-lg">
            <Lock className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="font-condensed text-2xl">Warehouse Rota System</CardTitle>
          <CardDescription className="font-mono text-xs">
            Enter password to access the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password" className="font-mono text-xs">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="rounded-xl font-mono"
                autoFocus
              />
            </div>

            {error && (
              <Alert className="bg-destructive/10 border-destructive/50">
                <AlertCircle className="h-4 w-4 text-destructive" />
                <AlertDescription className="font-mono text-xs text-destructive">
                  Incorrect password. Please try again.
                </AlertDescription>
              </Alert>
            )}

            <Button 
              type="submit" 
              className="w-full gradient-primary text-white rounded-xl shadow-lg hover:shadow-xl transition-smooth"
              disabled={!password}
            >
              <Lock className="h-4 w-4 mr-2" />
              <span className="font-mono text-sm">Access System</span>
            </Button>

            <p className="text-center text-xs font-mono text-muted-foreground mt-4">
              Default password: warehouse2024
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}