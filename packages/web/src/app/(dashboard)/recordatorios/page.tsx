"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MoreHorizontal, Plus, Search } from "lucide-react";

import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { ReminderIcon } from "@/components/reminder-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { TableRowsSkeleton } from "@/components/loaders";
import { judgingRemindersService } from "@/services/judging-reminders.service";
import type { JudgingReminder } from "@/types/judging-reminders";

const ALL_STATUS_VALUE = "all";

export default function RecordatoriosPage() {
  const { toast } = useToast();
  const [reminders, setReminders] = useState<JudgingReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(ALL_STATUS_VALUE);
  const [deleteTarget, setDeleteTarget] = useState<JudgingReminder | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadReminders = useCallback(async () => {
    setLoading(true);
    try {
      const response = await judgingRemindersService.listJudgingReminders({
        search: search.trim() || undefined,
        isActive:
          statusFilter === ALL_STATUS_VALUE
            ? "all"
            : statusFilter === "active"
              ? "true"
              : "false",
      });
      setReminders(response.data ?? []);
    } catch {
      toast({
        variant: "error",
        title: "No se pudieron cargar los recordatorios",
        description: "Intenta de nuevo en unos segundos.",
      });
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, toast]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      void loadReminders();
    }, 250);

    return () => clearTimeout(timeout);
  }, [loadReminders]);

  const statusLabel = useMemo(() => {
    if (statusFilter === "active") return "Activos";
    if (statusFilter === "inactive") return "Inactivos";
    return "Todos los estados";
  }, [statusFilter]);

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setDeleting(true);
    try {
      await judgingRemindersService.deleteJudgingReminder(deleteTarget.id);
      toast({
        variant: "success",
        title: "Recordatorio eliminado",
        description: `"${deleteTarget.name}" fue eliminado del catálogo.`,
      });
      setDeleteTarget(null);
      await loadReminders();
    } catch {
      toast({
        variant: "error",
        title: "No se pudo eliminar",
        description: "El recordatorio podría estar en uso.",
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
            Catálogo
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950">
            Recordatorios
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Administra los recordatorios disponibles para el flujo de juzgamiento.
          </p>
        </div>
        <Button
          nativeButton={false}
          render={
            <Link href="/recordatorios/nuevo">
              <Plus className="size-4" />
              Nuevo recordatorio
            </Link>
          }
        />
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nombre..."
            className="h-10 bg-white pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-600">Estado</span>
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value ?? ALL_STATUS_VALUE)}>
            <SelectTrigger className="h-10 w-[220px] bg-white">
              <span>{statusLabel}</span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_STATUS_VALUE}>Todos los estados</SelectItem>
              <SelectItem value="active">Activos</SelectItem>
              <SelectItem value="inactive">Inactivos</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white subtle-shadow">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Icono</TableHead>
              <TableHead>Ejemplar</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRowsSkeleton columns={5} />
            ) : reminders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-slate-500">
                  No hay recordatorios registrados
                </TableCell>
              </TableRow>
            ) : (
              reminders.map((reminder) => (
                <TableRow key={reminder.id}>
                  <TableCell className="font-medium text-slate-900">{reminder.name}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-slate-600">
                      <ReminderIcon icon={reminder.icon} className="size-4" />
                      <span className="text-sm">{reminder.icon}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-slate-400">—</TableCell>
                  <TableCell>
                    <Badge variant={reminder.isActive ? "secondary" : "outline"}>
                      {reminder.isActive ? "Activo" : "Inactivo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button variant="ghost" size="icon-sm" aria-label="Abrir acciones">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        }
                      />
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem
                          className="cursor-pointer"
                          render={<Link href={`/recordatorios/${reminder.id}`}>Ver</Link>}
                        />
                        <DropdownMenuItem
                          className="cursor-pointer"
                          render={<Link href={`/recordatorios/${reminder.id}/editar`}>Editar</Link>}
                        />
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="cursor-pointer text-destructive"
                          onClick={() => setDeleteTarget(reminder)}
                        >
                          Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <ConfirmActionDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Eliminar recordatorio"
        description={
          deleteTarget
            ? `¿Deseas eliminar "${deleteTarget.name}"? Esta acción no se puede deshacer.`
            : undefined
        }
        confirmText="Eliminar"
        variant="destructive"
        busy={deleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
