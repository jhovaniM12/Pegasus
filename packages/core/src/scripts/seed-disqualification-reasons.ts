import "reflect-metadata";
import { DisqualificationReason } from "../entities/staged-flow.entity.js";
import { loadLocalEnv } from "../shared/load-env.js";

loadLocalEnv();

const SOURCE_SYSTEM = "LOCAL";

const DISQUALIFICATION_REASONS = [
  {
    code: "1",
    name: "Brinca con el jinete o con la silla sola",
    description: "Al iniciar o durante la competencia."
  },
  {
    code: "2",
    name: "Sangrado por la boca o herida abierta",
    description: "Salvo verificacion veterinaria por muda dental."
  },
  {
    code: "3",
    name: "Se detiene o inmoviliza (retaque)",
    description: "Se planta y se niega a seguir o a voltear."
  },
  {
    code: "4",
    name: "Castigo en la pista o con implementos prohibidos",
    description: "Electricos, espuelas, tachuelas u otros punzantes."
  },
  {
    code: "5",
    name: "Montador en estado de embriaguez o uniforme no reglamentario",
    description: "Reportable por cualquier miembro del Cuerpo Tecnico."
  },
  {
    code: "6",
    name: "Girar dos o mas vueltas sobre el mismo poste",
    description: "Durante la prueba del ocho."
  },
  {
    code: "7",
    name: "Girar o salirse de la Tabla de Resonancia",
    description: "O no hacer el recorrido completo."
  },
  {
    code: "8",
    name: "No estar en condiciones optimas para competir",
    description: "Condicion general no apta."
  },
  {
    code: "9",
    name: "Perder dos o mas herraduras simultaneamente",
    description: "Durante la competencia."
  },
  {
    code: "10",
    name: "Andar no corresponde al que se juzga",
    description: "No ejecuta el aire de la categoria."
  },
  {
    code: "11",
    name: "No retroceder o levantar manos simultaneamente",
    description: "Despues del ocho o durante el retroceso, o en cualquier momento."
  },
  {
    code: "12",
    name: "Hiperflexion del tren posterior (calambres)",
    description: "En cualquier magnitud."
  },
  {
    code: "13",
    name: "Cojeas evidentes",
    description: "Se evidencia cojera."
  },
  {
    code: "14",
    name: "Cola sin tono o con apariencia de cola inmovil",
    description: "Debe buscarse naturalidad en la cola."
  },
  {
    code: "15",
    name: "Entrar a la Pista Sonora con otro ejemplar en examen",
    description: "Interfiere con el ejemplar en evaluacion."
  },
  {
    code: "16",
    name: "Obstaculizar o interferir el libre desempeno",
    description: "De otros montadores o ejemplares."
  },
  {
    code: "17",
    name: "No dirigirse al area de espera o bahia",
    description: "En el aire que se esta juzgando."
  }
];

async function main(): Promise<void> {
  const { getDataSource } = await import("../database/data-source.js");
  const dataSource = await getDataSource();

  try {
    const repo = dataSource.getRepository(DisqualificationReason);

    await repo.upsert(
      DISQUALIFICATION_REASONS.map((reason) => ({
        externalId: reason.code,
        sourceSystem: SOURCE_SYSTEM,
        code: reason.code,
        name: reason.name,
        description: reason.description,
        isActive: true
      })),
      {
        conflictPaths: ["code"],
        skipUpdateIfNoValuesChanged: true
      }
    );

    const loadedCount = await repo.count();
    console.log(`Motivos de descalificacion cargados: ${loadedCount}.`);
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error: unknown) => {
  console.error("Error al cargar motivos de descalificacion:");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
