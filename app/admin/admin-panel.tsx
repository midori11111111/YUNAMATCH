"use client";
/* eslint-disable @next/next/no-img-element -- user-generated moderation thumbnails use their stored URLs directly */
import Link from "next/link";
import { useEffect,useState } from "react";

type Report={id:number;targetId:string;reason:string;details:string;status:string;createdAt:string;resolvedAt:string|null;targetName:string|null;avatarUrl:string|null;suspendedAt:string|null};
type Ticket={id:number;userId:string;trainerName:string;category:string;message:string;status:string;createdAt:string;resolvedAt:string|null};
type Stats={today:string;totals:{uniqueVisitors:number;pageViews:number;signedInVisitors:number;registeredUsers:number;recruits:number;applications:number;todayVisitors:number;todayViews:number};daily:{day:string;visitors:number;views:number}[];funnel:{visitToRegistration:number;registrationToRecruit:number;recruitToApplication:number;applicationToMatch:number;matchToChat:number;matchToFinishedPlay:number;matchToMutualAgain:number;counts:{recruiters:number;recruitsWithApplication:number;matches:number;chattedMatches:number;finishedPlays:number;mutualAgain:number}};speed:{averageMinutes:number;within15Rate:number;sampleSize:number};retention:{d1:{rate:number;eligible:number};d7:{rate:number;eligible:number}}};

const rate=(value:number)=>`${value.toFixed(1)}%`;
const ageHours=(value:string)=>Math.floor((Date.now()-new Date(value).getTime())/3_600_000);

export default function AdminPanel(){
  const [reports,setReports]=useState<Report[]>([]),[tickets,setTickets]=useState<Ticket[]>([]),[stats,setStats]=useState<Stats|null>(null),[loading,setLoading]=useState(true),[showResolved,setShowResolved]=useState(false);
  const load=()=>Promise.all([
    fetch("/api/admin/reports",{cache:"no-store"}).then(response=>response.json()),
    fetch("/api/admin/support",{cache:"no-store"}).then(response=>response.json()),
    fetch("/api/admin/stats",{cache:"no-store"}).then(response=>response.json()),
  ]).then(([reportData,ticketData,statsData])=>{setReports(reportData.reports||[]);setTickets(ticketData.tickets||[]);if(statsData.totals)setStats(statsData)}).finally(()=>setLoading(false));
  useEffect(()=>{load()},[]);
  const act=async(report:Report,action:"resolve"|"suspend"|"restore"|"removeImage")=>{await fetch("/api/admin/reports",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({reportId:report.id,targetId:report.targetId,action})});load()};
  const actTicket=async(ticket:Ticket,action:"resolve"|"reopen")=>{await fetch("/api/admin/support",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({ticketId:ticket.id,action})});load()};
  const maxVisitors=Math.max(1,...(stats?.daily.map(day=>day.visitors)||[]));
  const visibleReports=reports.filter(item=>showResolved||item.status!=="resolved"),visibleTickets=tickets.filter(item=>showResolved||item.status!=="resolved");
  const logout=async()=>{await fetch("/api/admin/session",{method:"DELETE"});location.reload()};
  return <main className="adminPage"><header><div><small>YUNAMATCH ADMIN</small><h1>運営ダッシュボード</h1></div><nav><Link href="/">アプリへ戻る</Link><button onClick={logout}>管理画面からログアウト</button></nav></header>
    <section className="adminAnalytics"><div className="adminSectionTitle"><div><small>ACCESS OVERVIEW</small><h2>アクセス状況</h2></div><button onClick={load}>更新</button></div>
      {loading||!stats?<p>集計中…</p>:<>
        <div className="adminStatGrid">
          <article className="featured"><span>今日の訪問者</span><strong>{stats.totals.todayVisitors.toLocaleString()}<small>人</small></strong><p>{stats.totals.todayViews.toLocaleString()}回アクセス</p></article>
          <article><span>累計訪問者</span><strong>{stats.totals.uniqueVisitors.toLocaleString()}<small>人</small></strong><p>同じブラウザ・ログインは1人として集計</p></article>
          <article><span>累計アクセス</span><strong>{stats.totals.pageViews.toLocaleString()}<small>回</small></strong><p>ページを開いた合計回数</p></article>
          <article><span>登録ユーザー</span><strong>{stats.totals.registeredUsers.toLocaleString()}<small>人</small></strong><p>ログイン済み訪問者 {stats.totals.signedInVisitors.toLocaleString()}人</p></article>
        </div>
        <article className="adminChart"><div><h3>直近14日間</h3><p>1日ごとのユニーク訪問者</p></div><div className="adminBars">{stats.daily.length?stats.daily.map(item=><div key={item.day}><b>{item.visitors}</b><span style={{height:`${Math.max(8,item.visitors/maxVisitors*100)}%`}}/><small>{Number(item.day.slice(5,7))}/{Number(item.day.slice(8,10))}</small></div>):<p>集計データはまだありません。</p>}</div></article>
        <div className="adminFunnel"><article><span>訪問 → 登録</span><strong>{rate(stats.funnel.visitToRegistration)}</strong><small>{stats.totals.registeredUsers}/{stats.totals.uniqueVisitors}人</small></article><b>›</b><article><span>登録 → 募集</span><strong>{rate(stats.funnel.registrationToRecruit)}</strong><small>{stats.funnel.counts.recruiters}人が募集</small></article><b>›</b><article><span>募集 → 申請あり</span><strong>{rate(stats.funnel.recruitToApplication)}</strong><small>{stats.funnel.counts.recruitsWithApplication}件</small></article><b>›</b><article><span>申請 → 成立</span><strong>{rate(stats.funnel.applicationToMatch)}</strong><small>{stats.funnel.counts.matches}組</small></article></div>
        <div className="adminOutcomeGrid"><article><span>成立後にチャット</span><strong>{rate(stats.funnel.matchToChat)}</strong><small>{stats.funnel.counts.chattedMatches}組</small></article><article><span>プレイ完了</span><strong>{rate(stats.funnel.matchToFinishedPlay)}</strong><small>{stats.funnel.counts.finishedPlays}回</small></article><article><span>相互また遊びたい</span><strong>{rate(stats.funnel.matchToMutualAgain)}</strong><small>{stats.funnel.counts.mutualAgain}組</small></article><article><span>初回申請まで</span><strong>{stats.speed.sampleSize?`${stats.speed.averageMinutes}分`:"—"}</strong><small>15分以内 {rate(stats.speed.within15Rate)}</small></article><article><span>翌日再訪 D1</span><strong>{rate(stats.retention.d1.rate)}</strong><small>対象 {stats.retention.d1.eligible}人</small></article><article><span>7日後再訪 D7</span><strong>{rate(stats.retention.d7.rate)}</strong><small>対象 {stats.retention.d7.eligible}人</small></article></div>
        <div className="adminActivityGrid"><article><span>募集作成</span><strong>{stats.totals.recruits.toLocaleString()}</strong></article><article><span>プレイ申請</span><strong>{stats.totals.applications.toLocaleString()}</strong></article></div>
        <div className="adminBackup"><div><strong>運営バックアップ</strong><p>プロフィール・募集・マッチ・通報・アクセス集計をJSONで保存します。</p></div><a href="/api/admin/export">バックアップをダウンロード</a></div>
        <p className="adminMetricNote">再訪率は同じブラウザの識別情報で集計します。IPアドレスや閲覧ページの履歴は保存していません。</p>
      </>}
    </section>
    <section><div className="adminSectionTitle"><div><small>SAFETY & SUPPORT</small><h2>対応キュー</h2></div><label className="adminResolvedToggle"><input type="checkbox" checked={showResolved} onChange={event=>setShowResolved(event.target.checked)}/>対応済みも表示</label></div>
      <div className="adminQueueSummary"><span>未対応の通報 <b>{reports.filter(item=>item.status!=="resolved").length}</b></span><span>未対応のお問い合わせ <b>{tickets.filter(item=>item.status!=="resolved").length}</b></span><small>原則24時間以内に確認</small></div>
      {loading?<p>読み込み中…</p>:<>{visibleReports.map(report=><article key={`report-${report.id}`}><div className="adminReportUser">{report.avatarUrl?<img src={report.avatarUrl} alt=""/>:<span>{report.targetName?.slice(0,1)||"?"}</span>}<div><strong>{report.targetName||"退会ユーザー"}</strong><small>{new Date(report.createdAt).toLocaleString("ja-JP")} ・ 通報</small></div><em className={report.status==="resolved"?"resolved":ageHours(report.createdAt)>=24?"overdue":"onTime"}>{report.status==="resolved"?"対応済み":ageHours(report.createdAt)>=24?"24時間超過":`残り約${24-ageHours(report.createdAt)}時間`}</em></div><h3>{report.reason}</h3><p>{report.details||"詳細なし"}</p><div>{report.status!=="resolved"&&<button onClick={()=>act(report,"resolve")}>対応済みにする</button>}{report.avatarUrl&&<button onClick={()=>act(report,"removeImage")}>画像を削除</button>}<button className="danger" onClick={()=>act(report,report.suspendedAt?"restore":"suspend")}>{report.suspendedAt?"停止を解除":"アカウント停止"}</button></div></article>)}
      {visibleTickets.map(ticket=><article key={`ticket-${ticket.id}`}><div className="adminReportUser"><span>?</span><div><strong>{ticket.trainerName}</strong><small>{new Date(ticket.createdAt).toLocaleString("ja-JP")} ・ {ticket.category}</small></div><em className={ticket.status==="resolved"?"resolved":ageHours(ticket.createdAt)>=24?"overdue":"onTime"}>{ticket.status==="resolved"?"対応済み":ageHours(ticket.createdAt)>=24?"24時間超過":`残り約${24-ageHours(ticket.createdAt)}時間`}</em></div><p>{ticket.message}</p><div><button onClick={()=>actTicket(ticket,ticket.status==="resolved"?"reopen":"resolve")}>{ticket.status==="resolved"?"未対応に戻す":"対応済みにする"}</button></div></article>)}
      {!visibleReports.length&&!visibleTickets.length&&<p>未対応の通報・お問い合わせはありません。</p>}</>}
    </section>
  </main>;
}
