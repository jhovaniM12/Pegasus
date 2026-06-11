import { ILike, type DataSource, type FindOptionsWhere } from "typeorm";
import { FairEntry } from "../entities/fair-entries.js";
import { CATEGORY_RELATIONS } from "./category.repository.js";
import type { PaginatedResult, PaginationParams } from "./types.js";

type FairEntrySearchParams = PaginationParams & {
  search?: string;
  categoryId?: string;
};

function readRawNumber(row: Record<string, unknown>, keys: string[]): number {
  for (const key of keys) {
    const value = row[key];

    if (value !== undefined && value !== null) {
      return Number(value);
    }
  }

  return Number.NaN;
}

function buildFairEntryWhere(
  fairId: string,
  search?: string,
  categoryId?: string
): FindOptionsWhere<FairEntry> | FindOptionsWhere<FairEntry>[] {
  const baseWhere = categoryId ? { fairId, categoryId } : { fairId };
  const normalizedSearch = search?.trim();

  if (!normalizedSearch) {
    return baseWhere;
  }

  const searchPattern = `%${normalizedSearch}%`;

  return [
    { ...baseWhere, riderName: ILike(searchPattern) },
    { ...baseWhere, registrationNumber: ILike(searchPattern) },
  ];
}

export type FairEntriesCategorySummary = {
  category: {
    id: string;
    name: string | null;
    minAgeMonths: number;
    maxAgeMonths: number;
  };
  totalEntries: number;
};

export type FairEntriesGaitSummary = {
  gait: {
    id: string;
    name: string | null;
  };
  totalEntries: number;
  categories: FairEntriesCategorySummary[];
};

export async function findFairEntriesByFairId(
  dataSource: DataSource,
  fairId: string,
  params: FairEntrySearchParams
): Promise<PaginatedResult<FairEntry>> {
  const [items, total] = await dataSource.getRepository(FairEntry).findAndCount({
    where: buildFairEntryWhere(fairId, params.search, params.categoryId),
    relations: { category: CATEGORY_RELATIONS },
    order: { fairSequence: "ASC", trackPosition: "ASC" },
    skip: (params.page - 1) * params.limit,
    take: params.limit
  });

  return { items, total, page: params.page, limit: params.limit };
}

export async function summarizeFairEntriesByGait(
  dataSource: DataSource,
  fairId: string
): Promise<FairEntriesGaitSummary[]> {
  const rows = await dataSource
    .getRepository(FairEntry)
    .createQueryBuilder("entry")
    .innerJoin("entry.category", "category")
    .innerJoin("category.gait", "gait")
    .select("gait.id", "gaitId")
    .addSelect("gait.name", "gaitName")
    .addSelect("category.id", "categoryId")
    .addSelect("category.name", "categoryName")
    .addSelect("category.minAgeMonths", "minAgeMonths")
    .addSelect("category.maxAgeMonths", "maxAgeMonths")
    .addSelect("COUNT(entry.id)", "totalEntries")
    .where("entry.fair_id = :fairId", { fairId })
    .groupBy("gait.id")
    .addGroupBy("gait.name")
    .addGroupBy("category.id")
    .addGroupBy("category.name")
    .addGroupBy("category.minAgeMonths")
    .addGroupBy("category.maxAgeMonths")
    .orderBy("gait.name", "ASC")
    .addOrderBy("category.name", "ASC")
    .getRawMany<{
      gaitId: string;
      gaitName: string | null;
      categoryId: string;
      categoryName: string | null;
      minAgeMonths: string;
      maxAgeMonths: string;
      totalEntries: string;
    }>();

  const summaryByGait = new Map<string, FairEntriesGaitSummary>();

  for (const row of rows) {
    const totalEntries = Number(row.totalEntries);
    const minAgeMonths = readRawNumber(row, [
      "minAgeMonths",
      "minagemonths",
      "category_min_age_months"
    ]);
    const maxAgeMonths = readRawNumber(row, [
      "maxAgeMonths",
      "maxagemonths",
      "category_max_age_months"
    ]);
    const gaitSummary = summaryByGait.get(row.gaitId) ?? {
      gait: {
        id: row.gaitId,
        name: row.gaitName
      },
      totalEntries: 0,
      categories: []
    };

    gaitSummary.totalEntries += totalEntries;
    gaitSummary.categories.push({
      category: {
        id: row.categoryId,
        name: row.categoryName,
        minAgeMonths,
        maxAgeMonths
      },
      totalEntries
    });

    summaryByGait.set(row.gaitId, gaitSummary);
  }

  return Array.from(summaryByGait.values());
}
