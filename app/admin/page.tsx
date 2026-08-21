import { requireAdmin } from "../../lib/admin";
import AdminPanel from "./admin-panel";
import AdminLogin from "./admin-login";

export const dynamic="force-dynamic";
export default async function AdminPage(){return await requireAdmin()?<AdminPanel/>:<AdminLogin/>}
