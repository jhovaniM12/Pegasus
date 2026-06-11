"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Configuración</h1>
        <p className="text-muted-foreground">
          Administra los parámetros del sistema, roles y usuarios.
        </p>
      </div>

      <Tabs defaultValue="system" className="w-full">
        <TabsList>
          <TabsTrigger value="system">Sistema</TabsTrigger>
          <TabsTrigger value="users">Usuarios</TabsTrigger>
          <TabsTrigger value="roles">Roles</TabsTrigger>
        </TabsList>
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
