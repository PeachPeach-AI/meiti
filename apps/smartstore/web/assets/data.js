/* ============================================================
   自媒体工作站 · 样例数据包（对应实施计划 Task 1.3）
   说明：全部为演示用样例数据，缺失指标一律 null，界面显示「暂无数据/未授权」，
        绝不使用估算值冒充真实数据（PRD §5.1.2 / §8.1）。
   ============================================================ */
(function () {
  const orgs = [
    { id: 'org-group', name: '我的主页', level: 'group', parentId: null },
    { id: 'org-prov-js', name: '江苏省', level: 'province', parentId: 'org-group' },
    { id: 'org-city-nj', name: '南京', level: 'city', parentId: 'org-prov-js' },
    { id: 'org-city-sz', name: '苏州', level: 'city', parentId: 'org-prov-js' },
    { id: 'org-dist-xw', name: '玄武区', level: 'district', parentId: 'org-city-nj' },
    { id: 'org-dist-gl', name: '鼓楼区', level: 'district', parentId: 'org-city-nj' },
    { id: 'org-store-xh', name: '我的账号', level: 'store', parentId: 'org-dist-xw' },
    { id: 'org-store-gl', name: '我的账号', level: 'store', parentId: 'org-dist-gl' },
    { id: 'org-store-xj', name: '我的账号', level: 'store', parentId: 'org-dist-gl' },
    { id: 'org-city-wx', name: '无锡', level: 'city', parentId: 'org-prov-js' },
    { id: 'org-city-cz', name: '常州', level: 'city', parentId: 'org-prov-js' },
    { id: 'org-dist-sz-yq', name: '苏州工业园区', level: 'district', parentId: 'org-city-sz' },
    { id: 'org-dist-wx-lx', name: '梁溪区', level: 'district', parentId: 'org-city-wx' },
    { id: 'org-dist-cz-tn', name: '天宁区', level: 'district', parentId: 'org-city-cz' },
    { id: 'org-store-szyq', name: '我的账号', level: 'store', parentId: 'org-dist-sz-yq' },
    { id: 'org-store-wxlx', name: '我的账号', level: 'store', parentId: 'org-dist-wx-lx' },
    { id: 'org-store-cztn', name: '我的账号', level: 'store', parentId: 'org-dist-cz-tn' },
  ];

  const stores = [
    { id: 'org-store-xh', orgId: 'org-dist-xw', name: '我的账号', status: 'active', accounts: 46, active: 31, published7d: 128, plays7d: 862000 },
    { id: 'org-store-gl', orgId: 'org-dist-gl', name: '我的账号', status: 'active', accounts: 38, active: 24, published7d: 96, plays7d: 541000 },
    { id: 'org-store-xj', orgId: 'org-dist-gl', name: '我的账号', status: 'active', accounts: 29, active: 12, published7d: 34, plays7d: 132000 },
    { id: 'org-store-szyq', orgId: 'org-dist-sz-yq', name: '我的账号', status: 'active', accounts: 41, active: 27, published7d: 88, plays7d: 486000 },
    { id: 'org-store-wxlx', orgId: 'org-dist-wx-lx', name: '我的账号', status: 'active', accounts: 33, active: 19, published7d: 62, plays7d: 312000 },
    { id: 'org-store-cztn', orgId: 'org-dist-cz-tn', name: '我的账号', status: 'active', accounts: 27, active: 14, published7d: 41, plays7d: 208000 },
  ];

  const employees = [
    { id: 'e-wang', storeId: 'org-store-xh', name: '王娟', role: '我', status: 'active' },
    { id: 'e-li', storeId: 'org-store-xh', name: '李强', role: '我', status: 'active' },
    { id: 'e-zhang', storeId: 'org-store-gl', name: '张敏', role: '我', status: 'active' },
    { id: 'e-chen', storeId: 'org-store-xh', name: '陈涛', role: '我', status: 'active' },
    { id: 'e-xu', storeId: 'org-store-xj', name: '徐娟', role: '我', status: 'active' },
    { id: 'e-zhou', storeId: 'org-store-szyq', name: '周芳', role: '我', status: 'active' },
    { id: 'e-wu', storeId: 'org-store-szyq', name: '吴磊', role: '我', status: 'active' },
    { id: 'e-sun', storeId: 'org-store-wxlx', name: '孙敏', role: '我', status: 'active' },
    { id: 'e-qian', storeId: 'org-store-cztn', name: '钱进', role: '我', status: 'active' },
  ];

  const accounts = [
    {
      id: 'sample-wang', platform: 'douyin', nickname: '王姐12345', homepage: 'https://www.douyin.com/user/sample-wang',
      orgId: 'org-store-xh', employeeId: 'e-wang', authStatus: 'authorized', followers: 1280, likes: 4300, worksCount: 22,
      bio: '记录生活，分享美好。', region: '江苏南京', verified: false, avatar: '王', tone: 'a1',
      active: 'low', lastPublishedAt: '2026-09-11T18:20:00+08:00', silentDays: 12, status: '待优化',
      login: '抖音开放平台 · 扫码授权', syncedAt: '09-23 09:12',
    },
    {
      id: 'sample-li', platform: 'kuaishou', nickname: '李哥说宽带', homepage: 'https://www.kuaishou.com/profile/sample-li',
      orgId: 'org-store-xh', employeeId: 'e-li', authStatus: 'authorized', followers: 8640, likes: 41200, worksCount: 46,
      bio: '南京宽带办理 | 5G套餐咨询 | 我的账号', region: '江苏南京', verified: false, avatar: '李', tone: 'a2',
      active: 'active', lastPublishedAt: '2026-09-22T09:10:00+08:00', silentDays: 1, status: '垂直但硬广',
      login: '快手开放平台 · 扫码授权', syncedAt: '09-23 09:20',
    },
    {
      id: 'sample-zhang', platform: 'douyin', nickname: '张敏｜南京通信小知识', homepage: 'https://www.douyin.com/user/sample-zhang',
      orgId: 'org-store-gl', employeeId: 'e-zhang', authStatus: 'authorized', followers: 5420, likes: 21300, worksCount: 31,
      bio: '南京我的账号｜每天一个宽带小知识', region: '江苏南京', verified: false, avatar: '张', tone: 'a4',
      active: 'silent', lastPublishedAt: '2026-08-28T12:00:00+08:00', silentDays: 26, status: '断更',
      login: '抖音开放平台 · 扫码授权', syncedAt: '09-23 09:26',
    },
    {
      id: 'sample-chen', platform: 'douyin', nickname: '陈涛·我的账号', homepage: 'https://www.douyin.com/user/sample-chen',
      orgId: 'org-store-xh', employeeId: 'e-chen', authStatus: 'unauthorized', followers: null, likes: null, worksCount: null,
      bio: null, region: null, verified: null, avatar: '陈', tone: 'a3',
      active: 'unknown', lastPublishedAt: null, silentDays: null, status: '未授权',
      login: null, syncedAt: null,
    },
    {
      id: 'sample-wang2', platform: 'shipinhao', nickname: '王姐讲宽带·视频号', homepage: 'https://channels.weixin.qq.com/sample-wang2',
      orgId: 'org-store-xh', employeeId: 'e-wang', authStatus: 'authorized', followers: 2140, likes: 7600, worksCount: 9,
      bio: '我的账号王姐｜宽带 · 5G · 家庭组网', region: '江苏南京', verified: false, avatar: '王', tone: 'a2',
      active: 'active', lastPublishedAt: '2026-09-20T16:00:00+08:00', silentDays: 2, status: '活跃',
      login: '视频号 · 扫码授权', syncedAt: '09-23 09:10',
    },
    {
      id: 'sample-xu', platform: 'douyin', nickname: '徐娟·我的账号', homepage: 'https://www.douyin.com/user/sample-xu',
      orgId: 'org-store-xj', employeeId: 'e-xu', authStatus: 'authorized', followers: 3180, likes: 12400, worksCount: 18,
      bio: '我的账号｜宽带办理 · 家庭组网', region: '江苏南京', verified: false, avatar: '徐', tone: 'a1',
      active: 'low', lastPublishedAt: '2026-09-19T15:00:00+08:00', silentDays: 3, status: '平稳',
      login: '抖音开放平台 · 扫码授权', syncedAt: '09-23 09:30',
    },
    {
      id: 'sample-zhou', platform: 'douyin', nickname: '周姐讲宽带', homepage: 'https://www.douyin.com/user/sample-zhou',
      orgId: 'org-store-szyq', employeeId: 'e-zhou', authStatus: 'authorized', followers: 6120, likes: 26800, worksCount: 27,
      bio: '苏州园区｜宽带避坑 · 套餐咨询', region: '江苏苏州', verified: false, avatar: '周', tone: 'a2',
      active: 'active', lastPublishedAt: '2026-09-21T19:20:00+08:00', silentDays: 1, status: '活跃',
      login: '抖音开放平台 · 扫码授权', syncedAt: '09-23 09:31',
    },
    {
      id: 'sample-wu', platform: 'kuaishou', nickname: '吴哥数码', homepage: 'https://www.kuaishou.com/profile/sample-wu',
      orgId: 'org-store-szyq', employeeId: 'e-wu', authStatus: 'authorized', followers: 4230, likes: 15200, worksCount: 21,
      bio: '我的账号｜手机数码 · 号卡', region: '江苏苏州', verified: false, avatar: '吴', tone: 'a3',
      active: 'low', lastPublishedAt: '2026-09-10T11:00:00+08:00', silentDays: 12, status: '待优化',
      login: '快手开放平台 · 扫码授权', syncedAt: '09-23 09:33',
    },
    {
      id: 'sample-sun', platform: 'douyin', nickname: '孙敏｜无锡通信', homepage: 'https://www.douyin.com/user/sample-sun',
      orgId: 'org-store-wxlx', employeeId: 'e-sun', authStatus: 'authorized', followers: 2870, likes: 9800, worksCount: 16,
      bio: '我的账号｜每天一个通信小知识', region: '江苏无锡', verified: false, avatar: '孙', tone: 'a4',
      active: 'silent', lastPublishedAt: '2026-08-30T10:00:00+08:00', silentDays: 23, status: '断更',
      login: '抖音开放平台 · 扫码授权', syncedAt: '09-23 09:35',
    },
    {
      id: 'sample-qian', platform: 'shipinhao', nickname: '钱进·常州账号', homepage: 'https://channels.weixin.qq.com/sample-qian',
      orgId: 'org-store-cztn', employeeId: 'e-qian', authStatus: 'authorized', followers: 1560, likes: 5400, worksCount: 12,
      bio: '我的账号｜宽带 · 5G套餐', region: '江苏常州', verified: false, avatar: '钱', tone: 'a1',
      active: 'active', lastPublishedAt: '2026-09-18T14:00:00+08:00', silentDays: 4, status: '活跃',
      login: '视频号 · 扫码授权', syncedAt: '09-23 09:36',
    },
  ];

  const works = [
    { id: 'w-wang-001', accountId: 'sample-wang', publishedAt: '2026-08-20T10:00:00+08:00', title: '千兆宽带为什么卧室还是卡？', contentType: 'knowledge', topic: '家庭Wi-Fi', hook: '花千兆的钱，住千兆的房，为啥还卡？', format: 'talking-head', durationSec: 38, metrics: { plays: 5600, likes: 156, comments: 28, collects: 63, shares: 12 } },
    { id: 'w-wang-002', accountId: 'sample-wang', publishedAt: '2026-08-22T18:00:00+08:00', title: '本月套餐超值优惠', contentType: 'campaign', topic: '套餐', hook: null, format: 'product', durationSec: 25, metrics: { plays: 820, likes: 18, comments: 2, collects: 1, shares: 0 } },
    { id: 'w-wang-003', accountId: 'sample-wang', publishedAt: '2026-08-25T11:30:00+08:00', title: '路由器放这三个位置，信号直接砍半', contentType: 'pitfall', topic: '家庭组网', hook: '你家路由器是不是就放在电视柜里？', format: 'talking-head', durationSec: 41, metrics: { plays: 7200, likes: 210, comments: 36, collects: 88, shares: 24 } },
    { id: 'w-wang-004', accountId: 'sample-wang', publishedAt: '2026-08-27T19:00:00+08:00', title: '账号日常｜今天来办业务的人真多', contentType: 'daily', topic: '账号日常', hook: null, format: 'vlog', durationSec: 19, metrics: { plays: 2500, likes: 65, comments: 9, collects: 6, shares: 3 } },
    { id: 'w-wang-005', accountId: 'sample-wang', publishedAt: '2026-08-29T10:00:00+08:00', title: '192 号段到底值不值得办？', contentType: 'qa', topic: '5G号段', hook: '192 号段到底能不能用？一条视频讲清楚', format: 'talking-head', durationSec: 47, metrics: { plays: 3900, likes: 118, comments: 41, collects: 41, shares: 16 } },
    { id: 'w-wang-006', accountId: 'sample-wang', publishedAt: '2026-09-01T09:00:00+08:00', title: '九月开学季套餐开抢', contentType: 'campaign', topic: '校园套餐', hook: null, format: 'product', durationSec: 22, metrics: { plays: 640, likes: 12, comments: 1, collects: 0, shares: 0 } },
    { id: 'w-wang-007', accountId: 'sample-wang', publishedAt: '2026-09-03T20:00:00+08:00', title: '南京人注意：携号转网其实只要三步', contentType: 'knowledge', topic: '携号转网', hook: '携号转网是不是很麻烦？其实只要三步', format: 'talking-head', durationSec: 52, metrics: { plays: 6100, likes: 178, comments: 52, collects: 71, shares: 29 } },
    { id: 'w-wang-008', accountId: 'sample-wang', publishedAt: '2026-09-06T14:00:00+08:00', title: '全屋 WiFi 组网到底要不要做？', contentType: 'knowledge', topic: '家庭组网', hook: '家里面积大，一个路由器真的不够用', format: 'talking-head', durationSec: 44, metrics: { plays: 4300, likes: 132, comments: 24, collects: 57, shares: 14 } },
    { id: 'w-wang-009', accountId: 'sample-wang', publishedAt: '2026-09-08T17:00:00+08:00', title: '限时活动｜办宽带送电视会员', contentType: 'campaign', topic: '融合套餐', hook: null, format: 'product', durationSec: 18, metrics: { plays: 910, likes: 21, comments: 3, collects: 2, shares: 1 } },
    { id: 'w-wang-010', accountId: 'sample-wang', publishedAt: '2026-09-11T18:20:00+08:00', title: '随手拍｜下班路上的晚霞', contentType: 'daily', topic: '生活记录', hook: null, format: 'vlog', durationSec: 14, metrics: { plays: 1200, likes: 38, comments: 4, collects: 2, shares: 1 } },
    { id: 'w-li-001', accountId: 'sample-li', publishedAt: '2026-09-20T10:00:00+08:00', title: '本月主推：千兆宽带直降 300', contentType: 'campaign', topic: '宽带资费', hook: null, format: 'product', durationSec: 20, metrics: { plays: 1560, likes: 34, comments: 6, collects: 3, shares: 2 } },
    { id: 'w-li-002', accountId: 'sample-li', publishedAt: '2026-09-22T09:10:00+08:00', title: '套餐到期不提醒？教你查合约期', contentType: 'qa', topic: '套餐合约', hook: '套餐到期了还在自动扣费？', format: 'talking-head', durationSec: 36, metrics: { plays: 8200, likes: 268, comments: 74, collects: 122, shares: 41 } },
    { id: 'w-zhang-001', accountId: 'sample-zhang', publishedAt: '2026-08-26T12:00:00+08:00', title: '宽带装完第一件事：测速怎么做才准', contentType: 'knowledge', topic: '宽带测速', hook: '测速软件都测不准？因为你少了这一步', format: 'talking-head', durationSec: 40, metrics: { plays: 9800, likes: 312, comments: 88, collects: 156, shares: 62 } },
    { id: 'w-zhang-002', accountId: 'sample-zhang', publishedAt: '2026-08-28T12:00:00+08:00', title: '副卡办理的三个常见误区', contentType: 'pitfall', topic: '副卡', hook: '副卡不是越多越划算', format: 'talking-head', durationSec: 34, metrics: { plays: 6400, likes: 205, comments: 47, collects: 91, shares: 23 } },
    { id: 'w-xu-001', accountId: 'sample-xu', publishedAt: '2026-09-12T10:00:00+08:00', title: '仙林家庭宽带怎么选更划算', contentType: 'knowledge', topic: '家庭宽带', hook: '仙林的朋友，宽带别乱办', format: 'talking-head', durationSec: 38, metrics: { plays: 4200, likes: 132, comments: 21, collects: 45, shares: 11 } },
    { id: 'w-xu-002', accountId: 'sample-xu', publishedAt: '2026-09-15T19:00:00+08:00', title: '本月套餐优惠开抢', contentType: 'campaign', topic: '套餐', hook: null, format: 'product', durationSec: 20, metrics: { plays: 760, likes: 16, comments: 2, collects: 1, shares: 0 } },
    { id: 'w-xu-003', accountId: 'sample-xu', publishedAt: '2026-09-19T15:00:00+08:00', title: '家里两室一厅要不要做组网', contentType: 'qa', topic: '家庭组网', hook: '两室一厅到底要不要组网？', format: 'talking-head', durationSec: 35, metrics: { plays: 3100, likes: 98, comments: 26, collects: 34, shares: 9 } },
    { id: 'w-zhou-001', accountId: 'sample-zhou', publishedAt: '2026-09-08T09:00:00+08:00', title: '苏州办宽带最容易踩的坑', contentType: 'knowledge', topic: '宽带避坑', hook: '办宽带前，先看这三个坑', format: 'talking-head', durationSec: 44, metrics: { plays: 8800, likes: 312, comments: 68, collects: 141, shares: 52 } },
    { id: 'w-zhou-002', accountId: 'sample-zhou', publishedAt: '2026-09-14T20:00:00+08:00', title: '路由器放错位置，千兆也白搭', contentType: 'pitfall', topic: '家庭组网', hook: '你家路由器是不是放电视柜里？', format: 'talking-head', durationSec: 41, metrics: { plays: 6900, likes: 236, comments: 54, collects: 97, shares: 31 } },
    { id: 'w-zhou-003', accountId: 'sample-zhou', publishedAt: '2026-09-21T19:20:00+08:00', title: '园区账号日常', contentType: 'daily', topic: '账号日常', hook: null, format: 'vlog', durationSec: 18, metrics: { plays: 2100, likes: 58, comments: 7, collects: 5, shares: 2 } },
    { id: 'w-wu-001', accountId: 'sample-wu', publishedAt: '2026-09-06T11:00:00+08:00', title: '19 元号卡适合谁办？', contentType: 'qa', topic: '号卡', hook: '19 元号卡到底值不值？', format: 'talking-head', durationSec: 33, metrics: { plays: 3600, likes: 118, comments: 30, collects: 41, shares: 12 } },
    { id: 'w-wu-002', accountId: 'sample-wu', publishedAt: '2026-09-10T11:00:00+08:00', title: '手机以旧换新活动', contentType: 'campaign', topic: '手机', hook: null, format: 'product', durationSec: 22, metrics: { plays: 900, likes: 20, comments: 3, collects: 1, shares: 1 } },
    { id: 'w-wu-003', accountId: 'sample-wu', publishedAt: '2026-09-13T18:00:00+08:00', title: '数码小白买手机看这四点', contentType: 'knowledge', topic: '数码', hook: '买手机别只看参数', format: 'talking-head', durationSec: 40, metrics: { plays: 5200, likes: 176, comments: 39, collects: 72, shares: 21 } },
    { id: 'w-sun-001', accountId: 'sample-sun', publishedAt: '2026-09-02T10:00:00+08:00', title: '无锡 5G 覆盖怎么样', contentType: 'knowledge', topic: '5G', hook: '无锡 5G 到底覆盖怎么样？', format: 'talking-head', durationSec: 42, metrics: { plays: 4700, likes: 158, comments: 33, collects: 66, shares: 19 } },
    { id: 'w-sun-002', accountId: 'sample-sun', publishedAt: '2026-09-05T16:00:00+08:00', title: '携号转网三步搞定', contentType: 'qa', topic: '携号转网', hook: '携号转网其实只要三步', format: 'talking-head', durationSec: 37, metrics: { plays: 2900, likes: 92, comments: 24, collects: 31, shares: 8 } },
    { id: 'w-sun-003', accountId: 'sample-sun', publishedAt: '2026-08-30T10:00:00+08:00', title: '梁溪账号套餐活动', contentType: 'campaign', topic: '套餐', hook: null, format: 'product', durationSec: 19, metrics: { plays: 680, likes: 14, comments: 1, collects: 0, shares: 0 } },
    { id: 'w-qian-001', accountId: 'sample-qian', publishedAt: '2026-09-04T14:00:00+08:00', title: '常州人办宽带看这一条', contentType: 'knowledge', topic: '家庭宽带', hook: '常州办宽带，先看这条', format: 'talking-head', durationSec: 39, metrics: { plays: 3300, likes: 108, comments: 22, collects: 47, shares: 13 } },
    { id: 'w-qian-002', accountId: 'sample-qian', publishedAt: '2026-09-12T14:00:00+08:00', title: '光猫要不要换新的', contentType: 'pitfall', topic: '光猫', hook: '师傅让你换光猫，先看这条', format: 'talking-head', durationSec: 36, metrics: { plays: 4100, likes: 139, comments: 28, collects: 59, shares: 17 } },
    { id: 'w-qian-003', accountId: 'sample-qian', publishedAt: '2026-09-18T14:00:00+08:00', title: '天宁账号日常', contentType: 'daily', topic: '账号日常', hook: null, format: 'vlog', durationSec: 17, metrics: { plays: 1500, likes: 41, comments: 5, collects: 4, shares: 1 } },
    { id: 'w-wang2-001', accountId: 'sample-wang2', publishedAt: '2026-09-16T16:00:00+08:00', title: '视频号也要发：千兆宽带怎么选', contentType: 'knowledge', topic: '家庭宽带', hook: '千兆宽带到底怎么选？', format: 'talking-head', durationSec: 39, metrics: { plays: 2600, likes: 88, comments: 16, collects: 33, shares: 9 } },
    { id: 'w-wang2-002', accountId: 'sample-wang2', publishedAt: '2026-09-20T16:00:00+08:00', title: '王姐账号日常 vlog', contentType: 'daily', topic: '账号日常', hook: null, format: 'vlog', durationSec: 16, metrics: { plays: 1300, likes: 36, comments: 4, collects: 3, shares: 1 } },
  ];

  const contentTypes = [
    { key: 'knowledge', name: '知识科普', count: 15, avgPlays: 5600, avgLikes: 156, avgCollects: 63, color: 'c1' },
    { key: 'pitfall', name: '避坑指南', count: 5, avgPlays: 7200, avgLikes: 210, avgCollects: 88, color: 'c2' },
    { key: 'qa', name: '用户问答', count: 6, avgPlays: 3900, avgLikes: 118, avgCollects: 41, color: 'c4' },
    { key: 'daily', name: '账号日常', count: 3, avgPlays: 2500, avgLikes: 65, avgCollects: 6, color: 'c5' },
    { key: 'campaign', name: '套餐广告', count: 15, avgPlays: 800, avgLikes: 18, avgCollects: 1, color: 'c3' },
  ];

  const topics = [
    { id: 't1', title: '为什么千兆宽带卧室还是卡？', source: 'recording', sourceLabel: '录音问题', type: '知识科普', format: '真人口播', duration: '30–40 秒', biz: '家庭宽带 / 家庭组网', region: '南京全市', reason: '最近 7 天账号「Wi-Fi 卡顿」咨询 1,284 次，环比 +18%，为本周第一高频问题。', risk: '避免承诺「一定解决」，只讲排查方法。', hot: true,
      hook: '花千兆的钱，住千兆的房，为什么卧室还是卡？',
      say: '先别急着骂宽带，卧室卡通常不是宽带的问题，大概率是这三个原因。\n第一，路由器放错位置了。塞在弱电箱、电视柜里，信号被金属和墙体挡掉一大半。\n第二，还在用装宽带时送的老光猫、老路由器，千兆进户、百兆出。\n第三，卧室隔了承重墙，一堵墙信号就衰减一半。\n先按这三条自己排查，再考虑做全屋组网，别一上来就加钱。\n你家路由器放在哪？评论区告诉我，我帮你看要不要换。' },
    { id: 't2', title: '192 号段信号到底怎么样？实测给你看', source: 'recording', sourceLabel: '录音问题', type: '用户问答', format: '真人口播', duration: '40–50 秒', biz: '5G 号段', region: '玄武区', reason: '「192 号段信号」咨询 962 次，环比 +6%；同时该话题历史内容平均播放高于账号均值 42%。', risk: '信号表现存在地域差异，需注明测试地点。',
      hook: '192 号段到底能不能用？我用一周实测给你看。',
      say: '很多人问我，192 号段信号到底行不行。\n先说结论：和片区有关。老小区、电梯里、地下车库确实弱，城区路面、商场、地铁里反而不错。\n这一周我在南京跑了五个点实测：新街口地铁站、紫峰大厦楼下、老小区地下车库、玄武湖公园、高速上，速率数据都放在这条视频里。\n同一张卡，不同位置速率能差出三四倍，所以别听别人一句话就下结论，要看你常待的地方。\n你住哪个小区？评论区告诉我，我帮你查这片的覆盖情况。' },
    { id: 't3', title: '携号转网全流程，3 分钟讲清楚', source: 'recording', sourceLabel: '录音问题', type: '知识科普', format: '真人口播', duration: '45–60 秒', biz: '携号转网', region: '南京全市', reason: '「携号转网流程」咨询 528 次；该账号 09-03 同主题作品播放 6,100，为近 30 天前 20%。', risk: '需注明办理条件与授权码有效期。',
      hook: '携号转网是不是很麻烦？其实只要三步。',
      say: '携号转网不用跑账号，手机上就能办，三步搞定。\n第一步，用本机号发短信查转网资格，电信发 10001、移动 10086、联通 10010，拿到授权码。\n第二步，在想转入的运营商 App 里提交申请，填授权码、选好新套餐。\n第三步，等一个小时左右生效，把新卡放进手机激活就能用。\n三个坑提前避开：授权码当天有效，拿到就办；老号码有欠费要先结清；合约没到期的话，违约金多少先问清楚再决定。\n还有不清楚的，评论区问我，我一条条回。' },
    { id: 't4', title: '开学季校园宽带怎么选？一张表看懂', source: 'manual', sourceLabel: '运营下发', type: '对比型', format: '真人口播', duration: '35–45 秒', biz: '校园套餐', region: '玄武区 / 鼓楼区', reason: '地市运营下发重点选题，有效期 09-01 至 09-30，配合开学季活动。', risk: '资费以当期活动页为准，需标注有效期。',
      hook: '开学季办宽带，别一进校门就随便签。',
      say: '开学季办校园宽带，别一进校门就随便签，先看清三件事。\n一，合约期多久，能不能覆盖到毕业，提前解约违约金怎么算。\n二，是不是强制绑定手机号，话费有没有最低消费。\n三，暑假寒假人不在学校，能不能停机保号或者远程销户。\n这三条问清楚，能省一整年的麻烦。资费和活动以当期活动页为准，签之前再核一遍。\n我把今年几个套餐整理成了对比表，放在评论区置顶。\n想让我帮你逐条看的，评论区留一下校区。' },
    { id: 't5', title: '千兆宽带 + 全屋 WiFi 组网，比单办省多少？', source: 'business', sourceLabel: '业务选题', type: '优惠型', format: '真人口播', duration: '30–40 秒', biz: '融合套餐 / 全屋组网', region: '南京市', reason: '当前主推融合套餐，业务侧希望提升组网产品渗透；账号历史组网类内容收藏率 1.3%，高于均值。', risk: '不得使用「最低价」「保证」等表述。',
      hook: '全屋组网单独装和跟宽带一起办，到底差多少钱？',
      say: '很多人家装完千兆卧室还是卡，其实是没做组网，光升宽带没用。\n全屋 WiFi 有两种做法：一种是宽带到期时跟着宽带一起办融合套餐，设备钱能摊进月费里，整体更划算；另一种是单独找师傅加装，适合宽带还没到期、又急着解决的。\n两种方案的费用、工期、适合的户型，我做了一张对比图，你可以自己对号入座。\n不管选哪种，先让师傅上门测一遍信号再决定，别瞎买设备。\n想知道你家适不适合组网，评论区说下户型面积。' },
    { id: 't6', title: '套餐到期不提醒，自动续约怎么办？', source: 'recording', sourceLabel: '录音问题', type: '避坑型', format: '真人口播', duration: '35–45 秒', biz: '套餐合约', region: '南京全市', reason: '「套餐合约 / 自动续约」咨询 741 次，环比 +11%；同类内容收藏率显著高于广告类。', risk: '需说明以合约条款为准。',
      hook: '套餐到期了还在自动扣费？先别急着骂。',
      say: '套餐到期没去变更，运营商会按原价自动给你续上，很多人多交了大半年才发觉。\n想换套餐，记住提前一个月：在官方 App 里能查到合约到期日，到期前改，不算违约。\n如果已经被自动续费了，别急着认栽——拿扣费账单找客服说明情况，是可以申请退差额的。\n当然，具体以你合约上的条款为准，每个套餐略有差别，先看条款再打电话。\n你家套餐什么时候到期？评论区告诉我，我提醒你三个关键时间点。' },
    { id: 't7', title: '路由器放哪信号最好？三个位置千万别放', source: 'account', sourceLabel: '账号适配', type: '避坑型', format: '真人口播', duration: '40 秒', biz: '家庭组网', region: '玄武区', reason: '该账号避坑类内容平均播放 7,200，为账号均值 2.4 倍，属高适配方向。', risk: '无。',
      hook: '路由器放这三个位置，信号直接砍半。',
      say: '路由器别放这三个地方：弱电箱里、电视柜下面、贴着承重墙的角落。\n弱电箱是金属的，信号出来先衰减一半；电视柜又矮又挡；承重墙里有钢筋网，一堵墙信号基本就没了。\n正确的位置是客厅开阔处、离地一米左右，天线竖着摆，尽量别隔墙。\n就挪这么一下，很多家庭信号立竿见影，比先花钱换路由器管用。\n挪完还不行，再考虑换设备或者做组网，顺序别搞反。\n你家路由器现在放哪？评论区说下，我帮你判断。' },
    { id: 't8', title: '电视 + 宽带融合套餐，到底划不划算？', source: 'business', sourceLabel: '业务选题', type: '对比型', format: '图文混剪', duration: '30 秒', biz: '电视业务 / 融合套餐', region: '南京市', reason: '电视业务咨询 331 次；账号不愿出镜，建议走图文混剪生产线。', risk: '需注明套餐包含内容与合约期。',
      hook: '电视和宽带一起办，到底划不划算？',
      say: '电视和宽带，分开办还是一起办，先算清三笔账。\n第一笔，月费：融合套餐通常比单办便宜几十块，但要看清是长期价还是首年优惠价。\n第二笔，合约期：两样绑在一起办，合约是不是同步到期，中途想停一个怎么办。\n第三笔，电视会员你到底看不看，一个月看不了几回，就是白花钱。\n三笔账算完，答案自然就出来了。\n想算你家的，评论区说下现在用的套餐，我帮你算。' },
    { id: 't9', title: '测一测：你家路由器该换了吗？3 个问题', source: 'fission', sourceLabel: '裂变话题', type: '裂变话题', format: '真人口播', duration: '25–35 秒', biz: '家庭组网', region: '南京全市', reason: '互动测试型选题：评论区回答问题即可得到判断，同类型内容的评论与转发率高于账号均值。', risk: '结论只作参考，不构成硬件必须更换的承诺。',
      hook: '三个问题，测出你家路由器该不该换。',
      say: '不用懂参数，回答三个问题，就知道你家路由器该不该换。\n第一，它是不是三年前装宽带时送的那台？老设备带不动现在的宽带。\n第二，从客厅到最远的卧室，中间要穿几堵墙？两堵以上，单台设备基本罩不住。\n第三，晚上一家人一起刷视频的人，超过三个吗？设备一多，老路由器先扛不住。\n三条里中了两条，说明它已经带不动你家的设备量了。\n不过结论只作参考，换之前先试试挪位置，别多花冤枉钱。\n评论区告诉我你中了几条。' },
    { id: 't10', title: '刚搬完家的南京人，这 4 件事别忘办', source: 'fission', sourceLabel: '裂变话题', type: '裂变话题', format: '图文混剪', duration: '30–40 秒', biz: '宽带移机 / 电视业务', region: '南京市', reason: '「搬家清单」型内容天然带转发属性，用户会主动转给正在搬家的朋友。', risk: '办理时限与费用以当期政策为准。',
      hook: '刚搬完家，宽带这 4 件事别忘办。',
      say: '刚搬完家的注意了，宽带这四件事别忘办，办晚了要跑两趟。\n一，宽带移机，提前两天约师傅，新旧地址都要有人在场。\n二，电视业务记得一起迁，别只迁宽带，到时候机顶盒看不了。\n三，老房子的套餐如果还在合约期内，问清楚能不能移转，不能就先把自动续约停了。\n四，路由器到新家要重新调一次位置，户型变了，老位置多半不合适。\n时限和费用以当期政策为准，办之前打个电话确认最稳。\n转给最近要搬家的朋友，能省半天。\n你搬家卡在哪一步？评论区说说。' },
    { id: 't11', title: '家里 Wi-Fi 名字起成这样的，一看就是干通信的', source: 'fission', sourceLabel: '裂变话题', type: '裂变话题', format: '真人口播', duration: '20–30 秒', biz: '家庭组网', region: '南京全市', reason: '身份共鸣型选题：同行与本地用户会主动在评论区晒自家名称，互动门槛极低。', risk: '不点名具体单位与品牌。',
      hook: 'Wi-Fi 名字起成这样的，一看就是干通信的。',
      say: '家里 Wi-Fi 名字叫「CMCC-5G」「家用-2.4G」这种的，八成家里有干通信的。\n我们这行起名字就三个原则：自己能一眼认出来、能分清 2.4G 和 5G 频段、千万别带生日和门牌号——那等于把家门钥匙挂门口。\n名字起得好，访客连哪个、自己连哪个，一眼就分清。\n你家 Wi-Fi 叫什么？评论区晒一下，最有趣的我在下一条里念出来。\n南京的朋友，网络问题也可以顺便问我。' },
    { id: 't12', title: '老小区、高层、地下室，宽带最容易出问题的三种房子', source: 'fission', sourceLabel: '裂变话题', type: '裂变话题', format: '真人口播', duration: '30–40 秒', biz: '家庭宽带 / 家庭组网', region: '南京全市', reason: '「对照自查」型选题：用户会对照自己家并转发给同小区的邻居，本地转发率高。', risk: '只讲共性问题，不指向具体小区。',
      hook: '这几种房子，宽带最容易出问题。',
      say: '老小区、高层、地下室，这三类房子宽带最容易出问题，看看你家是不是。\n老小区，线路用了十来年容易老化，雨天之后更容易断，报修次数明显多。\n高层，承重墙多，一台路由器怎么摆都覆盖不了全家，往往需要组网。\n地下室在地下，室外信号本身进不来，得靠专门设备往里引。\n三种情况对应三种解法，别一上来就怪宽带、换宽带，先对号入座。\n你家是哪一种？评论区告诉我，我给你说对应的解决办法。\n转给住这类房子的朋友，一起排查更快。' },
    /* ---- 选题库新增来源：视频评论 / 用户私信 / 手动录入（P0 演示样例） ---- */
    { id: 't13', title: '千兆宽带怎么测速才准？评论区问爆了', source: 'comment', sourceLabel: '视频评论', type: '知识科普', format: '真人口播', duration: '30–40 秒', biz: '家庭宽带', region: '南京全市', bizCategory: '家庭宽带', note: '来自《千兆宽带为什么卧室还是卡？》评论区高频追问：装完想自己验收，不知道怎么测。', createdAt: '2026-09-26',
      hook: '装完千兆宽带，先别急着用，测个速再说。',
      say: '评论区好多人问：宽带装完怎么自己验收？\n三个要点：\n第一，测速前把家里别的设备断掉，电视、平板全下线，只留一台手机连 5G 频段。\n第二，人站在光猫和路由器一米以内测，别躲卧室里测。\n第三，多测几次取平均，晚上八九点是高峰，慢一点正常。\n千兆宽带实测能跑到 900 上下就合格，低于 500 再找师傅。\n测完把数字打在评论区，我帮你判断正不正常。' },
    { id: 't14', title: '老人用的手机卡，哪个性价比高？', source: 'comment', sourceLabel: '视频评论', type: '用户问答', format: '真人口播', duration: '35–45 秒', biz: '套餐合约', region: '南京全市', bizCategory: '套餐合约', note: '多条评论问给父母办卡：流量要少、月租要低、最好能亲情号互打免费。', createdAt: '2026-09-28',
      hook: '给爸妈办手机卡，别按自己的习惯选。',
      say: '给老人办卡，记住三个原则，别按自己的用量来。\n第一，流量不用大，老人在家有 WiFi，出门导航刷微信，几个 G 足够，选小流量套餐月租更低。\n第二，一定要办亲情号，子女号码互打免费，老人打电话不心疼。\n第三，问清楚合约期，别图首年优惠签两年，老人换套餐不方便。\n拿不准的，带上爸妈的身份证来店里，我帮你当面算。\n你家老人现在用的什么卡？评论区说说，我看看有没有更合适的。' },
    { id: 't15', title: '宽带绑了两年合约，能提前解约吗？', source: 'dm', sourceLabel: '用户私信', type: '避坑指南', format: '真人口播', duration: '30–40 秒', biz: '套餐合约', region: '南京全市', bizCategory: '套餐合约', note: '私信原话：「当时贪便宜签了两年，现在要搬家了，违约金要 300 多，有办法少亏点吗？」', createdAt: '2026-10-01',
      hook: '宽带合约没到期就想退？先算这笔账。',
      say: '有人私信问：宽带签了两年合约，中途想退，违约金 300 多，怎么少亏点？\n分三种情况：\n第一，搬家了不销户，直接申请移机，合约继续用，一分违约金不用交，最划算。\n第二，确实不用了，违约金一般按剩余月份折算，可以打客服申请减免，态度好一点通常能少交一部分。\n第三，如果是套餐纠纷、承诺没兑现，留好办理时的录音和单据，投诉渠道是能退的。\n拿不准自己属于哪种，把情况私信发我，我帮你看看。' },
    { id: 't16', title: '搬家后光猫要不要换新的？', source: 'dm', sourceLabel: '用户私信', type: '知识科普', format: '真人口播', duration: '25–35 秒', biz: '家庭宽带', region: '南京市', bizCategory: '家庭宽带', note: '私信高频问题：搬家移机时师傅说旧光猫不支持新小区的千兆线路，要不要花钱换。', createdAt: '2026-10-02',
      hook: '搬家移机，师傅让你换光猫，先看这一条。',
      say: '搬家的时候师傅说旧光猫带不动新家的千兆，要不要换？先看光猫背面标签。\n标着 GPON 或千兆口的，大部分情况能继续用，不用换。\n只有两种情况真得换：老小区原来是百兆线路，光猫本身就是百兆的；或者新小区用的入户方式不一样，接口对不上。\n换光猫认准运营商配发，别自己在网上乱买，制式不对装不上。\n拿不准就把光猫背面拍张照发我，我帮你看看要不要换。' },
    { id: 't17', title: 'FTTR 全屋光纤到底值不值？一次讲透', source: 'manual', sourceLabel: '手动录入', type: '知识科普', format: '真人口播', duration: '40–50 秒', biz: '家庭组网', region: '南京全市', bizCategory: '家庭组网', note: '大户型客户到店必问，目前站内还没有一条讲透 FTTR 的内容，先占位。', createdAt: '2026-10-03',
      hook: '全屋光纤 FTTR，是智商税还是真香？',
      say: '最近来店里问 FTTR 的大户型客户特别多，一次讲透。\nFTTR 就是把光纤铺到每个房间，主光猫加各个房间的从光猫，全屋都跑千兆。\n它适合三种人：大平层别墅、复式、以及对每个房间网速都有要求的重度用户。\n但它不便宜，设备和施工是一笔不小的开销，普通三居室一台好的路由器加组网往往就够。\n一句话总结：房子大、预算够、要求高，上 FTTR 不亏；普通户型先试传统组网。\n你家多大面积？评论区告诉我，我帮你判断值不值。' },
    { id: 't18', title: '192 虚商号段到底能不能携号转网？', source: 'manual', sourceLabel: '手动录入', type: '用户问答', format: '真人口播', duration: '30–40 秒', biz: '携号转网', region: '南京全市', bizCategory: '携号转网', note: '录音里问过两次、评论也出现过，政策口径需要一条内容讲清楚。', createdAt: '2026-10-04',
      hook: '192 号段想携转出去？先搞清这一条。',
      say: '192 号段能不能携号转网，一条视频说清楚。\n先说结论：能不能转，看的不是号段，是你这个号码的签约主体。\n如果是虚商转售号，也就是租用运营商网络的号，大部分暂时不支持携转，得先回归基础运营商。\n如果是正规基础运营商的 192 号码，和其他号段一样，正常走携转流程。\n不确定自己是哪种，发短信查一下资格，一分钟就有结果。\n查完搞不懂的，把回复截图发我，我帮你判断。' },
  ];
  /* 业务分类补丁：为原有 t1–t12 补 bizCategory（选题库一级分组维度） */
  const BIZCAT_MAP = { t1: '家庭宽带', t2: '5G号段', t3: '携号转网', t4: '校园业务', t5: '融合套餐', t6: '套餐合约', t7: '家庭组网', t8: '融合套餐', t9: '家庭组网', t10: '家庭宽带', t11: '家庭组网', t12: '家庭宽带' };
  topics.forEach(function (t) { if (!t.bizCategory) t.bizCategory = BIZCAT_MAP[t.id] || '其他'; });

  const dashboard = {
    stores: 128, storesOnline: 110, accounts: 342, accountsActive: 216,
    published7d: 1286, plays7d: 3842000, interactions7d: 96400, recordingSegments: 4800,
    coverage: 86, activeRate: 63, publishRate: 58, silentAccounts: 47,
    hotContentRate: 22, avgPlays: 2987,
    trend: [42, 55, 48, 61, 58, 72, 66, 81, 76, 92, 88, 104, 96, 118],
    byCity: [
      { name: '南京市', stores: 46, accounts: 132, published: 486, plays: 1620000, activeRate: 68 },
      { name: '苏州市', stores: 38, accounts: 104, published: 372, plays: 1180000, activeRate: 61 },
      { name: '无锡市', stores: 24, accounts: 62, published: 218, plays: 612000, activeRate: 57 },
      { name: '常州市', stores: 20, accounts: 44, published: 210, plays: 430000, activeRate: 44 },
    ],
  };

  const script = {
    topicId: 't1',
    title: '千兆宽带卧室还是卡？90% 是这三个原因',
    hook: '花千兆的钱，住千兆的房，为什么卧室还是卡？',
    body: '先别急着骂宽带，卧室卡通常不是宽带的问题。\n第一个原因，路由器放错了位置。放在电视柜里、弱电箱里、或者墙角，信号会被金属和墙体挡掉一大半。\n第二个原因，还在用运营商送的老路由器。千兆宽带配百兆路由器，跑出来的速度就只有一百兆。\n第三个原因，家里承重墙太多。一堵承重墙大概会衰减一半信号，两堵墙之后基本就没法用了。\n如果你家也是这样，最直接的办法是做全屋 WiFi 组网，让每个房间都有独立信号点。\n你家路由器放在哪？评论区告诉我，我帮你看要不要换。',
    duration: '42 秒（约 260 字）',
    shooting: ['场景：账号展示区，背景放路由器与光猫实物', '镜头：中近景固定机位，口播为主，讲到「路由器位置」时插入实物特写', '字幕重点：路由器位置 / 百兆路由器 / 承重墙 三个关键词上屏', '动作：手拿路由器指向弱电箱位置，做对比演示'],
    cover: '千兆宽带还卡？先看路由器放哪',
    covers: ['千兆宽带还卡？先看路由器放哪', '路由器放错，千兆也白搭', '家里 Wi-Fi 卡？先查这三个地方'],
    publish: '花千兆的钱，住千兆的房，为什么卧室还是卡？三个最常见的原因，第三个很多人不知道。你家路由器放在哪，评论区聊聊。\n南京地区宽带、组网问题都可以问我。',
    tags: ['#千兆宽带', '#家庭WiFi', '#全屋组网', '#南京宽带', '#宽带避坑'],
    cta: '有同样问题的，评论区说说你家路由器放在哪，我帮你看看要不要换。',
    variants: [
      { name: '知识型', on: true },
      { name: '生活化', on: false },
      { name: '专业向', on: false },
    ],
    checks: [
      { name: '敏感词校验', status: 'pass', note: '未命中敏感词表（共 486 条）' },
      { name: '夸大宣传校验', status: 'pass', note: '未出现「保证 / 100% / 最低价」等表述' },
      { name: '品牌规范校验', status: 'pass', note: '业务名称与资费表述符合知识库 v2.3' },
      { name: '开场钩子校验', status: 'pass', note: '前 3 秒为问题前置，非自我介绍' },
    ],
  };

  const mixcut = {
    template: '宽带知识 · 三图一屏',
    ratio: '9:16',
    duration: 30,
    shots: [
      { n: 1, line: '花千兆的钱，住千兆的房，为什么卧室还是卡？', visual: '账号实景 / 路由器特写', src: '账号素材库', voice: 'AI 女声 · 亲和' },
      { n: 2, line: '第一个原因：路由器放错了位置。', visual: '弱电箱示意', src: '授权素材', voice: 'AI 女声 · 亲和' },
      { n: 3, line: '第二个原因：还在用老路由器。', visual: '百兆 / 千兆对比图', src: '授权素材', voice: 'AI 女声 · 亲和' },
      { n: 4, line: '第三个原因：家里承重墙太多。', visual: '户型信号衰减示意', src: '模板图形', voice: 'AI 女声 · 亲和' },
      { n: 5, line: '评论区告诉我你家路由器放哪，我帮你看。', visual: '账号地址卡 + 二维码', src: '账号素材库', voice: 'AI 女声 · 亲和' },
    ],
    materials: [
      { name: '账号实景', type: '视频', count: 12, licensed: true },
      { name: '路由器产品图', type: '图片', count: 34, licensed: true },
      { name: '户型示意模板', type: '模板', count: 8, licensed: true },
      { name: '账号地址卡', type: '图片', count: 3, licensed: true },
    ],
  };

  const viral = [
    {
      id: 'v1', platform: 'douyin', platformName: '抖音', cat: '宽带', hot: true,
      title: '同样的宽带，为什么邻居家比你快？', author: '通信老张', durationSec: 32,
      plays: 1280000, likes: 46000, collects: 23000, shares: 8200,
      why: '「对比 + 反常识 + 可视化数据」是家宽类目近 30 天互动率最高的结构；同类 12 条爆款中 9 条采用此结构。',
      risk: '不得指名具体品牌或贬低友商；测速数据需来自真实测试并注明测试环境。',
      structure: [
        { name: '对比钩子', line: '同样办的千兆，为什么邻居家网速比你快一倍？', note: '用落差制造好奇，前 3 秒抛出' },
        { name: '反常识', line: '问题不在宽带，在你家那个「免费送」的光猫。', note: '打破用户归因，把矛头指向没想到的地方' },
        { name: '给方法', line: '把光猫换成千兆口，或者加一台路由器做桥接。', note: '一个动作就能解决，降低行动门槛' },
        { name: '可视化示范', line: '你看这测速，换之前 92 兆，换之后 940 兆。', note: '数据对比上屏，可信度最高的一步' },
        { name: '提问 CTA', line: '你家光猫是哪年的？评论区告诉我，我帮你看。', note: '提问式引导，顺带收集销售线索' }
      ],
      rewrite: {
        title: '同样办的千兆，为什么邻居家比你快？先看这三个地方',
        hook: '同样办的千兆，为什么邻居家刷视频不卡，你家却一直转圈？',
        body: '同样办的千兆，为什么邻居家刷视频不卡，你家却一直转圈？\n先别急着报修，多半不是宽带的问题。\n第一个地方，光猫。2019 年前装的百兆光猫，千兆宽带也最多跑到一百兆。\n第二个地方，路由器。放在电视柜里、弱电箱里，信号会被金属和墙体挡掉一大半。\n第三个地方，网线。很多人家还在用五类线，千兆根本跑不满。\n这三个换掉任意一个，速度立刻就不一样。你家光猫是哪年的？评论区告诉我，我帮你看。',
        cover: '千兆不快的三个地方',
        covers: ['千兆不快的三个地方', '同样千兆，为什么邻居家更快？', '网慢别怪宽带，先看这三处'],
        publish: '同样办的千兆，为什么邻居家不卡你家卡？大概率是这三个地方没弄对。你家光猫是哪年的，评论区聊聊。\n南京地区宽带、组网问题都可以问我。',
        tags: ['#千兆宽带', '#家庭网络', '#宽带避坑', '#南京宽带', '#全屋组网'],
        cta: '你家光猫是哪年的？评论区告诉我，我帮你看要不要换。',
        checks: [
          { name: '敏感词校验', status: 'pass', note: '未命中敏感词表（共 486 条）' },
          { name: '夸大宣传校验', status: 'pass', note: '未出现「保证 / 100% / 最低价」等表述' },
          { name: '品牌规范校验', status: 'pass', note: '业务名称与资费表述符合知识库 v2.3' },
          { name: '与参考作品相似度', status: 'fail', note: '结构与参考作品一致，文案重合度 12%，建议改写开场与结尾两处表达' }
        ]
      }
    },
    {
      id: 'v2', platform: 'douyin', platformName: '抖音', cat: '套餐',
      title: '办宽带时多问这一句，一年能省好几百', author: '数码小妹', durationSec: 27,
      plays: 863000, likes: 31000, collects: 41000, shares: 9600,
      why: '「损失感 + 信息差」结构，收藏率极高（收藏 / 点赞 ≈ 1.3），说明用户会存下来备用；适合做家宽决策类内容。',
      risk: '资费以当期活动与合约条款为准，不得承诺具体减免金额。',
      structure: [
        { name: '损失钩子', line: '办宽带的时候，销售最不想你问的一句话。', note: '用「对方不想让你知道」制造信息差' },
        { name: '放大损失', line: '不问这一句，你可能一年白交三四百。', note: '把不确定变成可量化的损失' },
        { name: '给清单', line: '合约期多久 / 到期怎么算 / 有没有更便宜的融合套餐。', note: '三个必问问题，降低记忆负担' },
        { name: '给话术', line: '你就直接问：到期之后是按什么价续？', note: '把问题变成一句可以直接抄的话' },
        { name: '收藏 CTA', line: '先收藏，办的时候照着问。', note: '收藏型 CTA，提升内容二次触达' }
      ],
      rewrite: {
        title: '办宽带前，这三句话一定要问，能省一笔',
        hook: '办宽带前多问三句话，一年可能省下好几百。',
        body: '办宽带前多问三句话，一年可能省下好几百。\n第一句，合约期是多久，违约金怎么算。\n第二句，到期之后是自动续还是自动停，续的话按什么价。\n第三句，有没有比我现在这个更便宜的融合套餐，带宽是不是一样。\n这三句话销售一般不会主动讲，但你问了都会告诉你。\n先收藏，办的时候照着问。南京的朋友，资费问题也可以直接问我。',
        cover: '办宽带必问的三句话',
        covers: ['办宽带必问的三句话', '办宽带前，先问这三句', '宽带合约，别签得太急'],
        publish: '办宽带别急着签字，先问这三句话。合约期、到期规则、更便宜的融合套餐，问清楚再办。\n南京的资费问题，评论区可以问我。',
        tags: ['#宽带办理', '#套餐避坑', '#南京宽带', '#资费透明'],
        cta: '先收藏，办的时候照着问；南京资费问题评论区问我。',
        checks: [
          { name: '敏感词校验', status: 'pass', note: '未命中敏感词表（共 486 条）' },
          { name: '夸大宣传校验', status: 'pass', note: '未出现「保证 / 100% / 最低价」等表述' },
          { name: '品牌规范校验', status: 'pass', note: '业务名称与资费表述符合知识库 v2.3' },
          { name: '与参考作品相似度', status: 'pass', note: '沿用参考结构，文案重合度 6%，低于 10% 阈值' }
        ]
      }
    },
    {
      id: 'v3', platform: 'kuaishou', platformName: '快手', cat: '服务',
      title: '宽带变慢先别报修，自己 3 步就能查', author: '装维老李', durationSec: 36,
      plays: 512000, likes: 21000, collects: 35000, shares: 5100,
      why: '「第一人称身份 + 省事」结构，装维师傅口吻自带信任；转发率高于同类，用户会转给家里不会处理的人。',
      risk: '涉及设备操作需提示断电安全；不建议引导用户自行拆改线路。',
      structure: [
        { name: '身份钩子', line: '我是装维的，其实一半的报修都不用师傅上门。', note: '第一人称身份背书 + 反常识开场' },
        { name: '第一步', line: '光猫和路由器都断电，等三十秒再开。', note: '最简单的动作放在最前，先给获得感' },
        { name: '第二步', line: '用网线直连光猫测速，先把 Wi-Fi 排除掉。', note: '教用户做一次变量排除' },
        { name: '第三步', line: '看光猫指示灯：闪红灯是线路，绿灯是设备。', note: '给一个可自行判断的结论' },
        { name: '兜底 CTA', line: '三步都不行再报修，把测速截图给师傅。', note: '给出下一步动作，不做绝对承诺' }
      ],
      rewrite: {
        title: '宽带变慢别急着报修，先自己查这三步',
        hook: '宽带变慢先别报修，三步自查，一半的问题自己就能解决。',
        body: '宽带变慢先别急着报修，三步自查，一半的问题自己就能解决。\n第一步，把光猫和路由器都断电，等三十秒再开。很多「变慢」重启一次就好了。\n第二步，用网线把电脑直连光猫测速。如果直连正常，问题就在 Wi-Fi 或路由器上。\n第三步，看光猫的指示灯。光信号闪红灯是线路问题，得报修；正常闪绿灯，多半是设备问题。\n三步都试过还不行，再报修，把测速截图发给师傅，上门会快很多。',
        cover: '宽带变慢先自查三步',
        covers: ['宽带变慢先自查三步', '宽带慢先别报修，先查这三步', '三个动作，一半网速问题自己解决'],
        publish: '宽带变慢先别报修，断电重启、有线直连测速、看指示灯，三步基本能判断问题在哪。\n收藏一下，家里宽带慢的时候用得上。',
        tags: ['#宽带报修', '#网络自查', '#家庭网络', '#南京宽带'],
        cta: '三步都不行再报修，把测速截图给师傅，上门更快。',
        checks: [
          { name: '敏感词校验', status: 'pass', note: '未命中敏感词表（共 486 条）' },
          { name: '夸大宣传校验', status: 'pass', note: '未出现「保证 / 100% / 最低价」等表述' },
          { name: '品牌规范校验', status: 'pass', note: '业务名称与资费表述符合知识库 v2.3' },
          { name: '与参考作品相似度', status: 'pass', note: '沿用参考结构，文案重合度 9%，低于 10% 阈值' }
        ]
      }
    }
  ];

  const comments = [
    { id: 'c1', accountId: 'sample-wang', author: '用户8**21', text: '我家也是这个问题，路由器放在弱电箱里，怎么弄？', work: '千兆宽带为什么卧室还是卡？', likes: 12, at: '09-22 20:14', region: '南京·秦淮', douyinId: 'dy_821***', aiJudge: '高意向', lead: true },
    { id: 'c2', accountId: 'sample-wang', author: '江宁老王', text: '全屋组网大概多少钱？我家 120 平', work: '全屋 WiFi 组网到底要不要做？', likes: 31, at: '09-22 18:02', region: '南京·江宁', douyinId: 'laowang_jn', aiJudge: '高意向', lead: true },
    { id: 'c3', accountId: 'sample-wang', author: '小鹿', text: '192 号段在我这边信号一般，你们账号能试吗？', work: '192 号段到底值不值得办？', likes: 8, at: '09-22 12:40', region: '南京·鼓楼', douyinId: 'xiaolu_92', aiJudge: '待跟进', lead: true },
    { id: 'c4', accountId: 'sample-wang', author: '南京小刘', text: '讲得挺清楚的，收藏了', work: '路由器放这三个位置，信号直接砍半', likes: 5, at: '09-21 21:10', region: '南京·玄武', douyinId: 'nj_xiaoliu', aiJudge: '普通互动', lead: false },
    { id: 'c5', accountId: 'sample-wang', author: '阿May', text: '携号转网要带什么材料？', work: '南京人注意：携号转网其实只要三步', likes: 19, at: '09-21 19:35', region: '南京·建邺', douyinId: 'amay_88', aiJudge: '待跟进', lead: true },
    { id: 'c6', accountId: 'sample-wang', author: '老周', text: '我家宽带到期了，续费还是转网划算？', work: '套餐到期不提醒，自动续约怎么办？', likes: 27, at: '09-21 09:12', region: '南京·浦口', douyinId: 'zhou_6***', aiJudge: '高意向', lead: true },
    { id: 'c7', accountId: 'sample-wang', author: '一颗糖', text: '这个测速方法有用，谢谢', work: '千兆宽带为什么卧室还是卡？', likes: 3, at: '09-20 22:05', region: '南京·雨花台', douyinId: 'tang_tang', aiJudge: '普通互动', lead: false },
    { id: 'c8', accountId: 'sample-wang', author: '玄武-陈', text: '我在你们厅附近，想过去看看路由器', work: '路由器放这三个位置，信号直接砍半', likes: 6, at: '09-20 15:48', region: '南京·玄武', douyinId: 'xw_chen', aiJudge: '高意向', lead: true }
  ];

  const nurture = {
    stage: '成长期', day: 12, target: 30, rate: '每周 3–4 条',
    accounts: [
      { id: 'sample-wang', label: '账号1 · 王姐12345', on: true },
      { id: 'sample-li', label: '账号2 · 李哥说宽带', on: true },
      { id: 'sample-zhang', label: '账号3 · 张敏｜南京通信小知识', on: false }
    ],
    keywords: ['宽带', '套餐', '家庭组网', '携号转网', '192 号段'],
    weights: { feed: 100, search: 0 },
    hitMultiplier: 2,
    skipIfMiss: true, likeAndCollect: true,
    dwellVideo: [10, 30], dwellLive: [5, 12], gap: [3, 7], perRound: [8, 30],
    run: { task: 'sp-2', round: 1, total: 11, target: '首页推荐流', watching: '家庭 Wi-Fi 卡顿怎么排查' },
    feed: [
      { title: '千兆宽带为什么卧室还是卡？', author: '通信老张', plays: '6.3万', dur: '01:12', hit: '宽带' },
      { title: '全屋 WiFi 组网到底要不要做？', author: '南京装维', plays: '2.7万', dur: '00:48', hit: '家庭组网' },
      { title: '套餐到期不提醒，自动续约怎么办？', author: '数码小妹', plays: '4.1万', dur: '03:13', hit: '套餐' },
      { title: '路由器放哪信号最好？三个位置千万别放', author: '装维老李', plays: '1.3万', dur: '00:36', hit: '宽带' },
      { title: '192 号段实测：地铁里到底能不能用', author: '通信老张', plays: '5.6万', dur: '02:04', hit: '192 号段' },
      { title: '周末去玄武湖看日落', author: '生活记录', plays: '2.1万', dur: '00:21', hit: '' }
    ],
    logs: [
      { at: '09-23 15:55', acct: 'sample-li', type: '看视频', obj: '首页推荐流 · 家庭 Wi-Fi 卡顿怎么排查', dwell: '5.7 s', like: false, collect: false, note: '来源：首页推荐流' },
      { at: '09-23 15:55', acct: 'sample-li', type: '收藏', obj: '首页推荐流 · 千兆宽带为什么还卡', dwell: '5.7 s', like: true, collect: true, note: '命中关键词：宽带' },
      { at: '09-23 15:54', acct: 'sample-li', type: '看视频', obj: '首页推荐流 · 路由器放哪信号最好', dwell: '4.7 s', like: false, collect: false, note: '未命中，快速划过' },
      { at: '09-23 15:54', acct: 'sample-li', type: '点赞', obj: '搜索 · 全屋组网到底要不要做', dwell: '8.2 s', like: true, collect: false, note: '命中关键词：家庭组网' },
      { at: '09-23 15:53', acct: 'sample-wang', type: '看视频', obj: '首页推荐流 · 携号转网只要三步', dwell: '6.1 s', like: false, collect: false, note: '来源：首页推荐流' },
      { at: '09-23 15:53', acct: 'sample-wang', type: '收藏', obj: '首页推荐流 · 套餐到期自动续约', dwell: '9.4 s', like: true, collect: true, note: '命中关键词：套餐' },
      { at: '09-23 15:52', acct: 'sample-wang', type: '看直播', obj: '直播 · 通信数码测评', dwell: '5.0 s', like: false, collect: false, note: '直播停留 5~12 秒' },
      { at: '09-23 15:52', acct: 'sample-wang', type: '看视频', obj: '首页推荐流 · 192 号段实测', dwell: '4.2 s', like: false, collect: false, note: '来源：首页推荐流' }
    ]
  };

  const recAssets = [
    { id: 'ra1', name: '玄武厅-王娟-2026-09-23-1542.mp3', store: '我的账号', staff: '王娟', dur: '03:42', at: '09-23 15:42', asr: 'done', topic: '家庭宽带 / 家庭组网' },
    { id: 'ra2', name: '玄武厅-王娟-2026-09-23-1610.mp3', store: '我的账号', staff: '王娟', dur: '02:18', at: '09-23 16:10', asr: 'done', topic: '套餐合约' },
    { id: 'ra3', name: '玄武厅-李强-2026-09-23-1030.mp3', store: '我的账号', staff: '李强', dur: '05:06', at: '09-23 10:30', asr: 'done', topic: '5G 号段' },
    { id: 'ra4', name: '玄武厅-王娟-2026-09-22-1425.mp3', store: '我的账号', staff: '王娟', dur: '04:12', at: '09-22 14:25', asr: 'done', topic: '携号转网' },
    { id: 'ra5', name: '玄武厅-陈涛-2026-09-22-1108.mp3', store: '我的账号', staff: '陈涛', dur: '01:56', at: '09-22 11:08', asr: 'pending', topic: '—' },
    { id: 'ra6', name: '鼓楼厅-张敏-2026-09-21-1705.mp3', store: '我的账号', staff: '张敏', dur: '06:24', at: '09-21 17:05', asr: 'done', topic: '宽带测速' },
    { id: 'ra7', name: '玄武厅-李强-2026-09-21-0932.mp3', store: '我的账号', staff: '李强', dur: '03:08', at: '09-21 09:32', asr: 'done', topic: '资费对比' },
    { id: 'ra8', name: '玄武厅-王娟-2026-09-20-1601.mp3', store: '我的账号', staff: '王娟', dur: '02:47', at: '09-20 16:01', asr: 'pending', topic: '—' }
  ];

  const complaints = [
    { id: 'cp1', at: '09-23 14:20', store: '我的账号', cust: '张**', type: '网络质量', level: '高', status: '处理中', owner: '李强' },
    { id: 'cp2', at: '09-23 10:05', store: '我的账号', cust: '王**', type: '资费争议', level: '中', status: '已处理', owner: '王娟' },
    { id: 'cp3', at: '09-22 16:48', store: '我的账号', cust: '刘**', type: '办理时效', level: '中', status: '已处理', owner: '张敏' },
    { id: 'cp4', at: '09-22 09:30', store: '我的账号', cust: '陈**', type: '合约条款', level: '高', status: '已升级', owner: '陈涛' },
    { id: 'cp5', at: '09-21 18:12', store: '我的账号', cust: '赵**', type: '服务态度', level: '低', status: '已处理', owner: '王娟' },
    { id: 'cp6', at: '09-21 11:26', store: '我的账号', cust: '周**', type: '网络质量', level: '中', status: '处理中', owner: '张敏' }
  ];

  const opportunities = [
    { id: 'op1', cust: '江宁老王', need: '120 平户型全屋组网', from: '录音', src: '全屋 WiFi 组网到底要不要做？', level: '高', value: '约 1,200 元', status: '跟进中' },
    { id: 'op2', cust: '老周', need: '宽带到期，续费转融合套餐', from: '评论', src: '套餐到期不提醒，自动续约怎么办？', level: '高', value: '约 1,680 元/年', status: '报价中' },
    { id: 'op3', cust: '用户8**21', need: '换路由器 / 加装组网', from: '评论', src: '千兆宽带为什么卧室还是卡？', level: '中', value: '约 400 元', status: '待联系' },
    { id: 'op4', cust: '小鹿', need: '192 号段入网', from: '评论', src: '192 号段到底值不值得办？', level: '中', value: '约 360 元/年', status: '待联系' },
    { id: 'op5', cust: '玄武-陈', need: '到店选购路由器 + 组网', from: '到店', src: '路由器放这三个位置，信号直接砍半', level: '高', value: '约 900 元', status: '已成单' },
    { id: 'op6', cust: '阿May', need: '携号转网 + 融合套餐', from: '录音', src: '南京人注意：携号转网其实只要三步', level: '中', value: '约 1,080 元/年', status: '跟进中' }
  ];

  const recDevice = {
    name: '玄武厅 · 录音终端 #2',
    ip: '192.168.1.42',
    todayCount: 18,
    todayDuration: '2 小时 14 分',
    lastBeat: '15:37'
  };

  /* 可检测到的录音设备清单（M4）：用于「检测 · 选择录音设备」 */
  const recDevices = [
    { name: '玄武厅 · 录音终端 #2', ip: '192.168.1.42', model: 'CR-200', online: true },
    { name: '玄武厅 · 取音线 A', ip: '192.168.1.51', model: 'PCM-1', online: true },
    { name: '二楼 · 录音终端 #1', ip: '192.168.1.63', model: 'CR-200', online: true },
    { name: '仓库 · 移动录音笔', ip: '—', model: 'DVR-9', online: false }
  ];

  /* 样例录音转写（M4）：客户/我分角色；录音中心的需求与异议统计由该数据实时计算 */
  const transcripts = [
    { id: 'tr1', assetId: 'ra1', store: '我的账号', staff: '王娟', at: '09-23 15:42', turns: [
      ['客户', '我家装的是千兆宽带，为什么卧室还是卡得很？晚上看视频一直转圈。'],
      ['我', '您家路由器放在哪个位置？弱电箱里还是电视柜里？'],
      ['客户', '放在客厅电视柜下面。另外想问全屋组网大概多少钱？我家 120 平。'],
      ['我', '位置确实会影响信号。组网方案我帮您算一下，先做个远程测速。']
    ] },
    { id: 'tr2', assetId: 'ra2', store: '我的账号', staff: '王娟', at: '09-23 16:10', turns: [
      ['客户', '我的套餐到期了还在自动扣费，这是怎么回事？'],
      ['我', '到期没有变更会按原套餐继续扣费，合约条款在 App 里可以查到。'],
      ['客户', '那怎么提前知道什么时候到期？我不想被绑定太久的合约。'],
      ['我', '合约页能看到到期日，到期前一个月改套餐不算违约。']
    ] },
    { id: 'tr3', assetId: 'ra3', store: '我的账号', staff: '李强', at: '09-23 10:30', turns: [
      ['客户', '192 号段信号到底行不行？我住老小区，怕覆盖不好。'],
      ['我', '信号和片区有关，我先帮您查一下您所在区域的覆盖情况。'],
      ['客户', '行，帮我看看。对比移动的号卡，你们有什么优势？'],
      ['我', '资费和权益我可以给您列个对比表，您看后再定。']
    ] },
    { id: 'tr4', assetId: 'ra4', store: '我的账号', staff: '王娟', at: '09-22 14:25', turns: [
      ['客户', '携号转网要带什么材料？流程复杂吗？'],
      ['我', '带身份证就行，确认原号码无欠费，授权码当天有效。'],
      ['客户', '那办完多久能用？要不要上门？'],
      ['我', '不需要上门，线上激活，一般一小时内生效。']
    ] },
    { id: 'tr5', assetId: 'ra7', store: '我的账号', staff: '李强', at: '09-21 09:32', turns: [
      ['客户', '你们家宽带资费有没有更便宜的？我现在每月 129。'],
      ['我', '我帮您看看在售套餐，重点对比带宽和合约期。'],
      ['客户', '便宜多少？有没有不用换号的优惠？'],
      ['我', '有同号档位升级的方案，我发您对比一下。']
    ] },
    { id: 'tr6', assetId: 'ra6', store: '我的账号', staff: '张敏', at: '09-21 17:05', turns: [
      ['客户', '电视业务怎么开通？机顶盒要另外买吗？'],
      ['我', '融合套餐里含电视会员，机顶盒押金制，不用买断。']
    ] },
    { id: 'tr7', assetId: 'ra6', store: '我的账号', staff: '张敏', at: '09-21 17:20', turns: [
      ['客户', '上周报修网络，师傅多久能上门？'],
      ['我', '工单 24 小时内响应，城区一般次日上门。'],
      ['客户', '要是还解决不了呢？我都不想用了。'],
      ['我', '超时会升级处理，您留个电话我盯着这张工单。']
    ] },
    { id: 'tr8', assetId: 'ra2', store: '我的账号', staff: '王娟', at: '09-23 16:20', turns: [
      ['客户', '副卡能不能多办两张？家人一起用便宜点。'],
      ['我', '主套餐带两张副卡名额，超出按月 10 元一张。'],
      ['客户', '好的，那帮我办两张。']
    ] }
  ];

  /* 录音分析页：精编样例 + 通用生成器 */
  const RA_PHASES = ['开场白', '需求挖掘', '业务介绍', '资费报价', '异议处理', '送别跟进'];
  const RA_PHASE_KW = {
    '开场白': /您好|你好|欢迎|请问|这边请|取号|办什么/,
    '需求挖掘': /哪个位置|放在哪|哪里|多少平|几口人|现在用|想办|咨询|了解|需要|几(张|个)|用不用|带什么/,
    '业务介绍': /方案|组网|宽带|千兆|Mesh|机顶盒|电视|副卡|套餐含|测速|权益|号段|覆盖/,
    '资费报价': /多少钱|资费|费用|月(费|租)|元|价格|优惠|折扣|合约期|期限|违约|到期/,
    '异议处理': /贵|便宜|别家|移动|联通|广电|担心|考虑|再看看|划不划算|值不值|划算|不想/,
    '送别跟进': /谢谢|再见|欢迎下次|留个电话|回头|联系|微信|加个|我盯着/
  };
  const recAnalyses = {
    ra1: {
      scene: '业务接待', tag: '首次客户', seller: '王娟', store: '我的账号', dur: '03:42', durSec: 222,
      lines: [
        { who: '我', sec: 8, text: '您好，欢迎光临我的账号，今天想办什么业务？', phase: '开场白' },
        { who: '客户', sec: 14, text: '我家装的是千兆宽带，为什么卧室还是卡得很？晚上看视频一直转圈。' },
        { who: '我', sec: 22, text: '您家路由器放在哪个位置？弱电箱里还是电视柜里？房子多大、几口人用？', phase: '需求挖掘' },
        { who: '客户', sec: 30, text: '放在客厅电视柜下面，120 平，一家五口，晚上都刷视频。' },
        { who: '我', sec: 41, text: '位置和承重墙都会影响覆盖，我先帮您做个远程测速看看瓶颈在哪。', phase: '需求挖掘' },
        { who: '客户', sec: 52, text: '那全屋组网大概多少钱？会不会很麻烦？' },
        { who: '我', sec: 64, text: '您这种情况 1000M 宽带加两个 Mesh 组网最合适，信号能覆盖每个房间，129 一个月，含主路由和上门安装。', phase: '业务介绍' },
        { who: '客户', sec: 80, text: '比我现在的贵多少？我现在每月也是 129。' },
        { who: '我', sec: 96, text: '您现在是单宽带，这 129 里含千兆带宽、两个 Mesh 和上门调测；也可以看 159 的融合套餐，多含电视会员和两张副卡。', phase: '资费报价' },
        { who: '客户', sec: 112, text: '电视我们用得少，副卡倒是可能办。合约期多久？违约金怎么算？' },
        { who: '我', sec: 128, text: '合约 24 个月，提前退订按剩余月份折算，App 合约页能随时查到期日，到期前改套餐不算违约。', phase: '资费报价' },
        { who: '客户', sec: 145, text: '还是有点贵，移动给我报 99，你们有什么优势？' },
        { who: '我', sec: 160, text: '差别在覆盖和售后：Mesh 上门调测、报修 24 小时响应，我可以把总成本逐项列给您对比。', phase: '异议处理' },
        { who: '客户', sec: 175, text: '行，那你列个表我带回去和家里人商量下。' },
        { who: '我', sec: 190, text: '好的，我加您个微信，方案发您；需要上门测速随时约，欢迎下次光临。', phase: '送别跟进' },
        { who: '客户', sec: 205, text: '好，谢谢。' }
      ],
      dims: [
        { name: '需求挖掘', score: 70 }, { name: '业务专业度', score: 88 }, { name: '方案讲解', score: 84 },
        { name: '异议处理', score: 73 }, { name: '营销转化', score: 76 }, { name: '服务体验', score: 79 }
      ],
      highlights: [
        { tag: '业务讲解', text: '围绕网速瓶颈原因、Mesh 组网原理与覆盖效果做了连续清晰的说明。' },
        { tag: '方案对比', text: '主动给出 129 单宽带与 159 融合套餐两版方案，列出包含项差异。' },
        { tag: '坦诚沟通', text: '在合约期与违约金上表达直接，降低客户对隐性费用的戒备。' },
        { tag: '跟进深入', text: '已进入资费、合约与副卡名额的实质性沟通，并约定微信回访。' }
      ],
      weaks: [
        { tag: '需求挖掘', text: '前半段对家庭用网高峰、设备数量与预算上限追问不够系统。' },
        { tag: '竞品应对', text: '面对移动 99 元报价，更多在解释成本构成，差异化卖点不够聚焦。' },
        { tag: '异议收口', text: '客户多次表达价格顾虑，但缺少明确的下一步闭环确认。' }
      ],
      followPath: [
        { title: '24h 内发送两版方案测算单', desc: '分别输出 129 单宽带与 159 融合套餐的费用明细，并单列合约与违约说明。' },
        { title: '补充覆盖勘测预约', desc: '针对卧室死角，安排上门测速与 Mesh 点位建议，给出可执行时间。' },
        { title: '竞品对比卡片跟进', desc: '整理与移动 99 元方案的带宽、覆盖与售后时效差异。' },
        { title: '二次邀约锁定办理窗口', desc: '围绕测速体验和副卡需求做二次邀约，推动客户回店办理。' }
      ],
      strategies: [
        { tag: '资费异议', tone: 'blue', text: '客户对月费敏感，建议输出 24 个月总成本视角，强调上门调测与报修响应的包含价值，而不是只比月租。' },
        { tag: '合约顾虑', tone: 'amber', text: '违约金与合约期是主要阻力，需要给出到期提醒与套餐变更规则的书面说明，而不是停留在口头解释。' },
        { tag: '竞品反制', tone: 'green', text: '面对移动低价报价，回到覆盖效果、售后时效与总拥有成本做价值收口，避免陷入单纯价格比拼。' }
      ],
      portrait: [
        { label: '办理阶段', tone: 'blue', tags: ['首次到店', '已测速', '进入报价阶段', '需书面方案'] },
        { label: '用网现状', tone: 'green', tags: ['千兆宽带', '大户型', '多设备', '有覆盖死角'] },
        { label: '核心顾虑', tone: 'amber', tags: ['月费敏感', '合约期长', '违约金', '覆盖效果'] },
        { label: '价值偏好', tone: 'purple', tags: ['覆盖优先', '售后时效', '上门服务', '性价比'] },
        { label: '决策行为', tone: 'pink', tags: ['对比移动', '家人共议', '关注合约', '在意口碑'] }
      ],
      intent: {
        budget: '129-159 元/月，关注合约期与违约金',
        product: '千兆宽带 + 全屋组网（已远程测速）',
        when: '1 个月内，对比移动后再定',
        rivals: ['移动', '联通', '广电']
      },
      sop: [
        { name: '开场白', score: 23 }, { name: '需求挖掘', score: 25 }, { name: '业务介绍', score: 86 },
        { name: '资费报价', score: 87 }, { name: '异议处理', score: 88 }, { name: '送别跟进', score: 89 }
      ]
    }
  };
  function recAnalysisFor(asset, turns) {
    if (recAnalyses[asset.id]) return recAnalyses[asset.id];
    var p = (asset.dur || '00:00').split(':');
    var durSec = (+p[0]) * 60 + (+p[1]);
    var list = turns || [], n = list.length || 1;
    var lines = list.map(function (t, i) {
      var who = t[0] === '客户' ? '客户' : '我', phase = null;
      if (who === '我') {
        for (var j = RA_PHASES.length - 1; j >= 0; j--) { if (RA_PHASE_KW[RA_PHASES[j]].test(t[1])) { phase = RA_PHASES[j]; break; } }
      }
      return { who: who, sec: Math.round((i + 0.5) / n * durSec), text: t[1], phase: phase };
    });
    var hit = {}; RA_PHASES.forEach(function (ph) { hit[ph] = 0; });
    lines.forEach(function (l) { if (l.phase) hit[l.phase]++; });
    var base = [78, 72, 86, 80, 74, 82];
    var sop = RA_PHASES.map(function (ph, i) {
      return { name: ph, score: Math.min(96, base[i] + Math.min(8, hit[ph] * 4) - (hit[ph] ? 0 : 22)) };
    });
    var dims = [
      { name: '需求挖掘', score: sop[1].score },
      { name: '业务专业度', score: sop[2].score },
      { name: '方案讲解', score: Math.round((sop[2].score + sop[3].score) / 2) },
      { name: '异议处理', score: sop[4].score },
      { name: '营销转化', score: Math.round((sop[3].score + sop[5].score) / 2) },
      { name: '服务体验', score: Math.round((sop[0].score + sop[5].score) / 2) }
    ];
    var sorted = sop.slice().sort(function (a, b) { return b.score - a.score; });
    var cust = lines.filter(function (l) { return l.who === '客户'; }).map(function (l) { return l.text; }).join(' ');
    var prod = /组网|千兆|宽带/.test(cust) ? '千兆宽带 + 全屋组网' : /副卡|融合/.test(cust) ? '融合套餐（宽带+电视+副卡）' : /携号转网/.test(cust) ? '携号转网套餐' : /电视|机顶盒/.test(cust) ? '宽带 + IPTV' : '在售套餐待定';
    return {
      scene: '业务接待', tag: /第[一二三四五]次|回头|老客/.test(cust) ? '回头客' : '首次客户',
      seller: asset.staff, store: asset.store, dur: asset.dur, durSec: durSec,
      lines: lines,
      dims: dims,
      highlights: sorted.slice(0, 3).map(function (s) { return { tag: s.name, text: '「' + s.name + '」环节话术完整、节奏顺畅，客户正向回应明显。' }; }),
      weaks: sorted.slice(-2).reverse().map(function (s) { return { tag: s.name, text: '该环节覆盖不足，建议按 SOP 补齐关键动作并在班后会复盘。' }; }),
      followPath: [
        { title: '24h 内发送方案明细', desc: '把本次沟通的资费与合约要点整理成书面方案回访发出。' },
        { title: '补充书面对比表', desc: '针对客户提到的对比诉求，输出竞品资费与权益对照。' },
        { title: '邀约体验 / 上门服务', desc: '安排上门测速或到店体验，推动意向转为办理。' },
        { title: '二次回访锁定办理窗口', desc: '围绕客户犹豫点做二次邀约，明确办理时间。' }
      ],
      strategies: [
        { tag: '资费异议', tone: 'blue', text: '客户对价格敏感，建议用总成本视角拆解包含项，而不是只比月租数字。' },
        { tag: '条款顾虑', tone: 'amber', text: '合约与违约相关顾虑需要书面化说明，给出可核对的规则依据。' },
        { tag: '竞品反制', tone: 'green', text: '面对低价竞品报价，回到覆盖效果、售后时效与总成本做价值收口。' }
      ],
      portrait: [
        { label: '办理阶段', tone: 'blue', tags: ['首次到店', '已沟通方案'].concat(/办|装|带/.test(cust) ? ['进入办理阶段'] : []) },
        { label: '用网现状', tone: 'green', tags: [/宽带|千兆/.test(cust) ? '宽带用户' : '号卡用户', /副卡|家人|一家/.test(cust) ? '家庭多成员' : '个人使用', /平|房间|卧室/.test(cust) ? '有覆盖诉求' : '常规场景'].filter(Boolean) },
        { label: '核心顾虑', tone: 'amber', tags: [/贵|便宜|价格|元/.test(cust) ? '价格敏感' : null, /合约|期限|违约/.test(cust) ? '合约条款' : null, /担心|信号|覆盖|卡/.test(cust) ? '网络质量' : null].filter(Boolean) },
        { label: '价值偏好', tone: 'purple', tags: [/速度|千兆|兆/.test(cust) ? '带宽优先' : null, /上门|安装/.test(cust) ? '上门服务' : null, [/贵|便宜|优惠/.test(cust) ? '性价比' : null].filter(Boolean)].filter(Boolean) },
        { label: '决策行为', tone: 'pink', tags: [/移动|联通|广电|别家/.test(cust) ? '对比友商' : null, /商量|家里|家人/.test(cust) ? '家人共议' : null, ['到店咨询']].filter(Boolean) }
      ],
      intent: {
        budget: /(\d+).*(元|\/月|每月)/.test(cust) ? '沟通中提及 ' + (cust.match(/(\d+)[^。]*?(元|\/月|每月)/) || ['', ''])[0].slice(0, 18) + '，待书面确认' : '预算待进一步确认',
        product: prod,
        when: '1 个月内，待书面确认合约条款',
        rivals: /移动/.test(cust) ? ['移动'] : [], 
      },
      sop: sop
    };
  }

  const fmt = (n) => (n === null || n === undefined ? '—' : new Intl.NumberFormat('zh-CN').format(n));

  /* 产品推荐：套餐目录 + 客户在网业务样例 */
  const packages = [
    { id: 'pk1', name: '千兆宽带 + 全屋组网', price: '129 元/月', fit: '宽带卡顿 · 大户型 · 多设备',
      items: '1000M 宽带 · 2 个 Mesh 组网 · 上门安装',
      reason: '大户型、多设备、房间有死角时，先做全屋组网比单纯升带宽更有效。',
      pitch: '您家不是网慢，是信号没覆盖到位。',
      script: '您先说下路由器放哪、房子多少平、有没有承重墙。\n按您家情况，1000M 宽带 + 两个 Mesh 组网最合适，信号能覆盖每个房间。\n129 一个月，含主路由和上门安装，先测速再决定，不满意可以调。' },
    { id: 'pk2', name: '融合套餐（宽带+电视+副卡）', price: '159 元/月', fit: '合约到期 · 家庭多成员',
      items: '1000M 宽带 · IPTV · 2 张副卡',
      reason: '宽带 + IPTV + 副卡打包，比单开更划算，适合家庭成员一起用。',
      pitch: '合约快到期了，现在换融合反而更省。',
      script: '您这个套餐快到到期，到期前一个月改不算违约。\n融合套餐把宽带、电视和两张副卡打包，159 一个月。\n家里几个人一起用，副卡分摊下来每人更便宜，IPTV 免开机顶盒。' },
    { id: 'pk3', name: '5G 畅享套餐', price: '99 元/月', fit: '高流量 · 号卡新办',
      items: '80G 流量 · 1000 分钟通话',
      reason: '主刷视频、开热点的高流量用户，80G 大流量更扛用。',
      pitch: '流量总不够，多半是套餐没选对。',
      script: '您现在 4G 月租偏高，流量到月中就限速。\n5G 畅享 99 一个月，80G 流量加 1000 分钟，刷视频不断网。\n老号可以平滑升级，不换号，今天办当天生效。' },
    { id: 'pk4', name: '电视增值包', price: '20 元/月', fit: '已装电视 · 加装频道',
      items: '高清频道包 · 极光 TV',
      reason: '已装机顶盒的客户加装高清增值包，内容更全、加价低。',
      pitch: '电视已经装了，频道再加一点更好看。',
      script: '您家机顶盒已经装了，加个 20 块的增值包就有高清和极光 TV。\n想看赛事、追剧都够，不用换设备，App 里就能订。' },
    { id: 'pk5', name: '携号转网融合优惠', price: '109 元/月', fit: '价格敏感 · 对比友商',
      items: '转网专享 · 融合宽带 500M',
      reason: '对比友商、价格敏感的客户，携入可享转网专享价。',
      pitch: '不用换号，转过来这套更划算。',
      script: '您原来号码、联系人都不用换，携号转网就能保留原号。\n转过来 109 一个月，500M 融合宽带，比现在便宜还带宽更高。\n我帮您在线提交，一般当天就能开通。' }
  ];
  const customers = [
    { name: '江宁老王', phone: '138****1024', plan: '千兆宽带（单宽带）', monthly: '118 元/月', contract: '2026-12-31 到期', inNet: '3 年', tv: '未装', note: '反映卧室网速差、房间有死角', tags: ['宽带', '组网'] },
    { name: '老周', phone: '139****6688', plan: '500M 宽带 + 融合套餐', monthly: '129 元/月', contract: '2026-11-15 到期', inNet: '5 年', tv: '已装', note: '合约即将到期，想换更划算的', tags: ['合约', '宽带', '资费'] },
    { name: '用户8**21', phone: '137****3021', plan: '200M 宽带', monthly: '89 元/月', contract: '2027-03-01 到期', inNet: '1 年', tv: '未装', note: '想加装路由器做全屋组网', tags: ['组网'] },
    { name: '小鹿', phone: '150****7788', plan: '4G 主卡', monthly: '59 元/月', contract: '—', inNet: '2 年', tv: '未装', note: '流量不够用，想办 5G 号卡', tags: ['5G', '流量'] },
    { name: '阿May', phone: '186****5522', plan: '移动携入待办', monthly: '—', contract: '—', inNet: '新客户', tv: '未装', note: '对比友商，价格敏感', tags: ['转网', '资费'] }
  ];

  const fmtK = (n) => (n === null || n === undefined ? '—' : n >= 10000 ? (n / 10000).toFixed(1) + ' 万' : fmt(n));
  const dt = (s) => (s ? s.slice(0, 10) : '—');

  const products = [
    { id: 'pd1', term: '一年期', type: '宽带', name: 'YM100M宽带', price: '299元/年', content: '100M宽带', fit: '租房、短期过渡、单人使用', reason: '价格最低，灵活不绑定', notes: '确认到期是否续费',
      script: '您如果是短期用，比如租房或者先试试看，我建议办这个 100M 一年 299，到期想续再续。' },
    { id: 'pd2', term: '一年期', type: '宽带', name: 'YM200M宽带', price: '399元/年', content: '200M宽带', fit: '短期用、对网速有要求、小家庭', reason: '比100M多100元，网速翻倍', notes: '确认路由器是否支持200M',
      script: '您要是家里两三个人用，或者平时看视频多，加 100 块上 200M 更合适。' },
    { id: 'pd3', term: '一年期', type: '电视+宽带', name: 'YM固网一年套餐', price: '480元/年', content: '数字电视节目包 +100M宽带', fit: '短期用、有电视需求、不想单独装有线', reason: '电视宽带一单全包，送光猫', notes: '确认旧机顶盒配件是否齐全',
      script: '您家里要看电视的话，这个最划算，电视加宽带一年 480，还送光猫。' },
    { id: 'pd4', term: '二年期', type: '宽带', name: 'YM200M宽带（两年）', price: '599元/年', content: '200M宽带', fit: '自住、多人家庭、看视频多', reason: '两年比一年期省199元', notes: '确认路由器支持',
      script: '家里人多或者看视频多，200M 两年 599，平均一年不到 300，比单办省近 200。' },
    { id: 'pd5', term: '三年期', type: '宽带', name: 'YM100M宽带（三年）', price: '1000元/三年', content: '100M宽带3年 + 惠民卡1年', fit: '长期稳定、有手机流量需求', reason: '宽带+惠民卡，一单全包', notes: '惠民卡用户自主选择，价格不变',
      script: '1000 块用 3 年，还送 1 年惠民卡，每月 100G 流量加 100 分钟。' },
    { id: 'pd6', term: '月套餐', type: '固移融合', name: '广电慧家 59元/月 100M 黄金鳄鱼', price: '59元/月', content: '数字电视节目包 +100M宽带+惠民卡', fit: '低预算、不想一次性交太多、过渡', reason: '按月交，压力小', notes: '额外副卡3张/10元/月',
      script: '您如果想不一次性交那么多，可以看看这个月套餐，59 一个月压力小。' },
    { id: 'pd7', term: '月套餐', type: '固移融合', name: '广电慧家 69元/月 300M 黄金鳄鱼', price: '69元/月', content: '数字电视节目包 +300M宽带+惠民卡', fit: '低预算、对网速有要求、过渡', reason: '按月交，网速更高', notes: '额外副卡3张/10元/月',
      script: '69 元/月的话，宽带升到 300M，流量语音一样，按月交也不心疼。' },
    { id: 'pd8', term: '二年期', type: '数字电视', name: 'YM直播电视', price: '576元/年', content: '数字电视节目包', fit: '只看电视、不需要宽带、老年人', reason: '两年比一年省，旧机回收', notes: '确认是否需要新机顶盒',
      script: '您如果主要是看电视、不需要宽带，两年 576，平均一年 288，比单办便宜。' }
  ];

  /* 题包管理：题目分类 + 题目（问题/参考答案）+ 题包（引用题目） */
  const qcats = [
    { id: 'c1', name: '产品保障类', desc: '关心产品是否保本、安全、可靠' },
    { id: 'c2', name: '风险顾虑类', desc: '担心风险、亏损、不确定性' },
    { id: 'c3', name: '决策拖延类', desc: '需要时间考虑、暂不决定' },
    { id: 'c4', name: '价格资费类', desc: '觉得贵、想更划算' }
  ];
  const questions = [
    { id: 'q1', catId: 'c1', type: 'single', status: '已发布', q: '客户问「这个产品保本吗？」，最合适的应答是？',
      options: ['任何理财产品都不承诺保本，收益可能高于也可能低于业绩比较基准，我们会按您的风险承受能力推荐相匹配的产品。', '保本的，稳赚不赔，放心买。', '通常都保本，不用担心。', '这个我不太清楚，您自己看说明书吧。'],
      answer: [0], a: '要点：不承诺保本 → 说明收益不确定 → 强调按风险承受能力匹配。' },
    { id: 'q2', catId: 'c1', type: 'single', status: '已发布', q: '客户问「安全吗？会不会跑路？」，最合适的应答是？',
      options: ['这是正规持牌机构发行的产品，资金全程受监管，我们只推荐在售可查的产品，您可以在说明书里核对。', '绝对安全，不可能出事。', '我们机构大，你不用担心。', '别问那么多，买了就知道。'],
      answer: [0], a: '要点：持牌机构 + 资金受监管 + 可核对，用事实打消顾虑。' },
    { id: 'q3', catId: 'c2', type: 'single', status: '已发布', q: '客户说「我担心有风险」，最合适的应答是？',
      options: ['理解您的顾虑。我们会先帮您做风险测评，只推荐与您风险承受能力匹配的产品。', '风险都会有的，忍一忍。', '高风险才有高收益，买就完了。', '这个不关我事。'],
      answer: [0], a: '要点：先共情 → 风险测评 → 只推匹配等级。' },
    { id: 'q4', catId: 'c2', type: 'single', status: '已发布', q: '客户问「万一亏了怎么办？」，最合适的应答是？',
      options: ['短期波动是正常的，我们更看重长期持有；如果暂时无法接受波动，可以先从 R1/R2 稳健型产品开始。', '绝对不会亏。', '亏了机构赔给你。', '亏盈自负，你自己看着办。'],
      answer: [0], a: '要点：解释波动 → 长期视角 → 给出更低风险的替代。' },
    { id: 'q5', catId: 'c3', type: 'single', status: '已发布', q: '客户说「我考虑一下」，最合适的应答是？',
      options: ['没问题，我把要点整理给您带走，方便您和家人商量；需要的话我帮您留意，不打扰您。', '那算了。', '现在不办以后就没了。', '您快点决定吧。'],
      answer: [0], a: '要点：尊重决策节奏 → 留资料 → 保持跟进但不施压。' },
    { id: 'q6', catId: 'c3', type: 'single', status: '已发布', q: '客户说「再等等看」，最合适的应答是？',
      options: ['可以，不过这类产品额度有限、利率也会浮动，您定个心理价位，达到我再提醒您。', '爱办不办。', '别等了，明天就涨价。', '随便您。'],
      answer: [0], a: '要点：给出「额度/利率会变」的客观理由 → 约定提醒，降低催促感。' },
    { id: 'q7', catId: 'c4', type: 'multiple', status: '已发布', q: '客户说「太贵了 / 不划算」，以下哪些做法是合适的？（多选）',
      options: ['按预算对比几款，把月费和包含内容列清楚。', '把性价比讲清楚，而不是只比价格。', '直接说别家都是骗人的。', '只挑最便宜的推荐给客户。'],
      answer: [0, 1], a: '要点：列清对比 + 讲性价比；不要贬低友商或只推最便宜。' },
    { id: 'q8', catId: 'c4', type: 'single', status: '草稿', q: '客户说「别人家更便宜」，最合适的应答是？',
      options: ['价格确实有差，但要一起看合约期和包含带宽，我帮您逐项对比。', '别家是骗人的。', '我们不可能比他们贵。', '那您去别家买吧。'],
      answer: [0], a: '要点：承认差异 → 引导对比合约期与内容 → 逐项拆解。' }
  ];
  const qpacks = [
    { id: 'pk1', name: '商贸客群·灵活理财题包', desc: '商贸客群·灵活理财题包', status: '草稿', qids: ['q1', 'q3', 'q5'] },
    { id: 'pk2', name: '宽带·异议应答题包', desc: '宽带价格与合约常见异议', status: '已发布', qids: ['q7', 'q8', 'q5'] }
  ];

  window.SS = { orgs, stores, employees, accounts, works, contentTypes, topics, dashboard, script, mixcut, viral, comments, nurture, recAssets, complaints, opportunities, recDevice, recDevices, transcripts, packages, customers, products, qcats, questions, qpacks, fmt, fmtK, dt, RA_PHASES, recAnalyses, recAnalysisFor };
})();
