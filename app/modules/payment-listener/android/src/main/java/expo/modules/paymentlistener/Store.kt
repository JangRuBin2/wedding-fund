package expo.modules.paymentlistener

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/**
 * SharedPreferences 기반 설정/전송큐/로그. 서비스(네이티브)와 앱 UI(JS) 양쪽에서 같이 씀.
 * 호출할 때마다 새 인스턴스가 생기므로 큐·로그는 인스턴스가 아니라 전역 LOCK으로 보호.
 */
class Store(context: Context) {
  private val prefs = context.applicationContext.getSharedPreferences("payment_listener", Context.MODE_PRIVATE)

  var serverUrl: String
    get() = prefs.getString("serverUrl", "") ?: ""
    set(v) = prefs.edit().putString("serverUrl", v.trim().trimEnd('/')).apply()

  var token: String
    get() = prefs.getString("token", "") ?: ""
    set(v) = prefs.edit().putString("token", v.trim()).apply()

  var memberName: String
    get() = prefs.getString("memberName", "") ?: ""
    set(v) = prefs.edit().putString("memberName", v.trim()).apply()

  var includeKakao: Boolean
    get() = prefs.getBoolean("includeKakao", true)
    set(v) = prefs.edit().putBoolean("includeKakao", v).apply()

  /** 매일 아침 '오늘의 팁' 알림 */
  var tipsEnabled: Boolean
    get() = prefs.getBoolean("tipsEnabled", true)
    set(v) = prefs.edit().putBoolean("tipsEnabled", v).apply()

  /** 마지막으로 팁을 띄운 날 (yyyy-MM-dd). 하루에 두 번 안 띄우게 */
  var lastTipDay: String
    get() = prefs.getString("lastTipDay", "") ?: ""
    set(v) = prefs.edit().putString("lastTipDay", v).apply()

  val configured: Boolean get() = serverUrl.isNotEmpty() && token.isNotEmpty()

  fun queue(): JSONArray = synchronized(LOCK) { JSONArray(prefs.getString("queue", "[]") ?: "[]") }

  fun enqueue(item: JSONObject) = synchronized(LOCK) {
    val q = queue()
    q.put(item)
    // 서버가 오래 죽어 있어도 저장공간 안 터지게 최근 500건만 유지
    val trimmed = JSONArray()
    val start = maxOf(0, q.length() - MAX_QUEUE)
    for (i in start until q.length()) trimmed.put(q.get(i))
    prefs.edit().putString("queue", trimmed.toString()).commit()
  }

  /** 앞에서부터 보낸 만큼만 지움 (보내는 사이에 새로 쌓인 건 남김) */
  fun dropFirst(n: Int) = synchronized(LOCK) {
    val q = queue()
    val rest = JSONArray()
    for (i in minOf(n, q.length()) until q.length()) rest.put(q.get(i))
    prefs.edit().putString("queue", rest.toString()).commit()
  }

  fun log(): JSONArray = synchronized(LOCK) { JSONArray(prefs.getString("log", "[]") ?: "[]") }

  fun addLog(packageName: String, preview: String, result: String) = synchronized(LOCK) {
    val entry = JSONObject()
      .put("at", System.currentTimeMillis())
      .put("packageName", packageName)
      .put("preview", preview)
      .put("result", result)
    val old = log()
    val next = JSONArray().put(entry)
    for (i in 0 until minOf(old.length(), MAX_LOG - 1)) next.put(old.get(i))
    prefs.edit().putString("log", next.toString()).apply()
  }

  companion object {
    const val MAX_QUEUE = 500
    const val MAX_LOG = 50
    private val LOCK = Any()
  }
}
