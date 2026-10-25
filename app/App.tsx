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
  if (result === "DUPLICATE" || result === "ALREADY_SEEN") return { text: "이미 받은 결제", tone: "muted" };
  if (result === "SKIPPED") return { text: "결제 알림 아님", tone: "muted" };
  if (result.startsWith("QUEUED")) return { text: "서버 연결 안 돼서 대기 중", tone: "warn" };
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
      setMsg(n ? `밀린 ${n}건 보냄` : "밀린 결제 없음");
    } catch (e) {
      setMsg(`보내기 실패: ${(e as Error).message}`);
    }
    refresh();
  };

  const good = (t: string) => t.includes("OK") || t.includes("완료") || t.includes("보냄");

  // 지금 제일 먼저 해야 할 것 하나
  const lastSent = log.find((l) => !l.result.startsWith("QUEUED"));
  const state: { title: string; body: string; tone: "ok" | "warn" | "bad" } = !granted
    ? { title: "알림 접근이 꺼져 있어", body: "이걸 켜야 카드·은행 결제 알림을 읽을 수 있어", tone: "bad" }
    : !configured
      ? { title: "서버 연결만 남았어", body: "아래에 서버 주소랑 토큰을 넣어줘", tone: "warn" }
      : queued > 0
        ? { title: `결제 ${queued}건이 대기 중`, body: "서버에 연결이 안 돼서 폰에 모아뒀어. 연결되면 자동으로 보내", tone: "warn" }
        : !battery
          ? { title: "수집 중, 근데 끊길 수 있어", body: "배터리 최적화에서 빼야 며칠 뒤에도 안 놓쳐", tone: "warn" }
          : {
              title: "결제 알림 수집 중",
              body: lastSent ? `마지막 전송 ${ago(lastSent.at)}` : "카드 한 번 긁으면 여기 기록이 떠",
              tone: "ok",
            };
  const toneColor = state.tone === "ok" ? c.save : state.tone === "warn" ? c.warn : c.spend;

  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={s.wrap}>
      <StatusBar style={dark ? "light" : "dark"} />
      <Text style={[s.brand, { color: c.sub }]}>결혼자금</Text>

      <View style={[s.hero, { backgroundColor: c.cover }]}>
        <View style={s.row}>
          <View style={[s.dot, { backgroundColor: toneColor }]} />
          <Text style={[s.heroTitle, { color: c.coverInk }]}>{state.title}</Text>
        </View>
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
          <Text style={[s.cardTitle, { color: c.ink }]}>배터리 최적화에서 빼기</Text>
          <Text style={[s.hint, { color: c.sub }]}>
            갤럭시는 안 쓰는 앱을 재워서 알림 수집이 며칠 뒤 끊겨. 앱 정보 → 배터리 → &apos;제한 없음&apos;, 그리고 설정 → 배터리 → 백그라운드 사용 한도에서
            &apos;사용하지 않는 앱&apos;·&apos;딥 슬립&apos; 목록에서 빼줘
          </Text>
          <Btn c={c} outline onPress={PaymentListener.openBatterySettings}>
            배터리 설정 열기
          </Btn>
        </Card>
      )}

      <Card c={c}>
        <Pressable style={s.row} onPress={() => configured && setEditing((v) => !v)} disabled={!configured}>
          <View style={{ flex: 1 }}>
            <Text style={[s.cardTitle, { color: c.ink }]}>서버 연결</Text>
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
            <Field c={c} label="토큰" hint="서버 .env의 INGEST_TOKEN 값" value={settings.token} onChangeText={(v) => set({ token: v })} secureTextEntry />
            <Field c={c} label="내 이름" hint="둘이 같이 쓰면 각자 다르게" value={settings.memberName} onChangeText={(v) => set({ memberName: v })} placeholder="민준" />
            <View style={[s.row, { paddingVertical: 6 }]}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={{ color: c.ink, fontSize: 15 }}>카톡 알림톡도 받기</Text>
                <Text style={[s.hint, { color: c.sub }]}>카드사·은행 채널만. 친구 대화는 안 보내</Text>
              </View>
              <Switch value={settings.includeKakao} onValueChange={(v) => set({ includeKakao: v })} />
            </View>
            <Btn c={c} onPress={onSave} disabled={busy || !settings.serverUrl || !settings.token}>
              {busy ? "연결 확인 중…" : "저장하고 연결 확인"}
            </Btn>
          </View>
        )}
        {!!msg && <Text style={[s.msg, { color: good(msg) ? c.save : c.spend }]}>{msg}</Text>}
      </Card>

      <View>
        <Text style={[s.sectionTitle, { color: c.ink }]}>최근 보낸 결제</Text>
        <Card c={c}>
          {log.length === 0 ? (
            <Text style={[s.hint, { color: c.sub, textAlign: "center", paddingVertical: 12 }]}>
              아직 없어. 카드 한 번 긁으면 몇 초 안에 여기 떠
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
                  <Text
                    style={{
                      color: d.tone === "ok" ? c.save : d.tone === "warn" ? c.warn : c.sub,
                      fontSize: 12,
                      fontWeight: "700",
                      marginLeft: 8,
                    }}
                  >
                    {d.text}
                  </Text>
                </View>
              );
            })
          )}
        </Card>
      </View>

      <Text style={[s.hint, { color: c.sub, textAlign: "center", paddingHorizontal: 12 }]}>
        금액과 결제·입금 단어가 같이 있는 알림만 서버로 가. 나머지 알림은 폰 밖으로 안 나가
      </Text>
    </ScrollView>
  );
}

type Colors = typeof LIGHT;

function Card({ c, children }: { c: Colors; children: React.ReactNode }) {
  return <View style={[s.card, { backgroundColor: c.card }]}>{children}</View>;
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
        style={[s.input, { color: c.ink, backgroundColor: c.bg }]}
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
  const bg = onCover ? c.coverInk : outline ? c.bg : c.ink;
  const fg = onCover ? c.cover : outline ? c.ink : c.card;
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

// 대시보드와 같은 통장 톤 (차가운 종이 + 남색 표지, 입금 파랑 / 출금 빨강)
const LIGHT = {
  bg: "#edf0f4",
  card: "#ffffff",
  ink: "#142033",
  sub: "#5f6b7a",
  faint: "#8a95a3",
  line: "#dde2e9",
  save: "#1f5fd1",
  spend: "#d43c4c",
  warn: "#b7791f",
  cover: "#17284a",
  coverInk: "#f3f6fb",
  coverSub: "#9fb0cc",
};
const DARK: Colors = {
  bg: "#0e131a",
  card: "#171d26",
  ink: "#e8edf3",
  sub: "#96a2b2",
  faint: "#6b7686",
  line: "#263040",
  save: "#6f9dff",
  spend: "#ff6b78",
  warn: "#e0a84a",
  cover: "#1b2a47",
  coverInk: "#eef2f8",
  coverSub: "#8fa1c0",
};

const s = StyleSheet.create({
  wrap: { padding: 16, paddingTop: 52, paddingBottom: 40, gap: 14 },
  brand: { fontSize: 15, fontWeight: "700", paddingHorizontal: 4 },
  hero: { borderRadius: 20, padding: 20, gap: 8 },
  heroTitle: { fontSize: 21, fontWeight: "800", flexShrink: 1 },
  heroBody: { fontSize: 14, lineHeight: 20, marginBottom: 6 },
  dot: { width: 9, height: 9, borderRadius: 5, marginRight: 10 },
  card: { borderRadius: 16, padding: 16, gap: 8 },
  cardTitle: { fontSize: 16, fontWeight: "700" },
  sectionTitle: { fontSize: 15, fontWeight: "700", marginBottom: 8, paddingHorizontal: 4 },
  hint: { fontSize: 12, lineHeight: 18 },
  input: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15 },
  row: { flexDirection: "row", alignItems: "center" },
  btn: { borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  msg: { fontWeight: "700", textAlign: "center", marginTop: 4 },
  logRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10 },
});
