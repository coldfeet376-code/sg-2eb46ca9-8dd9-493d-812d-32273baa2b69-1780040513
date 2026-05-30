import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, LogOut, LogIn } from "lucide-react";
import { useRouter } from "next/router";

export default function DebugAuthPage() {
  const [authState, setAuthState] = useState<any>(null);
  const [dbAuthState, setDbAuthState] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const checkAuth = async () => {
    setLoading(true);
    
    // Check browser session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    setAuthState({
      session: session ? {
        access_token: session.access_token ? `${session.access_token.substring(0, 20)}...` : null,
        refresh_token: session.refresh_token ? `${session.refresh_token.substring(0, 20)}...` : null,
        expires_at: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : null,
        user_id: session.user?.id,
        email: session.user?.email,
      } : null,
      user: user ? {
        id: user.id,
        email: user.email,
        created_at: user.created_at,
      } : null,
      sessionError,
      userError,
    });

    // Check database auth state
    try {
      const { data: dbData, error: dbError } = await supabase
        .rpc('get_current_user_info');
      
      setDbAuthState({
        data: dbData,
        error: dbError,
      });
    } catch (e: any) {
      setDbAuthState({
        error: e.message,
      });
    }
    
    setLoading(false);
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <div className="container mx-auto p-8 max-w-4xl">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Authentication Diagnostics</h1>
          <div className="flex gap-2">
            <Button onClick={checkAuth} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button variant="outline" onClick={() => router.push('/login')}>
              <LogIn className="h-4 w-4 mr-2" />
              Login Page
            </Button>
            <Button variant="destructive" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Browser Session State</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {authState ? (
              <>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">Status:</span>
                    {authState.session ? (
                      <Badge variant="default">✓ Session Found</Badge>
                    ) : (
                      <Badge variant="destructive">✗ No Session</Badge>
                    )}
                  </div>
                  
                  {authState.session && (
                    <>
                      <div>
                        <span className="font-semibold">User ID:</span> {authState.session.user_id}
                      </div>
                      <div>
                        <span className="font-semibold">Email:</span> {authState.session.email}
                      </div>
                      <div>
                        <span className="font-semibold">Expires:</span>{" "}
                        {authState.session.expires_at}
                      </div>
                      <div>
                        <span className="font-semibold">Access Token:</span>{" "}
                        <code className="text-xs bg-muted p-1 rounded">
                          {authState.session.access_token}
                        </code>
                      </div>
                    </>
                  )}
                  
                  {authState.sessionError && (
                    <div className="text-destructive">
                      <span className="font-semibold">Session Error:</span> {authState.sessionError.message}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div>Loading...</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Database Authentication Check</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This checks if your session is reaching the database (auth.uid() function)
            </p>
            
            {dbAuthState ? (
              <>
                {dbAuthState.error ? (
                  <div className="space-y-2">
                    <Badge variant="destructive">✗ Database Auth Failed</Badge>
                    <div className="text-destructive text-sm">
                      Error: {dbAuthState.error}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      This likely means the RPC function doesn't exist yet. Creating it...
                    </div>
                  </div>
                ) : dbAuthState.data ? (
                  <div className="space-y-2">
                    <Badge variant="default">✓ Database Authenticated</Badge>
                    <pre className="text-xs bg-muted p-4 rounded overflow-auto">
                      {JSON.stringify(dbAuthState.data, null, 2)}
                    </pre>
                  </div>
                ) : (
                  <div>
                    <Badge variant="destructive">✗ Not Authenticated in Database</Badge>
                  </div>
                )}
              </>
            ) : (
              <div>Loading...</div>
            )}
          </CardContent>
        </Card>

        <Card className="border-warning bg-warning/5">
          <CardHeader>
            <CardTitle>💡 Quick Fixes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <div className="font-semibold mb-2">If "No Session" above:</div>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Click "Sign Out" then go to Login page</li>
                <li>Log in with your credentials</li>
                <li>Come back here and click "Refresh"</li>
              </ol>
            </div>
            
            <div>
              <div className="font-semibold mb-2">If "Session Found" but "Not Authenticated in Database":</div>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Hard refresh the page (Ctrl+Shift+R or Cmd+Shift+R)</li>
                <li>If that doesn't work, clear browser cache and cookies</li>
                <li>Log out and back in</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}