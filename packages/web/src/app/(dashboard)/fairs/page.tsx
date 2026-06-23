"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Calendar } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { TableRowsSkeleton } from "@/components/loaders";
import { useFairs } from "@/hooks/use-fairs";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

const dateFormatter = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
});

function formatDateRange(start: string | null | undefined, end: string | null | undefined) {
  if (!start && !end) return "—";
  
  const format = (dateStr: string) => {
    const [year, month, day] = dateStr.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return dateFormatter.format(date);
  };

  if (start && end) {
    if (start === end) return format(start);
    return `${format(start)} - ${format(end)}`;
  }
  
  return start ? format(start) : format(end!);
}

export default function FairsPage() {
  const { fairs, loading } = useFairs();

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const pendingFairs = useMemo(() => {
    return fairs.filter((fair) => !fair.endDate || fair.endDate >= today);
  }, [fairs, today]);

  const closedFairs = useMemo(() => {
    return fairs.filter((fair) => fair.endDate && fair.endDate < today);
  }, [fairs, today]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Ferias</h1>
        <p className="text-sm text-muted-foreground">
          Gestiona el calendario operativo, inscripciones y resultados de las ferias Pegaso.
        </p>
      </div>

      <Tabs defaultValue="pending" className="w-full">
        <div className="flex items-center justify-between border-b border-border pb-px">
          <TabsList variant="line" className="h-10">
            <TabsTrigger value="pending" className="px-4 py-2 text-sm">
              Pendientes
              {!loading && (
                <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-xs font-semibold">
                  {pendingFairs.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="closed" className="px-4 py-2 text-sm">
              Cerradas
              {!loading && (
                <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-xs font-semibold">
                  {closedFairs.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="pending" className="mt-4">
          <div className="rounded-xl overflow-hidden bg-card subtle-shadow border border-border">
            <Table>
              <TableHeader>
                <TableRow className="border-border/60">
                  <TableHead className="px-5">Nombre</TableHead>
                  <TableHead className="px-4">Ciudad</TableHead>
                  <TableHead className="px-4">Grado</TableHead>
                  <TableHead className="px-4">Fechas</TableHead>
                  <TableHead className="px-5 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRowsSkeleton columns={5} />
                ) : pendingFairs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No hay ferias pendientes o activas
                    </TableCell>
                  </TableRow>
                ) : (
                  pendingFairs.map((fair) => (
                    <TableRow key={fair.id} className="border-border/40">
                      <TableCell className="px-5 py-3.5 font-medium text-foreground">
                        {fair.name}
                      </TableCell>
                      <TableCell className="px-4 py-3.5 text-muted-foreground">
                        {fair.city?.name || "—"}
                      </TableCell>
                      <TableCell className="px-4 py-3.5">
                        <Badge variant="outline" className="font-medium">
                          {fair.grade?.name || "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-4 py-3.5 text-muted-foreground text-xs font-medium">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="size-3.5 text-muted-foreground/70" />
                          <span>{formatDateRange(fair.startDate, fair.endDate)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="px-5 py-3.5 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          nativeButton={false}
                          render={<Link href={`/fairs/${fair.id}`}>Ver Detalle</Link>}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="closed" className="mt-4">
          <div className="rounded-xl overflow-hidden bg-card subtle-shadow border border-border">
            <Table>
              <TableHeader>
                <TableRow className="border-border/60">
                  <TableHead className="px-5">Nombre</TableHead>
                  <TableHead className="px-4">Ciudad</TableHead>
                  <TableHead className="px-4">Grado</TableHead>
                  <TableHead className="px-4">Fechas</TableHead>
                  <TableHead className="px-5 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRowsSkeleton columns={5} />
                ) : closedFairs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No hay ferias cerradas o finalizadas
                    </TableCell>
                  </TableRow>
                ) : (
                  closedFairs.map((fair) => (
                    <TableRow key={fair.id} className="border-border/40">
                      <TableCell className="px-5 py-3.5 font-medium text-foreground">
                        {fair.name}
                      </TableCell>
                      <TableCell className="px-4 py-3.5 text-muted-foreground">
                        {fair.city?.name || "—"}
                      </TableCell>
                      <TableCell className="px-4 py-3.5">
                        <Badge variant="outline" className="font-medium">
                          {fair.grade?.name || "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-4 py-3.5 text-muted-foreground text-xs font-medium">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="size-3.5 text-muted-foreground/70" />
                          <span>{formatDateRange(fair.startDate, fair.endDate)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="px-5 py-3.5 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          nativeButton={false}
                          render={<Link href={`/fairs/${fair.id}`}>Ver Detalle</Link>}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
