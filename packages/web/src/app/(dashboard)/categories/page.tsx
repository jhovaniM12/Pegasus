"use client";

import { useEffect, useState } from "react";
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

const PAGE_SIZE = 20;
const ALL_GAITS_VALUE = "all";

type Category = {
  id: string;
  name: string;
  minAgeMonths: number;
  maxAgeMonths: number;
  sex: {
    name: string;
  } | null;
  gait: {
    id: string;
    name: string;
  } | null;
};

type GaitOption = {
  id: string;
  name: string | null;
};

type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type CategoriesResponse = {
  data?: Category[];
  meta?: PaginationMeta;
};

type GaitsResponse = {
  data?: GaitOption[];
};

const emptyMeta: PaginationMeta = {
  page: 1,
  limit: PAGE_SIZE,
  total: 0,
  totalPages: 0,
};

function formatAgeRange(category: Category): string {
  return `${category.minAgeMonths} - ${category.maxAgeMonths} meses`;
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [gaits, setGaits] = useState<GaitOption[]>([]);
  const [selectedGaitId, setSelectedGaitId] = useState(ALL_GAITS_VALUE);
  const [meta, setMeta] = useState<PaginationMeta>(emptyMeta);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/categories/gaits")
      .then((res) => res.json())
      .then((data: GaitsResponse) => {
        setGaits(data.data || []);
      });
  }, []);

  useEffect(() => {
    const query = new URLSearchParams({
      page: String(page),
      limit: String(PAGE_SIZE),
    });

    if (selectedGaitId !== ALL_GAITS_VALUE) {
      query.set("gaitId", selectedGaitId);
    }

    fetch(`/api/categories?${query.toString()}`)
      .then((res) => res.json())
      .then((data: CategoriesResponse) => {
        setCategories(data.data || []);
        setMeta(data.meta || emptyMeta);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [page, selectedGaitId]);

  const firstItem = meta.total === 0 ? 0 : (meta.page - 1) * meta.limit + 1;
  const lastItem = Math.min(meta.page * meta.limit, meta.total);
  const canGoPrevious = meta.page > 1 && !loading;
  const canGoNext = meta.page < meta.totalPages && !loading;
  const selectedGaitName =
    selectedGaitId === ALL_GAITS_VALUE
      ? "Todos los andares"
      : gaits.find((gait) => gait.id === selectedGaitId)?.name || "Sin andar";
  const goToPage = (nextPage: number) => {
    setLoading(true);
    setPage(nextPage);
  };

  const changeGaitFilter = (value: string | null) => {
    setSelectedGaitId(value ?? ALL_GAITS_VALUE);
    setPage(1);
    setLoading(true);
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
              <TableRow>
                <TableCell colSpan={4} className="text-center">Cargando...</TableCell>
              </TableRow>
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
