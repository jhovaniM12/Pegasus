"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, ListFilter } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { TableRowsSkeleton } from "@/components/loaders";
import { useCategories, useCategoryGaits } from "@/hooks/use-categories";
import type { Category } from "@/types/categories";

const PAGE_SIZE = 20;
const ALL_GAITS_VALUE = "all";

function formatAgeRange(category: Category): string {
  return `${category.minAgeMonths} - ${category.maxAgeMonths} meses`;
}

export default function CategoriesPage() {
  const [selectedGaitId, setSelectedGaitId] = useState(ALL_GAITS_VALUE);
  const { gaits } = useCategoryGaits();
  const { categories, meta, loading, page, setPage } = useCategories({
    limit: PAGE_SIZE,
    gaitId: selectedGaitId === ALL_GAITS_VALUE ? undefined : selectedGaitId,
  });

  const firstItem = meta.total === 0 ? 0 : (meta.page - 1) * meta.limit + 1;
  const lastItem = Math.min(meta.page * meta.limit, meta.total);
  const canGoPrevious = meta.page > 1 && !loading;
  const canGoNext = meta.page < meta.totalPages && !loading;
  const selectedGaitName =
    selectedGaitId === ALL_GAITS_VALUE
      ? "Todos los andares"
      : gaits.find((gait) => gait.id === selectedGaitId)?.name || "Sin andar";
  const goToPage = (nextPage: number) => {
    setPage(nextPage);
  };

  const changeGaitFilter = (value: string | null) => {
    setSelectedGaitId(value ?? ALL_GAITS_VALUE);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
            Catálogo
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950">
            Categorías
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Consulta las categorías por sexo, andar y rango de edad.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <Badge variant="secondary" className="h-7 rounded-lg px-3 text-slate-600">
            <ListFilter className="size-3.5" />
            {meta.total} registros
          </Badge>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-600">Andar</span>
            <Select value={selectedGaitId} onValueChange={changeGaitFilter}>
              <SelectTrigger className="h-9 w-[260px] bg-white">
                <span className="truncate text-left">{selectedGaitName}</span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_GAITS_VALUE}>Todos los andares</SelectItem>
                {gaits.map((gait) => (
                  <SelectItem key={gait.id} value={gait.id}>
                    {gait.name || "Sin andar"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white subtle-shadow">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Sexo</TableHead>
              <TableHead>Andar</TableHead>
              <TableHead>Edades</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRowsSkeleton columns={4} />
            ) : categories.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center">No hay categorías registradas</TableCell>
              </TableRow>
            ) : (
              categories.map((category) => (
                <TableRow key={category.id}>
                  <TableCell className="font-medium">{category.name}</TableCell>
                  <TableCell>{category.sex?.name || "—"}</TableCell>
                  <TableCell>{category.gait?.name || "—"}</TableCell>
                  <TableCell>{formatAgeRange(category)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">
            Mostrando {firstItem} - {lastItem} de {meta.total}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!canGoPrevious}
              onClick={() => goToPage(Math.max(1, page - 1))}
            >
              <ChevronLeft className="size-4" />
              Anterior
            </Button>
            <span className="min-w-24 text-center text-sm font-medium text-slate-600">
              Página {meta.page} de {Math.max(meta.totalPages, 1)}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={!canGoNext}
              onClick={() => goToPage(page + 1)}
            >
              Siguiente
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
