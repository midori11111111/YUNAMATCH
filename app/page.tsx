import MatchApp, { type Profile } from "./match-app";
import { getChatGPTUser } from "./chatgpt-auth";
import { isAdminUser } from "../lib/admin";
import { normalizeRank } from "../lib/ranks";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string }>;
}) {
  const user = await getChatGPTUser();
  const preview = process.env.NODE_ENV !== "production" && (await searchParams).preview === "1";

  let initialProfile: Profile | null | undefined;
  let initialSuspended = false;
  if (user) {
    const [{ eq }, { getDb }, { profiles }] = await Promise.all([
      import("drizzle-orm"),
      import("../db"),
      import("../db/schema"),
    ]);
    const [row] = await getDb().select().from(profiles).where(eq(profiles.userId,user.userId)).limit(1);
    initialSuspended = Boolean(row?.suspendedAt);
    if (!row) initialProfile = null;
    else {
      let mainPokemon:string[]=[];
      let playTime:string[]=[];
      try{const values=JSON.parse(row.mainPokemon);if(Array.isArray(values))mainPokemon=values.filter((value):value is string=>typeof value==="string").slice(0,5)}catch{if(row.mainPokemon)mainPokemon=[row.mainPokemon]}
      try{const values=JSON.parse(row.playTime);if(Array.isArray(values))playTime=values.filter((value):value is string=>typeof value==="string").slice(0,7)}catch{if(row.playTime)playTime=[row.playTime]}
      initialProfile={trainerName:row.trainerName,mainPokemon,highestRate:normalizeRank(row.highestRate),playTime,gender:row.gender==="男性"||row.gender==="女性"?row.gender:"",contact:row.contact,avatarUrl:row.avatarUrl||"",age:row.age,ageConfirmed:Boolean(row.ageConfirmed),termsAccepted:Boolean(row.termsAcceptedAt)};
    }
  }

  return <MatchApp displayName={user?.displayName ?? "ゲスト"} authProvider={user?.provider ?? "guest"} authContact={user?.contactId ?? ""} authenticated={Boolean(user)} preview={preview} initialProfile={initialProfile} initialSuspended={initialSuspended} isAdmin={Boolean(user&&isAdminUser(user))} />;
}
