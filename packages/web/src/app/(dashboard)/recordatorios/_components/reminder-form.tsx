"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ReminderIcon } from "@/components/reminder-icon";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { judgingRemindersService } from "@/services/judging-reminders.service";
import {
  REMINDER_ICON_KEYS,
  REMINDER_ICON_LABELS,
  type CreateJudgingReminderInput,
  type JudgingReminder,
  type ReminderIconKey,
} from "@/types/judging-reminders";

type ReminderFormProps = {
  mode: "create" | "edit";
  initialValues?: JudgingReminder;
};

export function ReminderForm({ mode, initialValues }: ReminderFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = useState(initialValues?.name ?? "");
  const [icon, setIcon] = useState<ReminderIconKey>(initialValues?.icon ?? "bell");
  const [isActive, setIsActive] = useState(initialValues?.isActive ?? true);
  const [saving, setSaving] = useState(false);

  const selectedIconLabel = REMINDER_ICON_LABELS[icon];

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      toast({
        variant: "error",
        title: "Nombre obligatorio",
        description: "Ingresa un nombre para el recordatorio.",
      });
      return;
    }

    const payload: CreateJudgingReminderInput = {
      name: trimmedName,
      icon,
      isActive,
    };

    setSaving(true);

    try {
      if (mode === "create") {
        await judgingRemindersService.createJudgingReminder(payload);
        toast({
          variant: "success",
          title: "Recordatorio creado",
          description: "El catálogo se actualizó correctamente.",
        });
      } else if (initialValues) {
        await judgingRemindersService.updateJudgingReminder(initialValues.id, payload);
        toast({
          variant: "success",
          title: "Recordatorio actualizado",
          description: "Los cambios se guardaron correctamente.",
        });
      }

      router.push("/recordatorios");
      router.refresh();
    } catch {
      toast({
        variant: "error",
        title: "No se pudo guardar",
        description: "Verifica el nombre y vuelve a intentar.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-6 subtle-shadow">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="reminder-name">Nombre</Label>
            <Input
              id="reminder-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ej. Revisar documentación"
              maxLength={120}
            />
          </div>

          <div className="space-y-2">
            <Label>Icono</Label>
            <Select
              value={icon}
              onValueChange={(value) => setIcon((value as ReminderIconKey) ?? "bell")}
            >
              <SelectTrigger className="h-10 bg-white">
                <span className="flex items-center gap-2">
                  <ReminderIcon icon={icon} className="size-4 text-slate-600" />
                  <span>{selectedIconLabel}</span>
                </span>
              </SelectTrigger>
              <SelectContent>
                {REMINDER_ICON_KEYS.map((key) => (
                  <SelectItem key={key} value={key}>
                    <span className="flex items-center gap-2">
                      <ReminderIcon icon={key} className="size-4 text-slate-600" />
                      <span>{REMINDER_ICON_LABELS[key]}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-2">
          <Checkbox
            id="reminder-active"
            checked={isActive}
            onCheckedChange={(checked) => setIsActive(checked === true)}
          />
          <Label htmlFor="reminder-active" className="text-sm text-slate-600">
            Activo
          </Label>
        </div>
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          nativeButton={false}
          render={<Link href="/recordatorios">Cancelar</Link>}
        />
        <Button type="submit" disabled={saving}>
          {saving ? "Guardando..." : mode === "create" ? "Crear recordatorio" : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
}
