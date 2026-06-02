import { AppLayout } from "@/components/layout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useWorkspace } from "@/hooks/use-workspace";
import {
  ASSIGNABLE_ROLES,
  CAPABILITY_MATRIX,
  ROLE_DESCRIPTIONS,
  roleCan,
  roleLabel,
} from "@/lib/permissions";
import { ShieldCheck, Check, Minus } from "lucide-react";

// Roles shown across the matrix columns, including super_admin so users
// understand the full hierarchy.
const MATRIX_ROLES = ["super_admin", ...ASSIGNABLE_ROLES] as const;

export default function AccessPage() {
  const { currentRole, currentWorkspace, me } = useWorkspace();

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <ShieldCheck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Access & Permissions</h1>
            <p className="text-sm text-muted-foreground">
              How roles work and what each one can do.
            </p>
          </div>
        </div>

        <Card className="p-5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-muted-foreground">Your effective role in</span>
            <Badge variant="secondary">{currentWorkspace?.name ?? "this workspace"}</Badge>
            <span className="text-sm text-muted-foreground">is</span>
            <Badge>{roleLabel(currentRole)}</Badge>
            {me?.isSuperAdmin && (
              <span className="text-xs text-muted-foreground">
                (as a super admin you have full access to every workspace)
              </span>
            )}
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b bg-muted/40 px-4 py-2.5">
            <h2 className="text-sm font-semibold">Permission matrix</h2>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[260px]">Capability</TableHead>
                {MATRIX_ROLES.map((r) => (
                  <TableHead key={r} className="text-center">
                    {roleLabel(r)}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {CAPABILITY_MATRIX.map((cap) => (
                <TableRow key={cap.capability}>
                  <TableCell>
                    <div className="font-medium">{cap.label}</div>
                    <div className="text-xs text-muted-foreground">{cap.description}</div>
                  </TableCell>
                  {MATRIX_ROLES.map((r) => (
                    <TableCell key={r} className="text-center">
                      {roleCan(r, cap.capability) ? (
                        <Check className="mx-auto h-4 w-4 text-emerald-600" />
                      ) : (
                        <Minus className="mx-auto h-4 w-4 text-muted-foreground/40" />
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2">
          {MATRIX_ROLES.map((r) => (
            <Card key={r} className="p-5">
              <div className="flex items-center gap-2">
                <Badge variant={r === currentRole ? "default" : "secondary"}>
                  {roleLabel(r)}
                </Badge>
                {r === currentRole && (
                  <span className="text-xs text-muted-foreground">your role</span>
                )}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {ROLE_DESCRIPTIONS[r]}
              </p>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
