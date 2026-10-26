import { useCallback, useEffect, useState } from "react";
import {
  AppState,
  Linking,
  PermissionsAndroid,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  useColorScheme,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { PaymentListener, type ListenerSettings, type LogEntry } from "./modules/payment-listener";

/** 서버 응답/전송 결과 코드를 사람 말로 */
function describe(result: string): { text: string; tone: "ok" | "warn" | "muted" } {
  if (result === "PARSED") return { text: "기록됨", tone: "ok" };
  if (result === "CANCEL_MATCHED") return { text: "취소 반영", tone: "ok" };
  if (result === "DUPLICATE" || result === "ALREADY_SEEN") return { text: "이미 받음", tone: "muted" };
  if (result === "SKIPPED") return { text: "결제 아님", tone: "muted" };
  if (result.startsWith("QUEUED")) return { text: "보낼 준비 중", tone: "warn" };
  return { text: result, tone: "muted" };
}

function ago(at: number) {
  const m = Math.floor((Date.now() - at) / 60000);
  if (m < 1) return "방금";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

export default function App() {
  const dark = useColorScheme() === "dark";
  const c = dark ? DARK : LIGHT;
  const [settings, setSettings] = useState<ListenerSettings>(() => PaymentListener.getSettings());
  const [granted, setGranted] = useState(false);
  const [battery, setBattery] = useState(true);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [queued, setQueued] = useState(0);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const saved = PaymentListener.getSettings();
  const configured = !!saved.serverUrl && !!saved.token;
  const [editing, setEditing] = useState(!configured);

  const refresh = useCallback(() => {
    setGranted(PaymentListener.isPermissionGranted());
    setBattery(PaymentListener.isIgnoringBatteryOptimizations());
    setLog(PaymentListener.getLog());
    setQueued(PaymentListener.getQueueSize());
  }, []);

  useEffect(() => {
    refresh();
    // 큰 지출 알림 띄우려면 Android 13+ 알림 권한 필요
    if (Platform.OS === "android" && Number(Platform.Version) >= 33) {
      PermissionsAndroid.request("android.permission.POST_NOTIFICATIONS");
    }
    // 설정 화면 갔다가 돌아오면 상태 갱신 + 서비스 재연결 보정
    const sub = AppState.addEventListener("change", (s) => {
      if (s !== "active") return;
      refresh();
      if (PaymentListener.isPermissionGranted()) PaymentListener.requestRebind();
    });
    const timer = setInterval(refresh, 5000);
    return () => {
      sub.remove();
      clearInterval(timer);
    };
  }, [refresh]);

  const set = (patch: Partial<ListenerSettings>) => setSettings((s) => ({ ...s, ...patch }));

  const onSave = async () => {
    setBusy(true);
    PaymentListener.saveSettings(settings);
    const result = await PaymentListener.testConnection();
    setMsg(result);
    setBusy(false);
    if (good(result)) setEditing(false);
  };

  const onFlush = async () => {
    try {
      const n = await PaymentListener.flushQueue();
      setMsg(n ? `밀린 ${n}건 보냄` : "밀린 결제가 없어요");
    } catch (e) {
      setMsg(`보내지 못했어요: ${(e as Error).message}`);
    }
    refresh();
  };

  const good = (t: string) => t.includes("OK") || t.includes("완료") || t.includes("보냄");

  // 지금 제일 먼저 해야 할 것 하나
  const lastSent = log.find((l) => !l.result.startsWith("QUEUED"));
  const state: { icon: string; title: string; body: string; tone: "ok" | "warn" | "bad" } = !granted
    ? { icon: "🔔", title: "알림 접근을 허용해 주세요", body: "그래야 카드·은행 결제 알림을 읽어서 자동으로 기록할 수 있어요", tone: "bad" }
    : !configured
      ? { icon: "🔌", title: "서버 연결만 하면 끝나요", body: "아래에 서버 주소랑 토큰을 넣어 주세요", tone: "warn" }
      : queued > 0
        ? { icon: "📦", title: `결제 ${queued}건을 보관 중이에요`, body: "서버에 연결이 안 돼서 폰에 모아뒀어요. 연결되면 자동으로 보내요", tone: "warn" }
        : !battery
          ? { icon: "🔋", title: "잘 모으고 있지만 끊길 수 있어요", body: "배터리 최적화에서 빼야 며칠 뒤에도 안 놓쳐요", tone: "warn" }
          : {
              icon: "✅",
              title: "결제 알림을 모으고 있어요",
              body: lastSent ? `마지막으로 보낸 지 ${ago(lastSent.at)}` : "카드를 한 번 쓰면 아래에 바로 기록이 떠요",
              tone: "ok",
            };
  const toneColor = state.tone === "ok" ? c.ok : state.tone === "warn" ? c.warn : c.spend;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {/* 유리 카드 뒤에 비치는 색 번짐 (블러 대신 큰 반투명 원) */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={[s.blob, { backgroundColor: c.blob1, top: -120, left: -100 }]} />
        <View style={[s.blob, { backgroundColor: c.blob2, top: 60, right: -140 }]} />
        <View style={[s.blob, { backgroundColor: c.blob3, bottom: -120, left: -60 }]} />
      </View>
    <ScrollView contentContainerStyle={s.wrap}>
      <StatusBar style={dark ? "light" : "dark"} />
      <Text style={[s.brand, { color: c.ink }]}>결혼자금</Text>

      <View style={[s.hero, { backgroundColor: c.cover, borderColor: c.coverEdge }]}>
        <View style={[s.badge, { backgroundColor: c.coverChip }]}>
          <View style={[s.dot, { backgroundColor: toneColor }]} />
          <Text style={{ color: c.coverInk, fontSize: 13, fontWeight: "700" }}>
            {state.tone === "ok" ? "정상" : state.tone === "warn" ? "확인 필요" : "설정 필요"}
          </Text>
        </View>
        <Text style={[s.heroTitle, { color: c.coverInk }]}>
          {state.icon} {state.title}
        </Text>
        <Text style={[s.heroBody, { color: c.coverSub }]}>{state.body}</Text>
        {!granted && (
          <Btn c={c} onPress={PaymentListener.openPermissionSettings} onCover>
            설정에서 &apos;결혼자금&apos; 허용하기
          </Btn>
        )}
        {granted && configured && queued > 0 && (
          <Btn c={c} onPress={onFlush} onCover>
            지금 다시 보내기
          </Btn>
        )}
        {granted && configured && queued === 0 && (
          <Btn c={c} onPress={() => Linking.openURL(saved.serverUrl)} onCover>
            대시보드 열기
          </Btn>
        )}
      </View>

      {granted && !battery && (
        <Card c={c}>
          <Text style={[s.cardTitle, { color: c.ink }]}>🔋 배터리 최적화에서 빼 주세요</Text>
          <Text style={[s.hint, { color: c.sub }]}>
            갤럭시는 안 쓰는 앱을 재워서 며칠 뒤 알림 수집이 끊겨요.{"\n"}1. 앱 정보 → 배터리 → &apos;제한 없음&apos;{"\n"}2. 설정 → 배터리 → 백그라운드 사용 한도
            → &apos;사용하지 않는 앱&apos;·&apos;딥 슬립&apos; 목록에서 빼기
          </Text>
          <Btn c={c} outline onPress={PaymentListener.openBatterySettings}>
            배터리 설정 열기
          </Btn>
        </Card>
      )}

      <Card c={c}>
        <Pressable style={s.row} onPress={() => configured && setEditing((v) => !v)} disabled={!configured}>
          <View style={{ flex: 1 }}>
            <Text style={[s.cardTitle, { color: c.ink }]}>🔌 서버 연결</Text>
            {!editing && (
              <Text style={[s.hint, { color: c.sub }]} numberOfLines={1}>
                {saved.serverUrl.replace(/^https?:\/\//, "")}
                {saved.memberName ? `, ${saved.memberName}` : ""}
              </Text>
            )}
          </View>
          {configured && <Text style={{ color: c.save, fontWeight: "700" }}>{editing ? "닫기" : "수정"}</Text>}
        </Pressable>
        {editing && (
          <View style={{ gap: 2, marginTop: 6 }}>
            <Field c={c} label="서버 주소" value={settings.serverUrl} onChangeText={(v) => set({ serverUrl: v })} placeholder="https://money.example.com" keyboardType="url" />
            <Field c={c} label="토큰" hint="대시보드 설정 화면에 안내돼 있어요" value={settings.token} onChangeText={(v) => set({ token: v })} secureTextEntry />
            <Field c={c} label="내 이름" hint="둘이 같이 쓰면 각자 다르게" value={settings.memberName} onChangeText={(v) => set({ memberName: v })} placeholder="민준" />
            <View style={[s.row, { paddingVertical: 6 }]}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={{ color: c.ink, fontSize: 15 }}>카톡 알림톡도 받기</Text>
                <Text style={[s.hint, { color: c.sub }]}>카드사·은행 채널만 봐요. 친구 대화는 안 보내요</Text>
              </View>
              <Switch value={settings.includeKakao} onValueChange={(v) => set({ includeKakao: v })} />
            </View>
            <Btn c={c} onPress={onSave} disabled={busy || !settings.serverUrl || !settings.token}>
              {busy ? "연결 확인하는 중…" : "저장하고 연결 확인"}
            </Btn>
          </View>
        )}
        {!!msg && <Text style={[s.msg, { color: good(msg) ? c.save : c.spend }]}>{msg}</Text>}
      </Card>

      <View>
        <Text style={[s.sectionTitle, { color: c.ink }]}>최근 보낸 결제</Text>
        <Card c={c}>
          {log.length === 0 ? (
            <Text style={[s.hint, { color: c.sub, textAlign: "center", paddingVertical: 16, fontSize: 14 }]}>
              아직 보낸 결제가 없어요.{"\n"}카드를 쓰면 몇 초 안에 여기 떠요
            </Text>
          ) : (
            log.slice(0, 15).map((l, i) => {
              const d = describe(l.result);
              return (
                <View key={`${l.at}-${i}`} style={[s.logRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: c.line }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: c.ink, fontSize: 14 }} numberOfLines={1}>
                      {l.preview}
                    </Text>
                    <Text style={{ color: c.sub, fontSize: 12, marginTop: 2 }}>{ago(l.at)}</Text>
                  </View>
                  <View
                    style={[
                      s.pill,
                      { backgroundColor: d.tone === "ok" ? c.saveSoft : d.tone === "warn" ? c.warnSoft : c.fill },
                    ]}
                  >
                    <Text style={{ color: d.tone === "ok" ? c.save : d.tone === "warn" ? c.warn : c.sub, fontSize: 12, fontWeight: "700" }}>
                      {d.text}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </Card>
      </View>

      <Text style={[s.hint, { color: c.sub, textAlign: "center", paddingHorizontal: 12 }]}>
        🔒 금액과 결제·입금 단어가 같이 있는 알림만 서버로 보내요.{"\n"}다른 알림은 폰 밖으로 나가지 않아요
      </Text>
    </ScrollView>
    </View>
  );
}

type Colors = typeof LIGHT;

function Card({ c, children }: { c: Colors; children: React.ReactNode }) {
  return <View style={[s.card, { backgroundColor: c.card, borderColor: c.edge }]}>{children}</View>;
}

function Field({ c, label, hint, ...props }: { c: Colors; label: string; hint?: string } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={{ color: c.sub, fontSize: 12, marginBottom: 4 }}>
        {label}
        {hint ? <Text style={{ color: c.faint }}>{`  ${hint}`}</Text> : null}
      </Text>
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        placeholderTextColor={c.faint}
        style={[s.input, { color: c.ink, backgroundColor: c.fill }]}
        {...props}
      />
    </View>
  );
}

function Btn({
  c,
  children,
  onPress,
  outline,
  onCover,
  disabled,
}: {
  c: Colors;
  children: React.ReactNode;
  onPress: () => void;
  outline?: boolean;
  onCover?: boolean;
  disabled?: boolean;
}) {
  const bg = onCover ? c.coverInk : outline ? c.fill : c.accent;
  const fg = onCover ? c.coverBtnInk : outline ? c.ink : "#ffffff";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [s.btn, { backgroundColor: bg }, (pressed || disabled) && { opacity: 0.55 }]}
    >
      <Text style={{ color: fg, fontWeight: "700", fontSize: 15 }}>{children}</Text>
    </Pressable>
  );
}

// 대시보드와 같은 유리 톤 (은은한 색 번짐 + 반투명 카드, 저축 파랑 / 지출 빨강)
const LIGHT = {
  bg: "#eef1f7",
  card: "rgba(255,255,255,0.72)",
  edge: "rgba(255,255,255,0.9)",
  fill: "rgba(16,24,43,0.05)",
  ink: "#10182b",
  sub: "#5b6577",
  faint: "#8b94a5",
  line: "rgba(16,24,43,0.08)",
  save: "#2563eb",
  saveSoft: "rgba(37,99,235,0.12)",
  accent: "#2563eb",
  ok: "#22c55e",
  spend: "#e0384b",
  warn: "#c27410",
  warnSoft: "rgba(194,116,16,0.13)",
  cover: "#4f5ee8",
  coverEdge: "rgba(255,255,255,0.35)",
  coverChip: "rgba(255,255,255,0.18)",
  coverInk: "#ffffff",
  coverSub: "rgba(255,255,255,0.82)",
  coverBtnInk: "#3b4fd8",
  blob1: "rgba(125,160,255,0.22)",
  blob2: "rgba(255,170,200,0.2)",
  blob3: "rgba(150,220,255,0.2)",
};
const DARK: Colors = {
  bg: "#070b14",
  card: "rgba(30,38,54,0.72)",
  edge: "rgba(255,255,255,0.08)",
  fill: "rgba(255,255,255,0.06)",
  ink: "#eef2f8",
  sub: "#a3adbd",
  faint: "#6f7a8b",
  line: "rgba(255,255,255,0.08)",
  save: "#6ea0ff",
  saveSoft: "rgba(110,160,255,0.16)",
  accent: "#3d6fe6",
  ok: "#4ade80",
  spend: "#ff6b7a",
  warn: "#f0b04f",
  warnSoft: "rgba(240,176,79,0.15)",
  cover: "#3a43b8",
  coverEdge: "rgba(255,255,255,0.15)",
  coverChip: "rgba(255,255,255,0.14)",
  coverInk: "#ffffff",
  coverSub: "rgba(255,255,255,0.78)",
  coverBtnInk: "#2f3aa6",
  blob1: "rgba(60,90,200,0.22)",
  blob2: "rgba(160,60,120,0.16)",
  blob3: "rgba(30,110,160,0.18)",
};

const s = StyleSheet.create({
  wrap: { padding: 16, paddingTop: 56, paddingBottom: 48, gap: 16 },
  brand: { fontSize: 30, fontWeight: "800", letterSpacing: -0.8, paddingHorizontal: 4, marginBottom: 2 },
  blob: { position: "absolute", width: 360, height: 360, borderRadius: 180 },
  hero: { borderRadius: 28, padding: 22, gap: 10, borderWidth: 1 },
  badge: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  heroTitle: { fontSize: 22, fontWeight: "800", letterSpacing: -0.4 },
  heroBody: { fontSize: 15, lineHeight: 22, marginBottom: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  card: { borderRadius: 24, padding: 18, gap: 10, borderWidth: 1 },
  cardTitle: { fontSize: 17, fontWeight: "700" },
  sectionTitle: { fontSize: 17, fontWeight: "700", marginBottom: 10, paddingHorizontal: 6 },
  hint: { fontSize: 13, lineHeight: 20 },
  input: { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  row: { flexDirection: "row", alignItems: "center" },
  btn: { borderRadius: 999, paddingVertical: 15, alignItems: "center" },
  msg: { fontWeight: "700", textAlign: "center", marginTop: 4 },
  logRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12 },
  pill: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4, marginLeft: 8 },
});
