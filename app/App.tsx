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

  const refresh = useCallback(() => {
    setGranted(PaymentListener.isPermissionGranted());
    setBattery(PaymentListener.isIgnoringBatteryOptimizations());
    setLog(PaymentListener.getLog());
    setQueued(PaymentListener.getQueueSize());
  }, []);

  useEffect(() => {
    refresh();
    // 큰 지출 넛지 알림 띄우려면 Android 13+ 알림 권한 필요
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
    setMsg(await PaymentListener.testConnection());
    setBusy(false);
  };

  const onFlush = async () => {
    try {
      const n = await PaymentListener.flushQueue();
      setMsg(n ? `밀린 ${n}건 전송 완료` : "밀린 거 없음");
    } catch (e) {
      setMsg(`전송 실패: ${(e as Error).message}`);
    }
    refresh();
  };

  const good = (t: string) => t.includes("OK") || t.includes("완료");

  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={s.wrap}>
      <StatusBar style={dark ? "light" : "dark"} />
      <Text style={[s.h1, { color: c.ink }]}>결혼자금 수집기</Text>
      <Text style={[s.sub, { color: c.sub }]}>카드·은행 결제 알림을 내 서버로 보내는 앱</Text>

      <Card c={c}>
        <Text style={[s.label, { color: c.sub }]}>1. 알림 접근 권한</Text>
        <Text style={[s.status, { color: granted ? c.save : c.spend }]}>
          {granted ? "● 켜짐 — 결제 알림 수집 중" : "● 꺼짐"}
        </Text>
        {!granted && <Btn c={c} onPress={PaymentListener.openPermissionSettings}>설정에서 '결혼자금' 허용하기</Btn>}

        <Text style={[s.label, { color: c.sub, marginTop: 8 }]}>2. 배터리 최적화 제외</Text>
        <Text style={[s.status, { color: battery ? c.save : c.spend }]}>{battery ? "● 제외됨" : "● 최적화 중 (알림 놓칠 수 있음)"}</Text>
        {!battery && (
          <>
            <Btn c={c} outline onPress={PaymentListener.openBatterySettings}>배터리 설정 열기</Btn>
            <Text style={[s.hint, { color: c.sub }]}>
              갤럭시: 설정 → 배터리 → 백그라운드 사용 한도 → '사용하지 않는 앱'·'딥 슬립'에서 빼고, 앱 정보 → 배터리 → '제한 없음'
            </Text>
          </>
        )}
      </Card>

      <Card c={c}>
        <Text style={[s.label, { color: c.sub }]}>3. 서버 연결</Text>
        <Field c={c} label="서버 주소" value={settings.serverUrl} onChangeText={(v) => set({ serverUrl: v })} placeholder="https://money.example.com" keyboardType="url" />
        <Field c={c} label="토큰 (서버 .env의 INGEST_TOKEN)" value={settings.token} onChangeText={(v) => set({ token: v })} secureTextEntry />
        <Field c={c} label="내 이름 (커플 공유용)" value={settings.memberName} onChangeText={(v) => set({ memberName: v })} placeholder="민준" />
        <View style={s.row}>
          <Text style={{ color: c.ink, flex: 1 }}>카톡 알림톡(카드사·은행 채널)도 수집</Text>
          <Switch value={settings.includeKakao} onValueChange={(v) => set({ includeKakao: v })} />
        </View>
        <Btn c={c} onPress={onSave} disabled={busy}>{busy ? "확인 중…" : "저장하고 연결 테스트"}</Btn>
        {!!msg && <Text style={[s.msg, { color: good(msg) ? c.save : c.spend }]}>{msg}</Text>}
      </Card>

      {!!settings.serverUrl && (
        <Btn c={c} outline onPress={() => Linking.openURL(settings.serverUrl)}>대시보드 열기</Btn>
      )}

      <Card c={c}>
        <View style={s.row}>
          <Text style={[s.label, { color: c.sub, flex: 1 }]}>최근 전송 기록</Text>
          {queued > 0 && (
            <Pressable onPress={onFlush}>
              <Text style={{ color: c.spend, fontWeight: "700" }}>밀린 {queued}건 재전송</Text>
            </Pressable>
          )}
        </View>
        {log.length === 0 && <Text style={{ color: c.sub }}>아직 없음. 카드 한 번 긁어보면 여기 뜸</Text>}
        {log.map((l, i) => (
          <View key={`${l.at}-${i}`} style={[s.logRow, { borderColor: c.line }]}>
            <Text style={{ color: c.sub, fontSize: 11 }}>
              {new Date(l.at).toLocaleString("ko-KR")} · {l.packageName}
            </Text>
            <Text style={{ color: c.ink }} numberOfLines={2}>{l.preview}</Text>
            <Text
              style={{
                color: l.result === "PARSED" ? c.save : l.result.startsWith("QUEUED") ? c.spend : c.sub,
                fontSize: 12,
                fontWeight: "700",
              }}
            >
              {l.result}
            </Text>
          </View>
        ))}
      </Card>
      <Text style={[s.hint, { color: c.sub, textAlign: "center" }]}>
        금액(원)과 결제·입금 단어가 같이 있는 알림만 서버로 감. 카톡 친구 대화는 안 보냄
      </Text>
    </ScrollView>
  );
}

type Colors = typeof LIGHT;

function Card({ c, children }: { c: Colors; children: React.ReactNode }) {
  return <View style={[s.card, { backgroundColor: c.card, borderColor: c.line }]}>{children}</View>;
}

function Field({ c, label, ...props }: { c: Colors; label: string } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={{ color: c.sub, fontSize: 12, marginBottom: 4 }}>{label}</Text>
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        placeholderTextColor={c.sub}
        style={[s.input, { color: c.ink, backgroundColor: c.bg, borderColor: c.line }]}
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
  disabled,
}: {
  c: Colors;
  children: string;
  onPress: () => void;
  outline?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        s.btn,
        outline ? { borderWidth: 1, borderColor: c.line, backgroundColor: c.card } : { backgroundColor: c.ink },
        (pressed || disabled) && { opacity: 0.6 },
      ]}
    >
      <Text style={{ color: outline ? c.ink : c.bg, fontWeight: "700" }}>{children}</Text>
    </Pressable>
  );
}

const LIGHT = { bg: "#f6f4ef", card: "#ffffff", ink: "#1d1d1b", sub: "#6b6a66", line: "#e6e2d9", save: "#1f6b52", spend: "#c4552f" };
const DARK = { bg: "#141413", card: "#1e1e1c", ink: "#f0eee8", sub: "#a3a19b", line: "#2f2e2b", save: "#5cc19a", spend: "#ef8a65" };

const s = StyleSheet.create({
  wrap: { padding: 16, paddingTop: 56, paddingBottom: 40, gap: 12 },
  h1: { fontSize: 26, fontWeight: "800" },
  sub: { fontSize: 14, marginTop: -6 },
  card: { borderRadius: 18, borderWidth: 1, padding: 16, gap: 8 },
  label: { fontSize: 12, fontWeight: "600" },
  status: { fontSize: 16, fontWeight: "700" },
  hint: { fontSize: 12, lineHeight: 18 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 4 },
  btn: { borderRadius: 12, paddingVertical: 13, alignItems: "center" },
  msg: { fontWeight: "700", textAlign: "center" },
  logRow: { borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 8, gap: 2 },
});
