import { pokemonRole, type PokemonRole } from "./pokemon-role.ts";

export type DiscoverFilterCandidate = {
  trainerName: string;
  mainPokemon: string[];
  gender: string;
  playTime: string[];
  likeCount: number;
  lastActiveAt: string;
  online: boolean;
};

export type DiscoverActivityFilter = "" | "online" | "3h" | "24h";

type DiscoverFilters = {
  pokemonQuery: string;
  trainerQuery: string;
  gender: "" | "男性" | "女性";
  sharedTimeOnly: boolean;
  minLikes: number | null;
  maxLikes: number | null;
  role: PokemonRole | "";
  activity: DiscoverActivityFilter;
  myPlayTime: string[];
  officialPokemon: string[];
};

function normalizeSearchText(value: string) {
  return value.normalize("NFKC").trim().toLocaleLowerCase("ja-JP");
}

export function filterDiscoverCandidates<T extends DiscoverFilterCandidate>(
  candidates: T[],
  filters: DiscoverFilters,
) {
  const pokemonQuery = normalizeSearchText(filters.pokemonQuery);
  const trainerQuery = normalizeSearchText(filters.trainerQuery);
  const exactPokemonSelected =
    Boolean(pokemonQuery) &&
    filters.officialPokemon.some(
      (name) => normalizeSearchText(name) === pokemonQuery,
    );
  const exactTrainerExists =
    Boolean(trainerQuery) &&
    candidates.some(
      (person) => normalizeSearchText(person.trainerName) === trainerQuery,
    );

  const now = Date.now();
  const filtered = candidates.filter((person) => {
    const pokemonMatches =
      !pokemonQuery ||
      person.mainPokemon.some((name) => {
        const normalizedName = normalizeSearchText(name);
        return exactPokemonSelected
          ? normalizedName === pokemonQuery
          : normalizedName.includes(pokemonQuery);
      });
    const trainerName = normalizeSearchText(person.trainerName);
    const trainerMatches =
      !trainerQuery ||
      (exactTrainerExists
        ? trainerName === trainerQuery
        : trainerName.includes(trainerQuery));
    const genderMatches = !filters.gender || person.gender === filters.gender;
    const timeMatches =
      !filters.sharedTimeOnly ||
      person.playTime.includes("時間帯はいつでも") ||
      filters.myPlayTime.includes("時間帯はいつでも") ||
      person.playTime.some((time) => filters.myPlayTime.includes(time));
    const likesMatch =
      (filters.minLikes === null || person.likeCount >= filters.minLikes) &&
      (filters.maxLikes === null || person.likeCount <= filters.maxLikes);
    const roleMatches =
      !filters.role || person.mainPokemon.some((name) => pokemonRole(name) === filters.role);
    const lastActiveAt = new Date(person.lastActiveAt).getTime();
    const activityMatches =
      !filters.activity ||
      (filters.activity === "online" && person.online) ||
      (filters.activity === "3h" && lastActiveAt >= now - 3 * 60 * 60_000) ||
      (filters.activity === "24h" && lastActiveAt >= now - 24 * 60 * 60_000);
    return (
      pokemonMatches &&
      trainerMatches &&
      genderMatches &&
      timeMatches &&
      likesMatch &&
      roleMatches &&
      activityMatches
    );
  });
  return filters.activity
    ? filtered.sort(
        (left, right) =>
          new Date(right.lastActiveAt).getTime() -
          new Date(left.lastActiveAt).getTime(),
      )
    : filtered;
}
