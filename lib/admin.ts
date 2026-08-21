import { getChatGPTUser, type ChatGPTUser } from "../app/chatgpt-auth";

export function isAdminUser(user:ChatGPTUser){
  const ids=(process.env.ADMIN_USER_IDS||"").split(",").map(value=>value.trim()).filter(Boolean);
  const emails=(process.env.ADMIN_EMAILS||"").split(",").map(value=>value.trim().toLowerCase()).filter(Boolean);
  return ids.includes(user.userId)||emails.includes(user.email.toLowerCase());
}

export async function requireAdmin(){
  const user=await getChatGPTUser();if(!user)return null;
  return isAdminUser(user)?user:null;
}
