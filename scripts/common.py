"""抓取与产出的共用工具：带重试的 HTTP、并发拉取、JSONL 断点续传。

只依赖标准库，任何 Python 3.10+ 环境都能直接跑。

这一层是整个项目里唯一没有搬去 TypeScript 的部分：抓取要处理 GraphQL 分页、
断点续传、题解代码的 AST 结构判定，而 Python 的 `re` 支持环视、`ast` 是标准库，
换语言得不偿失。CLI 只是把它当子进程调起来。
"""

from __future__ import annotations

import json
import os
import random
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any, Callable, Iterable, Iterator

SCRIPTS_ROOT = Path(__file__).resolve().parent
PKG_ROOT = SCRIPTS_ROOT.parent

# 数据目录由 CLI 那边统一决定（默认 ~/.sinan/data），这里认同一个环境变量，
# 保证 `sinan sync` 写进去的和 `sinan` 读出来的永远是同一份。
_ENV_ROOT = os.environ.get("SINAN_DATA_ROOT")
DATA_DIR = Path(_ENV_ROOT).expanduser().resolve() if _ENV_ROOT else (PKG_ROOT / "data")
RAW_DIR = DATA_DIR / "raw"
DIST_DIR = DATA_DIR / "dist"

# dump_json 打印相对路径用
SITE_ROOT = DATA_DIR

UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)


class FetchError(RuntimeError):
    pass


def _request(url: str, *, data: bytes | None, headers: dict[str, str], timeout: int) -> bytes:
    req = urllib.request.Request(url, data=data, headers=headers, method="POST" if data else "GET")
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def http_json(
    url: str,
    *,
    payload: dict[str, Any] | None = None,
    headers: dict[str, str] | None = None,
    timeout: int = 30,
    retries: int = 4,
) -> Any:
    """发一次 HTTP 请求并解析 JSON，失败按指数退避重试。"""
    head = {"User-Agent": UA, "Accept": "application/json"}
    if payload is not None:
        head["Content-Type"] = "application/json"
    head.update(headers or {})
    body = json.dumps(payload).encode() if payload is not None else None

    last: Exception | None = None
    for attempt in range(retries):
        try:
            return json.loads(_request(url, data=body, headers=head, timeout=timeout))
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as err:
            last = err
            status = getattr(err, "code", None)
            if status in (400, 404):  # 明确的客户端错误，重试没意义
                raise FetchError(f"{url} -> HTTP {status}") from err
            time.sleep(min(8.0, 0.6 * 2**attempt) + random.random() * 0.3)
    raise FetchError(f"{url} 连续 {retries} 次失败: {last}")


def graphql(endpoint: str, query: str, variables: dict[str, Any], *, operation: str | None = None,
            referer: str | None = None) -> dict[str, Any]:
    payload: dict[str, Any] = {"query": query, "variables": variables}
    if operation:
        payload["operationName"] = operation
    headers = {"Referer": referer} if referer else {}
    body = http_json(endpoint, payload=payload, headers=headers)
    if body.get("errors"):
        raise FetchError(f"GraphQL 报错: {json.dumps(body['errors'], ensure_ascii=False)[:300]}")
    return body["data"]


# --- JSONL 缓存：抓取可中断续跑 ------------------------------------------------

def read_jsonl(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    out: list[dict[str, Any]] = []
    with path.open(encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                out.append(json.loads(line))
            except json.JSONDecodeError:  # 上次中断留下的半行
                continue
    return out


def fetch_many(
    keys: Iterable[str],
    worker: Callable[[str], dict[str, Any] | None],
    cache: Path,
    *,
    workers: int = 5,
    label: str = "fetch",
) -> list[dict[str, Any]]:
    """并发抓取一批 key，结果按行追加到 cache，重跑时自动跳过已完成的。"""
    cache.parent.mkdir(parents=True, exist_ok=True)
    done = {rec["_key"] for rec in read_jsonl(cache) if "_key" in rec and not rec.get("_error")}
    todo = [k for k in keys if k not in done]
    print(f"[{label}] 共 {len(done) + len(todo)} 项，已缓存 {len(done)}，待抓 {len(todo)}", flush=True)

    if todo:
        started = time.time()
        with cache.open("a", encoding="utf-8") as fh, ThreadPoolExecutor(workers) as pool:
            for i, rec in enumerate(pool.map(_guard(worker), todo), 1):
                if rec is not None:
                    fh.write(json.dumps(rec, ensure_ascii=False) + "\n")
                if i % 200 == 0 or i == len(todo):
                    rate = i / max(time.time() - started, 1e-6)
                    left = (len(todo) - i) / max(rate, 1e-6)
                    fh.flush()
                    print(f"[{label}] {i}/{len(todo)}  {rate:.1f} 项/秒  剩余约 {left/60:.1f} 分钟", flush=True)

    return read_jsonl(cache)


def _guard(worker: Callable[[str], dict[str, Any] | None]) -> Callable[[str], dict[str, Any] | None]:
    def run(key: str) -> dict[str, Any] | None:
        try:
            rec = worker(key)
        except Exception as err:  # 单题失败不该拖垮整轮抓取
            return {"_key": key, "_error": str(err)[:200]}
        if rec is not None:
            rec.setdefault("_key", key)
        return rec

    return run


def dump_json(path: Path, obj: Any, *, compact: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(obj, ensure_ascii=False, separators=(",", ":") if compact else (", ", ": "),
                      indent=None if compact else 2)
    path.write_text(text + "\n", encoding="utf-8")
    try:
        shown = path.relative_to(SITE_ROOT)
    except ValueError:
        shown = path
    print(f"[write] {shown}  {len(text)/1024:.0f} KB", flush=True)


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))
