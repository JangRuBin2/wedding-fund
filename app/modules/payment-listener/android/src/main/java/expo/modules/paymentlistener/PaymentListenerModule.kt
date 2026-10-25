package expo.modules.paymentlistener

import android.content.ComponentName
import android.content.Context
import android.content.Intent
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

    Function("isPermissionGranted") {
      NotificationManagerCompat.getEnabledListenerPackages(context).contains(context.packageName)
    }

    Function("openPermissionSettings") {
      context.startActivity(
        Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      )
    }

    Function("isIgnoringBatteryOptimizations") {
      val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
      pm.isIgnoringBatteryOptimizations(context.packageName)
    }

    Function("openBatterySettings") {
      context.startActivity(
        Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      )
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
    }

    Function("getLog") { Store(context).log().toString() }

    Function("getQueueSize") { Store(context).queue().length() }

    AsyncFunction("testConnection") { Forwarder.testBlocking(Store(context)) }

    AsyncFunction("flushQueue") { Forwarder.flushBlocking(Store(context)) }
  }
}
