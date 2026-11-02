---
name: skill-douyin-media
description: >-
  瑙ｆ瀽鎶栭煶鍗曟潯瑙嗛/鍥炬枃鐨勭礌鏉愶細鏃犳按鍗拌棰戙€佸皝闈€侀煶棰戯紙鍚儗鏅煶涔愶級銆佸瓧骞曘€?  榛樿鐢ㄦ湰鏈哄凡鐧诲綍鐨?DouyinProfile + Playwright 璇诲彇椤甸潰鏁版嵁锛屽啀閰嶅悎 ffmpeg 鎶介煶棰戙€?  faster-whisper 鐢熸垚瀛楀箷锛涗篃鏀寔閰嶇疆鑷缓瑙ｆ瀽 API锛圗vil0ctal v5 / media-parser锛夈€?  褰撶敤鎴疯銆屼笅杞芥姈闊宠棰戙€嶃€屾姈闊冲幓姘村嵃銆嶃€屾彁鍙栨姈闊抽煶棰戙€嶃€屾姈闊宠棰戣浆瀛楀箷/鏂囨銆?  銆岃В鏋愯繖涓姈闊抽摼鎺ャ€嶆椂浣跨敤銆?layer: produce
---

# 鎶栭煶绱犳潗瑙ｆ瀽锛堣棰?/ 闊抽 / 瀛楀箷锛?
> 鍏堣鏄庯細鍏綉鈥滃厤璐硅В鏋?API鈥濆ぇ澶氬凡缁忓け鏁堟垨闄愭祦锛?2vmy銆乸earktrue銆乷ioweb銆乸arsedock 绛夊疄娴?404/503/522锛夛紱
> 绋冲畾鍏嶈垂鐨勫仛娉曟槸 **鑷缓寮€婧愯В鏋愭湇鍔?* 鎴?**鏈満鐧诲綍鎬?+ Playwright + 鏈湴 ASR**銆?
## 涓夋潯璺嚎

| 璺嚎 | 闇€瑕?| 鑳芥嬁鍒?| 璇存槑 |
|---|---|---|---|
| 鏈湴椤甸潰瑙ｆ瀽锛堥粯璁わ級 | 鏈満鎶栭煶鐧诲綍鎬侊紙DouyinProfile锛? Playwright | 瑙嗛/灏侀潰/闊充箰/椤甸潰鑷甫瀛楀箷 | 鏃犻渶绗笁鏂?key锛涘彈椤甸潰鏀圭増/鐧诲綍鎬佸奖鍝?|
| 鑷缓 Evil0ctal v5 | Docker + 鑷缓 API key | 瑙嗛/闊抽/灏侀潰/鍦ㄧ嚎绂荤嚎瀛楀箷锛團unASR锛?| 寮€婧愬厤璐癸紝鏀寔 MCP/REST锛涘叕鍏?demo 鍙銆侀渶 key |
| 鑷缓 media-parser | Python 鏈嶅姟 | 瑙嗛/闊抽/灏侀潰 | 寮€婧愬厤璐癸紝`/api/v1/parse`锛屼笉鍚瓧骞?|

- Evil0ctal/Douyin_TikTok_Download_API锛歨ttps://github.com/Evil0ctal/Douyin_TikTok_Download_API
- ucmao/media-parser锛歨ttps://github.com/ucmao/media-parser

鏈湴璺嚎涓嶄緷璧栧叕缃?API锛屽瓧骞曠敤椤圭洰宸叉湁鐨?`skills/shared/scripts/asr.py`锛坒aster-whisper锛夈€?
## 鍏堟鏌?
```bash
cd "E:\AI椤圭洰\濯掍綋鐩戞帶\integrations\Easel"
python skills/openclaw/skill-douyin-media/scripts/douyin_media.py check
```

妫€鏌?`ffmpeg`銆乣playwright`銆乣faster_whisper`銆乣dashscope_key_set`銆乣DouyinProfile` 鏄惁宸茬櫥褰曘€?鑻?`profile_logged_in=false`锛屽厛鍘汇€岃处鍙?鈫?鎶栭煶銆嶇櫥褰曪紙鍙偣涓€娆★紝鎵爜 + 鐭俊锛夈€?
> **`faster_whisper=false` 涓嶄唬琛ㄤ笉鑳界敓鎴愬瓧骞?*锛氬彧瑕?`dashscope_key_set=true`锛?> 鐢?`--subtitle-engine dashscope`锛堟垨榛樿 `auto`锛夊氨浼氳蛋浜戣浆鍐欙紝涓嶈鐩存帴璺宠繃瀛楀箷銆?
## 鐢ㄦ硶

```bash
# 鍙В鏋愶紝涓嶄笅杞?python skills/openclaw/skill-douyin-media/scripts/douyin_media.py parse \
  --url "https://v.douyin.com/xxxx/"

# 涓嬭浇瑙嗛 + 灏侀潰 + 闊抽锛坒fmpeg 鎶藉彇锛?python skills/openclaw/skill-douyin-media/scripts/douyin_media.py download \
  --url "https://v.douyin.com/xxxx/" --out outputs/鎶栭煶绱犳潗

# 涓嬭浇骞剁敓鎴愬瓧骞曪紙鑷甫瀛楀箷浼樺厛锛涙病鏈夊垯 faster-whisper / DashScope锛?python skills/openclaw/skill-douyin-media/scripts/douyin_media.py all \
  --url "https://v.douyin.com/xxxx/" --out outputs/鎶栭煶绱犳潗 \
  --subtitle-engine auto        # auto | local | dashscope
```

浜х墿锛?```
outputs/鎶栭煶绱犳潗/
  assets/<id>.mp4
  assets/<id>-cover.jpg
  <id>.m4a
  subtitle.srt
  meta.json
```

## 鑷缓 API锛堝彲閫夛級

```bash
# media-parser 鎴?Evil0ctal v5
set DOUYIN_API_BASE=http://127.0.0.1:8080
set DOUYIN_API_KEY=dtk_xxx        # media-parser 鍙暀绌?```

閰嶇疆鍚庤剼鏈細浼樺厛璧?API锛屽け璐ヨ嚜鍔ㄥ洖閫€鏈湴椤甸潰瑙ｆ瀽銆?
## 瀛楀箷璇存槑

- **`music.play_url` 鏄儗鏅煶涔愶紝涓嶆槸浜哄０**锛涘瓧骞曞繀椤荤敤瑙嗛閲岀殑浜哄０闊宠建锛堜紭鍏堜粠 `video.play_addr` 涓嬭浇瑙嗛鍚?ffmpeg 鎶介煶棰戯級銆?- 鑴氭湰妫€娴嬪埌鍙湁 BGM 鏃朵細鎻愮ず銆屽彧鏈夎儗鏅煶涔愶紝娌℃湁浜哄０銆嶏紝涓嶄細鎷?BGM 纭浆銆?- 瑙嗛鑷甫 caption 鏃剁洿鎺ヤ笅杞?`.srt/.vtt`銆?- `--subtitle-engine auto`锛氭湰鍦?`faster-whisper` 鍙敤灏辫蛋鏈湴锛涗笉鍙敤鑷姩鍒?DashScope Paraformer銆?- `--subtitle-engine dashscope`锛氱洿鎺ヤ簯杞啓锛堜娇鐢?`.env` 鐨?`DASHSCOPE_API_KEY`锛涢煶棰戜細鍏堜紶鍒?uguu 涓存椂鏂囦欢搴婏紝鍙鐞嗘湁鏉冨唴瀹癸級銆?- `--subtitle-engine local`锛氬繀椤诲凡瀹夎 `faster-whisper`銆?- 娌℃湁鍒欒皟鐢?`asr.py`锛坒aster-whisper锛夋湰鍦拌浆鍐欍€傞娆￠渶瑕侊細
  ```bash
  pip install faster-whisper
  set HF_ENDPOINT=https://hf-mirror.com
  ```
  妯″瀷榛樿 `base`锛孋PU 鍙窇锛沗small` 鏇村噯浣嗘洿鎱€?
## 杈圭晫

- 鍙鐞嗙敤鎴锋湁鏉冧笅杞?浜屽垱鐨勫唴瀹癸紱涓嶈缁曡繃骞冲彴璁块棶鎺у埗锛屼笉瑕佹壒閲忔姄鍙栦粬浜哄唴瀹广€?- 瑙ｆ瀽澶辫触鏃跺瀹炶鏄庯紙鐧诲綍鎬?椤甸潰鏀圭増/閾炬帴涓嶆槸鍗曟潯瑙嗛锛夛紝涓嶈缂栭€犵洿閾俱€?- 涓嶆妸 cookie銆丄PI key 鍐欒繘浜х墿鎴栧洖澶嶏紱涓嶅悜鐢ㄦ埛绱㈣鎶栭煶瀵嗙爜銆?- 鎶栭煶椤甸潰/鎺ュ彛缁忓父鍙橈紱濡傛灉鏈湴瑙ｆ瀽鎷夸笉鍒版暟鎹紝浼樺厛寤鸿鑷缓 Evil0ctal v5锛岃€屼笉鏄户缁瘯鍏叡 API銆?
