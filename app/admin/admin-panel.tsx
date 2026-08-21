"use client";
/* eslint-disable @next/next/no-img-element -- user-generated moderation thumbnails use their stored URLs directly */
import Link from "next/link";
import { useEffect,useState } from "react";
type Report={id:number;targetId:string;reason:string;details:string;status:string;createdAt:string;targetName:string|null;avatarUrl:string|null;suspendedAt:string|null};
type Stats={today:string;totals:{uniqueVisitors:number;pageViews:number;signedInVisitors:number;registeredUsers:number;recruits:number;applications:number;todayVisitors:number;todayViews:number};daily:{day:string;visitors:number;views:number}[]};

export default function AdminPanel(){
  const [reports,setReports]=useState<Report[]>([]),[stats,setStats]=useState<Stats|null>(null),[loading,setLoading]=useState(true);
  const load=()=>Promise.all([
    fetch("/api/admin/reports",{cache:"no-store"}).then(response=>response.json()),
    fetch("/api/admin/stats",{cache:"no-store"}).then(response=>response.json()),
  ]).then(([reportData,statsData])=>{setReports(reportData.reports||[]);if(statsData.totals)setStats(statsData)}).finally(()=>setLoading(false));
  useEffect(()=>{load()},[]);
  const act=async(report:Report,action:"resolve"|"suspend"|"restore"|"removeImage")=>{await fetch("/api/admin/reports",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({reportId:report.id,targetId:report.targetId,action})});load()};
  const maxVisitors=Math.max(1,...(stats?.daily.map(day=>day.visitors)||[]));
  return <main className="adminPage"><header><div><small>YUNAMATCH ADMIN</small><h1>運営ダッシュボード</h1></div><Link href="/">アプリへ戻る</Link></header>
    <section className="adminAnalytics"><div className="adminSectionTitle"><div><small>ACCESS OVERVIEW</small><h2>アクセス状況</h2></div><button onClick={load}>更新</button></div>
      {loading||!stats?<p>集計中…</p>:<>
        <div className="adminStatGrid">
          <article className="featured"><span>今日の訪問者</span><strong>{stats.totals.todayVisitors.toLocaleString()}<small>人</small></strong><p>{stats.totals.todayViews.toLocaleString()}回アクセス</p></article>
          <article><span>累計訪問者</span><strong>{stats.totals.uniqueVisitors.toLocaleString()}<small>人</small></strong><p>同じブラウザ・ログインは1人として集計</p></article>
          <article><span>累計アクセス</span><strong>{stats.totals.pageViews.toLocaleString()}<small>回</small></strong><p>ページを開いた合計回数</p></article>
          <article><span>登録ユーザー</span><strong>{stats.totals.registeredUsers.toLocaleString()}<small>人</small></strong><p>ログイン済み訪問者 {stats.totals.signedInVisitors.toLocaleString()}人</p></article>
        </div>
        <article className="adminChart"><div><h3>直近14日間</h3><p>1日ごとのユニーク訪問者</p></div><div className="adminBars">{stats.daily.length?stats.daily.map(item=><div key={item.day}><b>{item.visitors}</b><span style={{height:`${Math.max(8,item.visitors/maxVisitors*100)}%`}}/><small>{Number(item.day.slice(5,7))}/{Number(item.day.slice(8,10))}</small></div>):<p>集計データはまだありません。</p>}</div></article>
        <div className="adminActivityGrid"><article><span>募集作成</span><strong>{stats.totals.recruits.toLocaleString()}</strong></article><article><span>プレイ申請</span><strong>{stats.totals.applications.toLocaleString()}</strong></article></div>
        <p className="adminMetricNote">IPアドレスや閲覧ページの履歴は保存していません。Cookieを削除した場合は別の訪問者として数えられます。</p>
      </>}
    </section>
    <section><div className="adminSectionTitle"><div><small>SAFETY</small><h2>通報一覧</h2></div></div>{loading?<p>読み込み中…</p>:reports.length?reports.map(report=><article key={report.id}><div className="adminReportUser">{report.avatarUrl?<img src={report.avatarUrl} alt=""/>:<span>{report.targetName?.slice(0,1)||"?"}</span>}<div><strong>{report.targetName||"退会ユーザー"}</strong><small>{new Date(report.createdAt).toLocaleString("ja-JP")} ・ {report.status}</small></div></div><h3>{report.reason}</h3><p>{report.details||"詳細なし"}</p><div><button onClick={()=>act(report,"resolve")}>対応済みにする</button>{report.avatarUrl&&<button onClick={()=>act(report,"removeImage")}>画像を削除</button>}<button className="danger" onClick={()=>act(report,report.suspendedAt?"restore":"suspend")}>{report.suspendedAt?"停止を解除":"アカウント停止"}</button></div></article>):<p>未対応の通報はありません。</p>}</section>
  </main>
}
