package expo.modules.paymentlistener

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import java.util.concurrent.TimeUnit

/**
 * 매일 아침(8:30쯤) 서버의 /api/tips/today 를 받아 알림으로 띄움.
 * 팁 내용과 고르는 규칙은 서버에 있어서 앱 업데이트 없이 바꿀 수 있음.
 * 서버가 공식 사이트(link)·관련 뉴스(newsUrl)·공유 글(shareText)을 주면 알림에 버튼으로 붙임.
 */
object Tips {
  private const val TAG = "PaymentListener"
  private const val CHANNEL = "tips"
  private const val WORK = "daily-tip"
  private const val NOTIFY_ID = 7_001

  /** 켜져 있고 서버가 설정돼 있으면 예약. 이미 예약돼 있으면 그대로 둠(시간이 밀리지 않게) */
  fun schedule(context: Context) {
    val store = Store(context)
    val wm = WorkManager.getInstance(context)
    if (!store.tipsEnabled || !store.configured) {
      wm.cancelUniqueWork(WORK)
      return
    }
    val request = PeriodicWorkRequestBuilder<TipWorker>(24, TimeUnit.HOURS)
      .setInitialDelay(millisUntilNext(8, 30), TimeUnit.MILLISECONDS)
      .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
      .build()
    wm.enqueueUniquePeriodicWork(WORK, ExistingPeriodicWorkPolicy.KEEP, request)
  }

  /** 껐다 켤 때는 예약을 새로 잡음 */
  fun reschedule(context: Context) {
    WorkManager.getInstance(context).cancelUniqueWork(WORK)
    schedule(context)
  }

  /** 서버에서 오늘 팁을 받아 알림. force=false면 오늘 이미 띄웠을 때 건너뜀 */
  @Throws(IOException::class)
  fun fetchAndNotify(context: Context, force: Boolean): String {
    val store = Store(context)
    if (!store.configured) return "서버 주소와 토큰을 먼저 입력해 주세요"
    val today = SimpleDateFormat("yyyy-MM-dd", Locale.KOREA).format(Date())
    if (!force && store.lastTipDay == today) return "오늘 팁은 이미 보냈어요"

    // 이름을 같이 보내면 서버가 그 사람 정보(설정 → 팁 맞춤 정보)로 팁을 거름
    val member = URLEncoder.encode(store.memberName, "UTF-8")
    val conn = URL("${store.serverUrl}/api/tips/today?member=$member").openConnection() as HttpURLConnection
    val body = try {
      conn.connectTimeout = 10_000
      conn.readTimeout = 15_000
      conn.setRequestProperty("Authorization", "Bearer ${store.token}")
      val code = conn.responseCode
      if (code == 401) return "토큰이 맞지 않아요"
      if (code == 404) return "서버를 최신 버전으로 배포해 주세요"
      if (code !in 200..299) throw IOException("서버 오류 (HTTP $code)")
      conn.inputStream.bufferedReader(Charsets.UTF_8).use { it.readText() }
    } finally {
      conn.disconnect()
    }
    val tip = JSONObject(body)
    val title = tip.optString("title")
    val text = tip.optString("body")
    val link = tip.optJSONObject("link")
    val shown = show(
      context,
      title,
      text,
      link?.str("label"),
      link?.str("url"),
      tip.str("newsUrl"),
      // 예전 서버는 shareText를 안 줘서 제목·본문으로 만듦
      tip.str("shareText") ?: "[모아봄 오늘의 팁] $title\n$text",
    )
    if (!shown) return "알림 권한을 허용해 주세요"
    store.lastTipDay = today
    return "오늘의 팁을 보냈어요"
  }

  /** 값이 없거나 null이면 null (optString은 null을 "null" 글자로 돌려줘서) */
  private fun JSONObject.str(key: String): String? = if (isNull(key)) null else optString(key).takeIf { it.isNotBlank() }

  /** https 주소만 브라우저로 엶 */
  private fun viewIntent(context: Context, url: String?, requestCode: Int): PendingIntent? {
    if (url == null || !url.startsWith("https://")) return null
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    return PendingIntent.getActivity(context, requestCode, intent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
  }

  /** 카톡 등으로 보내는 공유 시트 */
  private fun shareIntent(context: Context, title: String, shareText: String): PendingIntent {
    val send = Intent(Intent.ACTION_SEND)
      .setType("text/plain")
      .putExtra(Intent.EXTRA_SUBJECT, title)
      .putExtra(Intent.EXTRA_TEXT, shareText)
    val chooser = Intent.createChooser(send, "팁 공유하기").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    return PendingIntent.getActivity(context, 3, chooser, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
  }

  private fun show(
    context: Context,
    title: String,
    body: String,
    linkLabel: String?,
    linkUrl: String?,
    newsUrl: String?,
    shareText: String,
  ): Boolean {
    if (Build.VERSION.SDK_INT >= 33 &&
      ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
    ) return false
    if (Build.VERSION.SDK_INT >= 26) {
      val nm = context.getSystemService(NotificationManager::class.java)
      nm.createNotificationChannel(NotificationChannel(CHANNEL, "오늘의 팁", NotificationManager.IMPORTANCE_DEFAULT))
    }
    val open = context.packageManager.getLaunchIntentForPackage(context.packageName)?.let {
      PendingIntent.getActivity(context, 0, it, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
    }
    val builder = NotificationCompat.Builder(context, CHANNEL)
      .setSmallIcon(context.applicationInfo.icon)
      .setContentTitle(title)
      .setContentText(body)
      .setStyle(NotificationCompat.BigTextStyle().bigText(body))
      .setContentIntent(open)
      .setAutoCancel(true)
    // 버튼은 최대 3개: 공식 사이트, 관련 뉴스, 공유
    viewIntent(context, linkUrl, 1)?.let { builder.addAction(0, if (linkLabel != null) "$linkLabel 열기" else "자세히 보기", it) }
    viewIntent(context, newsUrl, 2)?.let { builder.addAction(0, "관련 뉴스", it) }
    builder.addAction(0, "공유", shareIntent(context, title, shareText))
    val n = builder.build()
    return try {
      NotificationManagerCompat.from(context).notify(NOTIFY_ID, n)
      true
    } catch (e: SecurityException) {
      Log.w(TAG, "no notification permission", e)
      false
    }
  }

  private fun millisUntilNext(hour: Int, minute: Int): Long {
    val now = Calendar.getInstance()
    val next = (now.clone() as Calendar).apply {
      set(Calendar.HOUR_OF_DAY, hour)
      set(Calendar.MINUTE, minute)
      set(Calendar.SECOND, 0)
      set(Calendar.MILLISECOND, 0)
      if (!after(now)) add(Calendar.DAY_OF_MONTH, 1)
    }
    return next.timeInMillis - now.timeInMillis
  }
}

class TipWorker(context: Context, params: WorkerParameters) : Worker(context, params) {
  override fun doWork(): Result = try {
    Tips.fetchAndNotify(applicationContext, force = false)
    Result.success()
  } catch (e: IOException) {
    // 네트워크·서버 문제면 WorkManager가 잠시 뒤 다시 시도
    Result.retry()
  } catch (e: Exception) {
    Log.w("PaymentListener", "tip failed", e)
    Result.failure()
  }
}
