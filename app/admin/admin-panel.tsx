"use client";
/* eslint-disable @next/next/no-img-element -- user-generated moderation thumbnails use their stored URLs directly */
import Link from "next/link";
import { useEffect, useState } from "react";

type ReportContextMessage = {
  id: number;
  senderName: string;
  body: string;
  kind: string;
  createdAt: number | string;
  isReported: boolean;
};
type Report = {
  id: number;
  targetId: string;
  reporterId: string;
  recruitId: number | null;
  connectionId: number | null;
  messageId: number | null;
  reportedContent: string;
  conversationContext: ReportContextMessage[];
  reason: string;
  details: string;
  status: string;
  createdAt: string;
  resolvedAt: string | null;
  targetName: string | null;
  avatarUrl: string | null;
  suspendedAt: string | null;
};
type FlaggedUser = {
  targetId: string;
  targetName: string | null;
  avatarUrl: string | null;
  suspendedAt: string | null;
  reportCount: number;
  openCount: number;
  lastReportedAt: string | number;
};
type Ticket = {
  id: number;
  userId: string;
  trainerName: string;
  category: string;
  message: string;
  status: string;
  createdAt: string;
  resolvedAt: string | null;
};
type Stats = {
  today: string;
  totals: {
    uniqueVisitors: number;
    pageViews: number;
    signedInVisitors: number;
    registeredUsers: number;
    recruits: number;
    applications: number;
    todayVisitors: number;
    todayViews: number;
  };
  daily: { day: string; visitors: number; views: number }[];
  funnel: {
    visitToRegistration: number;
    registrationToRecruit: number;
    recruitToApplication: number;
    applicationToMatch: number;
    matchToChat: number;
    matchToFinishedPlay: number;
    matchToMutualAgain: number;
    counts: {
      recruiters: number;
      recruitsWithApplication: number;
      matches: number;
      chattedMatches: number;
      finishedPlays: number;
      mutualAgain: number;
    };
  };
  speed: { averageMinutes: number; within15Rate: number; sampleSize: number };
  retention: {
    d1: { rate: number; eligible: number };
    d7: { rate: number; eligible: number };
  };
  demographics: {
    male: number;
    female: number;
    total: number;
    maleRate: number;
    femaleRate: number;
  };
};
type AdminUser = {
  userId: string;
  trainerName: string;
  avatarUrl: string | null;
  gender: string;
  age: number | null;
  highestRate: string;
  mainPokemon: string[];
  authProvider: string;
  suspendedAt: string | null;
  createdAt: string;
  updatedAt: string;
  reportCount: number;
};
type ServiceStat = {
  id: string;
  name: string;
  stage: string;
  profiles: number;
  recruits: number;
  connections: number;
  messages: number;
  reports: number;
  openReports: number;
};
type ReadinessCheck = { label: string; ready: boolean };
type LaunchReadiness = {
  common: ReadinessCheck[];
  services: Array<{
    id: string;
    name: string;
    ready: boolean;
    checks: ReadinessCheck[];
  }>;
};
type ServiceReport = {
  id: number;
  serviceId: string;
  targetProfileId: number;
  targetName: string;
  targetAvatarUrl: string;
  targetSuspendedAt: string | null;
  reporterName: string;
  reason: string;
  details: string;
  reportedContent: string;
  conversationContext: unknown[];
  status: string;
  createdAt: string;
  resolvedAt: string | null;
};
type ServiceAuditLog = {
  id: number;
  serviceId: string;
  action: string;
  targetProfileId: number | null;
  reportId: number | null;
  detail: string;
  createdAt: string;
};
type ServiceAdminUser = {
  id: number;
  serviceId: string;
  displayName: string;
  gameIdentity: string;
  skillTier: string;
  avatarUrl: string;
  age: number;
  suspendedAt: string | null;
  reportCount: number;
};

const rate = (value: number) => `${value.toFixed(1)}%`;
const ageHours = (value: string) =>
  Math.floor((Date.now() - new Date(value).getTime()) / 3_600_000);

export default function AdminPanel() {
  const [reports, setReports] = useState<Report[]>([]),
    [flaggedUsers, setFlaggedUsers] = useState<FlaggedUser[]>([]),
    [tickets, setTickets] = useState<Ticket[]>([]),
    [stats, setStats] = useState<Stats | null>(null),
    [loading, setLoading] = useState(true),
    [showResolved, setShowResolved] = useState(false);
  const [serviceStats, setServiceStats] = useState<ServiceStat[]>([]),
    [serviceSchemaReady, setServiceSchemaReady] = useState(false),
    [launchReadiness, setLaunchReadiness] = useState<LaunchReadiness | null>(null);
  const [serviceReports, setServiceReports] = useState<ServiceReport[]>([]),
    [serviceAuditLogs, setServiceAuditLogs] = useState<ServiceAuditLog[]>([]);
  const [serviceUserQuery, setServiceUserQuery] = useState(""),
    [serviceUserFilter, setServiceUserFilter] = useState(""),
    [serviceUserResults, setServiceUserResults] = useState<ServiceAdminUser[]>(
      [],
    ),
    [serviceUserNotice, setServiceUserNotice] = useState(""),
    [serviceUserBusy, setServiceUserBusy] = useState(0);
  const [userQuery, setUserQuery] = useState(""),
    [userResults, setUserResults] = useState<AdminUser[]>([]),
    [userSearchLoading, setUserSearchLoading] = useState(false),
    [userSearchError, setUserSearchError] = useState(""),
    [userSearchNotice, setUserSearchNotice] = useState(""),
    [userActionId, setUserActionId] = useState("");
  const load = () =>
    Promise.all([
      fetch("/api/admin/reports", { cache: "no-store" }).then((response) =>
        response.json(),
      ),
      fetch("/api/admin/support", { cache: "no-store" }).then((response) =>
        response.json(),
      ),
      fetch("/api/admin/stats", { cache: "no-store" }).then((response) =>
        response.json(),
      ),
      fetch("/api/admin/services", { cache: "no-store" }).then((response) =>
        response.json(),
      ),
      fetch("/api/admin/readiness", { cache: "no-store" }).then((response) =>
        response.json(),
      ),
      fetch("/api/admin/service-reports", { cache: "no-store" }).then(
        (response) => response.json(),
      ),
      fetch("/api/admin/service-audit", { cache: "no-store" }).then(
        (response) => response.json(),
      ),
    ])
      .then(
        ([
          reportData,
          ticketData,
          statsData,
          serviceData,
          readinessData,
          serviceReportData,
          serviceAuditData,
        ]) => {
          setReports(reportData.reports || []);
          setFlaggedUsers(reportData.flaggedUsers || []);
          setTickets(ticketData.tickets || []);
          if (statsData.totals) setStats(statsData);
          setServiceStats(serviceData.services || []);
          setServiceSchemaReady(Boolean(serviceData.schemaReady));
          if (readinessData.services) setLaunchReadiness(readinessData);
          setServiceReports(serviceReportData.reports || []);
          setServiceAuditLogs(serviceAuditData.logs || []);
        },
      )
      .finally(() => setLoading(false));
  useEffect(() => {
    load();
  }, []);
  const act = async (
    report: Report,
    action: "resolve" | "suspend" | "restore" | "removeImage",
  ) => {
    await fetch("/api/admin/reports", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        reportId: report.id,
        targetId: report.targetId,
        action,
      }),
    });
    load();
  };
  const actTarget = async (
    target: FlaggedUser,
    action: "suspend" | "restore",
  ) => {
    await fetch("/api/admin/reports", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ targetId: target.targetId, action }),
    });
    load();
  };
  const actTicket = async (ticket: Ticket, action: "resolve" | "reopen") => {
    await fetch("/api/admin/support", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ticketId: ticket.id, action }),
    });
    load();
  };
  const actServiceReport = async (
    report: ServiceReport,
    action: "resolve" | "suspend" | "restore" | "removeImage",
  ) => {
    await fetch("/api/admin/service-reports", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        reportId: report.id,
        service: report.serviceId,
        targetProfileId: report.targetProfileId,
        action,
      }),
    });
    load();
  };
  const searchServiceUsers = async () => {
    const query = serviceUserQuery.trim();
    if (!query)
      return setServiceUserNotice("表示名またはゲームIDを入力してください");
    setServiceUserNotice("");
    const params = new URLSearchParams({ q: query });
    if (serviceUserFilter) params.set("service", serviceUserFilter);
    const response = await fetch(`/api/admin/service-users?${params}`, {
        cache: "no-store",
      }),
      data = await response.json();
    if (!response.ok)
      return setServiceUserNotice(data.error || "検索できませんでした");
    setServiceUserResults(data.users || []);
  };
  const actServiceUser = async (
    target: ServiceAdminUser,
    action: "suspend" | "restore" | "delete",
  ) => {
    let confirmation: string | undefined;
    if (action === "delete") {
      const entered = window.prompt(
        `${target.displayName}さんの${target.serviceId}内データを完全に削除します。\n続けるには表示名を入力してください。`,
      );
      if (entered === null) return;
      confirmation = entered;
    } else if (
      action === "suspend" &&
      !window.confirm(
        `${target.displayName}さんを停止し、公開中の募集を終了しますか？`,
      )
    )
      return;
    setServiceUserBusy(target.id);
    setServiceUserNotice("");
    const response = await fetch("/api/admin/service-users", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          service: target.serviceId,
          profileId: target.id,
          action,
          confirmation,
        }),
      }),
      data = await response.json();
    setServiceUserBusy(0);
    if (!response.ok)
      return setServiceUserNotice(data.error || "操作できませんでした");
    setServiceUserResults((rows) =>
      action === "delete"
        ? rows.filter((row) => row.id !== target.id)
        : rows.map((row) =>
            row.id === target.id
              ? {
                  ...row,
                  suspendedAt: action === "suspend" ? data.suspendedAt : null,
                }
              : row,
          ),
    );
    setServiceUserNotice(`${target.displayName}さんの操作を完了しました`);
    load();
  };
  const searchUsers = async () => {
    const query = userQuery.trim();
    if (!query) {
      setUserResults([]);
      setUserSearchError("トレーナー名を入力してください");
      return;
    }
    setUserSearchLoading(true);
    setUserSearchError("");
    setUserSearchNotice("");
    try {
      const response = await fetch(
          `/api/admin/users?q=${encodeURIComponent(query)}`,
          { cache: "no-store" },
        ),
        data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "ユーザーを検索できませんでした");
      setUserResults(data.users || []);
    } catch (error) {
      setUserResults([]);
      setUserSearchError(
        error instanceof Error
          ? error.message
          : "ユーザーを検索できませんでした",
      );
    } finally {
      setUserSearchLoading(false);
    }
  };
  const actUser = async (target: AdminUser, action: "suspend" | "restore") => {
    if (
      action === "suspend" &&
      !window.confirm(
        `${target.trainerName}さんのアカウントを停止しますか？\n公開中の募集も終了します。`,
      )
    )
      return;
    setUserActionId(target.userId);
    setUserSearchError("");
    try {
      const response = await fetch("/api/admin/users", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ userId: target.userId, action }),
        }),
        data = await response.json();
      if (!response.ok) throw new Error(data.error || "操作できませんでした");
      setUserResults((rows) =>
        rows.map((row) =>
          row.userId === target.userId
            ? { ...row, suspendedAt: data.suspendedAt }
            : row,
        ),
      );
    } catch (error) {
      setUserSearchError(
        error instanceof Error ? error.message : "操作できませんでした",
      );
    } finally {
      setUserActionId("");
    }
  };
  const deleteUser = async (target: AdminUser) => {
    const confirmation = window.prompt(
      `${target.trainerName}さんのアカウントを完全に削除します。\nプロフィール・チャット・募集などは元に戻せません。\n\n続けるには「${target.trainerName}」と入力してください。`,
    );
    if (confirmation === null) return;
    if (confirmation !== target.trainerName) {
      setUserSearchError("トレーナー名が一致しないため削除しませんでした");
      return;
    }
    setUserActionId(target.userId);
    setUserSearchError("");
    setUserSearchNotice("");
    try {
      const response = await fetch("/api/admin/users", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            userId: target.userId,
            action: "delete",
            confirmation,
          }),
        }),
        data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "アカウントを削除できませんでした");
      setUserResults((rows) =>
        rows.filter((row) => row.userId !== target.userId),
      );
      setUserSearchNotice(
        `${target.trainerName}さんのアカウントを削除しました`,
      );
    } catch (error) {
      setUserSearchError(
        error instanceof Error
          ? error.message
          : "アカウントを削除できませんでした",
      );
    } finally {
      setUserActionId("");
    }
  };
  const maxVisitors = Math.max(
    1,
    ...(stats?.daily.map((day) => day.visitors) || []),
  );
  const visibleReports = reports.filter(
      (item) => showResolved || item.status !== "resolved",
    ),
    visibleTickets = tickets.filter(
      (item) => showResolved || item.status !== "resolved",
    );
  const logout = async () => {
    await fetch("/api/admin/session", { method: "DELETE" });
    location.reload();
  };
  return (
    <main className="adminPage">
      <header>
        <div>
          <small>YUNAMATCH ADMIN</small>
          <h1>運営ダッシュボード</h1>
        </div>
        <nav>
          <Link href="/">アプリへ戻る</Link>
          <button onClick={logout}>管理画面からログアウト</button>
        </nav>
      </header>
      <section className="adminServiceHub">
        <div className="adminSectionTitle">
          <div>
            <small>MULTI SERVICE CONTROL</small>
            <h2>サービス管理</h2>
          </div>
          <Link href="/legal">規約・安全センター</Link>
        </div>
        <p className="adminServiceLead">
          YUNAMATCHの既存データと新3サービスのデータを分離して管理します。
          {serviceSchemaReady
            ? "プロフィール・検索・募集・マッチ・チャット基盤は接続済みです。"
            : "共通データ基盤は次回公開時に有効になります。"}
        </p>
        <div className="adminServiceGrid">
          <article className="live">
            <header>
              <b>Y</b>
              <span>
                <strong>YUNAMATCH</strong>
                <small>本番稼働中</small>
              </span>
              <em>LIVE</em>
            </header>
            <p>
              ユナイト版。下のアクセス・ユーザー・通報はこの本番データです。
            </p>
            <Link href="/">サイトを開く</Link>
          </article>
          <article className="review">
            <header>
              <b>V</b>
              <span>
                <strong>バロマッチ</strong>
                <small>Riot製品審査・登録確認中</small>
              </span>
              <em>REVIEW</em>
            </header>
            <p>
              実データ基盤への接続済み。Riot連携だけ審査完了後に有効化します。
            </p>
            <Link href="/valomatch">確認する</Link>
          </article>
          <article className="beta">
            <header>
              <b>S</b>
              <span>
                <strong>スタメイト</strong>
                <small>限定ベータ準備中</small>
              </span>
              <em>BETA</em>
            </header>
            <p>Supercell非公式表記を掲載し、独立データ基盤へ接続済みです。</p>
            <Link href="/stamate">確認する</Link>
          </article>
          <article className="waiting">
            <header>
              <b>荘</b>
              <span>
                <strong>荘園メイト</strong>
                <small>NetEase回答待ち</small>
              </span>
              <em>HOLD</em>
            </header>
            <p>機能実装済み。書面回答待ちのため一般公開は停止しています。</p>
            <Link href="/shoenmate">確認する</Link>
          </article>
        </div>
        {serviceStats.length > 0 && (
          <div className="adminServiceMetrics">
            {serviceStats.map((service) => (
              <article key={service.id}>
                <strong>{service.name}</strong>
                <span>登録 {service.profiles}</span>
                <span>募集 {service.recruits}</span>
                <span>成立 {service.connections}</span>
                <span>チャット {service.messages}</span>
                <span className={service.openReports ? "alert" : ""}>
                  未対応通報 {service.openReports}
                </span>
              </article>
            ))}
          </div>
        )}
        {launchReadiness && (
          <div className="adminReadiness">
            <h3>公開準備チェック</h3>
            <article>
              <strong>全サービス共通</strong>
              <div>
                {launchReadiness.common.map((check) => (
                  <span className={check.ready ? "ok" : "missing"} key={check.label}>
                    {check.ready ? "✓" : "!"} {check.label}
                  </span>
                ))}
              </div>
            </article>
            {launchReadiness.services.map((service) => (
              <article key={service.id}>
                <strong>{service.name}</strong>
                <em>{service.ready ? "公開準備完了" : "未完了あり"}</em>
                <div>
                  {service.checks.map((check) => (
                    <span className={check.ready ? "ok" : "missing"} key={check.label}>
                      {check.ready ? "✓" : "!"} {check.label}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      <section>
        <div className="adminSectionTitle">
          <div>
            <small>MULTI SERVICE USERS</small>
            <h2>3サービスのユーザー検索</h2>
          </div>
        </div>
        <div className="adminUserSearchForm">
          <select
            value={serviceUserFilter}
            onChange={(event) => setServiceUserFilter(event.target.value)}
            aria-label="サービス"
          >
            <option value="">全サービス</option>
            <option value="valomatch">バロマッチ</option>
            <option value="stamate">スタメイト</option>
            <option value="shoenmate">荘園メイト</option>
          </select>
          <input
            value={serviceUserQuery}
            onChange={(event) => setServiceUserQuery(event.target.value)}
            onKeyDown={(event) =>
              event.key === "Enter" && void searchServiceUsers()
            }
            placeholder="表示名またはゲームID"
          />
          <button onClick={() => void searchServiceUsers()}>検索</button>
        </div>
        {serviceUserNotice && <p>{serviceUserNotice}</p>}
        <div className="adminUserSearchResults">
          {serviceUserResults.map((user) => (
            <article key={`${user.serviceId}-${user.id}`}>
              <div className="adminReportUser">
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt="" />
                ) : (
                  <span>{user.displayName.slice(0, 1)}</span>
                )}
                <div>
                  <strong>{user.displayName}</strong>
                  <small>
                    {user.serviceId}・{user.gameIdentity}・{user.skillTier}
                    ・通報 {user.reportCount}
                  </small>
                </div>
                <em className={user.suspendedAt ? "alert" : "onTime"}>
                  {user.suspendedAt ? "停止中" : "利用中"}
                </em>
              </div>
              <div>
                <button
                  disabled={serviceUserBusy === user.id}
                  onClick={() =>
                    void actServiceUser(
                      user,
                      user.suspendedAt ? "restore" : "suspend",
                    )
                  }
                >
                  {user.suspendedAt ? "停止を解除" : "アカウント停止"}
                </button>
                <button
                  className="danger"
                  disabled={serviceUserBusy === user.id}
                  onClick={() => void actServiceUser(user, "delete")}
                >
                  アカウント削除
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section>
        <div className="adminSectionTitle">
          <div>
            <small>MULTI SERVICE SAFETY</small>
            <h2>3サービスの通報</h2>
          </div>
          <button onClick={load}>更新</button>
        </div>
        <div className="adminQueueSummary">
          <span>
            未対応{" "}
            <b>
              {
                serviceReports.filter((item) => item.status !== "resolved")
                  .length
              }
            </b>
          </span>
          <small>通報された範囲だけを運営が確認します</small>
        </div>
        {serviceReports
          .filter((item) => showResolved || item.status !== "resolved")
          .map((report) => (
            <article key={`service-report-${report.id}`}>
              <div className="adminReportUser">
                {report.targetAvatarUrl ? (
                  <img src={report.targetAvatarUrl} alt="" />
                ) : (
                  <span>{report.targetName.slice(0, 1) || "?"}</span>
                )}
                <div>
                  <strong>{report.targetName}</strong>
                  <small>
                    {report.serviceId === "valomatch"
                      ? "バロマッチ"
                      : report.serviceId === "stamate"
                        ? "スタメイト"
                        : "荘園メイト"}
                    ・通報者 {report.reporterName}・
                    {new Date(report.createdAt).toLocaleString("ja-JP")}
                  </small>
                </div>
                <em
                  className={
                    report.status === "resolved" ? "resolved" : "onTime"
                  }
                >
                  {report.status === "resolved" ? "対応済み" : "未対応"}
                </em>
              </div>
              <h3>{report.reason}</h3>
              <p>{report.details || "詳細なし"}</p>
              {report.reportedContent && (
                <section className="adminReportedMessage">
                  <small>通報された発言</small>
                  <blockquote>{report.reportedContent}</blockquote>
                </section>
              )}
              <div>
                {report.status !== "resolved" && (
                  <button onClick={() => actServiceReport(report, "resolve")}>
                    対応済みにする
                  </button>
                )}
                {report.targetAvatarUrl && (
                  <button
                    onClick={() => actServiceReport(report, "removeImage")}
                  >
                    画像を削除
                  </button>
                )}
                <button
                  className="danger"
                  onClick={() =>
                    actServiceReport(
                      report,
                      report.targetSuspendedAt ? "restore" : "suspend",
                    )
                  }
                >
                  {report.targetSuspendedAt ? "停止を解除" : "アカウント停止"}
                </button>
              </div>
            </article>
          ))}
        {!serviceReports.length && <p>3サービスからの通報はありません。</p>}
      </section>
      <section>
        <div className="adminSectionTitle">
          <div>
            <small>ADMIN AUDIT</small>
            <h2>3サービスの管理操作ログ</h2>
          </div>
          <button onClick={load}>更新</button>
        </div>
        {serviceAuditLogs.slice(0, 100).map((log) => (
          <article key={`service-audit-${log.id}`}>
            <strong>{log.action}</strong>
            <p>{log.detail}</p>
            <small>
              {log.serviceId}・対象 #{log.targetProfileId || "-"}・通報 #
              {log.reportId || "-"}・
              {new Date(log.createdAt).toLocaleString("ja-JP")}
            </small>
          </article>
        ))}
        {!serviceAuditLogs.length && <p>管理操作ログはまだありません。</p>}
      </section>
      <section className="adminAnalytics">
        <div className="adminSectionTitle">
          <div>
            <small>ACCESS OVERVIEW</small>
            <h2>アクセス状況</h2>
          </div>
          <button onClick={load}>更新</button>
        </div>
        {loading || !stats ? (
          <p>集計中…</p>
        ) : (
          <>
            <div className="adminStatGrid">
              <article className="featured">
                <span>今日の訪問者</span>
                <strong>
                  {stats.totals.todayVisitors.toLocaleString()}
                  <small>人</small>
                </strong>
                <p>{stats.totals.todayViews.toLocaleString()}回アクセス</p>
              </article>
              <article>
                <span>累計訪問者</span>
                <strong>
                  {stats.totals.uniqueVisitors.toLocaleString()}
                  <small>人</small>
                </strong>
                <p>同じブラウザ・ログインは1人として集計</p>
              </article>
              <article>
                <span>累計アクセス</span>
                <strong>
                  {stats.totals.pageViews.toLocaleString()}
                  <small>回</small>
                </strong>
                <p>ページを開いた合計回数</p>
              </article>
              <article>
                <span>登録ユーザー</span>
                <strong>
                  {stats.totals.registeredUsers.toLocaleString()}
                  <small>人</small>
                </strong>
                <p>
                  ログイン済み訪問者{" "}
                  {stats.totals.signedInVisitors.toLocaleString()}人
                </p>
              </article>
            </div>
            <article className="adminChart">
              <div>
                <h3>直近14日間</h3>
                <p>1日ごとのユニーク訪問者</p>
              </div>
              <div className="adminBars">
                {stats.daily.length ? (
                  stats.daily.map((item) => (
                    <div key={item.day}>
                      <b>{item.visitors}</b>
                      <span
                        style={{
                          height: `${Math.max(8, (item.visitors / maxVisitors) * 100)}%`,
                        }}
                      />
                      <small>
                        {Number(item.day.slice(5, 7))}/
                        {Number(item.day.slice(8, 10))}
                      </small>
                    </div>
                  ))
                ) : (
                  <p>集計データはまだありません。</p>
                )}
              </div>
            </article>
            <article className="adminGenderCard">
              <div>
                <h3>登録ユーザーの男女比</h3>
                <p>プロフィールに登録された性別で集計</p>
              </div>
              <div className="adminGenderNumbers">
                <span className="male">
                  <b>男子 {stats.demographics.maleRate.toFixed(1)}%</b>
                  <small>{stats.demographics.male}人</small>
                </span>
                <span className="female">
                  <b>女子 {stats.demographics.femaleRate.toFixed(1)}%</b>
                  <small>{stats.demographics.female}人</small>
                </span>
              </div>
              <div
                className="adminGenderBar"
                aria-label={`男子${stats.demographics.maleRate.toFixed(1)}%、女子${stats.demographics.femaleRate.toFixed(1)}%`}
              >
                <i style={{ width: `${stats.demographics.maleRate}%` }} />
                <i style={{ width: `${stats.demographics.femaleRate}%` }} />
              </div>
              <small>合計 {stats.demographics.total}人</small>
            </article>
            <div className="adminFunnel">
              <article>
                <span>訪問 → 登録</span>
                <strong>{rate(stats.funnel.visitToRegistration)}</strong>
                <small>
                  {stats.totals.registeredUsers}/{stats.totals.uniqueVisitors}人
                </small>
              </article>
              <b>›</b>
              <article>
                <span>登録 → 募集</span>
                <strong>{rate(stats.funnel.registrationToRecruit)}</strong>
                <small>{stats.funnel.counts.recruiters}人が募集</small>
              </article>
              <b>›</b>
              <article>
                <span>募集 → 申請あり</span>
                <strong>{rate(stats.funnel.recruitToApplication)}</strong>
                <small>{stats.funnel.counts.recruitsWithApplication}件</small>
              </article>
              <b>›</b>
              <article>
                <span>申請 → 成立</span>
                <strong>{rate(stats.funnel.applicationToMatch)}</strong>
                <small>{stats.funnel.counts.matches}組</small>
              </article>
            </div>
            <div className="adminOutcomeGrid">
              <article>
                <span>成立後にチャット</span>
                <strong>{rate(stats.funnel.matchToChat)}</strong>
                <small>{stats.funnel.counts.chattedMatches}組</small>
              </article>
              <article>
                <span>プレイ完了</span>
                <strong>{rate(stats.funnel.matchToFinishedPlay)}</strong>
                <small>{stats.funnel.counts.finishedPlays}回</small>
              </article>
              <article>
                <span>相互また遊びたい</span>
                <strong>{rate(stats.funnel.matchToMutualAgain)}</strong>
                <small>{stats.funnel.counts.mutualAgain}組</small>
              </article>
              <article>
                <span>初回申請まで</span>
                <strong>
                  {stats.speed.sampleSize
                    ? `${stats.speed.averageMinutes}分`
                    : "—"}
                </strong>
                <small>15分以内 {rate(stats.speed.within15Rate)}</small>
              </article>
              <article>
                <span>翌日再訪 D1</span>
                <strong>{rate(stats.retention.d1.rate)}</strong>
                <small>対象 {stats.retention.d1.eligible}人</small>
              </article>
              <article>
                <span>7日後再訪 D7</span>
                <strong>{rate(stats.retention.d7.rate)}</strong>
                <small>対象 {stats.retention.d7.eligible}人</small>
              </article>
            </div>
            <div className="adminActivityGrid">
              <article>
                <span>募集作成</span>
                <strong>{stats.totals.recruits.toLocaleString()}</strong>
              </article>
              <article>
                <span>プレイ申請</span>
                <strong>{stats.totals.applications.toLocaleString()}</strong>
              </article>
            </div>
            <div className="adminBackup">
              <div>
                <strong>運営バックアップ</strong>
                <p>
                  プロフィール・募集・マッチ・通報・アクセス集計をJSONで保存します。
                </p>
              </div>
              <a href="/api/admin/export">バックアップをダウンロード</a>
            </div>
            <p className="adminMetricNote">
              再訪率は同じブラウザの識別情報で集計します。IPアドレスや閲覧ページの履歴は保存していません。
            </p>
          </>
        )}
      </section>
      <section className="adminUserManager">
        <div className="adminSectionTitle">
          <div>
            <small>USER MANAGEMENT</small>
            <h2>ユーザー検索</h2>
          </div>
        </div>
        <p className="adminUserLead">
          トレーナー名から登録ユーザーを検索し、同名候補を確認できます。
        </p>
        <form
          className="adminUserSearch"
          onSubmit={(event) => {
            event.preventDefault();
            void searchUsers();
          }}
        >
          <input
            value={userQuery}
            onChange={(event) => setUserQuery(event.target.value)}
            placeholder="トレーナー名を入力（例：桜みく）"
            aria-label="トレーナー名で検索"
            maxLength={40}
          />
          <button type="submit" disabled={userSearchLoading}>
            {userSearchLoading ? "検索中…" : "検索"}
          </button>
        </form>
        {userSearchError && (
          <p className="adminUserSearchError" role="alert">
            {userSearchError}
          </p>
        )}
        {userSearchNotice && (
          <p className="adminUserSearchNotice" role="status">
            {userSearchNotice}
          </p>
        )}
        {!userSearchLoading &&
          userQuery.trim() &&
          !userSearchError &&
          !userResults.length && (
            <p className="adminUserEmpty">一致する登録ユーザーはいません。</p>
          )}
        <div className="adminUserResults">
          {userResults.map((user) => (
            <article
              className={`adminUserCard${user.suspendedAt ? " suspended" : ""}`}
              key={user.userId}
            >
              <div className="adminReportUser">
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt="" />
                ) : (
                  <span>{user.trainerName.slice(0, 1) || "?"}</span>
                )}
                <div>
                  <strong>{user.trainerName}</strong>
                  <small>
                    {user.gender || "性別未設定"} ・{" "}
                    {user.age ? `${user.age}歳` : "年齢未設定"} ・{" "}
                    {user.highestRate || "レート未設定"}
                  </small>
                </div>
                <em className={user.suspendedAt ? "overdue" : "resolved"}>
                  {user.suspendedAt ? "停止中" : "利用中"}
                </em>
              </div>
              <div className="adminUserDetails">
                <span>
                  メイン{" "}
                  {user.mainPokemon.length
                    ? user.mainPokemon.join("・")
                    : "未設定"}
                </span>
                <span>ログイン {user.authProvider || "不明"}</span>
                <span>通報 {user.reportCount}人</span>
              </div>
              <p>
                登録 {new Date(user.createdAt).toLocaleString("ja-JP")} ・ 更新{" "}
                {new Date(user.updatedAt).toLocaleString("ja-JP")}
              </p>
              <div>
                <button
                  className={user.suspendedAt ? "" : "danger"}
                  disabled={userActionId === user.userId}
                  onClick={() =>
                    actUser(user, user.suspendedAt ? "restore" : "suspend")
                  }
                >
                  {userActionId === user.userId
                    ? "処理中…"
                    : user.suspendedAt
                      ? "停止を解除"
                      : "アカウント停止"}
                </button>
                <button
                  className="deleteDanger"
                  disabled={userActionId === user.userId}
                  onClick={() => deleteUser(user)}
                >
                  アカウント削除
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section>
        <div className="adminSectionTitle">
          <div>
            <small>SAFETY & SUPPORT</small>
            <h2>対応キュー</h2>
          </div>
          <label className="adminResolvedToggle">
            <input
              type="checkbox"
              checked={showResolved}
              onChange={(event) => setShowResolved(event.target.checked)}
            />
            対応済みも表示
          </label>
        </div>
        {!loading && flaggedUsers.length > 0 && (
          <div className="adminFlaggedSection">
            <div className="adminFlaggedHeading">
              <div>
                <small>PRIORITY REVIEW</small>
                <h3>5件以上の要確認ユーザー</h3>
              </div>
              <b>{flaggedUsers.length}人</b>
            </div>
            {flaggedUsers.map((target) => (
              <article
                className="adminFlaggedUser"
                key={`flagged-${target.targetId}`}
              >
                <div className="adminReportUser">
                  {target.avatarUrl ? (
                    <img src={target.avatarUrl} alt="" />
                  ) : (
                    <span>{target.targetName?.slice(0, 1) || "?"}</span>
                  )}
                  <div>
                    <strong>{target.targetName || "退会ユーザー"}</strong>
                    <small>
                      最終通報{" "}
                      {new Date(target.lastReportedAt).toLocaleString("ja-JP")}
                    </small>
                  </div>
                  <em className="overdue">要確認</em>
                </div>
                <div className="adminFlaggedCounts">
                  <strong>
                    {target.reportCount}
                    <small>人から通報</small>
                  </strong>
                  <span>未対応 {target.openCount}件</span>
                </div>
                <p>
                  下の通報一覧で理由と、チャットからの通報かどうかを確認できます。
                </p>
                <div>
                  <button
                    className="danger"
                    onClick={() =>
                      actTarget(
                        target,
                        target.suspendedAt ? "restore" : "suspend",
                      )
                    }
                  >
                    {target.suspendedAt ? "停止を解除" : "アカウント停止"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
        <div className="adminQueueSummary">
          <span>
            5件以上の要確認 <b>{flaggedUsers.length}</b>
          </span>
          <span>
            未対応の通報{" "}
            <b>{reports.filter((item) => item.status !== "resolved").length}</b>
          </span>
          <span>
            未対応のお問い合わせ{" "}
            <b>{tickets.filter((item) => item.status !== "resolved").length}</b>
          </span>
          <small>原則24時間以内に確認</small>
        </div>
        {loading ? (
          <p>読み込み中…</p>
        ) : (
          <>
            {visibleReports.map((report) => (
              <article key={`report-${report.id}`}>
                <div className="adminReportUser">
                  {report.avatarUrl ? (
                    <img src={report.avatarUrl} alt="" />
                  ) : (
                    <span>{report.targetName?.slice(0, 1) || "?"}</span>
                  )}
                  <div>
                    <strong>{report.targetName || "退会ユーザー"}</strong>
                    <small>
                      {new Date(report.createdAt).toLocaleString("ja-JP")} ・{" "}
                      {report.messageId
                        ? "発言を通報"
                        : report.connectionId
                          ? "チャットから通報"
                          : report.recruitId
                            ? "募集から通報"
                            : "通報"}
                    </small>
                  </div>
                  <em
                    className={
                      report.status === "resolved"
                        ? "resolved"
                        : ageHours(report.createdAt) >= 24
                          ? "overdue"
                          : "onTime"
                    }
                  >
                    {report.status === "resolved"
                      ? "対応済み"
                      : ageHours(report.createdAt) >= 24
                        ? "24時間超過"
                        : `残り約${24 - ageHours(report.createdAt)}時間`}
                  </em>
                </div>
                <h3>{report.reason}</h3>
                <p>{report.details || "詳細なし"}</p>
                {report.reportedContent && (
                  <section className="adminReportedMessage">
                    <small>通報された発言</small>
                    <blockquote>{report.reportedContent}</blockquote>
                  </section>
                )}
                {report.conversationContext.length > 0 && (
                  <details className="adminConversation" open>
                    <summary>
                      前後の会話を確認（{report.conversationContext.length}件）
                    </summary>
                    <div>
                      {report.conversationContext.map((message) => (
                        <div
                          key={`${report.id}-${message.id}`}
                          className={message.isReported ? "reported" : ""}
                        >
                          <header>
                            <strong>{message.senderName}</strong>
                            <time>
                              {new Date(message.createdAt).toLocaleString(
                                "ja-JP",
                              )}
                            </time>
                          </header>
                          <p>{message.body}</p>
                          {message.isReported && <small>通報対象</small>}
                        </div>
                      ))}
                    </div>
                  </details>
                )}
                <div>
                  {report.status !== "resolved" && (
                    <button onClick={() => act(report, "resolve")}>
                      対応済みにする
                    </button>
                  )}
                  {report.avatarUrl && (
                    <button onClick={() => act(report, "removeImage")}>
                      画像を削除
                    </button>
                  )}
                  <button
                    className="danger"
                    onClick={() =>
                      act(report, report.suspendedAt ? "restore" : "suspend")
                    }
                  >
                    {report.suspendedAt ? "停止を解除" : "アカウント停止"}
                  </button>
                </div>
              </article>
            ))}
            {visibleTickets.map((ticket) => (
              <article key={`ticket-${ticket.id}`}>
                <div className="adminReportUser">
                  <span>?</span>
                  <div>
                    <strong>{ticket.trainerName}</strong>
                    <small>
                      {new Date(ticket.createdAt).toLocaleString("ja-JP")} ・{" "}
                      {ticket.category}
                    </small>
                  </div>
                  <em
                    className={
                      ticket.status === "resolved"
                        ? "resolved"
                        : ageHours(ticket.createdAt) >= 24
                          ? "overdue"
                          : "onTime"
                    }
                  >
                    {ticket.status === "resolved"
                      ? "対応済み"
                      : ageHours(ticket.createdAt) >= 24
                        ? "24時間超過"
                        : `残り約${24 - ageHours(ticket.createdAt)}時間`}
                  </em>
                </div>
                <p>{ticket.message}</p>
                <div>
                  <button
                    onClick={() =>
                      actTicket(
                        ticket,
                        ticket.status === "resolved" ? "reopen" : "resolve",
                      )
                    }
                  >
                    {ticket.status === "resolved"
                      ? "未対応に戻す"
                      : "対応済みにする"}
                  </button>
                </div>
              </article>
            ))}
            {!visibleReports.length && !visibleTickets.length && (
              <p>未対応の通報・お問い合わせはありません。</p>
            )}
          </>
        )}
      </section>
    </main>
  );
}
