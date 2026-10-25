package expo.modules.paymentlistener

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification

/**
 * OS가 알림 올 때마다 호출. JS 런타임 없이 네이티브에서 바로 필터→전송해서
 * 갤럭시 배터리 최적화에도 최대한 안 놓치게 함.
 */
class PaymentListenerService : NotificationListenerService() {

  override fun onListenerConnected() {
    super.onListenerConnected()
    // 재연결될 때 밀린 거 전송 시도
    Thread {
      try { Forwarder.flushBlocking(Store(applicationContext)) } catch (_: Exception) {}
    }.start()
  }

  override fun onNotificationPosted(sbn: StatusBarNotification?) {
    sbn ?: return
    val n = sbn.notification ?: return
    // 그룹 요약 알림은 개별 알림과 내용이 겹쳐서 스킵 (중복은 서버도 한 번 더 거름)
    if (n.flags and Notification.FLAG_GROUP_SUMMARY != 0) return
    if (n.flags and Notification.FLAG_ONGOING_EVENT != 0) return

    val extras = n.extras ?: return
    val title = (extras.getCharSequence(Notification.EXTRA_TITLE_BIG)
      ?: extras.getCharSequence(Notification.EXTRA_TITLE))?.toString()?.trim().orEmpty()
    // 은행/카드 앱은 펼친 본문(bigText)이나 여러 줄(textLines)에 전체 내용이 있는 경우가 많음
    val lines = extras.getCharSequenceArray(Notification.EXTRA_TEXT_LINES)?.joinToString("\n")
    val text = (extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString()
      ?: lines
      ?: extras.getCharSequence(Notification.EXTRA_TEXT)?.toString())?.trim().orEmpty()

    val store = Store(applicationContext)
    if (!Forwarder.shouldForward(applicationContext, store, sbn.packageName, title, text)) return
    Forwarder.enqueueAndSend(applicationContext, sbn.packageName, title, text, sbn.postTime)
  }
}
