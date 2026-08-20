import { getChatGPTUser } from "../app/chatgpt-auth";

export async function requireAdmin(){
  const user=await getChatGPTUser();if(!user)return null;
  const ids=(process.env.ADMIN_USER_IDS||"").split(",").map(value=>value.trim()).filter(Boolean);
  const emails=(process.env.ADMIN_EMAILS||"").split(",").map(value=>value.trim().toLowerCase()).filter(Boolean);
  return ids.includes(user.userId)||emails.includes(user.email.toLowerCase())?user:null;
}
