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
import { useToast } from "@/components/ui/toast";
import { usePeople } from "@/hooks/use-people";
import { peopleService } from "@/services/people.service";

export default function PeoplePage() {
  const { people, loading } = usePeople();
  const { toast } = useToast();
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [savingPersonId, setSavingPersonId] = useState<string | null>(null);

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Personas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Asigna códigos de 6 caracteres a jueces, veterinarios autorizados y directores técnicos.
          </p>
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
              <TableRow>
                <TableCell colSpan={5} className="text-center">Cargando...</TableCell>
              </TableRow>
            ) : people.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center">No hay personas registradas</TableCell>
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
