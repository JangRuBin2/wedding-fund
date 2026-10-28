package expo.modules.paymentlistener

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
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
import java.util.concurrent.TimeUnit

/**
 * 앱 스스로 업데이트. GitHub Releases 의 최신 apk-<번호> 를 확인해서 지금 버전(versionCode = 빌드 번호)보다
 * 새로우면 받아서 PackageInstaller 로 설치. 같은 서명 키라 지우지 않고 덮어써짐.
 * 안드로이드 12+ 에서는 확인 창 없이 설치를 요청하지만, OS가 거절하면(처음 한 번 등) 확인 창/알림을 띄움
 */
object Updater {
  private const val TAG = "PaymentListener"
  private const val LATEST = "https://api.github.com/repos/JangRuBin2/wedding-fund/releases/latest"
  private const val CHANNEL = "update"
  private const val WORK = "app-update"
  private const val NOTIFY_ID = 7_002
  const val EXTRA_INTERACTIVE = "interactive"

  data class Release(val version: Int, val apkUrl: String)

  fun currentVersion(context: Context): Int {
    val info = context.packageManager.getPackageInfo(context.packageName, 0)
    return if (Build.VERSION.SDK_INT >= 28) info.longVersionCode.toInt() else @Suppress("DEPRECATION") info.versionCode
  }

  @Throws(IOException::class)
  fun latest(): Release? {
    val conn = URL(LATEST).openConnection() as HttpURLConnection
    val body = try {
      conn.connectTimeout = 10_000
      conn.readTimeout = 15_000
      conn.setRequestProperty("Accept", "application/vnd.github+json")
      if (conn.responseCode !in 200..299) throw IOException("GitHub 응답 ${conn.responseCode}")
      conn.inputStream.bufferedReader().use { it.readText() }
    } finally {
      conn.disconnect()
    }
    val json = JSONObject(body)
    val version = Regex("""apk-(\d+)""").find(json.optString("tag_name"))?.groupValues?.get(1)?.toIntOrNull() ?: return null
    val assets = json.optJSONArray("assets") ?: return null
    for (i in 0 until assets.length()) {
      val a = assets.getJSONObject(i)
      if (a.optString("name").endsWith(".apk")) return Release(version, a.getString("browser_download_url"))
    }
    return null
  }

  fun canInstall(context: Context) = Build.VERSION.SDK_INT < 26 || context.packageManager.canRequestPackageInstalls()

  fun openInstallPermission(context: Context) {
    val intent = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${context.packageName}"))
    context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
  }

  /** 새 버전이 있으면 받아서 설치 요청. 결과 문구를 돌려줌 */
  @Throws(IOException::class)
  fun checkAndInstall(context: Context, interactive: Boolean): String {
    val release = latest() ?: return "최신 버전 정보를 찾지 못했어요"
    val current = currentVersion(context)
    if (release.version <= current) return "최신 버전이에요 (#$current)"
    if (!canInstall(context)) {
      if (interactive) openInstallPermission(context) else notify(context, "모아봄 새 버전 #${release.version}이 있어요", "앱을 열어 '업데이트'를 눌러 주세요", null)
      return "설치 권한을 허용한 뒤 다시 눌러 주세요"
    }
    install(context, release, interactive)
    return "새 버전 #${release.version}을 설치하고 있어요"
  }

  private fun install(context: Context, release: Release, interactive: Boolean) {
    val installer = context.packageManager.packageInstaller
    val params = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL).apply {
      setAppPackageName(context.packageName)
      if (Build.VERSION.SDK_INT >= 31) setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED)
    }
    val sessionId = installer.createSession(params)
    try {
      installer.openSession(sessionId).use { session ->
        val conn = URL(release.apkUrl).openConnection() as HttpURLConnection
        try {
          conn.connectTimeout = 15_000
          conn.readTimeout = 60_000
          conn.instanceFollowRedirects = true
          if (conn.responseCode !in 200..299) throw IOException("다운로드 실패 (HTTP ${conn.responseCode})")
          conn.inputStream.use { input ->
            session.openWrite("moabom.apk", 0, conn.contentLengthLong.takeIf { it > 0 } ?: -1).use { out ->
              input.copyTo(out)
              session.fsync(out)
            }
          }
        } finally {
          conn.disconnect()
        }
        val intent = Intent(context, UpdateReceiver::class.java).putExtra(EXTRA_INTERACTIVE, interactive)
        val flags = PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= 31) PendingIntent.FLAG_MUTABLE else 0)
        session.commit(PendingIntent.getBroadcast(context, sessionId, intent, flags).intentSender)
      }
    } catch (e: Exception) {
      installer.abandonSession(sessionId)
      throw if (e is IOException) e else IOException(e.message ?: e.javaClass.simpleName)
    }
  }

  /** 하루 한 번 백그라운드에서 확인 */
  fun schedule(context: Context) {
    val request = PeriodicWorkRequestBuilder<UpdateWorker>(12, TimeUnit.HOURS)
      .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.UNMETERED).build())
      .build()
    WorkManager.getInstance(context).enqueueUniquePeriodicWork(WORK, ExistingPeriodicWorkPolicy.KEEP, request)
  }

  fun notify(context: Context, title: String, body: String, tap: Intent?) {
    if (Build.VERSION.SDK_INT >= 33 &&
      ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
    ) return
    if (Build.VERSION.SDK_INT >= 26) {
      context.getSystemService(NotificationManager::class.java)
        .createNotificationChannel(NotificationChannel(CHANNEL, "앱 업데이트", NotificationManager.IMPORTANCE_DEFAULT))
    }
    val target = tap ?: context.packageManager.getLaunchIntentForPackage(context.packageName)
    val pi = target?.let { PendingIntent.getActivity(context, 1, it, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT) }
    val n = NotificationCompat.Builder(context, CHANNEL)
      .setSmallIcon(context.applicationInfo.icon)
      .setContentTitle(title)
      .setContentText(body)
      .setContentIntent(pi)
      .setAutoCancel(true)
      .build()
    try {
      NotificationManagerCompat.from(context).notify(NOTIFY_ID, n)
    } catch (e: SecurityException) {
      Log.w(TAG, "no notification permission", e)
    }
  }
}

/** 설치 결과. OS가 사용자 확인을 요구하면 앱을 보고 있을 땐 바로 확인 창, 아니면 알림 */
class UpdateReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    when (intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE)) {
      PackageInstaller.STATUS_PENDING_USER_ACTION -> {
        @Suppress("DEPRECATION")
        val confirm = (if (Build.VERSION.SDK_INT >= 33) intent.getParcelableExtra(Intent.EXTRA_INTENT, Intent::class.java)
        else intent.getParcelableExtra(Intent.EXTRA_INTENT)) ?: return
        confirm.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        if (intent.getBooleanExtra(Updater.EXTRA_INTERACTIVE, false)) {
          try {
            context.startActivity(confirm)
            return
          } catch (e: Exception) {
            Log.w("PaymentListener", "confirm activity blocked", e)
          }
        }
        Updater.notify(context, "모아봄 새 버전이 준비됐어요", "눌러서 업데이트를 마쳐 주세요", confirm)
      }
      PackageInstaller.STATUS_SUCCESS -> Unit // 새 버전으로 앱이 다시 시작됨
      else -> Log.w("PaymentListener", "update failed: ${intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE)}")
    }
  }
}

class UpdateWorker(context: Context, params: WorkerParameters) : Worker(context, params) {
  override fun doWork(): Result = try {
    Updater.checkAndInstall(applicationContext, interactive = false)
    Result.success()
  } catch (e: IOException) {
    Result.retry()
  } catch (e: Exception) {
    Log.w("PaymentListener", "update check failed", e)
    Result.failure()
  }
}
