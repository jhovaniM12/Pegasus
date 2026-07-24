"use client";

import { ImportProcessingDialog } from "@/components/sync/import-processing-dialog";
import { ImportStepCard } from "@/components/sync/import-step-card";
import type { FedequinasFileKind, FedequinasImportStep } from "@/types/sync";

export const IMPORT_STEP_DEFINITIONS = [
  {
    fileKind: "FEH_FERIAS",
    title: "Feria",
    description: "Crea o actualiza la feria y valida sus catálogos base.",
    expectedHeaders: [
      "ID_FERIA",
      "ANO",
      "DESCRIPCION",
      "FECHA_INICIO",
      "FECHA_FIN",
      "CODIGO_CIUDAD",
      "CODIGO_GRADO",
      "OBSERVACIONES",
      "INSCRITOS",
    ],
  },
  {
    fileKind: "FEH_PERSONAL_FERIA",
    title: "Personal",
    description: "Vincula personas y roles operativos a la feria activa.",
    expectedHeaders: [
      "ID_PERSONAL_FERIA",
      "ID_FERIA",
      "ID_PERSONAL",
      "ID_ROL",
      "NOMBRE",
    ],
  },
  {
    fileKind: "FEH_INSCRIPCIONES_FERIA",
    title: "Inscripciones",
    description: "Importa participantes, categorías, posiciones y montadores.",
    expectedHeaders: [
      "ID_FERIA",
      "NUMERO_INSCRIPCION",
      "NUMERO_REGISTRO",
      "CODIGO_CATEGORIA",
      "POSICION_PISTA",
      "MONTADOR",
      "ID_MONTADOR",
      "CONSECUTIVO_FERIA",
    ],
  },
  {
    fileKind: "FEH_INSCRIPCIONES_FERIA_PADRES",
    title: "Ejemplares / Padres",
    description: "Completa los datos de ejemplares y su genealogía.",
    expectedHeaders: [
      "ID_FERIA",
      "NUMERO_INSCRIPCION",
      "NUMERO_REGISTRO",
      "NOMBRE_EJEMPLAR",
      "PADRE",
      "MADRE",
      "CODIGO_CATEGORIA",
      "POSICION_PISTA",
      "ID_MONTADOR",
      "MONTADOR",
    ],
  },
] as const;

type ImportStepperProps = {
  steps: FedequinasImportStep[];
  fairExternalId: string | null;
  onFileSelect: (fileKind: FedequinasFileKind, file: File | null) => void;
  onAnalyze: (fileKind: FedequinasFileKind) => Promise<void>;
  onClearPreview: (fileKind: FedequinasFileKind) => void;
  onApply: (fileKind: FedequinasFileKind) => Promise<void>;
};

export function ImportStepper({
  steps,
  fairExternalId,
  onFileSelect,
  onAnalyze,
  onClearPreview,
  onApply,
}: ImportStepperProps) {
  const processingStep = steps.find(
    (step) => step.status === "ANALYZING" || step.status === "APPLYING"
  );
  const processingDefinition = processingStep
    ? IMPORT_STEP_DEFINITIONS.find(
        (definition) => definition.fileKind === processingStep.fileKind
      )
    : null;
  const processingNumber = processingStep
    ? IMPORT_STEP_DEFINITIONS.findIndex(
        (definition) => definition.fileKind === processingStep.fileKind
      ) + 1
    : 0;

  return (
    <>
      <div className="space-y-4">
        {IMPORT_STEP_DEFINITIONS.map((definition, index) => {
          const step = steps.find((candidate) => candidate.fileKind === definition.fileKind);
          if (!step) return null;

          return (
            <ImportStepCard
              key={definition.fileKind}
              number={index + 1}
              title={definition.title}
              description={definition.description}
              expectedHeaders={definition.expectedHeaders}
              step={step}
              fairExternalId={fairExternalId}
              onFileSelect={onFileSelect}
              onAnalyze={onAnalyze}
              onClearPreview={onClearPreview}
              onApply={onApply}
            />
          );
        })}
      </div>

      {processingStep && processingDefinition && (
        <ImportProcessingDialog
          open
          mode={processingStep.status === "APPLYING" ? "applying" : "analyzing"}
          fileName={processingStep.file?.name ?? "Archivo XLSX"}
          fairExternalId={fairExternalId}
          stepNumber={processingNumber}
          stepTitle={processingDefinition.title}
        />
      )}
    </>
  );
}
