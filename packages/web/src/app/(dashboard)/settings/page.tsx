"use client";

import { useEffect, useMemo, useState } from "react";
import { awardDistinctivesService } from "@/services/award-distinctives.service";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Cinta } from "@/components/cinta";
import type { AwardDistinctive } from "@/types/award-distinctives";

type EditableDistinctive = AwardDistinctive & {
  saving: boolean;
};

function normalizeHex(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const prefixed = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  return /^#[0-9A-Fa-f]{6}$/.test(prefixed) ? prefixed.toUpperCase() : null;
}

export default function SettingsPage() {
  const [distinctives, setDistinctives] = useState<EditableDistinctive[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadingDistinctives, setLoadingDistinctives] = useState(true);

  useEffect(() => {
    const loadDistinctives = async () => {
      try {
        setLoadingDistinctives(true);
        setError(null);
        const response = await awardDistinctivesService.listAwardDistinctives();
        const rows = response.data ?? [];
        setDistinctives(rows.map((row) => ({ ...row, saving: false })));
      } catch (_error) {
        setError("No se pudieron cargar los distintivos configurables.");
      } finally {
        setLoadingDistinctives(false);
      }
    };

    void loadDistinctives();
  }, []);

  const canSave = useMemo(
    () =>
      distinctives.every((row) => row.label.trim().length > 0 && row.colorName.trim().length > 0),
    [distinctives]
  );

  const updateLocalDistinctive = (id: string, patch: Partial<EditableDistinctive>) => {
    setDistinctives((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const saveDistinctive = async (row: EditableDistinctive) => {
    const normalizedHex = row.colorHex ? normalizeHex(row.colorHex) : null;
    if (row.colorHex && !normalizedHex) {
      setError(`El color hexadecimal de "${row.label}" debe tener formato #RRGGBB.`);
      return;
    }
    if (!row.label.trim() || !row.colorName.trim()) {
      setError("Etiqueta y nombre de color son obligatorios.");
      return;
    }

    try {
      setError(null);
      updateLocalDistinctive(row.id, { saving: true });
      const response = await awardDistinctivesService.updateAwardDistinctive(row.id, {
        label: row.label.trim(),
        colorName: row.colorName.trim(),
        colorHex: normalizedHex,
        isActive: row.isActive
      });
      if (response.data) {
        updateLocalDistinctive(row.id, { ...response.data, saving: false });
      } else {
        updateLocalDistinctive(row.id, { saving: false });
      }
    } catch (_error) {
      updateLocalDistinctive(row.id, { saving: false });
      setError(`No se pudo guardar el distintivo del puesto ${row.position}.`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Configuración</h1>
        <p className="text-muted-foreground">
          Administra los parámetros del sistema, roles y usuarios.
        </p>
      </div>

      <Tabs defaultValue="distinctives" className="w-full">
        <TabsList>
          <TabsTrigger value="distinctives">Distintivos</TabsTrigger>
          <TabsTrigger value="system">Sistema</TabsTrigger>
          <TabsTrigger value="users">Usuarios</TabsTrigger>
          <TabsTrigger value="roles">Roles</TabsTrigger>
        </TabsList>
        <TabsContent value="distinctives" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Cintas por puesto premiable (1..5)</CardTitle>
              <CardDescription>
                Configura nombre, color y estado de los distintivos oficiales usados en resultados F2 y desempates.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingDistinctives ? (
                <p className="text-sm text-muted-foreground">Cargando distintivos...</p>
              ) : (
                <div className="space-y-4">
                  {distinctives.map((row) => (
                    <div key={row.id} className="rounded-lg border p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-700">Puesto {row.position}</p>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={row.isActive}
                            onCheckedChange={(checked) =>
                              updateLocalDistinctive(row.id, { isActive: checked === true })
                            }
                            id={`active-${row.id}`}
                          />
                          <Label htmlFor={`active-${row.id}`} className="text-sm text-slate-600">
                            Activo
                          </Label>
                        </div>
                      </div>
                      <div className="grid gap-3 md:grid-cols-4">
                        <div className="space-y-1">
                          <Label>Etiqueta</Label>
                          <Input
                            value={row.label}
                            onChange={(event) =>
                              updateLocalDistinctive(row.id, { label: event.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Nombre de color</Label>
                          <Input
                            value={row.colorName}
                            onChange={(event) =>
                              updateLocalDistinctive(row.id, { colorName: event.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Hexadecimal</Label>
                          <Input
                            placeholder="#RRGGBB"
                            value={row.colorHex ?? ""}
                            onChange={(event) =>
                              updateLocalDistinctive(row.id, {
                                colorHex: event.target.value.trim() ? event.target.value : null
                              })
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Vista previa</Label>
                          <div className="flex min-h-10 items-center justify-center rounded-md border bg-slate-50/50 px-3 py-2">
                            <Cinta
                              text={row.label || "Sin etiqueta"}
                              colorHex={normalizeHex(row.colorHex ?? "")}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 flex justify-end">
                        <Button
                          type="button"
                          disabled={row.saving || !canSave}
                          onClick={() => void saveDistinctive(row)}
                        >
                          {row.saving ? "Guardando..." : "Guardar"}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="system" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Parámetros del Sistema</CardTitle>
              <CardDescription>Configuración global de la plataforma.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Configuraciones en desarrollo...</p>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="users" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Usuarios del Sistema</CardTitle>
              <CardDescription>Gestión de accesos y cuentas.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Módulo en desarrollo...</p>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="roles" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Roles y Permisos</CardTitle>
              <CardDescription>Definición de capacidades por rol.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Módulo en desarrollo...</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
