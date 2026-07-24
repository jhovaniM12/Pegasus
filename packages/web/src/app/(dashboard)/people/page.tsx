"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, Sparkles, X } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { TableRowsSkeleton } from "@/components/loaders";
import { useFairs } from "@/hooks/use-fairs";
import { usePeople } from "@/hooks/use-people";
import { ApiError } from "@/services/api.service";
import { peopleService } from "@/services/people.service";
import type { Person } from "@/types/people";

const ALL_FAIRS_VALUE = "all";

const ROLE_PREFIX: Record<string, string> = {
  TECHNICAL_DIRECTOR: "DTF",
  JUDGE: "JFQ",
  VETERINARIAN: "VTF",
};

type RemoteAvailability = {
  code: string;
  checking: boolean;
  available: boolean | null;
  message: string;
};

function roleHint(person: Person): string | null {
  if (!person.accessRole) return null;
  const prefix = ROLE_PREFIX[person.accessRole];
  return prefix ? `Secuencia ${prefix}001…` : null;
}

function localValidationMessage(draft: string): string | null {
  const normalized = draft.trim().toUpperCase();
  if (!normalized) return null;
  if (!/^[A-Z0-9]{6}$/.test(normalized)) {
    return "El código debe tener 6 caracteres alfanuméricos.";
  }
  return null;
}

export default function PeoplePage() {
  const [selectedFairId, setSelectedFairId] = useState(ALL_FAIRS_VALUE);
  const { fairs, loading: fairsLoading } = useFairs();
  const { people, loading, reload } = usePeople({
    fairId: selectedFairId === ALL_FAIRS_VALUE ? undefined : selectedFairId,
  });
  const { toast } = useToast();
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [remoteByPerson, setRemoteByPerson] = useState<Record<string, RemoteAvailability>>({});
  const [savingPersonId, setSavingPersonId] = useState<string | null>(null);
  const [generatingPersonId, setGeneratingPersonId] = useState<string | null>(null);

  const selectedFairName =
    selectedFairId === ALL_FAIRS_VALUE
      ? "Todas las ferias"
      : fairs.find((fair) => fair.id === selectedFairId)?.name || "Feria";

  useEffect(() => {
    const timers: number[] = [];

    for (const [personId, code] of Object.entries(codes)) {
      const normalized = code.trim().toUpperCase();
      if (!/^[A-Z0-9]{6}$/.test(normalized)) continue;

      const timer = window.setTimeout(() => {
        setRemoteByPerson((current) => ({
          ...current,
          [personId]: {
            code: normalized,
            checking: true,
            available: current[personId]?.code === normalized ? current[personId].available : null,
            message: "Validando…",
          },
        }));

        void peopleService
          .checkAccessCode(normalized, personId)
          .then((response) => {
            const result = response.data;
            setRemoteByPerson((current) => ({
              ...current,
              [personId]: {
                code: normalized,
                checking: false,
                available: result?.available ?? false,
                message: result?.message ?? "No se pudo validar el código.",
              },
            }));
          })
          .catch(() => {
            setRemoteByPerson((current) => ({
              ...current,
              [personId]: {
                code: normalized,
                checking: false,
                available: false,
                message: "No se pudo validar el código.",
              },
            }));
          });
      }, 350);

      timers.push(timer);
    }

    return () => {
      for (const timer of timers) {
        window.clearTimeout(timer);
      }
    };
  }, [codes]);

  const assignAccessCode = async (personId: string) => {
    const accessCode = codes[personId]?.trim().toUpperCase() ?? "";
    const localError = localValidationMessage(accessCode);
    const remote = remoteByPerson[personId];

    if (localError) {
      toast({
        variant: "error",
        title: "Código inválido",
        description: localError,
      });
      return;
    }

    if (remote?.code === accessCode && remote.available === false) {
      toast({
        variant: "error",
        title: "Código no disponible",
        description: remote.message || "Elige otro código.",
      });
      return;
    }

    setSavingPersonId(personId);

    try {
      const response = await peopleService.assignAccessCode(personId, accessCode);
      setCodes((current) => {
        const next = { ...current };
        delete next[personId];
        return next;
      });
      reload();
      toast({
        variant: "success",
        title: "Código asignado correctamente",
        description: `Código ${response.data?.accessCode ?? accessCode} · Rol: ${response.data?.role ?? "staff"}.`,
      });
    } catch (error) {
      toast({
        variant: "error",
        title: "No se pudo asignar el código",
        description:
          error instanceof ApiError
            ? error.message
            : "Verifica que la persona tenga rol 2, 3 o Z en staff.",
      });
    } finally {
      setSavingPersonId(null);
    }
  };

  const generateAccessCode = async (person: Person) => {
    if (!person.accessRole) {
      toast({
        variant: "error",
        title: "Sin rol habilitado",
        description: "Solo jueces, directores técnicos y veterinarios pueden recibir código.",
      });
      return;
    }

    setGeneratingPersonId(person.id);

    try {
      const response = await peopleService.generateAccessCode(person.id);
      setCodes((current) => {
        const next = { ...current };
        delete next[person.id];
        return next;
      });
      reload();
      toast({
        variant: "success",
        title: "Código generado",
        description: `Asignado ${response.data?.accessCode ?? "el siguiente de la secuencia"}.`,
      });
    } catch (error) {
      toast({
        variant: "error",
        title: "No se pudo generar el código",
        description:
          error instanceof ApiError
            ? error.message
            : "Verifica que la persona tenga un rol habilitado.",
      });
    } finally {
      setGeneratingPersonId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Personas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Genera códigos por secuencia (DTF / JFQ / VTF) o asígnalos manualmente sin colisiones.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-600">Feria</span>
          <Select
            value={selectedFairId}
            onValueChange={(value) => setSelectedFairId(value ?? ALL_FAIRS_VALUE)}
            disabled={fairsLoading}
          >
            <SelectTrigger className="h-9 w-[280px] bg-white">
              <span className="truncate text-left">{selectedFairName}</span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_FAIRS_VALUE}>Todas las ferias</SelectItem>
              {fairs.map((fair) => (
                <SelectItem key={fair.id} value={fair.id}>
                  {fair.name || "Sin nombre"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Documento</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Código actual</TableHead>
              <TableHead className="min-w-[360px]">Asignar / Generar</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRowsSkeleton columns={6} />
            ) : people.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center">
                  {selectedFairId === ALL_FAIRS_VALUE
                    ? "No hay personas registradas"
                    : "No hay personal asignado a esta feria"}
                </TableCell>
              </TableRow>
            ) : (
              people.map((person) => {
                const draft = codes[person.id] ?? "";
                const normalizedDraft = draft.trim().toUpperCase();
                const localError = localValidationMessage(draft);
                const remote = remoteByPerson[person.id];
                const remoteForDraft =
                  remote && remote.code === normalizedDraft ? remote : null;
                const statusMessage = localError
                  ? localError
                  : remoteForDraft?.message;
                const statusAvailable = localError
                  ? false
                  : remoteForDraft?.available ?? null;
                const statusChecking = !localError && Boolean(remoteForDraft?.checking);
                const busy =
                  savingPersonId === person.id || generatingPersonId === person.id;
                const canAssign =
                  Boolean(person.accessRole) &&
                  !localError &&
                  /^[A-Z0-9]{6}$/.test(normalizedDraft) &&
                  statusAvailable === true &&
                  !busy;

                return (
                  <TableRow key={person.id}>
                    <TableCell className="font-medium">
                      {person.fullName || person.name}
                    </TableCell>
                    <TableCell>{person.email || "—"}</TableCell>
                    <TableCell>{person.documentNumber || "—"}</TableCell>
                    <TableCell>
                      <div className="space-y-0.5">
                        <div>{person.accessRoleLabel || "Sin rol habilitado"}</div>
                        {roleHint(person) && (
                          <div className="text-xs text-muted-foreground">{roleHint(person)}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {person.accessCode ? (
                        <span className="font-mono text-sm font-semibold tracking-wider">
                          {person.accessCode}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">Sin código</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Input
                            value={draft}
                            onChange={(event) =>
                              setCodes((current) => ({
                                ...current,
                                [person.id]: event.target.value.toUpperCase().slice(0, 6),
                              }))
                            }
                            placeholder={
                              person.accessRole
                                ? `${ROLE_PREFIX[person.accessRole] ?? "ABC"}001`
                                : "ABC123"
                            }
                            disabled={!person.accessRole || busy}
                            className="h-9 w-28 uppercase"
                          />
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => assignAccessCode(person.id)}
                            disabled={!canAssign}
                          >
                            {savingPersonId === person.id ? "Guardando" : "Asignar"}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => void generateAccessCode(person)}
                            disabled={!person.accessRole || busy}
                          >
                            {generatingPersonId === person.id ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <Sparkles className="size-3.5" />
                            )}
                            Generar
                          </Button>
                        </div>
                        {draft.trim().length > 0 && statusMessage && (
                          <p
                            className={`flex items-center gap-1 text-xs ${
                              statusChecking
                                ? "text-muted-foreground"
                                : statusAvailable
                                  ? "text-emerald-600"
                                  : "text-destructive"
                            }`}
                          >
                            {statusChecking ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : statusAvailable ? (
                              <Check className="size-3" />
                            ) : (
                              <X className="size-3" />
                            )}
                            {statusMessage}
                          </p>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
