import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

const root=new URL("../",import.meta.url);
const read=path=>readFile(new URL(path,root),"utf8");
const compact=value=>value.replace(/\s+/g,"").replace(/,([)\]}])/g,"$1");

test("isolates every new profile and recruit by service id",async()=>{
 const [schema,profile,recruits]=(await Promise.all([read("db/schema.ts"),read("app/api/services/[service]/profile/route.ts"),read("app/api/services/[service]/recruits/route.ts")])).map(compact);
 assert.match(schema,/uniqueIndex\("idx_service_profiles_service_user"\)\.on\(table\.serviceId,table\.userId\)/);
 assert.match(profile,/eq\(serviceProfiles\.serviceId,ctx\.service\)/);
 assert.match(profile,/target:\[serviceProfiles\.serviceId,serviceProfiles\.userId\]/);
 assert.match(recruits,/eq\(serviceRecruits\.serviceId,service\)/);
 assert.match(recruits,/serviceId:ctx\.service/);
});

test("discovers only active profiles from the selected service",async()=>{
 const discover=compact(await read("app/api/services/[service]/discover/route.ts"));
 assert.match(discover,/eq\(serviceProfiles\.serviceId,service\)/);
 assert.match(discover,/eq\(serviceProfiles\.status,"active"\)/);
 assert.match(discover,/isNull\(serviceProfiles\.suspendedAt\)/);
 assert.match(discover,/row\.showGender&&row\.age>=18\?row\.gender:""/);
 assert.match(discover,/eq\(serviceConnections\.serviceId,service\)/);
 assert.match(discover,/or\(eq\(serviceConnections\.userAProfileId,own\.id\),eq\(serviceConnections\.userBProfileId,own\.id\)\)/);
});

test("uses real account login and persistent onboarding in Stamate",async()=>{
 const [rawPage,onboarding]=await Promise.all([read("app/brawl-preview/page.tsx"),read("app/service-onboarding.tsx")]),page=compact(rawPage);
 assert.match(page,/fetch\("\/api\/services\/stamate\/profile"\)/);
 assert.match(page,/\/api\/login\/\$\{x\[2\]\}\?returnTo=/);
 assert.match(page,/ServiceOnboardingservice="stamate"/);
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
 const page=compact(await read("app/valorant-preview/page.tsx"));
 assert.match(page,/fetch\("\/api\/services\/valomatch\/profile"\)/);
 assert.match(page,/ServiceOnboardingservice="valomatch"/);
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

test("keeps Shoenmate functional but separately scoped while approval is pending",async()=>{
 const page=compact(await read("app/identity-preview/page.tsx"));
 assert.match(page,/fetch\("\/api\/services\/shoenmate\/profile"\)/);
 assert.match(page,/ServiceOnboardingservice="shoenmate"/);
 assert.match(page,/fetch\("\/api\/services\/shoenmate\/discover"\)/);
 assert.match(page,/fetch\("\/api\/services\/shoenmate\/likes"/);
 assert.match(page,/fetch\("\/api\/services\/shoenmate\/connections"/);
 assert.match(page,/fetch\("\/api\/services\/shoenmate\/recruits"/);
 assert.match(page,/fetch\("\/api\/services\/shoenmate\/messages"/);
 assert.match(page,/本サービスはNetEaseGamesおよびIdentityV／第五人格の公式サービスではありません/);
 assert.doesNotMatch(page,/setLogged\(true\)/);
});

test("keeps legal acceptance and minor gender privacy service scoped",async()=>{
 const [schema,profile]=(await Promise.all([read("db/schema.ts"),read("app/api/services/[service]/profile/route.ts")])).map(compact);
 assert.match(schema,/termsVersion:text\("terms_version"\)\.notNull\(\)/);
 assert.match(schema,/termsAcceptedAt:integer\("terms_accepted_at"/);
 assert.match(profile,/showGender=body\.showGender===true&&age>=18/);
 assert.match(profile,/gender:row\.showGender&&row\.age>=18\?row\.gender:""/);
});

test("rejects unknown service identifiers before database access",async()=>{
 const [config,profile,recruits]=(await Promise.all([read("lib/service-config.ts"),read("app/api/services/[service]/profile/route.ts"),read("app/api/services/[service]/recruits/route.ts")])).map(compact);
 assert.match(config,/serviceIds=\["valomatch","stamate","shoenmate"\]/);
 assert.match(profile,/if\(!isServiceId\(service\)\)returnnull/);
 assert.match(recruits,/if\(!isServiceId\(service\)\)returnResponse\.json/);
});

test("scopes connections and messages to both the service and a participant",async()=>{
 const [connections,messages]=(await Promise.all([read("app/api/services/[service]/connections/route.ts"),read("app/api/services/[service]/messages/route.ts")])).map(compact);
 assert.match(connections,/eq\(serviceConnections\.serviceId,ctx\.service\)/);
 assert.match(connections,/or\(eq\(serviceConnections\.userAProfileId,ctx\.profile\.id\),eq\(serviceConnections\.userBProfileId,ctx\.profile\.id\)\)/);
 assert.match(messages,/eq\(serviceConnections\.serviceId,service\)/);
 assert.match(messages,/or\(eq\(serviceConnections\.userAProfileId,profile\.id\),eq\(serviceConnections\.userBProfileId,profile\.id\)\)/);
});

test("deduplicates likes, matches, requests, and client message retries",async()=>{
 const [schema,connections,likes,messages]=(await Promise.all([read("db/schema.ts"),read("app/api/services/[service]/connections/route.ts"),read("app/api/services/[service]/likes/route.ts"),read("app/api/services/[service]/messages/route.ts")])).map(compact);
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
 const connections=compact(await read("app/api/services/[service]/connections/route.ts"));
 assert.match(connections,/requesterProfileId:ctx\.profile\.id/);
 assert.match(connections,/status:"pending"/);
 assert.match(connections,/action==="accept"&&incoming/);
 assert.match(connections,/action==="decline"&&incoming/);
 assert.match(connections,/action==="cancel"&&!incoming/);
});

test("supports scoped reporting and administrator moderation for all three services",async()=>{
 const [reportApi,adminApi,adminPage,brawl,valo,identity]=await Promise.all([
  read("app/api/services/[service]/reports/route.ts"),read("app/api/admin/service-reports/route.ts"),read("app/admin/admin-panel.tsx"),read("app/brawl-preview/page.tsx"),read("app/valorant-preview/page.tsx"),read("app/identity-preview/page.tsx")
 ]);
 const reportSource=compact(reportApi),adminSource=compact(adminApi);
 assert.match(reportSource,/eq\(serviceProfiles\.serviceId,service\)/);
 assert.match(reportSource,/eq\(serviceConnections\.serviceId,service\)/);
 assert.match(reportSource,/selected\.senderProfileId!==target\.id/);
 assert.match(reportSource,/conversationContext=JSON\.stringify/);
 assert.match(adminSource,/requireAdmin/);
 assert.match(adminSource,/action==="suspend"/);
 assert.match(adminSource,/action==="restore"/);
 assert.match(adminSource,/action==="removeImage"/);
 assert.match(adminPage,/\/api\/admin\/service-reports/);
 for(const page of [brawl,valo,identity])assert.match(page,/ServiceReportButton/);
});

test("blocks users across matching, recruiting, and chat surfaces",async()=>{
 const [schema,safety,guard,likes,connections,messages,discover,recruits]=(
  await Promise.all([
   read("db/schema.ts"),read("app/api/services/[service]/safety/route.ts"),read("lib/service-safety.ts"),
   read("app/api/services/[service]/likes/route.ts"),read("app/api/services/[service]/connections/route.ts"),
   read("app/api/services/[service]/messages/route.ts"),read("app/api/services/[service]/discover/route.ts"),
   read("app/api/services/[service]/recruits/route.ts")
  ])
 ).map(compact);
 assert.match(schema,/serviceBlocks=sqliteTable\("service_blocks"/);
 assert.match(schema,/uniqueIndex\("idx_service_blocks_service_pair"\)/);
 assert.match(safety,/exportasyncfunctionPOST/);
 assert.match(safety,/exportasyncfunctionDELETE/);
 assert.match(guard,/isServicePairBlocked/);
 for(const source of [likes,connections,messages])assert.match(source,/isServicePairBlocked/);
 assert.match(discover,/serviceBlocks/);
 assert.match(recruits,/serviceBlocks/);
});

test("supports service-scoped account deletion and audited moderation",async()=>{
 const [profile,auditSchema,auditApi,moderation,admin,safetyUi]=(
  await Promise.all([
   read("app/api/services/[service]/profile/route.ts"),read("db/schema.ts"),
   read("app/api/admin/service-audit/route.ts"),read("app/api/admin/service-reports/route.ts"),
   read("app/admin/admin-panel.tsx"),read("app/service-account-safety.tsx")
  ])
 ).map(compact);
 assert.match(profile,/exportasyncfunctionDELETE/);
 assert.match(profile,/body\.confirmation!=="削除"/);
 for(const table of ["serviceReports","serviceMessages","serviceLikes","serviceBlocks","serviceConnections","serviceRecruits","serviceProfiles"])
  assert.match(profile,new RegExp(`db\\.delete\\(${table}\\)`));
 assert.match(auditSchema,/serviceAdminAuditLogs=sqliteTable\("service_admin_audit_logs"/);
 assert.match(auditApi,/requireAdmin/);
 assert.match(moderation,/db\.insert\(serviceAdminAuditLogs\)/);
 assert.match(admin,/\/api\/admin\/service-audit/);
 assert.match(safetyUi,/ブロックを解除しました/);
 assert.match(safetyUi,/このサービスから退会/);
});

test("lets administrators search and moderate every service account",async()=>{
 const [api,admin]=(
  await Promise.all([
   read("app/api/admin/service-users/route.ts"),
   read("app/admin/admin-panel.tsx")
  ])
 ).map(compact);
 assert.match(api,/requireAdmin/);
 assert.match(api,/like\(serviceProfiles\.displayName/);
 assert.match(api,/like\(serviceProfiles\.gameIdentity/);
 assert.match(api,/\["suspend","restore","delete"\]\.includes\(action\)/);
 assert.match(api,/db\.insert\(serviceAdminAuditLogs\)/);
 assert.match(admin,/\/api\/admin\/service-users/);
 assert.match(admin,/3サービスのユーザー検索/);
 assert.match(admin,/アカウント削除/);
});
