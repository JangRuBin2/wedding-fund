import { registerRootComponent } from "expo";
import App from "./App";

// 알림 수집/전송은 네이티브 서비스(modules/payment-listener)가 앱이 꺼져 있어도 처리함.
// 이 JS 앱은 설정 화면 역할만.
registerRootComponent(App);
