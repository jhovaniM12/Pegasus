"use client";

import { useMemo, useState } from "react";
import { Search, Shield } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableRowsSkeleton } from "@/components/loaders";
import { useHorses } from "@/hooks/use-horses";

function formatDate(value: string | null): string {
  if (!value) return "—";

  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium" }).format(
    new Date(Date.UTC(year, month - 1, day))
  );
}

export default function HorsesPage() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const params = useMemo(() => ({ page, limit: 20, search }), [page, search]);
  const { horses, meta, loading } = useHorses(params);

  function applySearch() {
    setPage(1);
    setSearch(searchInput.trim());
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Ejemplares</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Consulta el maestro de ejemplares cargado desde Fedequinas.
          </p>
        </div>
        <Badge variant="outline" className="h-7 w-fit">
          <Shield className="size-3.5" />
          {meta.total} ejemplares
        </Badge>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") applySearch();
            }}
            placeholder="Buscar por nombre, registro o microchip"
            className="pl-8"
          />
        </div>
        <Button type="button" onClick={applySearch}>
          Buscar
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Registro</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Nacimiento</TableHead>
              <TableHead>Color</TableHead>
              <TableHead>Microchip</TableHead>
              <TableHead>Asociación</TableHead>
              <TableHead>Padre</TableHead>
              <TableHead>Madre</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRowsSkeleton columns={8} />
            ) : horses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                  No hay ejemplares cargados.
                </TableCell>
              </TableRow>
            ) : (
              horses.map((horse) => (
                <TableRow key={horse.id}>
                  <TableCell className="font-medium">{horse.registrationNumber}</TableCell>
                  <TableCell>{horse.name || "—"}</TableCell>
                  <TableCell>{formatDate(horse.birthDate)}</TableCell>
                  <TableCell>{horse.colorCode || "—"}</TableCell>
                  <TableCell>{horse.microchipNumber || "—"}</TableCell>
                  <TableCell>{horse.associationCode || "—"}</TableCell>
                  <TableCell>{horse.fatherRegistrationNumber || "—"}</TableCell>
                  <TableCell>{horse.motherRegistrationNumber || "—"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Página {meta.page} de {meta.totalPages || 1}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || loading}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= (meta.totalPages || 1) || loading}
            onClick={() => setPage((current) => current + 1)}
          >
            Siguiente
          </Button>
        </div>
      </div>
    </div>
  );
}
