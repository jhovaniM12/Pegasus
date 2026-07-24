"use client";

import { useId, useMemo, useState } from "react";
import { Download, TriangleAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { FedequinasIssue, FedequinasIssueSeverity } from "@/types/sync";

type IssueFilter = "all" | FedequinasIssueSeverity;

type ImportIssuesTableProps = {
  issues: FedequinasIssue[];
  fileName: string;
};

function escapeCsv(value: string | number): string {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function downloadIssues(issues: FedequinasIssue[], fileName: string) {
  const rows = [
    ["severidad", "fila", "codigo", "mensaje"],
    ...issues.map((issue) => [issue.severity, issue.row, issue.code, issue.message]),
  ];
  const csv = rows.map((row) => row.map(escapeCsv).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${fileName.replace(/\.xlsx$/i, "")}-issues.csv`;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function ImportIssuesTable({ issues, fileName }: ImportIssuesTableProps) {
  const [filter, setFilter] = useState<IssueFilter>("all");
  const titleId = useId();
  const filteredIssues = useMemo(
    () => (filter === "all" ? issues : issues.filter((issue) => issue.severity === filter)),
    [filter, issues]
  );

  if (issues.length === 0) return null;

  return (
    <section className="space-y-3" aria-labelledby={titleId}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h4 id={titleId} className="flex items-center gap-2 text-sm font-semibold">
            <TriangleAlert className="size-4 text-muted-foreground" aria-hidden />
            Observaciones del archivo
          </h4>
          <p className="text-xs text-muted-foreground">
            {issues.length} observaciones detectadas antes de aplicar.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={filter} onValueChange={(value) => setFilter(value as IssueFilter)}>
            <SelectTrigger className="w-40" aria-label="Filtrar observaciones">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="error">Errores</SelectItem>
              <SelectItem value="warning">Advertencias</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => downloadIssues(issues, fileName)}>
            <Download className="size-4" />
            Descargar CSV
          </Button>
        </div>
      </div>

      <div className="max-h-80 overflow-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead>Fila</TableHead>
              <TableHead>Código</TableHead>
              <TableHead>Mensaje</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredIssues.map((issue) => (
              <TableRow key={`${issue.row}-${issue.code}-${issue.message}`}>
                <TableCell>
                  <Badge variant={issue.severity === "error" ? "destructive" : "secondary"}>
                    {issue.severity === "error" ? "Error" : "Advertencia"}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono">{issue.row}</TableCell>
                <TableCell className="font-mono text-xs">{issue.code}</TableCell>
                <TableCell>{issue.message}</TableCell>
              </TableRow>
            ))}
            {filteredIssues.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                  No hay observaciones para este filtro.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
