/* ============================================================
   竞品情报 · 作品评论分析 / 账号分析 / 公众号文章
   - 抖音/快手/小红书复用 intercept.mjs 的 MediaCrawler 采集器
   - 公众号：公开文章 + 可选留言（粘贴/导入/cURL/一键抓包）
   - 报告写入 <root>/intel-data/<id>.json，评论明细 <id>.comments.json
   ============================================================ */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SERVER_DIR = fileURLToPath(new URL('.', import.meta.url));
const ROOT = path.resolve(SERVER_DIR, '..');
const DATA = path.join(ROOT, 'intel-data');

const PLATFORM_LABEL = { douyin: '抖音', kuaishou: '快手', xiaohongshu: '小红书', wechat: '公众号' };
const COMMENT_CAP = 5000;
const ACCOUNT_WORKS = 20;
const ACCOUNT_COMMENTS_PER_WORK = 200;

const STOPWORDS = new Set(('这个,那个,就是,可以,什么,怎么,还是,真的,一个,我们,他们,没有,因为,所以,但是,自己,现在,感觉,知道,不是,也是,这么,那么,如果,然后,已经,一直,有点,的话,时候,东西,问题,大家,直接,这种,那种,一下,不能,不会,可能,应该,需要,比较,非常,特别,觉得,看到,评论,视频,博主,楼主,谢谢,哈哈,哈哈哈,笑,表情,还有,以及,而且,或者,不过,其实,确实,是不是,有没有,能不能,多少钱,怎么办,怎么买,推荐,求推荐,想要,一张,大流量,流量卡,手机卡,电话卡,套餐,月租,流量,通话,运营商,移动,联通,电信,广电,现在,之前,以后,今年,去年,时候,真的,感觉').split(','));

const POS = ['好', '不错', '喜欢', '支持', '靠谱', '便宜', '划算', '实惠', '推荐', '真香', '感谢', '有用', '可以', '赞', '牛', '爱了', '满意', '稳定', '方便', '省钱', '香', '值', '良心', '放心', '给力'];
const NEG = ['骗', '坑', '垃圾', '差', '贵', '慢', '卡顿', '太卡', '无语', '后悔', '退', '投诉', '难用', '坑人', '虚假', '假的', '智商税', '套路', '不靠谱', '失望', '恶心', '黑心', '跑路', '限速', '断网', '烂'];

const INTENTS = [
  { key: '购买/求推荐', re: /求推荐|求一张|求个|来一张|来个|推荐|链接|在哪买|哪里买|怎么买|怎么办理|怎么办|下单|入手|想要|求渠道|有没有.*(卡|套餐|渠道)|求卡/ },
  { key: '价格/套餐咨询', re: /多少钱|价格|月租|套餐|流量|通话|资费|贵不贵|划算|性价比|几块|几元/ },
  { key: '售后/投诉', re: /投诉|退款|退货|注销|解约|客服|骗|坑人|跑路|售后|违约金|注销/ },
  { key: '使用体验', re: /网速|信号|卡顿|太卡|限速|稳定|好用|难用|体验|覆盖|断网/ },
  { key: '询问/求证', re: /真的吗|是不是|为什么|怎么|如何|能不能|可以吗|请问|吗[？?]?$/ }
];

const num = (v) => { const n = Number(String(v == null ? '' : v).replace(/[^\d.-]/g, '')); return isFinite(n) ? n : 0; };
const pick = (o, keys) => { for (const k of keys) if (o && o[k] != null && o[k] !== '') return o[k]; return ''; };
const pct = (n, d) => (d ? Math.round((n / d) * 1000) / 10 : 0);
const avg = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const median = (a) => {
  if (!a.length) return 0;
  const b = a.slice().sort((x, y) => x - y);
  const m = Math.floor(b.length / 2);
  return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2;
};
const r1 = (n) => Math.round(n * 10) / 10;

function fmtTime(ts) {
  let n = Number(ts);
  if (!isFinite(n) || n <= 0) return '';
  if (n < 1e12) n *= 1000;
  const d = new Date(n);
  if (isNaN(d.getTime())) return '';
  const p = (x) => String(x).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
}
function hourOf(ts) {
  let n = Number(ts);
  if (!isFinite(n) || n <= 0) return -1;
  if (n < 1e12) n *= 1000;
  const d = new Date(n);
  return isNaN(d.getTime()) ? -1 : d.getHours();
}

function detectPlatform(url) {
  const u = String(url || '').toLowerCase();
  if (/douyin\.com|iesdouyin\.com/.test(u)) return 'douyin';
  if (/xiaohongshu\.com|xhslink\.com/.test(u)) return 'xiaohongshu';
  if (/kuaishou\.com|gifshow\.com|chenzhongtech\.com/.test(u)) return 'kuaishou';
  if (/mp\.weixin\.qq\.com/.test(u)) return 'wechat';
  return '';
}

function cleanText(s) {
  return String(s == null ? '' : s)
    .replace(/\[[^\]]{1,12}\]/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function keywordsOf(texts, limit = 20) {
  const map = new Map();
  for (const raw of texts) {
    const t = cleanText(raw);
    const tags = t.match(/#[^#\s]{1,20}/g) || [];
    for (const tag of tags) map.set(tag.replace(/^#/, ''), (map.get(tag.replace(/^#/, '')) || 0) + 2);
    const body = t.replace(/#[^#\s]+/g, ' ');
    const re = /[\u4e00-\u9fa5]{2,10}/g;
    let m;
    while ((m = re.exec(body))) {
      const w = m[0];
      if (STOPWORDS.has(w) || /^(.)\1+$/.test(w)) continue;
      map.set(w, (map.get(w) || 0) + 1);
    }
  }
  return [...map.entries()]
    .filter(([w, c]) => c > 1 && w.length >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word, count]) => ({ word, count }));
}

function sentimentOf(text) {
  const t = cleanText(text);
  let pos = 0; let neg = 0;
  for (const w of POS) if (t.includes(w)) pos++;
  for (const w of NEG) if (t.includes(w)) neg++;
  if (pos > neg) return 'positive';
  if (neg > pos) return 'negative';
  return 'neutral';
}

function intentOf(text) {
  const t = cleanText(text);
  for (const it of INTENTS) if (it.re.test(t)) return it.key;
  return '其他';
}

function normalizeComment(c) {
  return {
    id: String(pick(c, ['comment_id', 'id']) || ''),
    workId: String(pick(c, ['aweme_id', 'note_id', 'video_id']) || ''),
    parentId: String(pick(c, ['parent_comment_id', 'parent_id']) || '0'),
    text: cleanText(pick(c, ['content', 'comment_text', 'text'])),
    author: String(pick(c, ['nickname', 'author', 'username']) || '匿名'),
    userKey: String(pick(c, ['creator_hash', 'user_id', 'uid']) || pick(c, ['nickname']) || ''),
    likes: num(pick(c, ['like_count', 'digg_count', 'liked_count'])),
    time: pick(c, ['create_time', 'timestamp']),
    at: fmtTime(pick(c, ['create_time', 'timestamp'])),
    region: String(pick(c, ['ip_label', 'ip_location']) || ''),
    sentiment: sentimentOf(pick(c, ['content', 'comment_text', 'text'])),
    intent: intentOf(pick(c, ['content', 'comment_text', 'text']))
  };
}

function summarizeComments(comments) {
  const total = comments.length;
  const top = comments.filter((c) => c.parentId === '0' || !c.parentId).length;
  const replies = total - top;
  const users = new Set(comments.map((c) => c.userKey || c.author)).size;
  const likeArr = comments.map((c) => c.likes);
  const s = { positive: 0, neutral: 0, negative: 0 };
  const intents = {};
  const hours = Array(24).fill(0);
  for (const c of comments) {
    s[c.sentiment] = (s[c.sentiment] || 0) + 1;
    intents[c.intent] = (intents[c.intent] || 0) + 1;
    const h = hourOf(c.time);
    if (h >= 0) hours[h]++;
  }
  return {
    total, topLevel: top, replies, uniqueUsers: users,
    avgLikes: r1(avg(likeArr)), medianLikes: r1(median(likeArr)),
    maxLikes: likeArr.length ? Math.max(...likeArr) : 0,
    sentiment: {
      positive: s.positive, neutral: s.neutral, negative: s.negative,
      positivePct: pct(s.positive, total), neutralPct: pct(s.neutral, total), negativePct: pct(s.negative, total)
    },
    intents: Object.entries(intents).sort((a, b) => b[1] - a[1]).map(([key, count]) => ({ key, count, pct: pct(count, total) })),
    hours
  };
}

const PROVINCES = new Set(['北京', '天津', '河北', '山西', '内蒙古', '辽宁', '吉林', '黑龙江', '上海', '江苏', '浙江', '安徽', '福建', '江西', '山东', '河南', '湖北', '湖南', '广东', '广西', '海南', '重庆', '四川', '贵州', '云南', '西藏', '陕西', '甘肃', '青海', '宁夏', '新疆', '台湾', '香港', '澳门']);

function normalizeRegion(s) {
  let r = String(s || '').replace(/\s+/g, '').trim();
  if (!r) return '';
  r = r.replace(/壮族|回族|维吾尔|自治区|特别行政区|省|市/g, '');
  if (r.includes('香港')) return '香港';
  if (r.includes('澳门')) return '澳门';
  if (r.includes('台湾')) return '台湾';
  if (!PROVINCES.has(r)) return '';
  return r;
}

function regionStats(comments) {
  const m = new Map();
  for (const c of comments) {
    const r = normalizeRegion(c.region);
    if (!r) continue;
    m.set(r, (m.get(r) || 0) + 1);
  }
  return [...m.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

const QUESTION_RULES = [
  { label: '怎么办理', re: /怎么办理|怎么办|如何办理|怎么弄|怎么申请/ },
  { label: '价格/资费', re: /多少钱|价格|月租|资费|贵不贵|几块|几元|收费标准/ },
  { label: '求推荐', re: /推荐|求一张|求个|哪家好|选哪个|什么卡好/ },
  { label: '在哪买', re: /在哪买|哪里买|怎么买|链接|渠道|下单/ },
  { label: '网速/信号', re: /网速|信号|卡顿|太卡|限速|断网|慢/ },
  { label: '套餐内容', re: /套餐|流量|通话|定向|通用/ },
  { label: '售后/注销', re: /注销|退款|售后|投诉|客服|解约/ },
  { label: '是否靠谱', re: /靠谱|骗|坑|真假|套路/ }
];

function questionStats(comments) {
  const map = new Map();
  for (const c of comments) {
    const t = String(c.text || '');
    for (const rule of QUESTION_RULES) {
      if (!rule.re.test(t)) continue;
      const cur = map.get(rule.label) || { label: rule.label, count: 0, sample: '' };
      cur.count += 1;
      if (!cur.sample) cur.sample = t.slice(0, 120);
      map.set(rule.label, cur);
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count).slice(0, 6);
}

function moodTextOf(cs) {
  if (!cs || !cs.total) return '数据较少';
  if (cs.sentiment.negativePct >= 40 && cs.sentiment.negativePct > cs.sentiment.positivePct) return '偏负向';
  if (cs.sentiment.positivePct >= 40 && cs.sentiment.positivePct > cs.sentiment.negativePct) return '偏正向';
  return '偏中性';
}

function makeSummary({ cs, questions, isAccount, worksCount }) {
  if (!cs || !cs.total) {
    return isAccount
      ? `账号共 ${worksCount || 0} 条作品，评论区数据较少，建议结合作品主题做选题判断。`
      : '评论区数据较少，建议结合正文/作品主题做选题判断。';
  }
  const focus = (questions || []).slice(0, 2).map((q) => q.label).join('、');
  const mood = '整体' + moodTextOf(cs);
  return isAccount
    ? `账号共 ${worksCount || 0} 条作品，评论${mood}${focus ? `，用户最关心${focus}` : ''}。`
    : `共 ${cs.total} 条留言，${mood}${focus ? `，用户最关心${focus}` : ''}。`;
}

function pickTopicKeyword(keywords, title) {
  const bad = /^(不卡|卡顿|好用|挺好用|还可以|可以|看地区|不限|很慢|慢|地区|真的|感觉|现在|就是|这个|那个|没有|什么|怎么|多少|支持|感谢|喜欢|不错|便宜|划算|分钟|两张|已经|用了|流量多)/;
  const list = (keywords || []).map((k) => k.word).filter((w) => w && w.length >= 2 && w.length <= 10 && !bad.test(w));
  const product = list.filter((w) => /流量|套餐|卡|宽带|手机|电视|广电|移动|联通|电信/.test(w) && w.length <= 8);
  product.sort((a, b) => a.length - b.length);
  if (product[0]) return product[0];
  const t = String(title || '').replace(/[《》？?！!，,。.\s]/g, '');
  for (const term of ['流量卡', '流量套餐', '宽带', '手机卡', '电话卡', '广电', '移动', '联通', '电信']) {
    if (t.includes(term)) return term;
  }
  return t.slice(0, 12) || '这个产品';
}

function makeTopics({ keywords, questions, title }) {
  const kw = pickTopicKeyword(keywords, title);
  const labels = new Set((questions || []).map((q) => q.label));
  const out = [];
  const add = (t) => { if (t && !out.includes(t)) out.push(t); };
  if (labels.has('怎么办理') || labels.has('在哪买')) add(`《${kw}办理全流程：从下单到激活的避坑指南》`);
  if (labels.has('价格/资费')) add(`《${kw}价格横评：不同预算怎么选最划算》`);
  if (labels.has('网速/信号')) add(`《实测${kw}：网速、信号与限速的真实体验》`);
  if (labels.has('套餐内容')) add(`《${kw}套餐怎么选？三类人群对号入座》`);
  if (labels.has('售后/注销')) add(`《${kw}售后与注销流程一次讲清》`);
  if (labels.has('是否靠谱')) add(`《${kw}靠谱吗？拆解常见套路与真假辨别》`);
  if (labels.has('求推荐')) add(`《同价位${kw}怎么挑？5个硬指标对比》`);
  add(`《新手选${kw}：最容易踩的5个坑》`);
  add(`《${kw}适合谁？三类人群对号入座》`);
  add(`《关于${kw}，评论区最关心的5个问题》`);
  return out.slice(0, 5);
}

function topComments(comments, n = 15) {
  return comments.slice().sort((a, b) => b.likes - a.likes).slice(0, n);
}

function workMetrics(w) {
  return {
    likes: num(pick(w, ['liked_count', 'like_count', 'digg_count'])),
    collects: num(pick(w, ['collected_count', 'collect_count', 'collected'])),
    comments: num(pick(w, ['comment_count', 'comments_count'])),
    shares: num(pick(w, ['share_count', 'shared_count', 'shares'])),
    time: pick(w, ['create_time', 'publish_time', 'timestamp'])
  };
}

function workTitle(w) {
  return cleanText(pick(w, ['title', 'desc', 'content', 'note_title'])) || '(无标题)';
}

function workUrl(platform, w) {
  const given = String(pick(w, ['aweme_url', 'note_url', 'video_url', 'share_url']) || '');
  if (given) return given;
  const id = pick(w, ['aweme_id', 'note_id', 'video_id']);
  if (!id) return '';
  if (platform === 'douyin') return 'https://www.douyin.com/video/' + id;
  if (platform === 'kuaishou') return 'https://www.kuaishou.com/short-video/' + id;
  if (platform === 'xiaohongshu') return 'https://www.xiaohongshu.com/explore/' + id;
  return '';
}

function buildWorkReport({ platform, url, raw, comments }) {
  const w = (raw.works || [])[0] || {};
  const m = workMetrics(w);
  const cs = summarizeComments(comments);
  const qs = questionStats(comments);
  const kws = keywordsOf([workTitle(w), ...comments.map((c) => c.text)]);
  const top = topComments(comments, 20);
  const neg = comments.filter((c) => c.sentiment === 'negative').sort((a, b) => b.likes - a.likes).slice(0, 10);
  const mood = moodTextOf(cs);
  const focus = qs.slice(0, 2).map((q) => q.label).join('、');
  const purchase = cs.intents.find((i) => i.key === '购买/求推荐');
  const negSample = neg[0] ? neg[0].text.slice(0, 40) : '';
  const topicKw = pickTopicKeyword(kws, workTitle(w));
  const topIntent = cs.intents.find((i) => i.key !== '其他');
  const bullets = [];
  bullets.push(`核心结论：共 ${cs.total} 条评论（一级 ${cs.topLevel}、回复 ${cs.replies}），整体${mood}${focus ? `，用户最关心${focus}` : ''}。`);
  bullets.push(`情绪结构：正向 ${cs.sentiment.positivePct}%、中性 ${cs.sentiment.neutralPct}%、负向 ${cs.sentiment.negativePct}%${negSample ? `；负向原声如“${negSample}…”` : ''}。`);
  if (cs.intents.length) bullets.push(`诉求分布：${cs.intents.slice(0, 4).map((i) => `${i.key} ${i.count} 条`).join('；')}。`);
  if (kws.length) bullets.push(`内容机会：围绕「${topicKw}」做实测/对比/避坑类内容，标题可直接用评论原话。`);
  if (purchase && purchase.pct >= 5) bullets.push(`转化建议：购买/求推荐类占 ${purchase.pct}%，建议置顶回复、主页补办理入口，并用下一篇承接高频问题。`);
  else if (topIntent) bullets.push(`互动建议：优先回复「${topIntent.key}」相关留言（${topIntent.count} 条），维护评论区口碑并为下一篇收集素材。`);
  bullets.push('选题联动：上方已生成 3-5 个选题，优先做实测、避坑和人群对比。');
  bullets.push('样本说明：基于公开评论样本，结论用于方向判断，不作为定量依据。');
  return {
    id: 'CI' + Date.now() + Math.floor(Math.random() * 1000),
    kind: 'work',
    platform,
    platformLabel: PLATFORM_LABEL[platform] || platform,
    sourceUrl: url,
    createdAt: new Date().toISOString(),
    title: workTitle(w),
    author: String(pick(w, ['nickname', 'author_name', 'author']) || ''),
    cover: String(pick(w, ['cover_url', 'cover', 'image_url']) || ''),
    workUrl: workUrl(platform, w),
    publishedAt: fmtTime(m.time),
    metrics: m,
    comments: cs,
    regions: regionStats(comments),
    questions: qs,
    summary: makeSummary({ cs, questions: qs }),
    topics: makeTopics({ keywords: kws, questions: qs, title: workTitle(w) }),
    keywords: kws,
    topComments: top.map((c) => ({ author: c.author, text: c.text, likes: c.likes, at: c.at, region: c.region, sentiment: c.sentiment, intent: c.intent })),
    negative: neg.map((c) => ({ author: c.author, text: c.text, likes: c.likes, at: c.at, region: c.region })),
    bullets,
    commentTotal: comments.length
  };
}

function buildAccountReport({ platform, url, raw, comments }) {
  const works = (raw.works || []).slice();
  const rows = works.map((w) => {
    const m = workMetrics(w);
    return { title: workTitle(w), url: workUrl(platform, w), time: fmtTime(m.time), hour: hourOf(m.time), ...m };
  }).sort((a, b) => (b.time || '').localeCompare(a.time || ''));
  const likes = rows.map((r) => r.likes);
  const cmts = rows.map((r) => r.comments);
  const cols = rows.map((r) => r.collects);
  const shs = rows.map((r) => r.shares);
  const avgLikes = avg(likes);
  const hotCount = likes.length ? rows.filter((r) => r.likes >= avgLikes * 2).length : 0;
  const hot = rows.slice().sort((a, b) => b.likes - a.likes);
  const top = hot.slice(0, 10);
  const low = hot.slice().reverse().slice(0, 5);
  const hours = Array(24).fill(0);
  for (const r of rows) if (r.hour >= 0) hours[r.hour]++;
  const tags = keywordsOf(rows.map((r) => r.title), 20);
  const cs = summarizeComments(comments);
  const qs = questionStats(comments);
  const account = String(pick(works[0] || {}, ['nickname', 'author_name', 'author']) || '');
  const bullets = [];
  bullets.push(`账号「${account || '未知'}」共采集 ${rows.length} 条作品（按最新排序）。`);
  bullets.push(`单条平均：评 ${Math.round(avg(cmts))}、藏 ${Math.round(avg(cols))}、转 ${Math.round(avg(shs))}。`);
  const peak = hours.map((n, h) => ({ h, n })).sort((a, b) => b.n - a.n).slice(0, 3).filter((x) => x.n > 0);
  if (peak.length) bullets.push('发布时间集中在 ' + peak.map((x) => x.h + ' 点').join('、') + '，可作为后续发布时段参考。');
  if (tags.length) bullets.push('高频标签/主题：' + tags.slice(0, 8).map((t) => t.word).join('、') + '。');
  if (cs.total) bullets.push(`评论区共 ${cs.total} 条：正向 ${cs.sentiment.positivePct}%、负向 ${cs.sentiment.negativePct}%；主要诉求 ${cs.intents.slice(0, 3).map((i) => i.key).join('、')}。`);
  bullets.push(`建议：优先复用爆款选题「${(top[0] && top[0].title.slice(0, 24)) || '—'}」的结构；低效作品「${(low[0] && low[0].title.slice(0, 24)) || '—'}」减少同类投入。`);
  return {
    id: 'CI' + Date.now() + Math.floor(Math.random() * 1000),
    kind: 'account',
    platform,
    platformLabel: PLATFORM_LABEL[platform] || platform,
    sourceUrl: url,
    createdAt: new Date().toISOString(),
    account,
    worksCount: rows.length,
    avg: { likes: Math.round(avgLikes), comments: Math.round(avg(cmts)), collects: Math.round(avg(cols)), shares: Math.round(avg(shs)) },
    medianLikes: Math.round(median(likes)),
    hot: { count: hotCount, pct: pct(hotCount, rows.length) },
    topWorks: top.map((r) => ({ title: r.title, url: r.url, time: r.time, likes: r.likes, comments: r.comments, collects: r.collects, shares: r.shares })),
    lowWorks: low.map((r) => ({ title: r.title, url: r.url, time: r.time, likes: r.likes, comments: r.comments })),
    hours,
    keywords: tags,
    comments: cs,
    regions: regionStats(comments),
    questions: qs,
    summary: makeSummary({ cs, questions: qs, isAccount: true, worksCount: rows.length }),
    topics: makeTopics({ keywords: tags, questions: qs, title: account }),
    topComments: topComments(comments, 15).map((c) => ({ author: c.author, text: c.text, likes: c.likes, at: c.at, region: c.region, sentiment: c.sentiment, intent: c.intent })),
    bullets,
    commentTotal: comments.length
  };
}

function saveReport(report, comments) {
  mkdirSync(DATA, { recursive: true });
  writeFileSync(path.join(DATA, report.id + '.json'), JSON.stringify(report, null, 2), 'utf8');
  writeFileSync(path.join(DATA, report.id + '.comments.json'), JSON.stringify(comments, null, 2), 'utf8');
}

function listReports() {
  if (!existsSync(DATA)) return [];
  return readdirSync(DATA)
    .filter((f) => f.endsWith('.json') && !f.endsWith('.comments.json'))
    .map((f) => {
      try {
        const r = JSON.parse(readFileSync(path.join(DATA, f), 'utf8'));
        return r && r.id ? { id: r.id, kind: r.kind, platform: r.platform, platformLabel: r.platformLabel, title: r.title || r.account || '', createdAt: r.createdAt, commentTotal: r.commentTotal || 0, url: r.workUrl || r.sourceUrl || '' } : null;
      } catch { return null; }
    })
    .filter(Boolean)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

function reportMarkdown(r) {
  const L = [];
  L.push(r.kind === 'work' ? '# 竞品情报 · 作品分析' : '# 竞品情报 · 账号分析');
  L.push('');
  L.push('- 平台：' + (r.platformLabel || r.platform));
  L.push('- 时间：' + (r.createdAt || ''));
  L.push('- 来源：' + (r.sourceUrl || ''));
  L.push('');
  if (r.kind === 'work') {
    L.push('## 作品概览');
    L.push('');
    L.push('- 标题：' + (r.title || ''));
    L.push('- 作者：' + (r.author || ''));
    L.push('- 发布：' + (r.publishedAt || ''));
    if (r.metrics) L.push(`- 数据：评 ${r.metrics.comments ?? '—'} / 藏 ${r.metrics.collects ?? '—'} / 转 ${r.metrics.shares ?? '—'}`);
    L.push('');
    L.push('## 评论总览');
    L.push('');
    L.push(`- 评论 ${r.comments.total} 条（一级 ${r.comments.topLevel}、回复 ${r.comments.replies}），去重用户约 ${r.comments.uniqueUsers}`);
    L.push(`- 情感：正向 ${r.comments.sentiment.positivePct}% / 中性 ${r.comments.sentiment.neutralPct}% / 负向 ${r.comments.sentiment.negativePct}%`);
    L.push('- 诉求：' + r.comments.intents.map((i) => `${i.key} ${i.count}（${i.pct}%）`).join('；'));
    L.push('');
    L.push('## 高频词');
    L.push('');
    L.push(r.keywords.map((k) => `${k.word}(${k.count})`).join('、'));
    L.push('');
    L.push('## 选题建议');
    L.push('');
    for (const t of r.topics || []) L.push('- ' + t);
    L.push('');
    if (r.negative.length) {
      L.push('## 典型负向原声');
      L.push('');
      for (const c of r.negative) L.push(`- ${c.author}：${c.text}`);
      L.push('');
    }
  } else {
    L.push('## 账号概览');
    L.push('');
    L.push(`- 账号：${r.account || ''}`);
    L.push(`- 作品数：${r.worksCount}`);
    L.push(`- 均值：评 ${r.avg.comments} / 藏 ${r.avg.collects} / 转 ${r.avg.shares}`);
    L.push('');
    L.push('## TOP 作品');
    L.push('');
    for (const w of r.topWorks) L.push(`- ${w.title}（${w.time}）`);
    L.push('');
    L.push('## 高频标签/主题');
    L.push('');
    L.push(r.keywords.map((k) => `${k.word}(${k.count})`).join('、'));
    L.push('');
    L.push('## 选题建议');
    L.push('');
    for (const t of r.topics || []) L.push('- ' + t);
    L.push('');
  }
  L.push('## 结论与建议');
  L.push('');
  for (const b of r.bullets) L.push('- ' + b);
  L.push('');
  return L.join('\n');
}

const csvCell = (v) => {
  const s = String(v == null ? '' : v);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

function commentsCsv(comments) {
  const head = ['评论ID', '作者', '内容', '时间', '地区', '情感', '诉求', '父评论'];
  const rows = comments.map((c) => [c.id, c.author, c.text, c.at, c.region, c.sentiment, c.intent, c.parentId]);
  return '\ufeff' + [head].concat(rows).map((r) => r.map(csvCell).join(',')).join('\r\n');
}

/* ---------- 公众号文章（公开页） ---------- */
const VENV_PY = process.platform === 'win32' ? path.join('Scripts', 'python.exe') : path.join('bin', 'python');
const PY_EXE = process.env.SS_MC_PY || path.join(ROOT, '..', '..', 'vendor', 'MediaCrawler', '.venv', VENV_PY);
const WECHAT_SCRIPT = path.join(SERVER_DIR, 'wechat_article.py');

function collectWechat(url, timeoutMs = 90000) {
  return new Promise((resolve) => {
    if (!existsSync(PY_EXE)) return resolve({ ok: false, message: '缺少 Python 运行环境（MediaCrawler .venv）' });
    if (!existsSync(WECHAT_SCRIPT)) return resolve({ ok: false, message: '缺少公众号采集脚本' });
    const child = spawn(PY_EXE, [WECHAT_SCRIPT, '--url', url], {
      windowsHide: true,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' }
    });
    let out = '';
    let err = '';
    let done = false;
    const finish = (v) => { if (done) return; done = true; clearTimeout(timer); resolve(v); };
    const timer = setTimeout(() => { try { child.kill(); } catch { /* ignore */ } finish({ ok: false, message: '公众号采集超时' }); }, timeoutMs);
    child.stdout.on('data', (b) => { out += b.toString('utf8'); });
    child.stderr.on('data', (b) => { err += b.toString('utf8'); });
    child.on('error', (e) => finish({ ok: false, message: String((e && e.message) || e) }));
    child.on('close', () => {
      const line = out.trim().split(/\r?\n/).filter(Boolean).pop() || '';
      try { finish(JSON.parse(line)); } catch { finish({ ok: false, message: (err || out || '公众号采集失败').slice(-400) }); }
    });
  });
}

function parsePastedComments(text) {
  const out = [];
  for (const raw of String(text || '').split(/\r?\n/)) {
    let line = raw.trim();
    if (!line) continue;
    let likes = 0;
    let region = '';
    const lm = line.match(/[（(\[]\s*(\d+)\s*(?:赞|likes?)\s*[)）\]]\s*(【([^】]{1,12})】)?\s*$/i);
    if (lm) {
      likes = Number(lm[1]);
      if (lm[3]) region = lm[3].trim();
      line = line.slice(0, lm.index).trim();
    }
    const rm = line.match(/【([^】]{1,12})】\s*$/);
    if (!region && rm) { region = rm[1].trim(); line = line.slice(0, rm.index).trim(); }
    let author = '匿名';
    let content = line;
    const m = line.match(/^(.{1,40}?)\s*[:：]\s*(.+)$/);
    if (m) { author = m[1].trim() || '匿名'; content = m[2].trim(); }
    if (content) out.push({ author, text: content, likes, at: '', region });
  }
  return out;
}

function buildWechatReport({ url, data }) {
  const comments = (data.comments || []).map((c, i) => ({
    id: 'wx' + (i + 1), workId: '', parentId: '0',
    text: c.text, author: c.author || '匿名', userKey: c.author || '',
    likes: Number(c.likes) || 0, time: '', at: c.at || '', region: c.region || '',
    sentiment: sentimentOf(c.text), intent: intentOf(c.text)
  })).filter((c) => c.text);
  const cs = summarizeComments(comments);
  const qs = questionStats(comments);
  const kws = keywordsOf([data.title || '', String(data.body || '').slice(0, 6000), ...comments.map((c) => c.text)]);
  const m = data.metrics || {};
  const neg = comments.filter((c) => c.sentiment === 'negative').sort((a, b) => b.likes - a.likes).slice(0, 10);
  const mood = moodTextOf(cs);
  const focus = qs.slice(0, 2).map((q) => q.label).join('、');
  const purchase = cs.intents.find((i) => i.key === '购买/求推荐');
  const negSample = neg[0] ? neg[0].text.slice(0, 40) : '';
  const topicKw = pickTopicKeyword(kws, data.title);
  const topIntent = cs.intents.find((i) => i.key !== '其他');
  const bullets = [
    `核心结论：《${data.title}》共 ${cs.total || 0} 条公开留言，整体${mood}${focus ? `，用户最关心${focus}` : ''}。`,
    (m.reads != null || m.woa != null)
      ? `页面数据：阅读 ${m.reads != null ? m.reads : '—'}、在看 ${m.woa != null ? m.woa : '—'}。`
      : '',
    cs.total ? `情绪结构：正向 ${cs.sentiment.positivePct}%、中性 ${cs.sentiment.neutralPct}%、负向 ${cs.sentiment.negativePct}%${negSample ? `；负向原声如“${negSample}…”` : ''}。` : '',
    cs.intents.length ? `诉求分布：${cs.intents.slice(0, 3).map((i) => `${i.key} ${i.count} 条`).join('；')}。` : '',
    kws.length ? `内容机会：围绕「${topicKw}」做实测/流程/避坑类选题，标题可直接借用评论原话。` : '',
    purchase && purchase.pct >= 5 ? `转化建议：购买/求推荐类占 ${purchase.pct}%，建议置顶回复、主页补办理入口，并对价格/套餐问题做统一回复。` : (topIntent ? `互动建议：优先回复「${topIntent.key}」相关留言（${topIntent.count} 条），维护评论区口碑并为下一篇收集素材。` : ''),
    '选题联动：上方已生成 3-5 个选题，优先做实测、避坑和人群对比。',
    comments.length ? '样本说明：公开留言为作者展示样本（非全量），结论用于方向判断。' : ''
  ].filter(Boolean);
  const report = {
    id: 'CI' + Date.now() + Math.floor(Math.random() * 1000),
    kind: 'work', platform: 'wechat', platformLabel: '公众号',
    sourceUrl: url, createdAt: new Date().toISOString(),
    title: data.title || '(无标题)', author: data.author || '',
    cover: '', workUrl: url, publishedAt: data.publishedAt || '',
    metrics: {
      reads: m.reads != null ? m.reads : null,
      likes: m.likes != null ? m.likes : null,
      woa: m.woa != null ? m.woa : null,
      comments: comments.length
    },
    comments: cs, keywords: kws,
    regions: regionStats(comments),
    questions: qs,
    summary: makeSummary({ cs, questions: qs }),
    topics: makeTopics({ keywords: kws, questions: qs, title: data.title }),
    topComments: topComments(comments, 20).map((c) => ({ author: c.author, text: c.text, likes: c.likes, at: c.at, region: '', sentiment: c.sentiment, intent: c.intent })),
    negative: neg.map((c) => ({ author: c.author, text: c.text, likes: c.likes, at: c.at, region: '' })),
    bullets, note: data.note || '', commentTotal: comments.length
  };
  return { report, comments };
}

export function rebuildSavedReport(id) {
  const rf = path.join(DATA, id + '.json');
  const cf = path.join(DATA, id + '.comments.json');
  if (!existsSync(rf)) return null;
  const old = JSON.parse(readFileSync(rf, 'utf8'));
  const comments = existsSync(cf) ? JSON.parse(readFileSync(cf, 'utf8')) : [];
  let nr = null;
  if (old.platform === 'wechat') {
    const data = {
      title: old.title, author: old.author, publishedAt: old.publishedAt,
      metrics: old.metrics || {}, bodyLen: 0, comments, note: old.note || ''
    };
    nr = buildWechatReport({ url: old.sourceUrl || old.workUrl || '', data }).report;
  } else if (old.kind === 'work') {
    const work = {
      title: old.title, nickname: old.author, aweme_url: old.workUrl,
      create_time: 0,
      liked_count: old.metrics && old.metrics.likes,
      collected_count: old.metrics && old.metrics.collects,
      comment_count: old.metrics && old.metrics.comments,
      share_count: old.metrics && old.metrics.shares
    };
    nr = buildWorkReport({ platform: old.platform, url: old.sourceUrl || old.workUrl || '', raw: { works: [work] }, comments });
    nr.publishedAt = old.publishedAt || nr.publishedAt;
    nr.author = old.author || nr.author;
    nr.cover = old.cover || nr.cover;
    nr.workUrl = old.workUrl || nr.workUrl;
  } else {
    return old;
  }
  nr.id = old.id;
  nr.createdAt = old.createdAt;
  writeFileSync(rf, JSON.stringify(nr, null, 2), 'utf8');
  return nr;
}

export function makeIntelRoutes(crawler) {
  const json = (res, code, obj) => {
    res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(obj));
  };
  const err = (res, code, name, msg) => json(res, code, { error: { code: name, message: msg } });
  const readBody = (req) => new Promise((r) => { let s = ''; req.on('data', (c) => { s += c; }); req.on('end', () => r(s)); });
  const readJson = async (req, res) => {
    const raw = await readBody(req);
    if (!raw) { err(res, 400, 'BAD_REQUEST', 'missing JSON body'); return undefined; }
    try { return JSON.parse(raw); } catch { err(res, 400, 'BAD_REQUEST', 'invalid JSON'); return undefined; }
  };

  return [
    { m: 'GET', p: '/api/intel/platforms', h: (req, res) => json(res, 200, {
        platforms: [
          { key: 'douyin', label: '抖音' },
          { key: 'kuaishou', label: '快手' },
          { key: 'xiaohongshu', label: '小红书' },
          { key: 'wechat', label: '公众号' }
        ]
      }) },

    { m: 'GET', p: '/api/intel/reports', h: (req, res) => json(res, 200, { reports: listReports() }) },

    { m: 'POST', p: '/api/intel/work', h: async (req, res) => {
        const b = await readJson(req, res); if (b === undefined) return;
        const url = String(b.url || '').trim();
        if (!url) return err(res, 400, 'BAD_REQUEST', '请填写作品链接');
        const platform = b.platform || detectPlatform(url);
        if (!platform) return err(res, 400, 'BAD_REQUEST', '无法识别平台，请使用抖音/快手/小红书/公众号文章链接');
        if (platform === 'wechat') {
          const data = await collectWechat(url);
          if (!data.ok) return err(res, 400, 'WECHAT_FAILED', data.message || '公众号文章采集失败');
          const wxText = String(b.wechatCommentsText || '').trim();
          if (wxText) {
            data.comments = parsePastedComments(wxText);
            data.note = `留言来自手动粘贴（共 ${data.comments.length} 条），非全量。`;
          }
          const { report, comments } = buildWechatReport({ url, data });
          saveReport(report, comments);
          return json(res, 200, report);
        }
        const r = await crawler.crawlAndWait({
          platform, mode: 'detail', ids: url, maxNotes: 1,
          maxComments: Math.min(Number(b.maxComments) || COMMENT_CAP, COMMENT_CAP), subComments: true
        });
        if (r.error) return err(res, 502, 'CRAWL_FAILED', r.error);
        const comments = (r.raw.comments || []).map((c) => normalizeComment(c)).filter((c) => c.text);
        const report = buildWorkReport({ platform, url, raw: r.raw, comments });
        saveReport(report, comments);
        json(res, 200, report);
      } },

    { m: 'POST', p: '/api/intel/account', h: async (req, res) => {
        const b = await readJson(req, res); if (b === undefined) return;
        const url = String(b.url || '').trim();
        if (!url) return err(res, 400, 'BAD_REQUEST', '请填写账号主页链接');
        const platform = b.platform || detectPlatform(url);
        if (!platform) return err(res, 400, 'BAD_REQUEST', '无法识别平台，请使用抖音/快手/小红书主页链接');
        if (platform === 'wechat') return err(res, 400, 'BAD_REQUEST', '公众号暂不支持账号模式，请用「作品模式」粘贴文章链接');
        const r = await crawler.crawlAndWait({
          platform, mode: 'creator', ids: url,
          maxNotes: Math.min(Number(b.maxNotes) || ACCOUNT_WORKS, 50),
          maxComments: Math.min(Number(b.maxComments) || ACCOUNT_COMMENTS_PER_WORK, 500), subComments: false
        });
        if (r.error) return err(res, 502, 'CRAWL_FAILED', r.error);
        const comments = (r.raw.comments || []).map((c) => normalizeComment(c)).filter((c) => c.text);
        const report = buildAccountReport({ platform, url, raw: r.raw, comments });
        saveReport(report, comments);
        json(res, 200, report);
      } },

    { m: 'GET', p: '/api/intel/reports/:id', h: (req, res, pp) => {
        const f = path.join(DATA, pp.id + '.json');
        if (!existsSync(f)) return err(res, 404, 'NOT_FOUND', 'report not found');
        json(res, 200, JSON.parse(readFileSync(f, 'utf8')));
      } },

    { m: 'DELETE', p: '/api/intel/reports/:id', h: (req, res, pp) => {
        if (!/^CI\d+$/.test(pp.id)) return err(res, 400, 'BAD_REQUEST', 'invalid report id');
        const f = path.join(DATA, pp.id + '.json');
        if (!existsSync(f)) return err(res, 404, 'NOT_FOUND', 'report not found');
        try { unlinkSync(f); } catch { /* ignore */ }
        try {
          const cf = path.join(DATA, pp.id + '.comments.json');
          if (existsSync(cf)) unlinkSync(cf);
        } catch { /* ignore */ }
        json(res, 200, { ok: true });
      } },

    { m: 'GET', p: '/api/intel/reports/:id/comments', h: (req, res, pp, u) => {
        const f = path.join(DATA, pp.id + '.comments.json');
        if (!existsSync(f)) return err(res, 404, 'NOT_FOUND', 'comments not found');
        const all = JSON.parse(readFileSync(f, 'utf8'));
        const limit = Math.min(Number(u.searchParams.get('limit')) || 2000, 5000);
        json(res, 200, { total: all.length, comments: all.slice(0, limit) });
      } },

    { m: 'GET', p: '/api/intel/reports/:id/export', h: (req, res, pp, u) => {
        const f = path.join(DATA, pp.id + '.json');
        if (!existsSync(f)) return err(res, 404, 'NOT_FOUND', 'report not found');
        const report = JSON.parse(readFileSync(f, 'utf8'));
        const fmt = u.searchParams.get('format') === 'csv' ? 'csv' : 'md';
        if (fmt === 'csv') {
          const cf = path.join(DATA, pp.id + '.comments.json');
          const comments = existsSync(cf) ? JSON.parse(readFileSync(cf, 'utf8')) : [];
          res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="intel-' + pp.id + '.csv"' });
          return res.end(commentsCsv(comments));
        }
        res.writeHead(200, { 'Content-Type': 'text/markdown; charset=utf-8', 'Content-Disposition': 'attachment; filename="intel-' + pp.id + '.md"' });
        res.end(reportMarkdown(report));
      } }
  ];
}
