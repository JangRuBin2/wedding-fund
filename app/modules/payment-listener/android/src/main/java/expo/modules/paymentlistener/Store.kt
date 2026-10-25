package expo.modules.paymentlistener

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/** SharedPreferences 기반 설정/전송큐/로그. 서비스(네이티브)와 앱 UI(JS) 양쪽에서 같이 씀 */
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

  val configured: Boolean get() = serverUrl.isNotEmpty() && token.isNotEmpty()

  @Synchronized
  fun queue(): JSONArray = JSONArray(prefs.getString("queue", "[]") ?: "[]")

  @Synchronized
  fun enqueue(item: JSONObject) {
    val q = queue()
    q.put(item)
    // 서버가 오래 죽어 있어도 저장공간 안 터지게 최근 500건만 유지
    val trimmed = JSONArray()
    val start = maxOf(0, q.length() - MAX_QUEUE)
    for (i in start until q.length()) trimmed.put(q.get(i))
    prefs.edit().putString("queue", trimmed.toString()).commit()
  }

  @Synchronized
  fun clearQueue() {
    prefs.edit().putString("queue", "[]").commit()
  }

  @Synchronized
  fun log(): JSONArray = JSONArray(prefs.getString("log", "[]") ?: "[]")

  @Synchronized
  fun addLog(packageName: String, preview: String, result: String) {
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
  }
}
