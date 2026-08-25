import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

const root=new URL("../",import.meta.url);
const read=path=>readFile(new URL(path,root),"utf8");

test("isolates every new profile and recruit by service id",async()=>{
 const [schema,profile,recruits]=await Promise.all([read("db/schema.ts"),read("app/api/services/[service]/profile/route.ts"),read("app/api/services/[service]/recruits/route.ts")]);
 assert.match(schema,/uniqueIndex\("idx_service_profiles_service_user"\)\.on\(table\.serviceId, table\.userId\)/);
 assert.match(profile,/eq\(serviceProfiles\.serviceId,ctx\.service\)/);
 assert.match(profile,/target:\[serviceProfiles\.serviceId,serviceProfiles\.userId\]/);
 assert.match(recruits,/eq\(serviceRecruits\.serviceId,service\)/);
 assert.match(recruits,/serviceId:ctx\.service/);
});

test("discovers only active profiles from the selected service",async()=>{
 const discover=await read("app/api/services/[service]/discover/route.ts");
 assert.match(discover,/eq\(serviceProfiles\.serviceId,service\)/);
 assert.match(discover,/eq\(serviceProfiles\.status,"active"\)/);
 assert.match(discover,/isNull\(serviceProfiles\.suspendedAt\)/);
 assert.match(discover,/row\.showGender&&row\.age>=18\?row\.gender:""/);
 assert.match(discover,/eq\(serviceConnections\.serviceId,service\)/);
 assert.match(discover,/or\(eq\(serviceConnections\.userAProfileId,own\.id\),eq\(serviceConnections\.userBProfileId,own\.id\)\)/);
});

test("uses real account login and persistent onboarding in Stamate",async()=>{
 const [page,onboarding]=await Promise.all([read("app/brawl-preview/page.tsx"),read("app/service-onboarding.tsx")]);
 assert.match(page,/fetch\("\/api\/services\/stamate\/profile"\)/);
 assert.match(page,/\/api\/login\/\$\{x\[2\]\}\?returnTo=/);
 assert.match(page,/ServiceOnboarding service="stamate"/);
 assert.match(onboarding,/method:"PUT"/);
 assert.match(onboarding,/termsAccepted:terms/);
 assert.match(onboarding,/age>=18&&gender/);
 assert.match(page,/fetch\("\/api\/services\/stamate\/discover"\)/);
 assert.match(page,/fetch\("\/api\/services\/stamate\/likes"/);
 assert.match(page,/fetch\("\/api\/services\/stamate\/connections"/);
 assert.match(page,/fetch\("\/api\/services\/stamate\/recruits"/);
 assert.match(page,/fetch\("\/api\/services\/stamate\/messages"/);
 assert.match(page,/act\(item\.id,"accept"\)/);
 assert.match(page,/act\(item\.id,"decline"\)/);
 assert.match(page,/act\(item\.id,"cancel"\)/);
});

test("uses real account login and matching APIs in Valomatch",async()=>{
 const page=await read("app/valorant-preview/page.tsx");
 assert.match(page,/fetch\("\/api\/services\/valomatch\/profile"\)/);
 assert.match(page,/ServiceOnboarding service="valomatch"/);
 assert.match(page,/fetch\("\/api\/services\/valomatch\/discover"\)/);
 assert.match(page,/fetch\("\/api\/services\/valomatch\/likes"/);
 assert.match(page,/fetch\("\/api\/services\/valomatch\/connections"/);
 assert.match(page,/fetch\("\/api\/services\/valomatch\/recruits"/);
 assert.match(page,/fetch\(`\/api\/services\/valomatch\/messages\?connectionId=/);
 assert.match(page,/fetch\("\/api\/services\/valomatch\/messages"/);
 assert.match(page,/act\(item\.id,"accept"\)/);
 assert.match(page,/act\(item\.id,"decline"\)/);
 assert.match(page,/act\(item\.id,"cancel"\)/);
 assert.match(page,/Riot連携（審査中）/);
 assert.doesNotMatch(page,/連携しました（デモ）/);
});

test("keeps legal acceptance and minor gender privacy service scoped",async()=>{
 const [schema,profile]=await Promise.all([read("db/schema.ts"),read("app/api/services/[service]/profile/route.ts")]);
 assert.match(schema,/termsVersion: text\("terms_version"\)\.notNull\(\)/);
 assert.match(schema,/termsAcceptedAt: integer\("terms_accepted_at"/);
 assert.match(profile,/showGender=body\.showGender===true&&age>=18/);
 assert.match(profile,/gender:row\.showGender&&row\.age>=18\?row\.gender:""/);
});

test("rejects unknown service identifiers before database access",async()=>{
 const [config,profile,recruits]=await Promise.all([read("lib/service-config.ts"),read("app/api/services/[service]/profile/route.ts"),read("app/api/services/[service]/recruits/route.ts")]);
 assert.match(config,/serviceIds=\["valomatch","stamate","shoenmate"\]/);
 assert.match(profile,/if\(!isServiceId\(service\)\)return null/);
 assert.match(recruits,/if\(!isServiceId\(service\)\)return Response\.json/);
});

test("scopes connections and messages to both the service and a participant",async()=>{
 const [connections,messages]=await Promise.all([read("app/api/services/[service]/connections/route.ts"),read("app/api/services/[service]/messages/route.ts")]);
 assert.match(connections,/eq\(serviceConnections\.serviceId,ctx\.service\)/);
 assert.match(connections,/or\(eq\(serviceConnections\.userAProfileId,ctx\.profile\.id\),eq\(serviceConnections\.userBProfileId,ctx\.profile\.id\)\)/);
 assert.match(messages,/eq\(serviceConnections\.serviceId,service\)/);
 assert.match(messages,/or\(eq\(serviceConnections\.userAProfileId,profile\.id\),eq\(serviceConnections\.userBProfileId,profile\.id\)\)/);
});

test("deduplicates likes, matches, requests, and client message retries",async()=>{
 const [schema,connections,likes,messages]=await Promise.all([read("db/schema.ts"),read("app/api/services/[service]/connections/route.ts"),read("app/api/services/[service]/likes/route.ts"),read("app/api/services/[service]/messages/route.ts")]);
 assert.match(schema,/uniqueIndex\("idx_service_connections_service_pair"\)/);
 assert.match(schema,/uniqueIndex\("idx_service_likes_service_pair"\)/);
 assert.match(schema,/uniqueIndex\("idx_service_messages_sender_client"\)/);
 assert.match(connections,/onConflictDoUpdate\(\{target:\[serviceConnections\.serviceId,serviceConnections\.pairKey\]/);
 assert.match(likes,/onConflictDoUpdate\(\{\s*target:\[serviceLikes\.serviceId,serviceLikes\.senderProfileId,serviceLikes\.recipientProfileId\]/);
 assert.match(likes,/eq\(serviceLikes\.senderProfileId,target\.id\).*eq\(serviceLikes\.recipientProfileId,ctx\.profile\.id\)/s);
 assert.match(likes,/matched:true,connection/);
 assert.match(messages,/onConflictDoNothing\(\{target:\[serviceMessages\.senderProfileId,serviceMessages\.clientId\]\}\)/);
});

test("keeps mate requests pending until the recipient acts",async()=>{
 const connections=await read("app/api/services/[service]/connections/route.ts");
 assert.match(connections,/requesterProfileId:ctx\.profile\.id/);
 assert.match(connections,/status:"pending"/);
 assert.match(connections,/action==="accept"&&incoming/);
 assert.match(connections,/action==="decline"&&incoming/);
 assert.match(connections,/action==="cancel"&&!incoming/);
});
