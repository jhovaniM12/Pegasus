import "reflect-metadata";
import {
  DisqualificationReason,
  type DisqualificationReasonScope
} from "../entities/staged-flow.entity.js";
import { loadLocalEnv } from "../shared/load-env.js";

loadLocalEnv();

const SOURCE_SYSTEM = "LOCAL";

type ReasonSeed = {
  code: string;
  name: string;
  description: string;
  scope: DisqualificationReasonScope;
  category?: string | null;
};

const COMPETITION_REASONS: ReasonSeed[] = [
  {
    code: "1",
    name: "Brinca con el jinete o con la silla sola",
    description: "Al iniciar o durante la competencia.",
    scope: "COMPETITION"
  },
  {
    code: "2",
    name: "Sangrado por la boca o herida abierta",
    description: "Salvo verificacion veterinaria por muda dental.",
    scope: "COMPETITION"
  },
  {
    code: "3",
    name: "Se detiene o inmoviliza (retaque)",
    description: "Se planta y se niega a seguir o a voltear.",
    scope: "COMPETITION"
  },
  {
    code: "4",
    name: "Castigo en la pista o con implementos prohibidos",
    description: "Electricos, espuelas, tachuelas u otros punzantes.",
    scope: "COMPETITION"
  },
  {
    code: "5",
    name: "Montador en estado de embriaguez o uniforme no reglamentario",
    description: "Reportable por cualquier miembro del Cuerpo Tecnico.",
    scope: "COMPETITION"
  },
  {
    code: "6",
    name: "Girar dos o mas vueltas sobre el mismo poste",
    description: "Durante la prueba del ocho.",
    scope: "COMPETITION"
  },
  {
    code: "7",
    name: "Girar o salirse de la Tabla de Resonancia",
    description: "O no hacer el recorrido completo.",
    scope: "COMPETITION"
  },
  {
    code: "8",
    name: "No estar en condiciones optimas para competir",
    description: "Condicion general no apta.",
    scope: "COMPETITION"
  },
  {
    code: "9",
    name: "Perder dos o mas herraduras simultaneamente",
    description: "Durante la competencia.",
    scope: "COMPETITION"
  },
  {
    code: "10",
    name: "Andar no corresponde al que se juzga",
    description: "No ejecuta el aire de la categoria.",
    scope: "COMPETITION"
  },
  {
    code: "11",
    name: "No retroceder o levantar manos simultaneamente",
    description: "Despues del ocho o durante el retroceso, o en cualquier momento.",
    scope: "COMPETITION"
  },
  {
    code: "12",
    name: "Hiperflexion del tren posterior (calambres)",
    description: "En cualquier magnitud.",
    scope: "COMPETITION"
  },
  {
    code: "13",
    name: "Cojeas evidentes",
    description: "Se evidencia cojera.",
    scope: "COMPETITION"
  },
  {
    code: "14",
    name: "Cola sin tono o con apariencia de cola inmovil",
    description: "Debe buscarse naturalidad en la cola.",
    scope: "COMPETITION"
  },
  {
    code: "15",
    name: "Entrar a la Pista Sonora con otro ejemplar en examen",
    description: "Interfiere con el ejemplar en evaluacion.",
    scope: "COMPETITION"
  },
  {
    code: "16",
    name: "Obstaculizar o interferir el libre desempeno",
    description: "De otros montadores o ejemplares.",
    scope: "COMPETITION"
  },
  {
    code: "17",
    name: "No dirigirse al area de espera o bahia",
    description: "En el aire que se esta juzgando.",
    scope: "COMPETITION"
  }
];

const PRE_RING_REASONS: ReasonSeed[] = [
  {
    code: "PR-01",
    name: "Indocilidad o riesgo de accidente",
    description:
      "Todo ejemplar que presente indocilidad y ofrezca riesgos de accidente para el personal de Prepista será rechazado.",
    scope: "PRE_RING",
    category: "Problemas de comportamiento"
  },
  {
    code: "PR-02",
    name: "Edad fuera del rango de la categoría",
    description:
      "No se aceptarán ejemplares con edad distinta a la máxima y mínima exigida para cada categoría.",
    scope: "PRE_RING",
    category: "Inconsistencias de edad y alzada"
  },
  {
    code: "PR-03",
    name: "Alzada mínima reglamentaria no cumplida",
    description:
      "El ejemplar que no cumpla con la alzada mínima reglamentaria no podrá participar en competencia.",
    scope: "PRE_RING",
    category: "Inconsistencias de edad y alzada"
  },
  {
    code: "PR-04",
    name: "Plantillas, herraduras de tacón o herrajes correctivos",
    description:
      "Quedan prohibidas las plantillas, las herraduras de tacón y los herrajes correctivos.",
    scope: "PRE_RING",
    category: "Irregularidades en cascos y herrajes"
  },
  {
    code: "PR-05",
    name: "Cascos cubiertos con pintura",
    description: "Los cascos cubiertos con cualquier clase de pintura también impiden la participación.",
    scope: "PRE_RING",
    category: "Irregularidades en cascos y herrajes"
  },
  {
    code: "PR-06",
    name: "Belfo",
    description: "Mandíbula más larga que el maxilar. Los ejemplares belfos no pueden competir.",
    scope: "PRE_RING",
    category: "Defectos bucales y dentales"
  },
  {
    code: "PR-07",
    name: "Picudo",
    description: "Maxilar más largo que la mandíbula. Los ejemplares picudos no pueden competir.",
    scope: "PRE_RING",
    category: "Defectos bucales y dentales"
  },
  {
    code: "PR-08",
    name: "Sangrado por la boca o heridas abiertas",
    description: "Tampoco podrán competir aquellos que sangren por la boca o presenten heridas abiertas.",
    scope: "PRE_RING",
    category: "Defectos bucales y dentales"
  },
  {
    code: "PR-09",
    name: "Falta de dos o más dientes permanentes",
    description: "La falta de dos o más dientes permanentes impide competir.",
    scope: "PRE_RING",
    category: "Defectos bucales y dentales"
  },
  {
    code: "PR-10",
    name: "Encarrillamiento",
    description: "Abultamiento óseo en los huesos planos de la cara. No permite competir.",
    scope: "PRE_RING",
    category: "Defectos óseos, musculares y articulares"
  },
  {
    code: "PR-11",
    name: "Bursitis atlanto-occipital (aguacates)",
    description: "La bursitis atlanto-occipital (aguacates) impide la participación.",
    scope: "PRE_RING",
    category: "Defectos óseos, musculares y articulares"
  },
  {
    code: "PR-12",
    name: "Lordosis (pandos) por encima de lo permitido",
    description: "Los ejemplares con lordosis (pandos) por encima de las medidas permitidas son rechazados.",
    scope: "PRE_RING",
    category: "Defectos óseos, musculares y articulares"
  },
  {
    code: "PR-13",
    name: "Lunanco",
    description: "Asimetría en bases óseas. Ser lunanco es motivo de rechazo.",
    scope: "PRE_RING",
    category: "Defectos óseos, musculares y articulares"
  },
  {
    code: "PR-14",
    name: "Fracturas óseas o atrofias musculares",
    description:
      "Fracturas óseas o atrofias musculares en cualquier parte del cuerpo que afecten la estética o simetría no permiten competir.",
    scope: "PRE_RING",
    category: "Defectos óseos, musculares y articulares"
  },
  {
    code: "PR-15",
    name: "Engrosamientos deformantes en miembros",
    description:
      "Los engrosamientos deformantes en los miembros de locomoción no clasificables como golpes de transporte impiden competir.",
    scope: "PRE_RING",
    category: "Defectos óseos, musculares y articulares"
  },
  {
    code: "PR-16",
    name: "Tuerto",
    description: "Los ejemplares tuertos no pueden competir.",
    scope: "PRE_RING",
    category: "Defectos visuales y auditivos"
  },
  {
    code: "PR-17",
    name: "Deformación en orejas (tungos o gachos)",
    description: "Los ejemplares con deformación en las orejas (tungos o gachos) tienen prohibido competir.",
    scope: "PRE_RING",
    category: "Defectos visuales y auditivos"
  },
  {
    code: "PR-18",
    name: "Ciclán o problemas de testículos",
    description:
      "Los ejemplares ciclanes o con problemas de testículos (hipertróficos, atróficos, con hipoplasia, fibrosis o prótesis) no pueden competir.",
    scope: "PRE_RING",
    category: "Defectos reproductivos"
  },
  {
    code: "PR-19",
    name: "Potranca o yegua con un solo pezón",
    description: "Las potrancas o yeguas con un solo pezón no podrán participar en ningún caso.",
    scope: "PRE_RING",
    category: "Defectos reproductivos"
  },
  {
    code: "PR-20",
    name: "Cuerpos extraños bajo la piel de la cola",
    description: "Los ejemplares con cuerpos extraños introducidos debajo de la piel de la cola serán descalificados.",
    scope: "PRE_RING",
    category: "Anomalías en la cola"
  },
  {
    code: "PR-21",
    name: "Cola inmóvil, inyectada o sometida a presión",
    description:
      "Las colas inmóviles, inyectadas o sometidas a presión de cauchos o golpes para impedir el coleo son rechazadas.",
    scope: "PRE_RING",
    category: "Anomalías en la cola"
  },
  {
    code: "PR-22",
    name: "Cola recién picada",
    description: "Los ejemplares con colas recién picadas no pueden competir.",
    scope: "PRE_RING",
    category: "Anomalías en la cola"
  },
  {
    code: "PR-23",
    name: "Colimocho",
    description: "Los ejemplares colimochos tienen prohibida la participación.",
    scope: "PRE_RING",
    category: "Anomalías en la cola"
  },
  {
    code: "PR-24",
    name: "Cojera evidente",
    description: "El ejemplar que presente cojera evidente no puede competir.",
    scope: "PRE_RING",
    category: "Problemas de locomoción y aplomos"
  },
  {
    code: "PR-25",
    name: "Hiperflexión del tren posterior (calambre)",
    description: "La hiperflexión del tren posterior (calambre) impide la competencia.",
    scope: "PRE_RING",
    category: "Problemas de locomoción y aplomos"
  },
  {
    code: "PR-26",
    name: "Aplomos técnica y anatómicamente inaceptables",
    description: "Los aplomos técnica y anatómicamente inaceptables no permiten competir.",
    scope: "PRE_RING",
    category: "Problemas de locomoción y aplomos"
  },
  {
    code: "PR-27",
    name: "Pisada no plana (arremetidos o plantados)",
    description:
      "Los ejemplares que no hacen pisada plana con uno o varios cascos (arremetidos o plantados) son considerados anormales y no podrán competir.",
    scope: "PRE_RING",
    category: "Problemas de locomoción y aplomos"
  },
  {
    code: "PR-28",
    name: "Ojicambiado",
    description: "Los ejemplares ojicambiados (ojos de distinto color) no pueden competir.",
    scope: "PRE_RING",
    category: "Color y pigmentación irreglamentarios"
  },
  {
    code: "PR-29",
    name: "Calzado irreglamentario",
    description: "El calzado irreglamentario (pintas que exceden la articulación) impide competir.",
    scope: "PRE_RING",
    category: "Color y pigmentación irreglamentarios"
  },
  {
    code: "PR-30",
    name: "Pintas no continuas en los miembros",
    description: "Las pintas no continuas en los miembros son motivo de rechazo.",
    scope: "PRE_RING",
    category: "Color y pigmentación irreglamentarios"
  },
  {
    code: "PR-31",
    name: "Manchas en el cuerpo sobre piel rosada",
    description:
      "Las manchas en el cuerpo sobre piel rosada, en lugar distinto a la cabeza, impiden la participación.",
    scope: "PRE_RING",
    category: "Color y pigmentación irreglamentarios"
  },
  {
    code: "PR-32",
    name: "Manchas en la cara que toquen los párpados",
    description: "Las manchas en la cara que toquen el borde libre de los párpados impiden competir.",
    scope: "PRE_RING",
    category: "Color y pigmentación irreglamentarios"
  },
  {
    code: "PR-33",
    name: "Manchas blancas en ollares y ambos labios",
    description:
      "Las manchas blancas que invadan los ollares y afecten ambos labios prohíben la competencia.",
    scope: "PRE_RING",
    category: "Color y pigmentación irreglamentarios"
  },
  {
    code: "PR-34",
    name: "Colorantes en pintas",
    description: "El uso de colorantes en las pintas para modificar su tamaño impide competir.",
    scope: "PRE_RING",
    category: "Color y pigmentación irreglamentarios"
  },
  {
    code: "PR-35",
    name: "Crines o cola teñidas",
    description: "Los ejemplares con crines o cola teñidas no serán autorizados.",
    scope: "PRE_RING",
    category: "Color y pigmentación irreglamentarios"
  },
  {
    code: "PR-36",
    name: "Pseudo albino",
    description: "Los ejemplares pseudo albinos no pueden competir.",
    scope: "PRE_RING",
    category: "Color y pigmentación irreglamentarios"
  },
  {
    code: "PR-37",
    name: "Cirugías no autorizadas para ocultar anomalías",
    description:
      "Las cirugías realizadas aparentemente para ocultar problemas de pigmentación o anomalías son motivo de exclusión y sanción.",
    scope: "PRE_RING",
    category: "Intervenciones no autorizadas"
  }
];

const DISQUALIFICATION_REASONS: ReasonSeed[] = [...COMPETITION_REASONS, ...PRE_RING_REASONS];

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
        category: reason.category ?? null,
        scope: reason.scope,
        isActive: true
      })),
      {
        conflictPaths: ["code"],
        skipUpdateIfNoValuesChanged: true
      }
    );

    const loadedCount = await repo.count();
    const preRingCount = await repo.count({ where: { scope: "PRE_RING" } });
    console.log(`Motivos de descalificacion cargados: ${loadedCount} (prepista: ${preRingCount}).`);
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error: unknown) => {
  console.error("Error al cargar motivos de descalificacion:");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
