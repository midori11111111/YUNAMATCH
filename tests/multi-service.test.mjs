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
