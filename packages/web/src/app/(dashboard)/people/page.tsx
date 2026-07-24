"use client";

import { useState } from "react";
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
import { peopleService } from "@/services/people.service";

const ALL_FAIRS_VALUE = "all";

export default function PeoplePage() {
  const [selectedFairId, setSelectedFairId] = useState(ALL_FAIRS_VALUE);
  const { fairs, loading: fairsLoading } = useFairs();
  const { people, loading } = usePeople({
    fairId: selectedFairId === ALL_FAIRS_VALUE ? undefined : selectedFairId,
  });
  const { toast } = useToast();
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [savingPersonId, setSavingPersonId] = useState<string | null>(null);

  const selectedFairName =
    selectedFairId === ALL_FAIRS_VALUE
      ? "Todas las ferias"
      : fairs.find((fair) => fair.id === selectedFairId)?.name || "Feria";

  const assignAccessCode = async (personId: string) => {
    const accessCode = codes[personId]?.trim().toUpperCase() ?? "";

    if (!/^[A-Z0-9]{6}$/.test(accessCode)) {
      toast({
        variant: "error",
        title: "Código inválido",
        description: "El código debe tener 6 caracteres alfanuméricos.",
      });
      return;
    }

    setSavingPersonId(personId);

    try {
      const response = await peopleService.assignAccessCode(personId, accessCode);
      setCodes((current) => ({ ...current, [personId]: "" }));
      toast({
        variant: "success",
        title: "Código asignado correctamente",
        description: `Rol: ${response.data?.role ?? "staff"}.`,
      });
    } catch {
      toast({
        variant: "error",
        title: "No se pudo asignar el código",
        description: "Verifica que la persona tenga rol 2, 3 o Z en staff.",
      });
    } finally {
      setSavingPersonId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Personas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Asigna códigos de 6 caracteres a jueces, veterinarios autorizados y directores técnicos.
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
              <TableHead className="w-[280px]">Código de acceso</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRowsSkeleton columns={5} />
            ) : people.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center">
                  {selectedFairId === ALL_FAIRS_VALUE
                    ? "No hay personas registradas"
                    : "No hay personal asignado a esta feria"}
                </TableCell>
              </TableRow>
            ) : (
              people.map((person) => (
                <TableRow key={person.id}>
                  <TableCell className="font-medium">{person.fullName || person.name}</TableCell>
                  <TableCell>{person.email || "—"}</TableCell>
                  <TableCell>{person.documentNumber || "—"}</TableCell>
                  <TableCell>{person.accessRoleLabel || "Sin rol habilitado"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Input
                        value={codes[person.id] ?? ""}
                        onChange={(event) =>
                          setCodes((current) => ({
                            ...current,
                            [person.id]: event.target.value.toUpperCase().slice(0, 6),
                          }))
                        }
                        placeholder="ABC123"
                        className="h-9 w-28 uppercase"
                      />
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => assignAccessCode(person.id)}
                        disabled={savingPersonId === person.id}
                      >
                        {savingPersonId === person.id ? "Guardando" : "Asignar"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
