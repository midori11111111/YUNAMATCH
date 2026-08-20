import Link from "next/link";
import { requireAdmin } from "../../lib/admin";
import AdminPanel from "./admin-panel";

export const dynamic="force-dynamic";
export default async function AdminPage(){const user=await requireAdmin();if(!user)return <main className="legalPage"><section><h1>管理者専用</h1><p>このページを表示する権限がありません。</p><Link href="/">YUNAMATCHへ戻る</Link></section></main>;return <AdminPanel/>}
