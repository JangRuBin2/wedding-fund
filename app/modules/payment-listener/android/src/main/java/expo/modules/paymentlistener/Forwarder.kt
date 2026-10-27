package expo.modules.paymentlistener

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

/**
 * 1차 필터 + 서버 전송. 진짜 파싱은 서버가 함 (포맷이 바뀌어도 서버만 고치면 되게).
 * 네트워크 실패 시 큐에 쌓아두고 다음 알림/앱 실행 때 재전송.
 */
object Forwarder {
  private const val TAG = "PaymentListener"
  private const val NUDGE_CHANNEL = "nudge"
  private val executor = Executors.newSingleThreadExecutor()

  private val MONEY = Regex("""\d[\d,]*\s*원""")
  private val KEYWORD = Regex("승인|결제|사용|입금|출금|취소|체크|일시불|할부|이체")
  private val FINANCE_SENDER = Regex("카드|은행|뱅크|페이|pay|증권|금융|토스|BC|NH|KB|IBK", RegexOption.IGNORE_CASE)
  private val IGNORED = setOf("android", "com.android.systemui", "com.samsung.android.app.smartcapture")

  fun shouldForward(context: Context, store: Store, pkg: String, title: String, text: String): Boolean {
    if (pkg == context.packageName || pkg in IGNORED) return false
    val full = "$title\n$text"
    if (!MONEY.containsMatchIn(full) || !KEYWORD.containsMatchIn(full)) return false
    // 카톡은 카드사/은행 채널(알림톡)만. 친구 대화는 절대 안 보냄
    if (pkg == "com.kakao.talk") return store.includeKakao && FINANCE_SENDER.containsMatchIn(title)
    return true
  }

  /** 서비스에서 호출: 백그라운드 스레드에서 전송 */
  fun enqueueAndSend(context: Context, pkg: String, title: String, text: String, postedAt: Long) {
    val app = context.applicationContext
    executor.execute {
      val store = Store(app)
      if (!store.configured) return@execute
      val item = JSONObject()
        .put("packageName", pkg)
        .put("title", title)
        .put("text", text)
        .put("postedAt", postedAt)
      if (store.memberName.isNotEmpty()) item.put("memberName", store.memberName)
      val preview = "$title $text".replace(Regex("\\s+"), " ").take(80)

      try {
        flushBlocking(store)
        val res = JSONObject(post(store, item.toString()))
        store.addLog(pkg, preview, res.optString("result", "?"))
        val nudge = res.optString("nudge", "")
        if (nudge.isNotEmpty() && nudge != "null") showNudge(app, nudge)
      } catch (e: Exception) {
        Log.w(TAG, "send failed, queued", e)
        store.enqueue(item)
        store.addLog(pkg, preview, "QUEUED (${e.message ?: e.javaClass.simpleName})")
      }
    }
  }

  /** 밀린 큐 전송. 성공 시 보낸 건수 반환 */
  fun flushBlocking(store: Store): Int {
    val q = store.queue()
    if (q.length() == 0 || !store.configured) return 0
    post(store, q.toString())
    store.clearQueue()
    return q.length()
  }

  /** 인증만 확인 (빈 배열 전송 → 서버는 [] 반환) */
  fun testBlocking(store: Store): String {
    if (!store.configured) return "서버 주소와 토큰을 먼저 입력해 주세요"
    return try {
      val body = post(store, "[]")
      if (body.trim().startsWith("[")) "연결됐어요" else "서버 응답을 확인할 수 없어요: ${body.take(60)}"
    } catch (e: Exception) {
      "연결하지 못했어요. ${e.message ?: e.javaClass.simpleName}"
    }
  }

  private fun post(store: Store, json: String): String {
    val conn = URL("${store.serverUrl}/api/ingest").openConnection() as HttpURLConnection
    try {
      conn.requestMethod = "POST"
      conn.connectTimeout = 10_000
      conn.readTimeout = 15_000
      conn.doOutput = true
      conn.setRequestProperty("Content-Type", "application/json; charset=utf-8")
      conn.setRequestProperty("Authorization", "Bearer ${store.token}")
      conn.outputStream.use { it.write(json.toByteArray(Charsets.UTF_8)) }
      val code = conn.responseCode
      if (code == 401) throw IllegalStateException("토큰이 맞지 않아요")
      if (code !in 200..299) throw IllegalStateException("서버 오류 (HTTP $code)")
      return conn.inputStream.bufferedReader(Charsets.UTF_8).use { it.readText() }
    } finally {
      conn.disconnect()
    }
  }

  private fun showNudge(context: Context, body: String) {
    if (Build.VERSION.SDK_INT >= 33 &&
      ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
    ) return
    if (Build.VERSION.SDK_INT >= 26) {
      val nm = context.getSystemService(NotificationManager::class.java)
      nm.createNotificationChannel(NotificationChannel(NUDGE_CHANNEL, "큰 지출 알림", NotificationManager.IMPORTANCE_HIGH))
    }
    val n = NotificationCompat.Builder(context, NUDGE_CHANNEL)
      .setSmallIcon(context.applicationInfo.icon)
      .setContentTitle("잠깐만요")
      .setContentText(body)
      .setStyle(NotificationCompat.BigTextStyle().bigText(body))
      .setAutoCancel(true)
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .build()
    try {
      NotificationManagerCompat.from(context).notify((System.currentTimeMillis() % Int.MAX_VALUE).toInt(), n)
    } catch (e: SecurityException) {
      Log.w(TAG, "no notification permission", e)
    }
  }
}
