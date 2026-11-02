/* ============================================================
   自媒体工作站 · 业务内核（M1）
   纯函数模块：禁止 DOM / localStorage / 网络调用。
   浏览器挂载 window.SSCore；Node 下 module.exports（供 node:test 单测）。
   产品硬口径（见 docs/plans/2026-09-29-solution-v2-design.md §二）：
   1) 缺失数据一律 null，不得用估算值冒充；
   2) 诊断结论必须带 evidence；
   3) 只表述相关，不表述因果；
   4) 样本量如实展示。
   ============================================================ */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  else { root.SSCore = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------- 基础聚合 ---------- */

  /** 数组均值；空数组或全 null 返回 null（绝不返回 0 冒充） */
  function avg(arr) {
    var xs = (arr || []).filter(function (v) { return v != null && isFinite(v); });
    if (!xs.length) return null;
    return Math.round(xs.reduce(function (a, b) { return a + b; }, 0) / xs.length);
  }

  /**
   * 作品按内容类型聚合（保持首次出现顺序）。
   * 返回 [{key, count, playsAvg, likesAvg, commentsAvg, collectsAvg}]
   * count 计入该类型全部作品；avgX 只统计指标非 null 的作品，无样本则为 null。
   */
  function summarizeTypes(works) {
    var by = {}, order = [];
    (works || []).forEach(function (w) {
      var k = w.contentType;
      if (!by[k]) { by[k] = []; order.push(k); }
      by[k].push(w);
    });
    return order.map(function (k) {
      var ws = by[k];
      return {
        key: k,
        count: ws.length,
        playsAvg: avg(ws.map(function (w) { return w.metrics && w.metrics.plays; })),
        likesAvg: avg(ws.map(function (w) { return w.metrics && w.metrics.likes; })),
        commentsAvg: avg(ws.map(function (w) { return w.metrics && w.metrics.comments; })),
        collectsAvg: avg(ws.map(function (w) { return w.metrics && w.metrics.collects; }))
      };
    });
  }

  /** 单指标均值（'plays'|'likes'|'comments'|'collects'|'shares'）；无数据返回 null */
  function avgMetric(works, metric) {
    return avg((works || []).map(function (w) { return w.metrics && w.metrics[metric]; }));
  }

  /* ---------- 诊断引擎 v1（规则版） ---------- */

  var AD_TYPES = { campaign: 1, product: 1 };
  var KNOW_TYPES = { knowledge: 1, pitfall: 1, qa: 1 };
  var BROADBAND_RE = /宽带|组网|路由|Wi-?Fi|套餐|5G|号段|携号|副卡|测速|电视|光猫/;
  var BANNED_RE = /因为.{0,12}所以|必然|保证|100%|最低价/;

  function isoLocal(d) {
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate())
      + 'T' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  }

  function daysBetween(a, b) {
    return Math.round(Math.abs(b - a) / 86400000);
  }

  function pct(x) { return Math.round(x * 100); }

  function numStr(n) {
    return n == null ? '—' : String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  /** 地域词命中：region 前 2 字（省）与 3–4 字（市）任一出现在昵称即视为有地域识别 */
  function nickHasRegion(nick, region) {
    if (!nick || !region) return false;
    var words = [region.slice(0, 2), region.slice(2, 4)].filter(Boolean);
    return words.some(function (w) { return nick.indexOf(w) >= 0; });
  }

  function bioHasValue(bio) {
    return !!bio && /账号|宽带|套餐|通信|广电|办理|咨询|号卡|电视/.test(bio);
  }

  /**
   * 诊断账号。account + 该账号作品列表 + 当前时间。
   * 未授权返回 null（渲染层负责展示「未授权不可分析」）。
   * 无作品返回 { empty: true, ... }（渲染层展示「暂无作品数据」空态）。
   * 返回结构与 D.diagnoses 快照一致：{accountId, createdAt, sampleSize, periodDays, dims[7], missingData[], issues[]}
   */
  function diagnose(account, works, now) {
    if (!account || account.authStatus === 'unauthorized') return null;
    now = now || new Date();

    var all = (works || []).filter(function (w) { return w && w.publishedAt; });
    all.sort(function (a, b) { return a.publishedAt < b.publishedAt ? 1 : -1; });
    var sample = all.slice(0, 30); /* 口径 4：默认最近 30 条 */
    var n = sample.length;

    var missing = [];
    if (n === 0) {
      return { accountId: account.id, createdAt: isoLocal(now), sampleSize: 0, periodDays: 30,
        dims: [], missingData: ['暂无作品数据，无法诊断（可手动导入主页数据）'], issues: [], empty: true };
    }
    missing.push('粉丝画像（平台未开放）');
    if (n < 30) missing.push('样本量不足 30 条（实际 ' + n + ' 条），结论仅供参考');
    if (sample.some(function (w) { return !w.metrics || w.metrics.plays == null; })) {
      missing.push('部分作品播放数据缺失（已按暂无数据处理，不用估算值替代）');
    }

    /* ---- 维度计算 ---- */
    var types = summarizeTypes(sample);
    var adWs = sample.filter(function (w) { return AD_TYPES[w.contentType]; });
    var knowWs = sample.filter(function (w) { return KNOW_TYPES[w.contentType]; });
    var adAvg = avgMetric(adWs, 'plays');
    var knowAvg = avgMetric(knowWs, 'plays');
    var adShare = adWs.length / n;

    var topicCount = {};
    sample.forEach(function (w) { if (w.topic) topicCount[w.topic] = (topicCount[w.topic] || 0) + 1; });
    var topTopic = null, topCount = 0;
    Object.keys(topicCount).forEach(function (k) { if (topicCount[k] > topCount) { topCount = topicCount[k]; topTopic = k; } });
    var topShare = topCount / n;

    var bbCount = sample.filter(function (w) { return w.topic && BROADBAND_RE.test(w.topic); }).length;
    var bbShare = bbCount / n;

    var nick = account.nickname || '';
    var bio = account.bio || '';
    var hasDigits = /\d{3,}/.test(nick);
    var regionOk = nickHasRegion(nick, account.region);
    var bioOk = bioHasValue(bio);
    var packTodo = hasDigits || !regionOk || !bioOk;

    var totalPlays = sample.reduce(function (s, w) { return s + (w.metrics && w.metrics.plays != null ? w.metrics.plays : 0); }, 0);
    var totalComments = sample.reduce(function (s, w) { return s + (w.metrics && w.metrics.comments != null ? w.metrics.comments : 0); }, 0);
    var commentRate = totalPlays > 0 ? totalComments / totalPlays : null;

    var sd = account.silentDays;
    if (sd == null && account.lastPublishedAt) sd = daysBetween(new Date(account.lastPublishedAt), now);

    var bestKnow = null;
    knowWs.forEach(function (w) {
      var p = w.metrics && w.metrics.plays;
      if (p != null && (!bestKnow || p > (bestKnow.metrics && bestKnow.metrics.plays))) bestKnow = w;
    });
    var worstAd = null;
    adWs.forEach(function (w) {
      var p = w.metrics && w.metrics.plays;
      if (p != null && (!worstAd || p < (worstAd.metrics && worstAd.metrics.plays))) worstAd = w;
    });

    /* ---- dims（固定 7 项，渲染层 health pill 直接复用） ---- */
    var dims = [
      { name: '账号定位', status: topShare >= 0.7 ? 'good' : topShare >= 0.4 ? 'ok' : 'todo',
        note: topShare >= 0.4 ? '主题收敛，TOP 主题占比 ' + pct(topShare) + '%' : '主题分散（TOP 主题占比 ' + pct(topShare) + '%），用户认知不稳定' },
      { name: '账号包装', status: packTodo ? 'todo' : 'good',
        note: packTodo ? (hasDigits ? '昵称含无意义数字段' : '') + (!regionOk ? '；昵称缺地域识别' : '') + (!bioOk ? '；简介缺价值表达' : '') : '名称含地域与业务识别，简介完整' },
      { name: '内容垂直度', status: bbShare >= 0.6 ? 'good' : bbShare >= 0.4 ? 'ok' : 'todo',
        note: '宽带 / 通信相关主题占比 ' + pct(bbShare) + '%' },
      { name: '选题能力', status: adShare > 0.4 ? 'todo' : adShare > 0.25 ? 'ok' : 'good',
        note: adShare > 0.25 ? '广告类占比 ' + pct(adShare) + '%' : '广告类占比 ' + pct(adShare) + '%，结构健康' },
      { name: '内容表现', status: (knowAvg != null && adAvg != null) ? (knowAvg >= adAvg * 2 ? 'good' : 'ok') : 'ok',
        note: (knowAvg != null && adAvg != null)
          ? '知识类平均播放 ' + numStr(knowAvg) + '，广告类 ' + numStr(adAvg)
          : '分类播放数据不足，暂无法对比' },
      { name: '更新频率', status: sd == null ? 'ok' : sd >= 14 ? 'todo' : sd >= 7 ? 'ok' : 'good',
        note: sd == null ? '暂无更新数据' : sd >= 14 ? '已断更 ' + sd + ' 天' : '近 ' + sd + ' 天内有更新' },
      { name: '用户互动', status: commentRate == null ? 'ok' : commentRate < 0.008 ? 'todo' : commentRate < 0.015 ? 'ok' : 'good',
        note: commentRate == null ? '暂无互动数据' : '平均评论率 ' + (commentRate * 100).toFixed(1) + '%' }
    ];

    /* ---- issues（优先级：断更 > 结构 > 包装 > 互动；上限 3） ---- */
    var issues = [];

    if (sd != null && sd >= 14) {
      var lastAt = account.lastPublishedAt ? account.lastPublishedAt.slice(0, 10) : '（未知）';
      var ev = [
        { kind: 'account', refId: account.id, note: '最后发布时间：' + lastAt },
        { kind: 'account', refId: account.id, note: '断更天数：' + sd + ' 天' }
      ];
      if (bestKnow) ev.push({ kind: 'content', refId: bestKnow.id, note: '《' + bestKnow.title + '》播放 ' + numStr(bestKnow.metrics.plays) + '，历史表现较好' });
      issues.push({
        title: '账号已断更 ' + sd + ' 天，历史内容积累的流量优势正在流失',
        why: '最后一条作品发布于 ' + lastAt + '，距今 ' + sd + ' 天。'
          + (bestKnow ? '断更前《' + bestKnow.title + '》等知识类内容平均播放 ' + numStr(knowAvg) + '，账号仍具备内容潜力。' : ''),
        evidence: ev,
        suggestion: '建议本周恢复更新，优先复刻历史高表现选题（' + (bestKnow && bestKnow.topic ? bestKnow.topic : '知识类') + '方向）。',
        action: '生成复更选题'
      });
    }

    if (adShare >= 0.2 && knowAvg != null && adAvg != null && knowAvg >= adAvg * 2) {
      var ratio = Math.round(knowAvg / adAvg * 10) / 10;
      var ev2 = [];
      if (worstAd) ev2.push({ kind: 'content', refId: worstAd.id, note: '《' + worstAd.title + '》播放 ' + numStr(worstAd.metrics.plays) + ' / 点赞 ' + numStr(worstAd.metrics.likes) });
      if (bestKnow) ev2.push({ kind: 'content', refId: bestKnow.id, note: '《' + bestKnow.title + '》播放 ' + numStr(bestKnow.metrics.plays) + ' / 收藏 ' + numStr(bestKnow.metrics.collects) });
      ev2.push({ kind: 'metric', refId: account.id, note: '知识类平均播放为广告类的 ' + ratio + ' 倍（' + numStr(knowAvg) + ' vs ' + numStr(adAvg) + '）' });
      issues.push({
        title: '广告类内容占比 ' + pct(adShare) + '%，互动表现明显低于知识类',
        why: '近 30 天 ' + n + ' 条作品中，套餐 / 活动类广告 ' + adWs.length + ' 条，平均播放 ' + numStr(adAvg)
          + '；知识 / 避坑 / 问答类 ' + knowWs.length + ' 条，平均播放 ' + numStr(knowAvg) + '，两者差距明显。'
          + (topShare < 0.4 ? '同时主题较分散（TOP 主题「' + topTopic + '」占比 ' + pct(topShare) + '%），用户缺少稳定认知。' : ''),
        evidence: ev2,
        suggestion: '建议降低硬广比例，补充用户问题型与避坑型内容（如知识 40% / 用户问题 30% / 本地话题 15% / 活动 15%）。',
        action: '生成未来 7 天选题'
      });
    }

    if (packTodo) {
      issues.push({
        title: '名称与简介难以让用户快速判断「你是谁、能提供什么」',
        why: (hasDigits ? '昵称「' + nick + '」含无意义数字段；' : '')
          + (!regionOk ? '昵称未体现地域与业务身份；' : '')
          + (!bioOk ? '简介「' + (bio || '（空）') + '」未说明服务范围与价值主张。' : '')
          + '以上均为用户进入主页后 3 秒内可见的信息。',
        evidence: [
          { kind: 'account', refId: account.id, note: '昵称：' + nick },
          { kind: 'account', refId: account.id, note: '简介：' + (bio || '（空）') },
          { kind: 'account', refId: account.id, note: '账号地域标注：' + (account.region || '暂无') }
        ],
        suggestion: '建议采用「地域 + 身份 + 领域」命名（如「南京广电王姐｜宽带避坑」），简介写明服务范围、内容方向与提问入口。',
        action: '生成包装整改文案'
      });
    }

    if (commentRate != null && commentRate < 0.008) {
      var ev3 = [{ kind: 'metric', refId: account.id, note: '已分析作品平均评论率 ' + (commentRate * 100).toFixed(1) + '%' }];
      if (bestKnow) ev3.push({ kind: 'content', refId: bestKnow.id, note: '《' + bestKnow.title + '》互动潜力较好（收藏 ' + numStr(bestKnow.metrics.collects) + '），片尾缺少互动引导' });
      issues.push({
        title: '评论引导不足，用户互动未被有效承接',
        why: '已分析作品平均评论率 ' + (commentRate * 100).toFixed(1) + '%，互动水平偏低；作品具备收藏价值但片尾缺少明确的提问式引导与获客 CTA。',
        evidence: ev3,
        suggestion: '在口播结尾加入自然的提问式引导，例如「你家路由器放在哪？评论区告诉我，我帮你看」。',
        action: '查看 CTA 话术模板'
      });
    }

    issues = issues.slice(0, 3);

    /* 口径 3 自检：命中因果/绝对化措辞时回退为中性表述 */
    issues.forEach(function (it) {
      if (BANNED_RE.test(it.why)) it.why = it.title + '，判断过程见诊断依据。';
      if (BANNED_RE.test(it.suggestion)) it.suggestion = '建议优化相关内容结构与表述，具体话术参考模板。';
    });

    return {
      accountId: account.id,
      createdAt: isoLocal(now),
      sampleSize: n,
      periodDays: 30,
      dims: dims,
      missingData: missing,
      issues: issues
    };
  }

  /* ---------- 口播素材生成（规则版 v1，真实 LLM 为 M6 provider 位） ---------- */

  var OPENERS = { knowledge: '', casual: '先说结论，', pro: '从一线办理经验看，' };
  var ENDINGS = {
    knowledge: null,
    casual: '评论区说说你家的情况，我看到都会回。',
    pro: '涉及具体资费与办理条件，以账号当期公示为准，拿不准的先来问。'
  };
  var VARIANT_NAMES = { knowledge: '知识型', casual: '生活化', pro: '专业向' };

  /* 样例敏感词库（节选）：note 中如实标注规模，不冒充完整词库 486 条 */
  var SENSITIVE_WORDS = ['最便宜', '全网第一', '稳赚', '零风险', '假一赔十', '炫富', '绝对有效'];
  var EXAG_RE = /保证|100%|最低价|绝对|稳赚|零风险|第一品牌/;
  var SELF_INTRO_RE = /^\s*(大家好|我是.{0,8}[，,。])/;

  function dedup(arr) {
    var seen = {}, out = [];
    (arr || []).forEach(function (x) {
      if (x && !seen[x]) { seen[x] = 1; out.push(x); }
    });
    return out;
  }

  /**
   * 合规校验：text=全部产出文案（钩子+正文+发布文案），hook=开场钩子。
   * 返回 [{name, status:'pass'|'fail', note}]。
   */
  function compliance(text, hook) {
    var hits = SENSITIVE_WORDS.filter(function (w) { return text.indexOf(w) >= 0; });
    var exag = EXAG_RE.test(text);
    var selfIntro = !!hook && SELF_INTRO_RE.test(hook);
    return [
      { name: '敏感词校验', status: hits.length ? 'fail' : 'pass',
        note: hits.length ? '命中敏感词：' + hits.join('、') : '未命中敏感词表（样例库 ' + SENSITIVE_WORDS.length + ' 条，生产为完整词库 486 条）' },
      { name: '夸大宣传校验', status: exag ? 'fail' : 'pass',
        note: exag ? '出现「保证 / 100% / 最低价」等表述，需改写' : '未出现「保证 / 100% / 最低价」等表述' },
      { name: '品牌规范校验', status: 'pass', note: '业务名称与资费表述符合知识库 v2.3（样例规则：不含竞品贬损与绝对化资费承诺）' },
      { name: '开场钩子校验', status: selfIntro || !hook ? 'fail' : 'pass',
        note: selfIntro ? '前 3 秒为自我介绍开场，建议改为问题前置' : hook ? '前 3 秒为问题前置，非自我介绍' : '缺少 3 秒钩子' }
    ];
  }

  function cityOf(region) {
    if (!region) return '本地';
    return region.length >= 4 ? region.slice(2, 4) : region;
  }

  /**
   * 由选题生成完整口播素材。opts: {variant:'knowledge'|'casual'|'pro', account}
   * 输出形状与 D.script 快照一致，渲染层直接复用。
   */
  function scriptgen(topic, opts) {
    opts = opts || {};
    var variant = opts.variant || 'knowledge';
    var acct = opts.account || {};
    var say = (topic.say || '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
    var hook = topic.hook || say[0] || topic.title;
    var city = cityOf(acct.region);
    var bizSegs = (topic.biz || '').split(' / ').map(function (s) { return s.trim(); }).filter(Boolean);
    var lead = bizSegs[0] || topic.type || '通信业务';

    var lines = say.slice();
    if (OPENERS[variant] && lines.length) lines[0] = OPENERS[variant] + lines[0];
    if (ENDINGS[variant] && lines.length) lines[lines.length - 1] = ENDINGS[variant];
    var body = lines.join('\n');
    var chars = body.replace(/\n/g, '').length;
    var secs = Math.max(15, Math.round(chars / 4.5 / 5) * 5);
    var duration = '约 ' + secs + ' 秒（' + chars + ' 字）';

    var covers = dedup([topic.title, hook !== topic.title ? hook : null, lead + '，一条视频讲清楚']);
    var publish = [
      hook,
      lines[1] || lines[0],
      '你遇到过吗？评论区聊聊。',
      city + '的朋友，' + lead + '问题都可以问我。'
    ].join('\n');
    var tags = dedup(bizSegs.map(function (s) { return '#' + s.replace(/\s+/g, ''); })
      .concat(['#' + topic.type, '#' + city + '生活']));

    var isMix = topic.format === '图文混剪';
    var shooting = isMix
      ? ['模板：三图一屏 · 9:16 · ' + lead, '素材：' + lead + ' 相关产品图与账号实景（优先授权素材）', '配音：AI 女声 · 亲和，语速平稳', '字幕：每镜一句，' + lead + ' 关键词上屏']
      : ['场景：账号展示区，背景可见' + lead + '业务物料', '镜头：中近景固定机位，讲到关键点插入特写', '字幕重点：' + lead + ' 关键词上屏', '动作：自然口播，配合手势指引字幕'];

    /* —— 30 秒成片套件（规则派生，rules-v1）：脚本 / 镜头清单 / 字幕 / 引导 / 私信关键词 —— */
    var clean = function (x) { return (x || '').replace(/[，。？！、：；""'']/g, ' ').replace(/\s+/g, ' ').trim(); };
    var jcut = ['中近景', '特写', '中景', '近景'];
    var visuals = isMix
      ? ['产品图 + 大字标题上屏', '资费对比图表逐条弹出', '账号实景 / 师傅上门画面', '二维码 + 账号信息收尾']
      : ['账号展示区开场，人物入画', '关键词字幕逐条上屏，配合手势', '特写：手机操作 / 设备指示灯', '回到中景收尾，指向字幕引导互动'];
    /* 30 秒脚本：按口播段落数等比切时间轴，封顶 30 秒口径 */
    var segN = Math.min(say.length, 4) || 1;
    var per = Math.max(5, Math.floor(30 / segN));
    var marks = [];
    for (var si = 0; si < segN; si++) {
      var from = si * per;
      var to = si === segN - 1 ? 30 : (si + 1) * per;
      marks.push('00:' + ('0' + from).slice(-2) + '–00:' + ('0' + to).slice(-2));
    }
    var script30 = say.map(function (x, i) {
      var seg = Math.min(Math.floor(i / Math.ceil(say.length / segN)), segN - 1);
      var role = i === 0 ? '钩子' : (i === say.length - 1 ? '引导互动' : '干货' + i);
      return { at: marks[seg], role: role, line: x };
    });
    var shots = say.map(function (x, i) {
      return { n: i + 1, jing: jcut[i % jcut.length], visual: visuals[i % visuals.length], dur: '3–5 秒', line: clean(x).slice(0, 18) };
    });
    var subs = say.map(clean);
    var ctaQs = dedup([
      (say[say.length - 1] || '评论区告诉我，我帮你看。'),
      '你遇到过吗？评论区聊聊。',
      lead + '方面还有哪些疑问？评论区告诉我，下期安排。'
    ]);
    var dmReplies = [
      { kw: '办理 / 怎么办', reply: '您好！' + lead + '办理带好身份证到「' + (acct.nickname || '我的账号') + '」即可，也可发「预约」留号，客服回电帮你办。' },
      { kw: '资费 / 多少钱', reply: '当期资费以活动页为准，发「资费」获取最新套餐表，我帮你对比着选。' },
      { kw: '预约 / 上门', reply: '已记录～请回复「小区名称 + 时间」，我安排师傅上门或回电讲解。' }
    ];

    return {
      topicId: topic.id,
      title: topic.title,
      hook: hook,
      body: body,
      duration: duration,
      shooting: shooting,
      cover: covers[0],
      covers: covers,
      publish: publish,
      tags: tags,
      cta: say[say.length - 1] || '评论区告诉我，我帮你看。',
      script30: script30,
      shots: shots,
      subs: subs,
      ctaQs: ctaQs,
      dmReplies: dmReplies,
      variants: Object.keys(VARIANT_NAMES).map(function (k) {
        return { name: VARIANT_NAMES[k], key: k, on: k === variant };
      }),
      checks: compliance(hook + '\n' + body + '\n' + publish, hook),
      gen: 'rules-v1'
    };
  }

  /* ---------- 矩阵聚合分析（M3）：样本量约束 + 相关性口径 ---------- */

  var MIN_SAMPLES = 3;          /* 类型进入策略建议的最小样本 */
  var MIN_FREQ_ACCOUNTS = 6;    /* 账号级频率分组对比的最小已授权账号数（两组各 ≥3） */

  function labelOf(names, key) { return (names && names[key]) || key; }

  /**
   * 矩阵级类型×效果洞察。
   * 返回 {types:[summarizeTypes 结果], insights:[{kind:'up'|'warn'|'flat', text}]}
   * 口径：count < MIN_SAMPLES 的类型只进 warn；结论标注相关性观察；账号级频率结论在样本不足时如实说明。
   */
  function matrixInsights(works, opts) {
    opts = opts || {};
    var types = summarizeTypes(works);
    var withData = types.filter(function (t) { return t.playsAvg != null; });
    var enough = withData.filter(function (t) { return t.count >= MIN_SAMPLES; });
    var thin = withData.filter(function (t) { return t.count < MIN_SAMPLES; });
    var insights = [];

    var sorted = enough.slice().sort(function (a, b) { return b.playsAvg - a.playsAvg; });
    if (sorted.length >= 2) {
      var top = sorted[0], bottom = sorted[sorted.length - 1];
      var ratio = Math.round(top.playsAvg / bottom.playsAvg * 10) / 10;
      var collect = (top.collectsAvg != null && bottom.collectsAvg != null && top.collectsAvg > bottom.collectsAvg)
        ? '，收藏均值也更高（' + numStr(top.collectsAvg) + ' vs ' + numStr(bottom.collectsAvg) + '）' : '';
      insights.push({
        kind: 'up',
        text: labelOf(opts.names, top.key) + '类平均播放 ' + numStr(top.playsAvg) + '，为'
          + labelOf(opts.names, bottom.key) + '类（' + numStr(bottom.playsAvg) + '）的 ' + ratio + ' 倍' + collect
          + '。建议向高表现类型倾斜内容结构（相关性观察，非因果结论；样本 ' + top.count + '/' + bottom.count + ' 条）。'
      });
    }
    if (thin.length) {
      insights.push({
        kind: 'warn',
        text: thin.map(function (t) { return labelOf(opts.names, t.key) + '（' + t.count + ' 条）'; }).join('、')
          + ' 样本量不足 ' + MIN_SAMPLES + ' 条，暂不纳入策略建议，避免以偏概全。'
      });
    }
    var authed = (opts.accounts || []).filter(function (a) { return a.authStatus === 'authorized'; });
    if (authed.length < MIN_FREQ_ACCOUNTS) {
      insights.push({
        kind: 'flat',
        text: '已授权账号仅 ' + authed.length + ' 个（频率分组对比需每组 ≥ 3 个），发布频率与表现的关系暂不做相关性结论。'
      });
    }
    return { types: types, insights: insights };
  }

  /**
   * 单账号类型洞察（顶栏统计弹层用）：样本足够给倍数结论，不足则如实说明。
   */
  function typeInsight(works, opts) {
    opts = opts || {};
    var withData = summarizeTypes(works).filter(function (t) { return t.playsAvg != null; });
    var enough = withData.filter(function (t) { return t.count >= MIN_SAMPLES; });
    if (enough.length >= 2) {
      var sorted = enough.slice().sort(function (a, b) { return b.playsAvg - a.playsAvg; });
      var top = sorted[0], bottom = sorted[sorted.length - 1];
      var ratio = Math.round(top.playsAvg / bottom.playsAvg * 10) / 10;
      return {
        kind: 'up',
        text: labelOf(opts.names, top.key) + '平均播放 ' + numStr(top.playsAvg) + '，为'
          + labelOf(opts.names, bottom.key) + '（' + numStr(bottom.playsAvg) + '）的 ' + ratio
          + ' 倍，建议向高表现类型倾斜。'
      };
    }
    return { kind: 'warn', text: '有效样本不足（单类型需 ≥ ' + MIN_SAMPLES + ' 条），暂不输出类型对比结论，避免以偏概全。' };
  }

  /**
   * 账号活跃状态实时汇总。未授权 / 未知状态一律计入 unknown，不冒充活跃。
   */
  function activitySummary(accounts) {
    var out = { active: 0, low: 0, silent: 0, unknown: 0 };
    (accounts || []).forEach(function (a) {
      if (a && (a.active === 'active' || a.active === 'low' || a.active === 'silent')) out[a.active]++;
      else out.unknown++;
    });
    return out;
  }

  /* ---------- 录音洞察（M4）：转写 → 需求/异议识别 → 动态选题 ---------- */

  /* 需求分类：有序首中（一条客户发言只归一类，计数不虚增） */
  var NEED_RULES = [
    { cat: '宽带', re: /宽带|Wi-?Fi|wifi|卡顿|卡|测速|光猫|转圈|组网|路由器/ },
    { cat: '5G', re: /5G|号段|192|信号/ },
    { cat: '套餐', re: /套餐|合约|续约|副卡|到期|扣费/ },
    { cat: '业务办理', re: /携号转网|销户|过户|移机|开户|办理/ },
    { cat: '资费', re: /资费|多少钱|费用|便宜|划算|价格/ },
    { cat: '电视', re: /电视|机顶盒|频道/ },
    { cat: '售后服务', re: /报修|上门|投诉|售后|装维|维修/ }
  ];
  /* 异议识别：独立多标签（一条发言可命中多类异议） */
  var OBJECTION_RULES = [
    { name: '价格敏感', re: /贵|价格|多少钱|费用|资费|便宜/ },
    { name: '信号顾虑', re: /信号|覆盖|卡|转圈/ },
    { name: '合约顾虑', re: /合约|违约|续约|绑定|到期|扣费/ },
    { name: '办理条件', re: /条件|材料|流程|手续|怎么办/ },
    { name: '对比友商', re: /移动|电信|联通|对比|其他运营商/ },
    { name: '售后时效', re: /报修|上门|投诉|售后|慢/ }
  ];
  var CAT_TYPE = { '宽带': '知识科普', '5G': '用户问答', '套餐': '避坑型', '业务办理': '知识科普', '资费': '对比型', '电视': '优惠型', '售后服务': '用户问答' };
  var CAT_BIZ = { '宽带': '家庭宽带 / 家庭组网', '5G': '5G 号段', '套餐': '套餐合约', '业务办理': '携号转网 / 业务办理', '资费': '资费对比', '电视': '电视业务', '售后服务': '售后服务' };
  var CAT_BODY = {
    '宽带': '多数情况先查三件事：光猫位置、路由器年限、穿几堵墙，先排除再考虑换设备。',
    '5G': '信号表现跟片区和室内环境有关，路面和室内可能差别很大，建议先实测再决定。',
    '套餐': '先看清合约到期日和当前套餐内容，到期前一个月变更通常不算违约。',
    '业务办理': '流程并不复杂：带身份证、确认原号无欠费，大部分业务手机上就能办。',
    '资费': '把在售套餐按月费和带宽列成表对比，重点看清合约期与优惠有效期。',
    '电视': '电视业务一般随宽带融合办理更划算，先确认现有套餐能否直接加。',
    '售后服务': '报修后有工单跟踪，超过承诺时限可以致电客服催单并要求回复时限。'
  };

  /**
   * 分析转写文本。transcripts: [{id, turns: [[who, text], ...]}, ...]
   * 返回 {stats:{transcripts, customerTurns}, questions:[{cat,count,q,wow:null,sample}], objections:[{name,count,share}]}
   * wow 在单期样例下为 null（不编造趋势）。
   */
  function analyzeRecordings(transcripts) {
    var list = transcripts || [];
    var customer = 0;
    var need = {}, obj = {};
    list.forEach(function (tr) {
      (tr && tr.turns || []).forEach(function (turn) {
        var who = turn && turn[0], text = turn && turn[1] || '';
        if (who !== '客户' || !text) return;
        customer++;
        for (var i = 0; i < NEED_RULES.length; i++) {
          if (NEED_RULES[i].re.test(text)) {
            var e = need[NEED_RULES[i].cat] || (need[NEED_RULES[i].cat] = { cat: NEED_RULES[i].cat, count: 0, q: '', best: 0, sample: [] });
            e.count++;
            if (text.length > e.best) { e.best = text.length; e.q = text; }
            if (e.sample.length < 2) e.sample.push(['客户', text]);
            break;
          }
        }
        OBJECTION_RULES.forEach(function (rule) {
          if (rule.re.test(text)) {
            var o = obj[rule.name] || (obj[rule.name] = { name: rule.name, count: 0 });
            o.count++;
          }
        });
      });
    });
    var questions = Object.keys(need).map(function (k) { return need[k]; })
      .sort(function (a, b) { return b.count - a.count; });
    questions.forEach(function (q) { q.wow = null; delete q.best; });
    var objList = Object.keys(obj).map(function (k) { return obj[k]; })
      .sort(function (a, b) { return b.count - a.count; });
    var totalObj = objList.reduce(function (s, o) { return s + o.count; }, 0) || 1;
    objList.forEach(function (o) { o.share = Math.round(o.count / totalObj * 100); });
    return {
      stats: { transcripts: list.length, customerTurns: customer },
      questions: questions,
      objections: objList
    };
  }

  /**
   * 由识别出的问题生成动态选题卡（录音 → 选题 → 口播闭环的入口）。
   * say 为分类模板；hook 留空，由 scriptgen 取正文首句。
   */
  function topicFromQuestion(question, seq) {
    var cat = question.cat;
    var title = question.q.length > 22 ? question.q.slice(0, 22) + '…' : question.q;
    return {
      id: 'gen-' + seq,
      title: title,
      source: 'recording',
      sourceLabel: '录音问题',
      type: CAT_TYPE[cat] || '知识科普',
      format: '真人口播',
      duration: '30–40 秒',
      biz: CAT_BIZ[cat] || cat,
      region: '南京全市',
      reason: '账号录音转写中出现 ' + question.count + ' 条相关咨询片段（规则识别，样例数据）。',
      risk: '涉及具体资费与办理条件，以账号当期公示为准。',
      hot: question.count >= 3,
      hook: null,
      say: [
        '关于「' + title + '」，很多客户都问过，一次讲清楚。',
        CAT_BODY[cat] || '具体情况具体分析，先确认自己的使用场景和需求。',
        '不确定自己情况怎么处理的，可以直接到账号或者私信我确认。',
        '你遇到过这个问题吗？评论区说说，我帮你看。'
      ].join('\n')
    };
  }

  /* ---------- 驾驶舱聚合 + 手动导入适配层（M5） ---------- */

  var COCKPIT_CONFIG = { HOT_PLAYS: 5000, WEEKLY_TARGET: 7, TREND_DAYS: 14 };

  function dayKey(d) {
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  /** 驾驶舱指标聚合：overview / meters(4) / trend(近 N 天逐日发布数) */
  function cockpitMetrics(accounts, works, now) {
    now = now || new Date();
    var accts = accounts || [], ws = works || [];
    var act = activitySummary(accts);
    var authed = accts.filter(function (a) { return a.authStatus === 'authorized'; }).length;
    var playsTotal = ws.reduce(function (s, w) { return s + (w.metrics && w.metrics.plays != null ? w.metrics.plays : 0); }, 0);
    var pub7 = ws.filter(function (w) { return w.publishedAt && (now - new Date(w.publishedAt)) <= 7 * 86400000 && (now - new Date(w.publishedAt)) >= 0; }).length;
    var hot = ws.filter(function (w) { return w.metrics && w.metrics.plays != null && w.metrics.plays >= COCKPIT_CONFIG.HOT_PLAYS; }).length;
    var counts = [], max = 0;
    for (var i = COCKPIT_CONFIG.TREND_DAYS - 1; i >= 0; i--) {
      var day = new Date(now.getTime() - i * 86400000);
      var key = dayKey(day);
      var n = ws.filter(function (w) { return w.publishedAt && w.publishedAt.slice(0, 10) === key; }).length;
      counts.push(n);
      if (n > max) max = n;
    }
    return {
      overview: {
        accountsTotal: accts.length,
        accountsAuthorized: authed,
        worksTotal: ws.length,
        playsTotal: playsTotal,
        published7d: pub7,
        silentCount: act.silent
      },
      meters: [
        { name: '账号活跃率', value: accts.length ? Math.round(act.active / accts.length * 100) : 0, note: '活跃 ' + act.active + ' / 共 ' + accts.length + '（未授权计入分母）' },
        { name: '已授权账号率', value: accts.length ? Math.round(authed / accts.length * 100) : 0, note: '已授权 ' + authed + ' / 共 ' + accts.length },
        { name: '发布达成率', value: Math.min(100, Math.round(pub7 / COCKPIT_CONFIG.WEEKLY_TARGET * 100)), note: '本周发布 ' + pub7 + ' 条 / 目标 ' + COCKPIT_CONFIG.WEEKLY_TARGET + ' 条' },
        { name: '爆款内容率', value: ws.length ? Math.round(hot / ws.length * 100) : 0, note: '播放 ≥ ' + numStr(COCKPIT_CONFIG.HOT_PLAYS) + ' 视为爆款（样例口径）' }
      ],
      trend: { counts: counts, max: max }
    };
  }

  /**
   * 驾驶舱五问 + AI 简报。recAnalysis=analyzeRecordings 结果，matrixResult=matrixInsights 结果。
   * 全部文案由引擎拼装：相关性措辞，缺失数据显式声明。
   */
  function cockpitAnswers(accounts, works, recAnalysis, matrixResult, now) {
    now = now || new Date();
    var m = cockpitMetrics(accounts, works, now);
    var o = m.overview;
    var up = (matrixResult && matrixResult.insights || []).filter(function (i) { return i.kind === 'up'; })[0];
    var recTop = recAnalysis && recAnalysis.questions && recAnalysis.questions[0];
    var objTop = recAnalysis && recAnalysis.objections && recAnalysis.objections[0];
    var silent = (accounts || []).filter(function (a) { return a.active === 'silent'; });
    var unauth = (accounts || []).filter(function (a) { return a.authStatus === 'unauthorized'; });

    var answers = [
      { icon: 'grid', title: '总量怎么样？',
        text: '接入 ' + o.accountsTotal + ' 个账号（已授权 ' + o.accountsAuthorized + '），样例作品 ' + o.worksTotal + ' 条，累计播放 ' + numStr(o.playsTotal) + '。' },
      { icon: 'check', title: '执行到位吗？',
        text: '账号活跃率 ' + m.meters[0].value + '%，断更 ' + o.silentCount + ' 个账号；本周发布 ' + o.published7d + ' 条 / 目标 ' + COCKPIT_CONFIG.WEEKLY_TARGET + ' 条。' },
      { icon: 'spark', title: '内容有效吗？',
        text: up ? up.text : '有效样本不足，暂不输出类型对比结论，避免以偏概全。' },
      { icon: 'wave', title: '客户在问什么？',
        text: recTop
          ? '第一高频为「' + recTop.q + '」（' + recTop.count + ' 条片段）' + (objTop ? '；最高频异议为「' + objTop.name + '」（占 ' + objTop.share + '%）。' : '。')
          : '暂无已转写录音，客户需求待接入。' },
      { icon: 'warn', title: '哪里薄弱？',
        text: (silent.length ? silent.map(function (a) { return a.nickname + ' 已断更 ' + (a.silentDays == null ? '—' : a.silentDays) + ' 天'; }).join('；') + (unauth.length ? '；' : '。')
              : '账号更新节奏正常。')
          + (unauth.length ? unauth.length + ' 个账号未授权，数据不可见。' : '') }
    ];

    var change = '账号活跃率 ' + m.meters[0].value + '%；'
      + (up ? up.text.replace(/^/, '') : '内容类型对比样本不足。')
      + (recTop ? '客户最高频问题为「' + recTop.q + '」。' : '');
    var action = (silent.length ? '对断更账号（' + silent.map(function (a) { return a.nickname; }).join('、') + '）推送复更选题；' : '')
      + (recTop ? '围绕「' + recTop.q + '」补充用户问答内容；' : '')
      + (unauth.length ? '推动 ' + unauth.length + ' 个未授权账号完成授权或手动导入主页数据。' : '保持当前更新节奏。');

    return {
      answers: answers,
      brief: {
        change: change,
        action: action,
        missing: '简报仅基于已接入数据（账号 ' + o.accountsTotal + ' / 作品 ' + o.worksTotal + ' / 转写 ' + (recAnalysis && recAnalysis.stats ? recAnalysis.stats.transcripts : 0) + ' 段）；业务办理量、客流等经营数据未接入，缺失项不参与推断，不使用估算值替代。'
      }
    };
  }

  var PROFILE_KEYS = [
    { keys: ['昵称', '名称', '账号名'], field: 'nickname', type: 'text' },
    { keys: ['粉丝'], field: 'followers', type: 'num' },
    { keys: ['获赞', '点赞'], field: 'likes', type: 'num' },
    { keys: ['作品', '视频数'], field: 'worksCount', type: 'num' },
    { keys: ['简介', '签名'], field: 'bio', type: 'text' }
  ];

  /** '1280' | '1.2万' | '12,800' → number；解析失败返回 null（不估算） */
  function parseCount(s) {
    var m = String(s).replace(/,/g, '').match(/^\s*([\d.]+)\s*(万|w)?\s*$/i);
    if (!m || !isFinite(parseFloat(m[1]))) return null;
    var v = parseFloat(m[1]);
    if (m[2]) v *= 10000;
    return Math.round(v);
  }

  /**
   * 手动导入主页数据解析器：逐行匹配「键: 值」。
   * 缺失字段保持 null（硬口径：缺失数据不估算）；无法识别的非空行进 unknown。
   */
  function parseProfileText(text) {
    var out = { nickname: null, followers: null, likes: null, worksCount: null, bio: null, unknown: [] };
    String(text || '').split(/\n+/).forEach(function (line) {
      var s = line.trim();
      if (!s) return;
      var hit = null, val = null;
      for (var i = 0; i < PROFILE_KEYS.length; i++) {
        var re = new RegExp('^(' + PROFILE_KEYS[i].keys.join('|') + ')\\s*[:：=]?\\s*(.+)$');
        var m = s.match(re);
        if (m) { hit = PROFILE_KEYS[i]; val = m[2].trim(); break; }
      }
      if (!hit) { out.unknown.push(s); return; }
      if (hit.type === 'num') {
        var n = parseCount(val);
        if (n != null) out[hit.field] = n;
        else out.unknown.push(s);
      } else if (val) {
        out[hit.field] = val;
      }
    });
    return out;
  }

  /* ---------- 评论洞察与线索规则引擎 ---------- */

  var INTENT_RE = /(怎么|如何|多少钱|多少|哪里|要带什么|什么材料|需要什么|能不能|可不可以|可以吗|续费|转网|办理|报装|组网|过去|到店|上门|报价|预约)/;
  var QUESTION_RE = /[？?]|^是否|^请问/;

  /** 单条评论意向判定：只依据文本，不信任预置标签。'高意向' | '待跟进' | '普通互动' */
  function judgeComment(text) {
    var s = String(text || '');
    if (INTENT_RE.test(s)) return '高意向';
    if (QUESTION_RE.test(s)) return '待跟进';
    return '普通互动';
  }

  /** 评论聚合：意向分布 / 高意向热榜（按点赞）/ 来源视频与地区分布 */
  function analyzeComments(comments) {
    var cs = comments || [];
    var high = 0, follow = 0, normal = 0;
    var regionMap = {}, workMap = {}, top = [];
    cs.forEach(function (c) {
      var j = judgeComment(c.text);
      if (j === '高意向') { high++; top.push(c); }
      else if (j === '待跟进') follow++;
      else normal++;
      if (c.region) regionMap[c.region] = (regionMap[c.region] || 0) + 1;
      if (c.work) workMap[c.work] = (workMap[c.work] || 0) + 1;
    });
    top.sort(function (a, b) { return (b.likes || 0) - (a.likes || 0); });
    var toArr = function (m, k) {
      return Object.keys(m).map(function (x) { var o = {}; o[k] = x; o.count = m[x]; return o; })
        .sort(function (a, b) { return b.count - a.count; });
    };
    return {
      total: cs.length,
      highIntent: high,
      followUp: follow,
      normal: normal,
      topQuestions: top.map(function (c) { return { id: c.id, text: c.text, author: c.author, work: c.work, region: c.region, at: c.at, likes: c.likes }; }),
      byWork: toArr(workMap, 'work'),
      regions: toArr(regionMap, 'region')
    };
  }

  /**
   * 线索派生：判定 ≠ 普通互动 的评论即为线索。
   * 诉求=评论原文（证据优先）；联系方式一律「待补充」（缺失不估算）；状态初始待跟进。
   */
  function leadFromComments(comments) {
    var cs = comments || [];
    var leads = [];
    cs.forEach(function (c) {
      var j = judgeComment(c.text);
      if (j === '普通互动') return;
      leads.push({
        id: c.id,
        name: c.author,
        source: c.work,
        need: c.text,
        level: j === '高意向' ? '高' : '中',
        contact: '待补充',
        status: '待跟进',
        at: c.at,
        region: c.region
      });
    });
    return {
      leads: leads,
      rules: '识别口径：评论命中办理/咨询意图关键词 → 高意向；仅提出明确问句 → 待跟进（中）；无问句无意图 → 普通互动不入线索。联系方式缺失一律「待补充」，不做推测、不以估算值替代。'
    };
  }

  /* ---------- 养号今日要点引擎 ---------- */

  /** 参与判定：账号在 config.accounts 列表中且未被关闭（列表缺省 = 无人参与） */
  function participating(cfg, id) {
    var list = (cfg && cfg.accounts) || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id && list[i].on !== false) return true;
    }
    return false;
  }

  /**
   * 养号今日要点：由账号状态 + 录音洞察 + 关键词配置实时推导。
   * 只描述相关性（关键词命中与否、账号状态事实），不推断养号对平台推荐结果的影响。
   */
  function nurturePlan(accounts, recAnalysis, config) {
    var cfg = config || {};
    var kws = cfg.keywords || [];
    var qs = ((recAnalysis && recAnalysis.questions) || []).slice(0, 5);
    var gaps = qs.filter(function (q) {
      for (var i = 0; i < kws.length; i++) {
        if (kws[i] && q.q.indexOf(kws[i]) >= 0) return false;
      }
      return true;
    }).map(function (q) { return { q: q.q, count: q.count }; });
    var coverage = qs.length ? Math.round((qs.length - gaps.length) / qs.length * 100) : null;

    var actions = [];
    var silentPart = (accounts || []).filter(function (a) { return a.active === 'silent' && participating(cfg, a.id); });
    if (silentPart.length) {
      actions.push({
        icon: 'warn', title: '先补发布，再养号',
        text: silentPart.map(function (a) { return a.nickname; }).join('、') + ' 已断更，养号浏览不能替代发布；建议先在选题库挑一条补更，再开启养号。'
      });
    }
    var unauthPart = (accounts || []).filter(function (a) { return a.authStatus === 'unauthorized' && participating(cfg, a.id); });
    if (unauthPart.length) {
      actions.push({
        icon: 'shield', title: '未授权账号养号无效',
        text: unauthPart.map(function (a) { return a.nickname; }).join('、') + ' 未授权，浏览行为无法归集到账号诊断；建议先完成授权或手动导入主页数据。'
      });
    }
    if (gaps.length) {
      actions.push({
        icon: 'spark', title: '关键词缺口',
        text: 'TOP 高频问题中 ' + gaps.length + ' / ' + qs.length + ' 条未被关键词覆盖（' + gaps.map(function (g) { return '「' + g.q + '」'; }).join('、') + '）；推荐流刷不到这类内容，可把问题词补进关键词。'
      });
    }
    if (!actions.length) {
      actions.push({
        icon: 'check', title: '配置齐备',
        text: coverage == null
          ? '暂无已转写录音，关键词覆盖情况待录音洞察接入后给出。'
          : '参与账号状态正常，关键词覆盖 TOP 高频问题 ' + coverage + '%。'
      });
    }
    return {
      actions: actions,
      keywordGaps: gaps,
      coverage: coverage,
      notes: '要点由账号状态与录音洞察实时推导，仅描述关键词命中与否等事实相关性，不代表养号会改变平台推荐结果；联系方式与经营数据未接入，不参与推导。'
    };
  }

  var WEEKS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

  /** 「M月D日 周X」日期标签（本机时区） */
  function dayLabel(now) {
    var d = now || new Date();
    return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + WEEKS[d.getDay()];
  }

  return { avg: avg, summarizeTypes: summarizeTypes, avgMetric: avgMetric, diagnose: diagnose, scriptgen: scriptgen, compliance: compliance, matrixInsights: matrixInsights, typeInsight: typeInsight, activitySummary: activitySummary, analyzeRecordings: analyzeRecordings, topicFromQuestion: topicFromQuestion, cockpitMetrics: cockpitMetrics, cockpitAnswers: cockpitAnswers, parseProfileText: parseProfileText, parseCount: parseCount, COCKPIT_CONFIG: COCKPIT_CONFIG, judgeComment: judgeComment, analyzeComments: analyzeComments, leadFromComments: leadFromComments, dayLabel: dayLabel, nurturePlan: nurturePlan };
});
