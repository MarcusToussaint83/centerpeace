/**
 * Provider registry.
 *
 * The UI imports `getProviders()` to render a mode picker; everything else
 * lives behind the `SeatingProvider` interface so adding a new provider is a
 * one-line registry change.
 */

import { apiProvider } from "./api";
import { localProvider } from "./local";
import type { SeatingProvider } from "./types";

const PROVIDERS: SeatingProvider[] = [localProvider, apiProvider];

export function getProviders(): SeatingProvider[] {
  return PROVIDERS;
}

export function getProvider(id: string): SeatingProvider | undefined {
  return PROVIDERS.find((p) => p.id === id);
}

export type { SeatingProvider, SeatingProposal, ProviderContext } from "./types";
