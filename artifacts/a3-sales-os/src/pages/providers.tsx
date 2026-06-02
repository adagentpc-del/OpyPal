import { useEffect, useState, useCallback } from "react";
import { Mail, Plus, Star, Trash2, RefreshCw, ShieldAlert, CheckCircle2, XCircle, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/hooks/use-workspace";
import { roleAtLeast } from "@/lib/permissions";

const API_BASE = import.meta.env.BASE_URL + "api";

type ProviderType = "outlook" | "gmail" | "resend" | "forwarding";

interface ProviderHealth {
  type: ProviderType;
  configured: boolean;
  connected: boolean;
  primaryEmail: string | null;
  connectionCount: number;
  detail?: string | null;
}

interface SenderIdentity {
  fromName?: string;
  fromEmail?: string;
  replyToEmail?: string;
  signature?: string;
  defaultProvider?: ProviderType;
  providerPriority?: ProviderType[];
  forwardingInbox?: string;
}

interface ProviderStatusResponse {
  providers: ProviderHealth[];
  senderIdentity: SenderIdentity;
  sendChain: ProviderType[];
}

interface MailboxConnection {
  id: number;
  emailAddress: string;
  displayName: string | null;
  isPrimary: boolean;
  isActive: boolean;
  lastSyncedAt: string | null;
  syncError: string | null;
}

const PROVIDER_LABELS: Record<ProviderType, string> = {
  outlook: "Outlook / Microsoft 365",
  gmail: "Gmail / Google Workspace",
  resend: "Resend",
  forwarding: "Manual Forwarding Inbox",
};

export default function ProvidersPage() {
  const { toast } = useToast();
  const { currentRole } = useWorkspace();
  const canEdit = roleAtLeast(currentRole, "workspace_admin");

  const [status, setStatus] = useState<ProviderStatusResponse | null>(null);
  const [outlookConns, setOutlookConns] = useState<MailboxConnection[]>([]);
  const [gmailConns, setGmailConns] = useState<MailboxConnection[]>([]);
  const [identity, setIdentity] = useState<SenderIdentity>({});
  const [forwardingInbox, setForwardingInbox] = useState("");
  const [saving, setSaving] = useState(false);

  const loadAll = useCallback(() => {
    fetch(`${API_BASE}/providers/status`).then(r => r.json()).then((d: ProviderStatusResponse) => {
      setStatus(d);
      setIdentity(d.senderIdentity || {});
      setForwardingInbox(d.senderIdentity?.forwardingInbox || "");
    }).catch(() => {});
    fetch(`${API_BASE}/outlook/status`).then(r => r.json()).then(d => setOutlookConns(d.connections || [])).catch(() => {});
    fetch(`${API_BASE}/gmail/status`).then(r => r.json()).then(d => setGmailConns(d.connections || [])).catch(() => {});
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const connect = async (provider: "outlook" | "gmail") => {
    try {
      const res = await fetch(`${API_BASE}/${provider}/auth-url`);
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else toast({ title: data.message || `${PROVIDER_LABELS[provider]} not configured`, variant: "destructive" });
    } catch {
      toast({ title: "Could not start connection", variant: "destructive" });
    }
  };

  const syncConn = async (provider: "outlook" | "gmail", id: number) => {
    try {
      await fetch(`${API_BASE}/${provider}/connections/${id}/sync`, { method: "POST" });
      toast({ title: "Sync started" });
      loadAll();
    } catch {
      toast({ title: "Sync failed", variant: "destructive" });
    }
  };

  const makePrimary = async (provider: "outlook" | "gmail", id: number) => {
    try {
      await fetch(`${API_BASE}/${provider}/connections/${id}/primary`, { method: "PATCH" });
      toast({ title: "Primary mailbox updated" });
      loadAll();
    } catch {
      toast({ title: "Update failed", variant: "destructive" });
    }
  };

  const disconnect = async (provider: "outlook" | "gmail", id: number) => {
    try {
      await fetch(`${API_BASE}/${provider}/connections/${id}`, { method: "DELETE" });
      toast({ title: "Mailbox disconnected" });
      loadAll();
    } catch {
      toast({ title: "Disconnect failed", variant: "destructive" });
    }
  };

  const saveIdentity = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/providers/sender-identity`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromName: identity.fromName ?? "",
          fromEmail: identity.fromEmail ?? "",
          replyToEmail: identity.replyToEmail ?? "",
          signature: identity.signature ?? "",
          defaultProvider: identity.defaultProvider ?? "",
        }),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      toast({ title: "Sender identity saved" });
      loadAll();
    } catch (e: any) {
      toast({ title: e.message || "Save failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const saveForwarding = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/providers/forwarding-inbox`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forwardingInbox: forwardingInbox.trim() }),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      toast({ title: "Forwarding inbox saved" });
      loadAll();
    } catch (e: any) {
      toast({ title: e.message || "Save failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const healthFor = (t: ProviderType) => status?.providers.find(p => p.type === t);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Mail className="h-6 w-6" /> Email Providers
        </h1>
        <p className="text-muted-foreground mt-1">
          Connect mailboxes, set your sending identity, and control provider fallback order.
        </p>
        {!canEdit && (
          <div className="mt-3 flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <ShieldAlert className="h-4 w-4" />
            You have view-only access. A workspace admin can change these settings.
          </div>
        )}
      </div>

      {status?.sendChain && status.sendChain.length > 0 && (
        <div className="border rounded-xl p-4 bg-muted/30">
          <div className="text-sm font-medium mb-2">Active send order (with fallback)</div>
          <div className="flex flex-wrap items-center gap-2">
            {status.sendChain.map((p, i) => (
              <div key={p} className="flex items-center gap-2">
                <Badge variant="secondary">{i + 1}. {PROVIDER_LABELS[p]}</Badge>
                {i < status.sendChain.length - 1 && <span className="text-muted-foreground">→</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Connection cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <ProviderCard
          title={PROVIDER_LABELS.outlook}
          health={healthFor("outlook")}
          connections={outlookConns}
          canEdit={canEdit}
          onConnect={() => connect("outlook")}
          onSync={(id) => syncConn("outlook", id)}
          onPrimary={(id) => makePrimary("outlook", id)}
          onDisconnect={(id) => disconnect("outlook", id)}
        />
        <ProviderCard
          title={PROVIDER_LABELS.gmail}
          health={healthFor("gmail")}
          connections={gmailConns}
          canEdit={canEdit}
          onConnect={() => connect("gmail")}
          onSync={(id) => syncConn("gmail", id)}
          onPrimary={(id) => makePrimary("gmail", id)}
          onDisconnect={(id) => disconnect("gmail", id)}
        />
      </div>

      {/* Resend (transactional, no per-workspace OAuth) */}
      <div className="border rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold">{PROVIDER_LABELS.resend}</h2>
            <StatusBadge connected={!!healthFor("resend")?.connected} />
          </div>
          <div className="text-sm text-muted-foreground">{healthFor("resend")?.primaryEmail || "—"}</div>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          {healthFor("resend")?.detail || "Transactional fallback provider, used last in the send chain."}
        </p>
      </div>

      {/* Sender identity */}
      <div className="border rounded-xl p-4 space-y-4">
        <h2 className="font-semibold">Sender Identity</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>From name</Label>
            <Input value={identity.fromName ?? ""} disabled={!canEdit}
              onChange={(e) => setIdentity({ ...identity, fromName: e.target.value })}
              placeholder="A3 Visual Sales" />
          </div>
          <div>
            <Label>From email</Label>
            <Input value={identity.fromEmail ?? ""} disabled={!canEdit}
              onChange={(e) => setIdentity({ ...identity, fromEmail: e.target.value })}
              placeholder="sales@a3visual.com" />
          </div>
          <div>
            <Label>Reply-to email</Label>
            <Input value={identity.replyToEmail ?? ""} disabled={!canEdit}
              onChange={(e) => setIdentity({ ...identity, replyToEmail: e.target.value })}
              placeholder="replies@a3visual.com" />
          </div>
          <div>
            <Label>Default provider</Label>
            <select
              className="w-full border rounded-lg px-3 py-2 text-sm bg-background disabled:opacity-60"
              value={identity.defaultProvider ?? ""}
              disabled={!canEdit}
              onChange={(e) => setIdentity({ ...identity, defaultProvider: (e.target.value || undefined) as ProviderType })}
            >
              <option value="">Use workspace default</option>
              <option value="outlook">Outlook / Microsoft 365</option>
              <option value="gmail">Gmail / Google Workspace</option>
              <option value="resend">Resend</option>
            </select>
          </div>
        </div>
        <div>
          <Label>Signature</Label>
          <textarea
            className="w-full border rounded-lg px-3 py-2 text-sm bg-background disabled:opacity-60 min-h-[80px]"
            value={identity.signature ?? ""}
            disabled={!canEdit}
            onChange={(e) => setIdentity({ ...identity, signature: e.target.value })}
            placeholder="Best regards, ..."
          />
        </div>
        {canEdit && (
          <Button onClick={saveIdentity} disabled={saving}>
            <Save className="h-4 w-4 mr-2" /> Save sender identity
          </Button>
        )}
      </div>

      {/* Forwarding inbox */}
      <div className="border rounded-xl p-4 space-y-3">
        <h2 className="font-semibold">{PROVIDER_LABELS.forwarding}</h2>
        <p className="text-sm text-muted-foreground">
          A dedicated address you forward replies to. Forwarded mail is attributed to this
          workspace and matched to the original lead.
        </p>
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <Label>Forwarding inbox address</Label>
            <Input value={forwardingInbox} disabled={!canEdit}
              onChange={(e) => setForwardingInbox(e.target.value)}
              placeholder="inbox@a3visual.com" />
          </div>
          {canEdit && (
            <Button onClick={saveForwarding} disabled={saving} variant="outline">
              <Save className="h-4 w-4 mr-2" /> Save
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ connected }: { connected: boolean }) {
  return connected ? (
    <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
      <CheckCircle2 className="h-3 w-3 mr-1" /> Connected
    </Badge>
  ) : (
    <Badge variant="secondary">
      <XCircle className="h-3 w-3 mr-1" /> Not connected
    </Badge>
  );
}

function ProviderCard({
  title, health, connections, canEdit, onConnect, onSync, onPrimary, onDisconnect,
}: {
  title: string;
  health?: ProviderHealth;
  connections: MailboxConnection[];
  canEdit: boolean;
  onConnect: () => void;
  onSync: (id: number) => void;
  onPrimary: (id: number) => void;
  onDisconnect: (id: number) => void;
}) {
  const configured = !!health?.configured;
  return (
    <div className="border rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{title}</h2>
        <StatusBadge connected={!!health?.connected} />
      </div>

      {!configured && (
        <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          {health?.detail || "Provider not configured."}
        </div>
      )}

      {connections.length > 0 ? (
        <div className="space-y-2">
          {connections.map(conn => (
            <div key={conn.id} className="flex items-center justify-between border rounded-lg px-3 py-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{conn.emailAddress}</span>
                  {conn.isPrimary && (
                    <Badge variant="secondary" className="shrink-0"><Star className="h-3 w-3 mr-1" /> Primary</Badge>
                  )}
                </div>
                {conn.syncError && <div className="text-xs text-red-600 truncate">{conn.syncError}</div>}
              </div>
              {canEdit && (
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="icon" variant="ghost" title="Sync" onClick={() => onSync(conn.id)}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  {!conn.isPrimary && (
                    <Button size="icon" variant="ghost" title="Make primary" onClick={() => onPrimary(conn.id)}>
                      <Star className="h-4 w-4" />
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" title="Disconnect" onClick={() => onDisconnect(conn.id)}>
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        configured && <p className="text-sm text-muted-foreground">No mailboxes connected yet.</p>
      )}

      {canEdit && configured && (
        <Button variant="outline" onClick={onConnect}>
          <Plus className="h-4 w-4 mr-2" /> Connect mailbox
        </Button>
      )}
    </div>
  );
}
