"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";

type Fair = {
  id: string;
  name: string;
  city?: {
    name?: string;
  };
  grade?: {
    name?: string;
  };
};

export default function FairsPage() {
  const [fairs, setFairs] = useState<Fair[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/fairs")
      .then((res) => res.json())
      .then((data) => {
        setFairs(data.data || []);
        setLoading(false);
      });
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Ferias</h1>
      </div>
      <div className="rounded-xl overflow-hidden bg-white subtle-shadow border border-slate-200">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Ciudad</TableHead>
              <TableHead>Grado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center">Cargando...</TableCell>
              </TableRow>
            ) : fairs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center">No hay ferias registradas</TableCell>
              </TableRow>
            ) : (
              fairs.map((fair) => (
                <TableRow key={fair.id}>
                  <TableCell className="font-medium">{fair.name}</TableCell>
                  <TableCell>{fair.city?.name}</TableCell>
                  <TableCell>{fair.grade?.name}</TableCell>
                  <TableCell className="text-right">
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
    </div>
  );
}
