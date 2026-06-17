"use client";

import { RoundEntryCard, type F1RoundEntryCardProps } from "./round-entry-card";

export type F1EntryCardProps = Omit<F1RoundEntryCardProps, "variant">;

export function F1EntryCard(props: F1EntryCardProps) {
  return <RoundEntryCard variant="f1" {...props} />;
}
