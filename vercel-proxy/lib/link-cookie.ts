import { createHmac, timingSafeEqual } from "node:crypto";

export const linkCookieName="yunamatch-link-target";

export function createLinkCookie(userId:string,secret:string){
  const payload=Buffer.from(JSON.stringify({userId,expiresAt:Date.now()+10*60*1000})).toString("base64url");
  const signature=createHmac("sha256",secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function readLinkCookie(value:string|undefined,secret:string){
  if(!value||!secret)return null;
  const [payload,signature]=value.split(".");
  if(!payload||!signature)return null;
  const expected=createHmac("sha256",secret).update(payload).digest();
  let received:Buffer;
  try{received=Buffer.from(signature,"base64url")}catch{return null}
  if(received.length!==expected.length||!timingSafeEqual(received,expected))return null;
  try{
    const parsed=JSON.parse(Buffer.from(payload,"base64url").toString("utf8")) as {userId?:unknown;expiresAt?:unknown};
    if(typeof parsed.userId!=="string"||typeof parsed.expiresAt!=="number"||parsed.expiresAt<Date.now())return null;
    return parsed.userId;
  }catch{return null}
}
