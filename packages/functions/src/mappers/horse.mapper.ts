import type { Horse } from "@pegasus/core";
import { toSyncableDto, type SyncableDto } from "./syncable.mapper.js";

export type HorseDto = SyncableDto & {
  name: string | null;
  registrationNumber: string;
  birthDate: string | null;
  colorCode: string | null;
  microchipNumber: string | null;
  associationCode: string | null;
  birthCityCode: string | null;
  fatherRegistrationNumber: string | null;
  motherRegistrationNumber: string | null;
};

export function toHorseDto(horse: Horse): HorseDto {
  return {
    ...toSyncableDto(horse),
    name: horse.name,
    registrationNumber: horse.registrationNumber,
    birthDate: horse.birthDate,
    colorCode: horse.colorCode,
    microchipNumber: horse.microchipNumber,
    associationCode: horse.associationCode,
    birthCityCode: horse.birthCityCode,
    fatherRegistrationNumber: horse.fatherRegistrationNumber,
    motherRegistrationNumber: horse.motherRegistrationNumber
  };
}
