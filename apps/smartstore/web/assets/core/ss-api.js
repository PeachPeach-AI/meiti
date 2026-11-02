/* ============================================================
   自媒体工作站 · 服务解析层（M6 适配模块）
   契约文档：docs/plans/2026-09-29-m6-shell-api-contract.md
   - window.SS_API_BASE 存在 → 优先走 EXE 本地 API（同形 REST）
   - 未注入 / 请求失败 → 自动回退 SSCore 样例实现（断网可演示）
   - api.lastError() 可查询最近一次远端失败（界面据此显示「样例数据」标注）
   视图当前仍同步调用 SSCore；切换步骤见契约文档 §五。
   ============================================================ */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  else { root.SSApi = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var state = {
    base: (typeof window !== 'undefined' && window.SS_API_BASE) ? String(window.SS_API_BASE).replace(/\/+$/, '') : null,
    lastError: null
  };
  var TIMEOUT_MS = 2500;

  function deps() {
    var w = typeof window !== 'undefined' ? window : globalThis;
    return { D: w.SS, C: w.SSCore };
  }

  function ok(v) { return Promise.resolve(v); }

  function rawRemote(path, body, method) {
    var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctl ? setTimeout(function () { ctl.abort(); }, TIMEOUT_MS) : null;
    return fetch(state.base + path, {
      method: method || (body ? 'POST' : 'GET'),
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: ctl && ctl.signal
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (v) {
      if (timer) clearTimeout(timer);
      return v;
    }, function (err) {
      if (timer) clearTimeout(timer);
      throw err;
    });
  }

  /** 远端优先 + 失败自动回退本地样例实现 */
  function via(path, body, method, localFn) {
    if (!state.base) return ok(localFn());
    return rawRemote(path, body, method).catch(function (err) {
      state.lastError = { at: new Date().toISOString(), path: path, message: String((err && err.message) || err) };
      return localFn();
    });
  }

  function acctById(D, id) {
    return D.accounts.filter(function (a) { return a.id === id; })[0];
  }

  var api = {
    /** 运行时/测试注入 API 根地址；传 null 强制本地样例模式 */
    useBase: function (base) {
      state.base = base ? String(base).replace(/\/+$/, '') : null;
      state.lastError = null;
      return api;
    },
    isRemote: function () { return !!state.base; },
    lastError: function () { return state.lastError; },

    accounts: function () {
      return via('/api/accounts', null, null, function () { return deps().D.accounts; });
    },
    works: function (accountId) {
      return via('/api/accounts/' + encodeURIComponent(accountId) + '/works', null, null, function () {
        return deps().D.works.filter(function (w) { return w.accountId === accountId; });
      });
    },
    addAccount: function (payload) {
      return via('/api/accounts', payload, null, function () {
        var D = deps().D;
        var a = {
          id: 'added-' + (D.addedSeq = (D.addedSeq || 0) + 1),
          platform: payload.platform, nickname: payload.nickname, homepage: payload.homepage,
          authStatus: 'unauthorized', followers: null, likes: null, worksCount: null,
          bio: null, region: null, verified: null, avatar: (payload.nickname || '?').slice(0, 1),
          tone: 'a3', active: 'unknown', lastPublishedAt: null, silentDays: null, status: '未授权'
        };
        D.accounts.push(a);
        return a;
      });
    },
    removeAccount: function (accountId) {
      return via('/api/accounts/' + encodeURIComponent(accountId), null, 'DELETE', function () {
        var D = deps().D;
        D.accounts = D.accounts.filter(function (a) { return a.id !== accountId; });
        return { ok: true };
      });
    },
    importProfile: function (accountId, profile) {
      return via('/api/accounts/' + encodeURIComponent(accountId) + '/import', profile, null, function () {
        var a = acctById(deps().D, accountId);
        if (!a) throw new Error('account not found: ' + accountId);
        ['nickname', 'followers', 'likes', 'worksCount', 'bio'].forEach(function (k) {
          if (profile && profile[k] != null && profile[k] !== '') a[k] = profile[k];
        });
        a.importedAt = new Date().toISOString().slice(5, 16).replace('T', ' ');
        return a;
      });
    },
    topics: function () {
      return via('/api/topics', null, null, function () { return deps().D.topics; });
    },
    topicFromRecording: function (question) {
      return via('/api/topics/from-recording', question, null, function () {
        var D = deps().D;
        var t = deps().C.topicFromQuestion(question, (D.genSeq = (D.genSeq || 0) + 1));
        D.topics.unshift(t);
        return t;
      });
    },
    diagnose: function (accountId) {
      return via('/api/diagnosis/' + encodeURIComponent(accountId), null, null, function () {
        var d = deps();
        var a = acctById(d.D, accountId);
        return a ? d.C.diagnose(a, d.D.works.filter(function (w) { return w.accountId === accountId; }), new Date()) : null;
      });
    },
    script: function (topicId, variant) {
      return via('/api/scripts', { topicId: topicId, variant: variant || 'knowledge' }, null, function () {
        var d = deps();
        var t = d.D.topics.filter(function (x) { return x.id === topicId; })[0] || d.D.topics[0];
        return d.C.scriptgen(t, { variant: variant || 'knowledge', account: d.D.accounts[0] });
      });
    },
    matrixInsights: function () {
      return via('/api/matrix/insights', null, null, function () {
        var d = deps();
        return d.C.matrixInsights(d.D.works, { names: {}, accounts: d.D.accounts });
      });
    },
    recordingsAnalysis: function () {
      return via('/api/recordings/analysis', null, null, function () {
        return deps().C.analyzeRecordings(deps().D.transcripts);
      });
    },
    cockpit: function () {
      return via('/api/cockpit', null, null, function () {
        var d = deps();
        var now = new Date();
        var mi = d.C.matrixInsights(d.D.works, { names: {}, accounts: d.D.accounts });
        var recR = d.C.analyzeRecordings(d.D.transcripts);
        var m = d.C.cockpitMetrics(d.D.accounts, d.D.works, now);
        var a = d.C.cockpitAnswers(d.D.accounts, d.D.works, recR, mi, now);
        return Object.assign({}, m, { answers: a.answers, brief: a.brief });
      });
    },
    comments: function (accountId) {
      return via('/api/comments' + (accountId ? '?accountId=' + encodeURIComponent(accountId) : ''), null, null, function () {
        var D = deps().D;
        return accountId ? D.comments.filter(function (c) { return c.accountId === accountId; }) : D.comments;
      });
    },
    identifyLeads: function (comments) {
      return via('/api/leads/identify', { comments: comments || [] }, null, function () {
        return deps().C.leadFromComments(comments || []);
      });
    },
    /* 截流中心：仅远端可用（依赖本地 Python 采集器），不做本地样例回退 */
    interceptPlatforms: function () { return rawRemote('/api/intercept/platforms'); },
    interceptCreate: function (payload) { return rawRemote('/api/intercept/tasks', payload); },
    interceptTasks: function () { return rawRemote('/api/intercept/tasks'); },
    interceptStatus: function (id) { return rawRemote('/api/intercept/tasks/' + encodeURIComponent(id)); },
    interceptStop: function (id) { return rawRemote('/api/intercept/tasks/' + encodeURIComponent(id) + '/stop', {}); },
    interceptComments: function (id) { return rawRemote('/api/intercept/tasks/' + encodeURIComponent(id) + '/comments'); },
    interceptLeads: function (id) { return rawRemote('/api/intercept/tasks/' + encodeURIComponent(id) + '/leads'); },
    interceptExportUrl: function (id, fmt, what) {
      return state.base ? state.base + '/api/intercept/tasks/' + encodeURIComponent(id) + '/export?format=' + (fmt || 'csv') + (what ? '&what=' + encodeURIComponent(what) : '') : '';
    },
    /* 登录 / 会话（先登录后采集） */
    interceptLoginStatus: function () { return rawRemote('/api/intercept/login/status'); },
    interceptLoginSetEngine: function (engine) { return rawRemote('/api/intercept/login/engine', { engine: engine }); },
    interceptLoginOpen: function (payload) { return rawRemote('/api/intercept/login/open', payload); },
    interceptLoginSetup: function () { return rawRemote('/api/intercept/login/setup', {}); },
    interceptRisk: function () { return rawRemote('/api/intercept/risk'); },
    interceptRiskConfig: function (payload) { return rawRemote('/api/intercept/risk/config', payload); },
    interceptRiskReset: function () { return rawRemote('/api/intercept/risk/reset', {}); },
    /**
     * M6 切换：远端模式下拉取全部集合并写入 window.SS（视图零改动即消费真实数据）。
     * 本地模式返回 false；任一请求失败返回 false 并记录 lastError（保持样例数据原样）。
     */
    bootstrap: function () {
      if (!state.base) return ok(false);
      var D = deps().D;
      return Promise.all([
        rawRemote('/api/accounts'), rawRemote('/api/works'), rawRemote('/api/topics'),
        rawRemote('/api/comments'), rawRemote('/api/transcripts')
      ]).then(function (rs) {
        D.accounts = rs[0]; D.works = rs[1]; D.topics = rs[2]; D.comments = rs[3]; D.transcripts = rs[4];
        return true;
      }).catch(function (e) {
        state.lastError = { at: new Date().toISOString(), path: '/api/* (bootstrap)', message: String((e && e.message) || e) };
        return false;
      });
    }
  };

  return api;
});
