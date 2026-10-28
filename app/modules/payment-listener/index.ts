import { requireNativeModule } from "expo";

export type ListenerSettings = {
  serverUrl: string;
  token: string;
  memberName: string;
  includeKakao: boolean;
};

export type LogEntry = { at: number; packageName: string; preview: string; result: string };

type Native = {
  isPermissionGranted(): boolean;
  openPermissionSettings(): void;
  openAppDetails(): void;
  isIgnoringBatteryOptimizations(): boolean;
  openBatterySettings(): void;
  requestRebind(): void;
  getSettings(): ListenerSettings;
  saveSettings(serverUrl: string, token: string, memberName: string, includeKakao: boolean): void;
  getLog(): string;
  getQueueSize(): number;
  testConnection(): Promise<string>;
  flushQueue(): Promise<number>;
  getTipsEnabled(): boolean;
  setTipsEnabled(enabled: boolean): void;
  sendTipNow(): Promise<string>;
};

const Native = requireNativeModule<Native>("PaymentListener");

export const PaymentListener = {
  ...Native,
  saveSettings: (s: ListenerSettings) => Native.saveSettings(s.serverUrl, s.token, s.memberName, s.includeKakao),
  getLog: (): LogEntry[] => {
    try {
      return JSON.parse(Native.getLog());
    } catch {
      return [];
    }
  },
};
