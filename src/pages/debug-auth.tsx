import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, LogOut, LogIn } from "lucide-react";
import { useRouter } from "next/router";
import { Layout } from "@/components/Layout";

export default function DebugAuthPage() {
  const [authState, setAuthState] = useState<any>(null);
  const [dbAuthState, setDbAuthState] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const checkAuth = async () => {
    setLoading(true);
    setError(null);
    
    try {
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

      // Check database auth state - wrapped in try-catch
      try {
        const { data: dbData, error: dbError } = await supabase
          .rpc('get_current_user_info');
        
        setDbAuthState({
          data: dbData,
          error: dbError?.message || null,
        });
      } catch (rpcError: any) {
        console.error("RPC call failed:", rpcError);
        setDbAuthState({
          error: `RPC function not found or failed: ${rpcError.message}`,
        });
      }
    } catch (e: any) {
      console.error("Auth check failed:", e);
      setError(e.message || "Unknown error during auth check");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <Layout>
      <div className="container mx-auto p-8 max-w-4xl">
        {error && (
          <Card className="mb-6 border-destructive bg-destructive/5">
            <CardContent className="pt-6">
              <div className="text-destructive font-semibold">Error loading diagnostics:</div>
              <div className="text-sm mt-2">{error}</div>
            </CardContent>
          </Card>
        )}
        
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold">Authentication Diagnostics</h1>
            <div className="flex gap-2">
              <Button onClick={checkAuth} disabled={loading} size="sm">
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button variant="outline" onClick={() => router.push('/login')} size="sm">
                <LogIn className="h-4 w-4 mr-2" />
                Login
              </Button>
              <Button variant="destructive" onClick={handleSignOut} size="sm">
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
              {loading && !authState ? (
                <div>Loading browser session...</div>
              ) : authState ? (
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
                <div className="text-muted-foreground">No session data available</div>
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
              
              {loading && !dbAuthState ? (
                <div>Checking database authentication...</div>
              ) : dbAuthState ? (
                <>
                  {dbAuthState.error ? (
                    <div className="space-y-2">
                      <Badge variant="destructive">✗ Database Auth Check Failed</Badge>
                      <div className="text-destructive text-sm">
                        Error: {dbAuthState.error}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Note: This is expected if the diagnostic RPC function hasn't been created yet.
                        The important check is the "Browser Session State" above.
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
                <div className="text-muted-foreground">No database check results</div>
              )}
            </CardContent>
          </Card>

          <Card className="border-warning bg-warning/5">
            <CardHeader>
              <CardTitle>💡 Quick Fixes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <div className="font-semibold mb-2">If "✗ No Session" above:</div>
                <ol className="list-decimal list-inside space-y-1 ml-2">
                  <li>Click "Sign Out" button above</li>
                  <li>Click "Login" button and enter your credentials</li>
                  <li>Come back here and click "Refresh"</li>
                  <li>You should see "✓ Session Found"</li>
                </ol>
              </div>
              
              <div>
                <div className="font-semibold mb-2">If "✓ Session Found" but rest days/availability still won't save:</div>
                <ol className="list-decimal list-inside space-y-1 ml-2">
                  <li>Hard refresh the page (pull down to refresh on mobile)</li>
                  <li>Go to Staff page and try clicking a rest day again</li>
                  <li>Check browser console (if available) for specific error messages</li>
                </ol>
              </div>

              <div>
                <div className="font-semibold mb-2">For import issues:</div>
                <ol className="list-decimal list-inside space-y-1 ml-2">
                  <li>Make sure you see "✓ Session Found" above</li>
                  <li>Go to Import page</li>
                  <li>Import will now verify your session before starting</li>
                  <li>If session is missing, you'll get a clear error message</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}