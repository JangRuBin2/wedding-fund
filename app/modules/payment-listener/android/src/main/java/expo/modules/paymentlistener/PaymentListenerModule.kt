package expo.modules.paymentlistener

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.PowerManager
import android.provider.Settings
import android.service.notification.NotificationListenerService
import androidx.core.app.NotificationManagerCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** JS(설정 화면)에서 쓰는 API */
class PaymentListenerModule : Module() {
  private val context: Context
    get() = requireNotNull(appContext.reactContext) { "React context unavailable" }

  override fun definition() = ModuleDefinition {
    Name("PaymentListener")

    // 앱 켤 때마다 팁 예약 확인 (이미 있으면 그대로)
    OnCreate {
      val ctx = appContext.reactContext ?: return@OnCreate
      try { Tips.schedule(ctx) } catch (e: Exception) { android.util.Log.w("PaymentListener", "tip schedule failed", e) }
      try { Updater.schedule(ctx) } catch (e: Exception) { android.util.Log.w("PaymentListener", "update schedule failed", e) }
    }

    Function("isPermissionGranted") {
      NotificationManagerCompat.getEnabledListenerPackages(context).contains(context.packageName)
    }

    Function("openPermissionSettings") {
      open(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
    }

    /** '제한된 설정 허용'은 앱 정보 화면의 ⋮ 메뉴에 있음 */
    Function("openAppDetails") {
      open(appDetails())
    }

    Function("isIgnoringBatteryOptimizations") {
      val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
      pm.isIgnoringBatteryOptimizations(context.packageName)
    }

    Function("openBatterySettings") {
      open(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))
    }

    /** 서비스가 OS에 의해 끊겼을 때 다시 붙이기 */
    Function("requestRebind") {
      NotificationListenerService.requestRebind(ComponentName(context, PaymentListenerService::class.java))
    }

    Function("getSettings") {
      val s = Store(context)
      mapOf(
        "serverUrl" to s.serverUrl,
        "token" to s.token,
        "memberName" to s.memberName,
        "includeKakao" to s.includeKakao
      )
    }

    Function("saveSettings") { serverUrl: String, token: String, memberName: String, includeKakao: Boolean ->
      val s = Store(context)
      s.serverUrl = serverUrl
      s.token = token
      s.memberName = memberName
      s.includeKakao = includeKakao
      Tips.schedule(context)
    }

    Function("getTipsEnabled") { Store(context).tipsEnabled }

    Function("setTipsEnabled") { enabled: Boolean ->
      Store(context).tipsEnabled = enabled
      Tips.reschedule(context)
    }

    /** 지금 버전과 GitHub 최신 버전 */
    AsyncFunction("checkUpdate") {
      val current = Updater.currentVersion(context)
      val latest = try { Updater.latest()?.version } catch (e: Exception) { null }
      mapOf("current" to current, "latest" to (latest ?: 0), "available" to (latest != null && latest > current))
    }

    /** 새 버전 받아서 설치 (확인 창이 필요하면 바로 띄움) */
    AsyncFunction("installUpdate") {
      try {
        Updater.checkAndInstall(context, interactive = true)
      } catch (e: Exception) {
        "업데이트하지 못했어요. ${e.message ?: e.javaClass.simpleName}"
      }
    }

    /** 설정 화면의 '지금 하나 받아 보기' */
    AsyncFunction("sendTipNow") {
      try {
        Tips.fetchAndNotify(context, force = true)
      } catch (e: Exception) {
        "팁을 받지 못했어요. ${e.message ?: e.javaClass.simpleName}"
      }
    }

    Function("getLog") { Store(context).log().toString() }

    Function("getQueueSize") { Store(context).queue().length() }

    AsyncFunction("testConnection") { Forwarder.testBlocking(Store(context)) }

    AsyncFunction("flushQueue") { Forwarder.flushBlocking(Store(context)) }
  }

  private fun appDetails() =
    Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${context.packageName}"))

  /** 기기마다 없는 설정 화면이 있어서, 실패하면 앱 정보 화면으로 대신 이동 (앱이 꺼지지 않게) */
  private fun open(intent: Intent) {
    try {
      context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    } catch (e: Exception) {
      try { context.startActivity(appDetails().addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) } catch (_: Exception) {}
    }
  }
}
