import sqlite3, os, json, urllib.request, urllib.error, datetime, sys

DB = os.path.expanduser(r"~\.local\share\opencode\opencode.db")
TZ = datetime.timezone(datetime.timedelta(hours=8))
PEAK = [(9 * 60, 12 * 60), (14 * 60, 18 * 60)]


def is_peak(ts_ms):
    t = datetime.datetime.fromtimestamp(ts_ms / 1000, TZ)
    if t.isoweekday() > 5:
        return False
    m = t.hour * 60 + t.minute
    return any(a <= m < b for a, b in PEAK)


def credential():
    con = sqlite3.connect("file:" + DB.replace("\\", "/") + "?mode=ro", uri=True)
    row = con.execute("select value from credential where integration_id='opencode' and active=1").fetchone()
    d = json.loads(row[0])
    return d["access"], (d.get("metadata") or {}).get("email", "?")


def fetch_usage(tok):
    req = urllib.request.Request(
        "https://opencode.ai/inference/go/v1/usage",
        headers={"Authorization": "Bearer " + tok, "User-Agent": "opencode-cli/2.2.5"},
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())["usage"]


def fmt_reset(iso):
    t = datetime.datetime.fromisoformat(iso.replace("Z", "+00:00")).astimezone(TZ)
    return t.strftime("%m-%d %H:%M")


def bar(pct, width=30):
    n = max(0, min(width, round(pct / 100 * width)))
    return "[" + "#" * n + "-" * (width - n) + "]"


def local_stats(days):
    con = sqlite3.connect("file:" + DB.replace("\\", "/") + "?mode=ro", uri=True)
    since = (datetime.datetime.now(TZ) - datetime.timedelta(days=days)).timestamp() * 1000
    rows = con.execute(
        """select time_created, cost, tokens_input, tokens_output, tokens_reasoning, tokens_cache_read
           from session_v2 where model like '%opencode-go%' and time_created >= ?""",
        (since,),
    ).fetchall()
    agg = {"peak": [0, 0, 0, 0, 0.0, 0], "off": [0, 0, 0, 0, 0.0, 0]}
    for ts, cost, inp, out, rea, cr in rows:
        k = "peak" if is_peak(ts) else "off"
        a = agg[k]
        a[0] += inp or 0
        a[1] += cr or 0
        a[2] += (out or 0) + (rea or 0)
        a[3] += 1
        a[4] += cost or 0
        a[5] += 1 if cr else 0
    return agg


def rate(cache, fresh):
    tot = cache + fresh
    return (cache / tot * 100) if tot else 0.0


def main():
    tok, email = credential()
    print("账号:", email)
    try:
        u = fetch_usage(tok)
        print("\nGo 额度（Console 同源数据）")
        for k, label in [("rolling", "5小时窗口"), ("weekly", "每周"), ("monthly", "每月")]:
            x = u[k]
            print(f"  {label:<8} {bar(x['percent'])} {x['percent']:>3}%   重置 {fmt_reset(x['resetsAt'])}")
    except urllib.error.HTTPError as e:
        print("额度接口返回", e.code, e.read(200).decode("utf-8", "ignore"))
    except Exception as e:
        print("额度接口失败:", type(e).__name__, str(e)[:120])

    for days in (1, 7):
        agg = local_stats(days)
        print(f"\n最近 {days} 天（本地记录，按标价折算）")
        tot_in = tot_cr = tot_cost = 0
        for key, label in [("peak", "高峰 09-12/14-18 工作日"), ("off", "空闲 其余时段+周末")]:
            inp, cr, outp, n, cost, _ = agg[key]
            if n == 0:
                continue
            print(f"  {label:<22} 请求 {n:>4}  命中 {rate(cr, inp):5.1f}%  新鲜输入 {inp/1e6:7.2f}M  缓存读 {cr/1e6:8.2f}M  输出 {outp/1e6:6.2f}M  费用 ${cost:.2f}")
            tot_in += inp; tot_cr += cr; tot_cost += cost
        if tot_in + tot_cr:
            print(f"  {'合计':<22} 命中 {rate(tot_cr, tot_in):5.1f}%  费用 ${tot_cost:.2f}")
        else:
            print("  无记录")


if __name__ == "__main__":
    main()
