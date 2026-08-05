"use client";

import { useState } from "react";
import { use } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { useFairDetail, useFairEntries, useFairResults, useFairStaff } from "@/hooks/use-fairs";
import { ContentReveal, FairDetailSkeleton, TableRowsSkeleton } from "@/components/loaders";
import { ApiError } from "@/services/api.service";
import { fairsService } from "@/services/fairs.service";
import type { FairStaff } from "@/types/fairs";

const ENTRIES_PAGE_SIZE = 20;
const RESULTS_PAGE_SIZE = 20;
const STAFF_PAGE_SIZE = 20;
const JUDGE_ROLE_EXTERNAL_ID = "2";
const JUDGE_SEATS = [1, 2, 3, 4, 5] as const;
const EMPTY_SEAT_VALUE = "none";

function formatDate(value: string | null): string {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function formatAgeRange(minAgeMonths: number, maxAgeMonths: number): string {
  const minAge = Number(minAgeMonths);
  const maxAge = Number(maxAgeMonths);

  if (!Number.isFinite(minAge) || !Number.isFinite(maxAge)) {
    return "Edad no disponible";
  }

  if (maxAge >= 999) {
    return `> ${minAge} meses`;
  }

  return `${minAge} - ${maxAge} meses`;
}

function EntriesStepBadge({
  active,
  children,
}: {
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <span
      className={
        active
          ? "inline-flex h-6 items-center rounded-full bg-slate-950 px-3 text-xs font-semibold text-white"
          : "inline-flex h-6 items-center rounded-full border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700"
      }
    >
      {children}
    </span>
  );
}

function isJudgeStaff(staff: FairStaff): boolean {
  return staff.role.externalId === JUDGE_ROLE_EXTERNAL_ID;
}

function JudgeSeatSelect({
  fairId,
  staffMember,
  onUpdated,
}: {
  fairId: string;
  staffMember: FairStaff;
  onUpdated: () => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const value =
    staffMember.judgeSeat != null ? String(staffMember.judgeSeat) : EMPTY_SEAT_VALUE;

  const handleChange = async (nextValue: string | null) => {
    if (!nextValue || saving) {
      return;
    }

    const nextSeat =
      nextValue === EMPTY_SEAT_VALUE ? null : Number.parseInt(nextValue, 10);
    if (nextSeat === staffMember.judgeSeat) {
      return;
    }
    if (nextSeat != null && !JUDGE_SEATS.includes(nextSeat as (typeof JUDGE_SEATS)[number])) {
      return;
    }

    setSaving(true);
    try {
      await fairsService.updateStaffJudgeSeat(fairId, staffMember.id, nextSeat);
      onUpdated();
      toast({
        title: nextSeat != null ? `Asignado como Juez ${nextSeat}` : "Asiento liberado",
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "No se pudo actualizar el asiento",
        description:
          error instanceof ApiError ? error.message : "Intenta de nuevo en unos segundos.",
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Select value={value} onValueChange={handleChange} disabled={saving}>
      <SelectTrigger className="h-8 min-w-28 bg-white">
        <span className="text-sm">
          {staffMember.judgeSeat != null ? `Juez ${staffMember.judgeSeat}` : "Sin asiento"}
        </span>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={EMPTY_SEAT_VALUE}>Sin asiento</SelectItem>
        {JUDGE_SEATS.map((seat) => (
          <SelectItem key={seat} value={String(seat)}>
            Juez {seat}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function EntriesSteps({
  current,
  gaitName,
}: {
  current: "gaits" | "categories" | "entries";
  gaitName?: string | null;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <EntriesStepBadge active={current === "gaits"}>Andares</EntriesStepBadge>
      <ChevronRight className="size-4 text-slate-400" />
      <EntriesStepBadge active={current === "categories"}>
        {gaitName || "Categorías"}
      </EntriesStepBadge>
      <ChevronRight className="size-4 text-slate-400" />
      <EntriesStepBadge active={current === "entries"}>Inscritos</EntriesStepBadge>
    </div>
  );
}

export default function FairDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { fair, entriesSummary, loading } = useFairDetail(id);
  const [selectedGaitId, setSelectedGaitId] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [entriesSearchDraft, setEntriesSearchDraft] = useState("");
  const [entriesSearch, setEntriesSearch] = useState("");
  const { entries, meta: entriesMeta, loading: entriesLoading, page: entriesPage, setPage: setEntriesPage } = useFairEntries(id, {
    limit: ENTRIES_PAGE_SIZE,
    categoryId: selectedCategoryId,
    search: entriesSearch,
  });
  const { results, meta: resultsMeta, loading: resultsLoading, page: resultsPage, setPage: setResultsPage } = useFairResults(id, {
    limit: RESULTS_PAGE_SIZE,
    categoryId: selectedCategoryId,
  });
  const {
    staff,
    meta: staffMeta,
    loading: staffLoading,
    page: staffPage,
    setPage: setStaffPage,
    reload: reloadStaff,
  } = useFairStaff(id, {
    limit: STAFF_PAGE_SIZE,
  });

  const entriesTotal = entriesSummary.reduce((total, gait) => total + gait.totalEntries, 0);
  const selectedGait = entriesSummary.find((gait) => gait.gait.id === selectedGaitId) ?? null;
  const selectedCategorySummary =
    selectedGait?.categories.find((category) => category.category.id === selectedCategoryId) ?? null;

  const submitEntriesSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextSearch = entriesSearchDraft.trim();

    if (nextSearch === entriesSearch) {
      return;
    }

    setEntriesSearch(nextSearch);
  };

  const clearEntriesSearch = () => {
    if (!entriesSearch && !entriesSearchDraft) {
      return;
    }

    setEntriesSearchDraft("");
    setEntriesSearch("");
  };

  const goToEntriesPage = (page: number) => {
    setEntriesPage(page);
  };

  const goToResultsPage = (page: number) => {
    setResultsPage(page);
  };

  const goToStaffPage = (page: number) => {
    setStaffPage(page);
  };

  const selectGait = (gaitId: string) => {
    setSelectedGaitId(gaitId);
    setSelectedCategoryId(null);
    setEntriesSearchDraft("");
    setEntriesSearch("");
  };

  const selectCategory = (categoryId: string) => {
    setSelectedCategoryId(categoryId);
    setEntriesSearchDraft("");
    setEntriesSearch("");
  };

  const backToGaits = () => {
    setSelectedGaitId(null);
    setSelectedCategoryId(null);
    setEntriesSearchDraft("");
    setEntriesSearch("");
  };

  const backToCategories = () => {
    setSelectedCategoryId(null);
    setEntriesSearchDraft("");
    setEntriesSearch("");
  };

  const firstEntry = entriesMeta.total === 0 ? 0 : (entriesMeta.page - 1) * entriesMeta.limit + 1;
  const lastEntry = Math.min(entriesMeta.page * entriesMeta.limit, entriesMeta.total);
  const canGoPreviousEntryPage = entriesMeta.page > 1 && !entriesLoading;
  const canGoNextEntryPage = entriesMeta.page < entriesMeta.totalPages && !entriesLoading;
  const firstResult = resultsMeta.total === 0 ? 0 : (resultsMeta.page - 1) * resultsMeta.limit + 1;
  const lastResult = Math.min(resultsMeta.page * resultsMeta.limit, resultsMeta.total);
  const canGoPreviousResultPage = resultsMeta.page > 1 && !resultsLoading;
  const canGoNextResultPage = resultsMeta.page < resultsMeta.totalPages && !resultsLoading;
  const firstStaff = staffMeta.total === 0 ? 0 : (staffMeta.page - 1) * staffMeta.limit + 1;
  const lastStaff = Math.min(staffMeta.page * staffMeta.limit, staffMeta.total);
  const canGoPreviousStaffPage = staffMeta.page > 1 && !staffLoading;
  const canGoNextStaffPage = staffMeta.page < staffMeta.totalPages && !staffLoading;

  if (loading) {
    return <FairDetailSkeleton />;
  }

  if (!fair) {
    return <div className="p-8 text-center text-destructive">Feria no encontrada</div>;
  }

  return (
    <ContentReveal>
    <div className="space-y-6">
      <div className="space-y-4">
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={
            <Link href="/fairs">
              <ArrowLeft className="size-4" />
              Volver a ferias
            </Link>
          }
        />
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">{fair.name}</h1>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Badge variant="secondary">{fair.grade?.name}</Badge>
            <span>•</span>
            <span>{fair.city?.name}</span>
          </div>
        </div>
      </div>

      <Tabs defaultValue="info" className="w-full">
        <TabsList>
          <TabsTrigger value="info">Información General</TabsTrigger>
          <TabsTrigger value="entries">Inscritos ({entriesTotal})</TabsTrigger>
          <TabsTrigger value="staff">Staff ({staffMeta.total})</TabsTrigger>
        </TabsList>
        <TabsContent value="info" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Detalles de la Feria</CardTitle>
              <CardDescription>Información básica sobre el evento.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Nombre</div>
                  <div>{fair.name}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Ciudad</div>
                  <div>{fair.city?.name || "—"}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Grado</div>
                  <div>{fair.grade?.name || "—"}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Fecha inicio</div>
                  <div>{formatDate(fair.startDate)}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Fecha fin</div>
                  <div>{formatDate(fair.endDate)}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="entries" className="mt-4">
          <div className="space-y-4">
            {!selectedGait ? (
              <>
                <div className="space-y-3">
                  <EntriesSteps current="gaits" />
                  <div>
                    <h2 className="text-lg font-semibold">Andares</h2>
                    <p className="text-sm text-muted-foreground">
                      Selecciona un andar para ver sus categorías inscritas.
                    </p>
                  </div>
                </div>
                {entriesSummary.length === 0 ? (
                  <div className="rounded-lg border bg-white p-8 text-center text-sm text-muted-foreground">
                    No hay inscritos
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {entriesSummary.map((gait) => (
                      <button
                        key={gait.gait.id}
                        type="button"
                        onClick={() => selectGait(gait.gait.id)}
                        className="rounded-lg border bg-white p-5 text-left shadow-sm transition hover:border-slate-400 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950"
                      >
                        <div className="text-sm font-medium text-muted-foreground">Andar</div>
                        <div className="mt-2 text-xl font-semibold">{gait.gait.name || "Sin andar"}</div>
                        <div className="mt-4 flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Inscritos</span>
                          <Badge variant="secondary">{gait.totalEntries}</Badge>
                        </div>
                        <div className="mt-4 text-sm font-medium text-slate-900">Ver categorías</div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : !selectedCategorySummary ? (
              <>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-3">
                    <EntriesSteps current="categories" gaitName={selectedGait.gait.name} />
                    <div>
                      <h2 className="text-lg font-semibold">{selectedGait.gait.name || "Sin andar"}</h2>
                      <p className="text-sm text-muted-foreground">
                        Selecciona una categoría para ver sus inscritos.
                      </p>
                    </div>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={backToGaits}>
                    <ChevronLeft className="size-4" />
                    Volver a andares
                  </Button>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {selectedGait.categories.map((category) => (
                    <button
                      key={category.category.id}
                      type="button"
                      onClick={() => selectCategory(category.category.id)}
                      className="rounded-lg border bg-white p-5 text-left shadow-sm transition hover:border-slate-400 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950"
                    >
                      <div className="text-sm font-medium text-muted-foreground">Categoría</div>
                      <div className="mt-2 text-base font-semibold">{category.category.name || "Sin categoría"}</div>
                      <div className="mt-3 text-sm text-muted-foreground">
                        Edad: {formatAgeRange(category.category.minAgeMonths, category.category.maxAgeMonths)}
                      </div>
                      <div className="mt-4 flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Inscritos</span>
                        <Badge variant="secondary">{category.totalEntries}</Badge>
                      </div>
                      <div className="mt-4 text-sm font-medium text-slate-900">Ver inscritos</div>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="rounded-lg border bg-white">
                <div className="space-y-4 p-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <Button type="button" variant="outline" size="sm" onClick={backToCategories}>
                      <ChevronLeft className="size-4" />
                      Volver a categorías
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={backToGaits}>
                      Ver andares
                    </Button>
                  </div>
                  <EntriesSteps current="entries" gaitName={selectedGait.gait.name} />
                </div>
                <div className="gap-4 border-t border-slate-200 p-6 md:flex md:flex-row md:items-start md:justify-between">
                  <div className="space-y-1">
                    <div className="text-sm font-medium text-muted-foreground">Categoría seleccionada</div>
                    <h2 className="text-lg font-semibold">
                      {selectedCategorySummary.category.name || "Sin categoría"}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {selectedCategorySummary.totalEntries} inscritos en esta categoría.
                    </p>
                  </div>
                  <form onSubmit={submitEntriesSearch} className="mt-4 flex w-full gap-2 md:mt-0 md:w-[440px]">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        value={entriesSearchDraft}
                        onChange={(event) => setEntriesSearchDraft(event.target.value)}
                        placeholder="Montador o registro"
                        className="h-10 bg-white pl-9"
                      />
                    </div>
                    <Button type="submit" size="sm" className="h-10">
                      Buscar
                    </Button>
                    {entriesSearch && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-10"
                        onClick={clearEntriesSearch}
                      >
                        Limpiar
                      </Button>
                    )}
                  </form>
                </div>
                <div className="px-6 pb-2">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Registro</TableHead>
                        <TableHead>Montador</TableHead>
                        <TableHead>Documento</TableHead>
                        <TableHead>Categoría</TableHead>
                        <TableHead className="text-right">Pista</TableHead>
                        <TableHead>Participa</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {entriesLoading ? (
                        <TableRowsSkeleton columns={6} />
                      ) : entries.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center">No hay inscritos</TableCell>
                        </TableRow>
                      ) : (
                        entries.map((entry) => (
                          <TableRow key={entry.id}>
                            <TableCell className="font-medium">{entry.registrationNumber}</TableCell>
                            <TableCell>{entry.riderName || "—"}</TableCell>
                            <TableCell>{entry.riderDocumentNumber || "—"}</TableCell>
                            <TableCell>{entry.category?.name || "—"}</TableCell>
                            <TableCell className="text-right">{entry.trackPosition || "—"}</TableCell>
                            <TableCell>
                              <Badge variant={entry.participate ? "secondary" : "outline"}>
                                {entry.participate ? "Sí" : "No"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex flex-col gap-3 border-t border-slate-200 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-slate-500">
                    Mostrando {firstEntry} - {lastEntry} de {entriesMeta.total}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!canGoPreviousEntryPage}
                      onClick={() => goToEntriesPage(Math.max(1, entriesPage - 1))}
                    >
                      <ChevronLeft className="size-4" />
                      Anterior
                    </Button>
                    <span className="min-w-24 text-center text-sm font-medium text-slate-600">
                      Página {entriesMeta.page} de {Math.max(entriesMeta.totalPages, 1)}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!canGoNextEntryPage}
                      onClick={() => goToEntriesPage(entriesPage + 1)}
                    >
                      Siguiente
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>
                </div>
                <div className="border-t border-slate-200 p-6">
                  <div>
                    <h3 className="text-base font-semibold">Resultados de la categoría</h3>
                    <p className="text-sm text-muted-foreground">
                      Puestos y puntajes obtenidos por los montadores en esta categoría.
                    </p>
                  </div>
                  <div className="mt-4">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Registro</TableHead>
                          <TableHead>Montador</TableHead>
                          <TableHead>Documento</TableHead>
                          <TableHead>Título</TableHead>
                          <TableHead className="text-right">Puesto</TableHead>
                          <TableHead className="text-right">Puntaje</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {resultsLoading ? (
                          <TableRowsSkeleton columns={7} />
                        ) : results.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center">
                              No hay resultados para esta categoría
                            </TableCell>
                          </TableRow>
                        ) : (
                          results.map((result) => (
                            <TableRow key={result.id}>
                              <TableCell className="font-medium">
                                {result.fairEntry.registrationNumber || "—"}
                              </TableCell>
                              <TableCell>{result.fairEntry.riderName || "—"}</TableCell>
                              <TableCell>{result.fairEntry.riderDocumentNumber || "—"}</TableCell>
                              <TableCell>{result.title?.name || "—"}</TableCell>
                              <TableCell className="text-right">{result.positionObtained || "—"}</TableCell>
                              <TableCell className="text-right">{result.score.toFixed(2)}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="mt-4 flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-slate-500">
                      Mostrando {firstResult} - {lastResult} de {resultsMeta.total}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!canGoPreviousResultPage}
                        onClick={() => goToResultsPage(Math.max(1, resultsPage - 1))}
                      >
                        <ChevronLeft className="size-4" />
                        Anterior
                      </Button>
                      <span className="min-w-24 text-center text-sm font-medium text-slate-600">
                        Página {resultsMeta.page} de {Math.max(resultsMeta.totalPages, 1)}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!canGoNextResultPage}
                        onClick={() => goToResultsPage(resultsPage + 1)}
                      >
                        Siguiente
                        <ChevronRight className="size-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </TabsContent>
        <TabsContent value="staff" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Personal de la Feria</CardTitle>
              <CardDescription>
                Consulta los datos de contacto y el rol del personal asignado al evento. En jueces,
                asigna el asiento fijo del panel (Juez 1–5).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Apellido</TableHead>
                    <TableHead>Teléfono</TableHead>
                    <TableHead>Celular</TableHead>
                    <TableHead>Correo</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Asiento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {staffLoading ? (
                    <TableRowsSkeleton columns={7} />
                  ) : staff.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center">
                        No hay personal registrado para esta feria
                      </TableCell>
                    </TableRow>
                  ) : (
                    staff.map((staffMember) => (
                      <TableRow key={staffMember.id}>
                        <TableCell className="font-medium">{staffMember.person.name || "—"}</TableCell>
                        <TableCell>{staffMember.person.lastName || "—"}</TableCell>
                        <TableCell>{staffMember.person.telephone || "—"}</TableCell>
                        <TableCell>{staffMember.person.phone || "—"}</TableCell>
                        <TableCell>{staffMember.person.email || "—"}</TableCell>
                        <TableCell>{staffMember.role.name || "—"}</TableCell>
                        <TableCell>
                          {isJudgeStaff(staffMember) ? (
                            <JudgeSeatSelect
                              fairId={id}
                              staffMember={staffMember}
                              onUpdated={() => {
                                reloadStaff();
                              }}
                            />
                          ) : (
                            "—"
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              <div className="flex flex-col gap-3 border-t border-slate-200 px-1 py-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-slate-500">
                  Mostrando {firstStaff} - {lastStaff} de {staffMeta.total}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!canGoPreviousStaffPage}
                    onClick={() => goToStaffPage(Math.max(1, staffPage - 1))}
                  >
                    <ChevronLeft className="size-4" />
                    Anterior
                  </Button>
                  <span className="min-w-24 text-center text-sm font-medium text-slate-600">
                    Página {staffMeta.page} de {Math.max(staffMeta.totalPages, 1)}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!canGoNextStaffPage}
                    onClick={() => goToStaffPage(staffPage + 1)}
                  >
                    Siguiente
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
    </ContentReveal>
  );
}
