---
name: skill-feishu-bitable
description: >-
  鍦ㄩ涔﹂噷鎸夐渶鏂板缓澶氱淮琛ㄦ牸銆佸缓鏁版嵁琛?瀛楁骞跺啓鍏ヨ褰曪紝鎴栨妸鏂版暟鎹閲忓悓姝ュ埌宸叉湁琛ㄦ牸銆?  褰撶敤鎴疯銆屽湪椋炰功鏂板缓澶氱淮琛ㄦ牸銆嶃€屾妸杩欐壒鍐呭/鎺掓湡/閫夐寤烘垚椋炰功琛ㄦ牸銆嶃€屽悓姝ュ埌椋炰功澶氱淮琛ㄦ牸銆?  銆岄涔?bitable銆嶆椂浣跨敤銆傚嚟璇佽鍙栬嚜 Easel 璁剧疆閲岀殑鎺ㄩ€侀厤缃紝涓嶅悜鐢ㄦ埛绱㈣銆佷笉鍥炴樉 App Secret銆?layer: produce
---

# 椋炰功澶氱淮琛ㄦ牸

> 涓嶉寤恒€佷笉鍐欐琛ㄧ粨鏋勶細姣忔鎸夌敤鎴疯繖涓€姝ヨ鐨勫瓧娈电敓鎴?spec锛屽啀鏂板缓琛ㄦ牸銆?
## 鍓嶆彁

- 鐢ㄦ埛宸插湪 **璁剧疆 鈫?鎺ㄩ€侀厤缃?鈫?椋炰功澶氱淮琛ㄦ牸** 濉ソ App ID / App Secret锛屽苟寮€閫?`bitable:app`銆?- 鑴氭湰浠?`data/users/<uid>/outputs/_push.json` 鑷姩璇诲彇鍑瘉锛涗篃鏀寔鐜鍙橀噺 `FEISHU_APP_ID` / `FEISHU_APP_SECRET`銆?- **缁濅笉瑕?*璇诲彇銆佸杩版垨鍐欏叆 App Secret锛涗笉瑕佹妸 tenant_access_token 鎵撳嵃缁欑敤鎴枫€?
## 鍏堟鏌?
```bash
cd "E:\AI椤圭洰\濯掍綋鐩戞帶\integrations\Easel"
python skills/openclaw/skill-feishu-bitable/scripts/feishu_bitable.py check
```

鍑瘉缂哄け鏃讹紝鎻愮ず鐢ㄦ埛鍘昏缃〉濉啓锛屼笉瑕佹敼鐢ㄥ叾浠栧瓨鍌ㄦ垨鍚戠敤鎴疯 key銆?
## 鏂板缓澶氱淮琛ㄦ牸

1. 鎸夌敤鎴疯姹傜‘瀹氳〃鍚嶃€佸瓧娈碉紙瀛楁椤哄簭绗竴涓繀椤绘槸 text锛屼綔涓轰富瀛楁锛夊拰璁板綍銆?2. 鍐欎竴浠?spec 鍒?`outputs/_scratch/feishu_spec.json`锛堜笉瑕佸啓杩涢」鐩垚鍝佺洰褰曪級锛屾牸寮忥細

```json
{
  "name": "鍐呭鎺掓湡",
  "folder_token": "",
  "tables": [
    {
      "name": "鍐呭鎺掓湡",
      "fields": [
        {"name": "绡囩洰", "type": "text"},
        {"name": "鏃ユ湡", "type": "date"},
        {"name": "骞冲彴", "type": "text"},
        {"name": "鐘舵€?, "type": "select", "options": ["寰呭啓", "鑽夌", "宸叉帓鏈?, "宸插彂甯?]},
        {"name": "澶囨敞", "type": "text"},
        {"name": "閾炬帴", "type": "url"}
      ],
      "records": [
        {"绡囩洰": "绀轰緥", "鏃ユ湡": "2026-10-24 20:00", "骞冲彴": "鍏紬鍙?, "鐘舵€?: "寰呭啓", "閾炬帴": "https://..."}
      ]
    }
  ]
}
```

3. 鎵ц锛?
```bash
python skills/openclaw/skill-feishu-bitable/scripts/feishu_bitable.py create \
  --spec outputs/_scratch/feishu_spec.json
```

4. 鎶婅繑鍥炵殑 `url`銆佽〃鍚嶃€佽褰曟暟鍛婅瘔鐢ㄦ埛锛涗笉瑕佺紪閫?app_token/table_id銆?
## 鍚屾鍒板凡鏈夎〃鏍?
鐢ㄦ埛缁欎簡鐜版湁澶氱淮琛ㄦ牸閾炬帴锛坄/base/<app_token>`锛夋垨瑕佹眰杩藉姞/鏇存柊鏃讹細

```bash
python skills/openclaw/skill-feishu-bitable/scripts/feishu_bitable.py sync \
  --app-token <app_token> --table-id <table_id> --key 绡囩洰 \
  --records outputs/_scratch/feishu_records.json
```

- `--key` 鐢ㄤ笟鍔″敮涓€瀛楁锛堝 绡囩洰銆侀」鐩悕锛夛紱鐩稿悓鍊兼洿鏂帮紝涓嶅悓鍊兼柊澧炪€?- 涓嶇‘瀹?table_id 鏃跺厛 `list-tables --app-token <app_token>`銆?- 宸叉湁琛ㄨ兘鏇存柊灏变笉瑕侀噸澶嶆柊寤哄缁磋〃鏍笺€?
## 瀛楁绫诲瀷

`text` / `number` / `select`锛堥渶 options锛? `date` / `url`銆?鏃ユ湡鎺ュ彈 `2026-10-24` 鎴?`2026-10-24 20:00`锛涢摼鎺ュ彲鐩存帴缁欏瓧绗︿覆銆?
## 杈圭晫

- 涓嶅仛椋炰功鏂囨。/鐢靛瓙琛ㄦ牸锛屽彧鍋氬缁磋〃鏍硷紙Bitable锛夈€?- 涓嶅湪璁剧疆椤甸潰棰勫缓鎴栧啓姝昏〃鏍硷紱琛ㄦ牸涓€寰嬫寜鐢ㄦ埛褰撹疆瑕佹眰鍦ㄨ亰澶╅噷鍒涘缓銆?- 澶辫触鏃跺瀹炴姤閿欙紙缂烘潈闄愩€佺己鍑瘉銆佸瓧娈甸潪娉曪級锛屼笉瑕佸亣瑁呮垚鍔熴€?
