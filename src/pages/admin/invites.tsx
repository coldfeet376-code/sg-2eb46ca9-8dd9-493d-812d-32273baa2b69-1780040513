import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { authService } from "@/services/authService";
import { Mail, Copy, CheckCircle, XCircle, Clock, Ban, RefreshCw } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

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

export default function AdminInvitesPage() {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingInvite, setSendingInvite] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    checkAdminAndLoadData();
  }, []);

  const checkAdminAndLoadData = async () => {
    setLoading(true);
    try {
      const adminStatus = await authService.isAdmin();
      setIsAdmin(adminStatus);
      
      if (!adminStatus) {
        toast({
          title: "Access denied",
          description: "You must be an admin to access this page",
          variant: "destructive",
        });
        router.push("/");
        return;
      }

      await loadInvitations();
    } catch (error) {
      console.error("Error checking admin status:", error);
      router.push("/");
    } finally {
      setLoading(false);
    }
  };

  const loadInvitations = async () => {
    try {
      const data = await authService.getInvitations();
      setInvitations(data);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load invitations",
        variant: "destructive",
      });
    }
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendingInvite(true);

    try {
      // Validate email domain (allow specific admin email)
      const isSpecialAdmin = newEmail.toLowerCase() === "coldfeet376@gmail.com";
      const isAdminEmail = newEmail.toLowerCase().startsWith("admin@");
      const hasCorrectDomain = newEmail.toLowerCase().endsWith("@gistworld.com");
      
      if (!isSpecialAdmin && !isAdminEmail && !hasCorrectDomain) {
        toast({
          title: "Invalid email domain",
          description: "Email must be @gistworld.com",
          variant: "destructive",
        });
        setSendingInvite(false);
        return;
      }

      const invitation = await authService.sendInvitation(newEmail);
      
      // Copy invite link to clipboard
      const inviteUrl = `${window.location.origin}/signup?token=${invitation.token}`;
      await navigator.clipboard.writeText(inviteUrl);
      
      toast({
        title: "Invitation sent",
        description: "Invite link copied to clipboard",
      });
      
      setNewEmail("");
      setDialogOpen(false);
      await loadInvitations();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send invitation",
        variant: "destructive",
      });
    } finally {
      setSendingInvite(false);
    }
  };

  const copyInviteLink = async (token: string) => {
    const inviteUrl = `${window.location.origin}/signup?token=${token}`;
    await navigator.clipboard.writeText(inviteUrl);
    toast({
      title: "Copied",
      description: "Invite link copied to clipboard",
    });
  };

  const handleCancelInvite = async (id: string) => {
    try {
      await authService.cancelInvitation(id);
      toast({
        title: "Invitation cancelled",
      });
      await loadInvitations();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to cancel invitation",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string, expiresAt: string) => {
    const isExpired = new Date(expiresAt) < new Date();
    
    if (status === "accepted") {
      return (
        <Badge variant="default" className="gap-1 bg-primary/10 text-primary border-primary/20">
          <CheckCircle className="h-3 w-3" />
          Accepted
        </Badge>
      );
    }
    
    if (status === "cancelled") {
      return (
        <Badge variant="secondary" className="gap-1">
          <Ban className="h-3 w-3" />
          Cancelled
        </Badge>
      );
    }
    
    if (isExpired) {
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="h-3 w-3" />
          Expired
        </Badge>
      );
    }
    
    return (
      <Badge variant="outline" className="gap-1">
        <Clock className="h-3 w-3" />
        Pending
      </Badge>
    );
  };

  if (!isAdmin) {
    return null;
  }

  return (
    <>
      <Head>
        <title>User Invitations - GIST Warehouse Rota</title>
      </Head>
      <Layout>
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-4xl font-condensed font-bold tracking-tight text-foreground mb-2">
                User Invitations
              </h1>
              <p className="text-sm font-sans text-muted-foreground">
                Invite new users to join the warehouse rota system
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={loadInvitations}
                disabled={loading}
                variant="outline"
                className="font-sans font-medium gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="font-sans font-medium gap-2">
                    <Mail className="h-4 w-4" />
                    Send Invite
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="font-condensed text-xl">Send Invitation</DialogTitle>
                    <DialogDescription className="font-sans">
                      Enter the email address of the person you want to invite
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSendInvite} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email" className="font-sans font-medium">
                        Email Address
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="user@gistworld.com"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        required
                        className="font-sans"
                      />
                      <p className="text-xs text-muted-foreground font-sans">
                        Must be @gistworld.com email
                      </p>
                    </div>
                    <Button
                      type="submit"
                      className="w-full font-sans font-medium gap-2"
                      disabled={sendingInvite}
                    >
                      {sendingInvite ? (
                        "Sending..."
                      ) : (
                        <>
                          <Mail className="h-4 w-4" />
                          Send Invitation
                        </>
                      )}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <Card className="shadow-sm">
            <CardHeader className="border-b border-border/50 bg-muted/30">
              <CardTitle className="text-lg font-condensed font-bold tracking-tight">
                Invitation History
              </CardTitle>
              <CardDescription className="font-sans">
                View and manage sent invitations
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-12 text-center">
                  <div className="h-8 w-8 mx-auto border-4 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : invitations.length === 0 ? (
                <div className="p-12 text-center space-y-2">
                  <Mail className="h-12 w-12 mx-auto text-muted-foreground/50" />
                  <p className="text-sm font-sans text-muted-foreground">
                    No invitations sent yet
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="font-sans">Email</TableHead>
                      <TableHead className="font-sans">Status</TableHead>
                      <TableHead className="font-sans">Invited By</TableHead>
                      <TableHead className="font-sans">Sent</TableHead>
                      <TableHead className="font-sans">Expires</TableHead>
                      <TableHead className="font-sans text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invitations.map((invite) => (
                      <TableRow key={invite.id}>
                        <TableCell className="font-mono text-sm">
                          {invite.email}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(invite.status, invite.expires_at)}
                        </TableCell>
                        <TableCell className="font-sans text-sm text-muted-foreground">
                          {invite.invited_by_email || "Unknown"}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {new Date(invite.created_at).toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {new Date(invite.expires_at).toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {invite.status === "pending" && (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => copyInviteLink(invite.token)}
                                  className="gap-1"
                                >
                                  <Copy className="h-3 w-3" />
                                  Copy Link
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleCancelInvite(invite.id)}
                                  className="gap-1 text-destructive hover:text-destructive"
                                >
                                  <Ban className="h-3 w-3" />
                                  Cancel
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </Layout>
    </>
  );
}