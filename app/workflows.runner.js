// 工作流触发面板：用于从前端触发 GitHub Actions workflow，并展示运行进度
// 依赖：GitHub Token（Classic PAT），需要 repo + workflow 权限

window.DPRWorkflowRunner = (function () {
  const WORKFLOWS = [
    {
      id: 'daily-paper-reader.yml',
      name: '立即爬取并处理论文',
      desc: '触发 daily-paper-reader 工作流（抓取→召回→重排→生成 docs）。',
    },
    {
      id: 'sync.yml',
      name: '同步上游代码',
      desc: '触发 Upstream Sync 工作流（合并上游 main 到当前仓库）。',
    },
  ];

  let overlay = null;
  let panel = null;
  let statusEl = null;
  let runsEl = null;
  let refreshTimer = null;
  let activeRun = null;

  const escapeHtml = (str) => {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  const loadGithubToken = () => {
    try {
      const secret = window.decoded_secret_private || {};
      if (secret.github && secret.github.token) {
        return String(secret.github.token || '').trim();
      }
    } catch {
      // ignore
    }
    try {
      const raw = window.localStorage
        ? window.localStorage.getItem('github_token_data')
        : '';
      if (!raw) return '';
      const obj = JSON.parse(raw);
      return String((obj && obj.token) || '').trim();
    } catch {
      return '';
    }
  };

  const resolveRepoFromUrl = async (token) => {
    const currentUrl = window.location.href || '';
    const githubPagesMatch = currentUrl.match(
      /https?:\/\/([^.]+)\.github\.io\/([^\/]+)/,
    );
    if (githubPagesMatch) {
      return { owner: githubPagesMatch[1], repo: githubPagesMatch[2] };
    }

    // 非 GitHub Pages URL：回退到「Token 对应的用户 + daily-paper-reader」作为默认目标仓库
    try {
      const userRes = await ghFetch(token, 'https://api.github.com/user');
      if (userRes.ok) {
        const user = await userRes.json();
        const login = (user && user.login) ? String(user.login) : '';
        if (login) {
          return { owner: login, repo: 'daily-paper-reader' };
        }
      }
    } catch {
      // ignore
    }

    return { owner: '', repo: '' };
  };

  const ghFetch = async (token, url, init) => {
    const res = await fetch(url, {
      ...(init || {}),
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
        ...(init && init.headers ? init.headers : {}),
      },
    });
    return res;
  };

  const setStatus = (text, color) => {
    if (!statusEl) return;
    statusEl.textContent = text || '';
    statusEl.style.color = color || '#666';
  };

  const ensureOverlay = () => {
    if (overlay && panel) return;
    overlay = document.getElementById('dpr-workflow-overlay');
    if (overlay) {
      panel = document.getElementById('dpr-workflow-panel');
      statusEl = document.getElementById('dpr-workflow-status');
      runsEl = document.getElementById('dpr-workflow-runs');
      return;
    }

    overlay = document.createElement('div');
    overlay.id = 'dpr-workflow-overlay';
    overlay.innerHTML = `
      <div id="dpr-workflow-panel">
        <div id="dpr-workflow-header">
          <div style="font-weight:600;">工作流触发</div>
          <div style="display:flex; gap:8px; align-items:center;">
            <button id="dpr-workflow-refresh-btn" class="arxiv-tool-btn" style="padding:2px 10px;">刷新</button>
            <button id="dpr-workflow-close-btn" class="arxiv-tool-btn" style="padding:2px 6px;">关闭</button>
          </div>
        </div>
        <div style="padding:10px 12px;">
          <div id="dpr-workflow-status" style="font-size:12px; color:#666; margin-bottom:10px;">准备就绪。</div>
          <div style="display:flex; flex-direction:column; gap:8px; margin-bottom:12px;">
            ${WORKFLOWS.map(
              (wf) => `
              <div class="dpr-wf-card">
                <div style="display:flex; justify-content:space-between; gap:10px; align-items:center;">
                  <div style="min-width:0;">
                    <div style="font-weight:600; font-size:13px;">${escapeHtml(wf.name)}</div>
                    <div style="font-size:12px; color:#666; margin-top:2px;">${escapeHtml(wf.desc)}</div>
                  </div>
                  <button class="arxiv-tool-btn dpr-wf-run-btn" data-wf="${escapeHtml(
                    wf.id,
                  )}" style="padding:6px 10px; background:#17a2b8; color:white; flex-shrink:0;">运行</button>
                </div>
              </div>
            `,
            ).join('')}
          </div>
          <div style="font-weight:600; font-size:13px; margin-bottom:6px;">执行过程</div>
          <div id="dpr-workflow-runs" style="font-size:12px; color:#333; border:1px solid #eee; border-radius:8px; background:#fff; padding:10px; min-height:120px;">
            <div style="color:#999;">尚未触发工作流。</div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    panel = document.getElementById('dpr-workflow-panel');
    statusEl = document.getElementById('dpr-workflow-status');
    runsEl = document.getElementById('dpr-workflow-runs');

    const closeBtn = document.getElementById('dpr-workflow-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', close);
    }
    overlay.addEventListener('mousedown', (e) => {
      if (e.target === overlay) close();
    });

    const refreshBtn = document.getElementById('dpr-workflow-refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        if (activeRun && activeRun.owner && activeRun.repo && activeRun.runId) {
          refreshRun(activeRun.owner, activeRun.repo, activeRun.runId);
        } else {
          setStatus('暂无可刷新的运行记录。', '#666');
        }
      });
    }

    overlay.querySelectorAll('.dpr-wf-run-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const wfId = btn.getAttribute('data-wf') || '';
        if (!wfId) return;
        await dispatchAndMonitor(wfId);
      });
    });
  };

  const open = () => {
    ensureOverlay();
    if (!overlay) return;
    overlay.style.display = 'flex';
    requestAnimationFrame(() => overlay.classList.add('show'));
  };

  const close = () => {
    if (!overlay) return;
    overlay.classList.remove('show');
    setTimeout(() => {
      overlay.style.display = 'none';
    }, 160);
    stopPolling();
  };

  const stopPolling = () => {
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
  };

  const dispatchAndMonitor = async (workflowFile) => {
    const token = loadGithubToken();
    if (!token) {
      setStatus('未检测到 GitHub Token：请在“密钥配置”或“GitHub Token”处完成配置。', '#c00');
      return;
    }
    const { owner, repo } = await resolveRepoFromUrl(token);
    if (!owner || !repo) {
      setStatus('无法推断目标仓库：请确认 GitHub Token 有效，或使用 xxx.github.io/仓库名/ 访问。', '#c00');
      return;
    }

    setStatus(`正在触发工作流：${workflowFile} ...`, '#666');
    runsEl.innerHTML = '<div style="color:#999;">正在触发，请稍候...</div>';
    stopPolling();
    activeRun = null;

    const createdAt = new Date();

    try {
      // 触发 dispatch
      const dispatchUrl = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(
        workflowFile,
      )}/dispatches`;
      const res = await ghFetch(token, dispatchUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ref: 'main' }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`触发失败：HTTP ${res.status} ${res.statusText} - ${txt}`);
      }

      setStatus('已触发，正在等待运行记录创建...', '#666');

      // 轮询找到本次 dispatch 对应的 run
      const lookup = async () => {
        const runsUrl = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(
          workflowFile,
        )}/runs?event=workflow_dispatch&per_page=10`;
        const runsRes = await ghFetch(token, runsUrl);
        if (!runsRes.ok) {
          const txt = await runsRes.text().catch(() => '');
          throw new Error(`读取 workflow runs 失败：HTTP ${runsRes.status} ${runsRes.statusText} - ${txt}`);
        }
        const data = await runsRes.json();
        const list = Array.isArray(data.workflow_runs) ? data.workflow_runs : [];
        const found = list.find((r) => {
          try {
            const t = new Date(r.created_at);
            return t.getTime() >= createdAt.getTime() - 5000;
          } catch {
            return false;
          }
        });
        return found || null;
      };

      let run = null;
      for (let i = 0; i < 18; i += 1) {
        // 最多等 ~90 秒
        // eslint-disable-next-line no-await-in-loop
        run = await lookup();
        if (run) break;
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 5000));
      }

      if (!run || !run.id) {
        setStatus('已触发，但未能在短时间内找到对应的运行记录。建议打开 Actions 页面查看。', '#c00');
        runsEl.innerHTML = `<div style="color:#666;">请在 GitHub Actions 查看：<a target="_blank" href="https://github.com/${owner}/${repo}/actions">打开 Actions</a></div>`;
        return;
      }

      activeRun = { owner, repo, runId: run.id, token };
      setStatus(`运行已创建：run_id=${run.id}，开始拉取进度...`, '#080');
      await refreshRun(owner, repo, run.id);

      refreshTimer = setInterval(() => {
        if (!activeRun) return;
        refreshRun(activeRun.owner, activeRun.repo, activeRun.runId);
      }, 5000);
    } catch (e) {
      console.error(e);
      setStatus(`触发失败：${e.message || e}`, '#c00');
      runsEl.innerHTML = `<div style="color:#c00;">${escapeHtml(e.message || String(e))}</div>`;
    }
  };

  const renderRun = (owner, repo, run, jobs) => {
    const runUrl = `https://github.com/${owner}/${repo}/actions/runs/${run.id}`;
    const status = run.status || '';
    const conclusion = run.conclusion || '';

    const badgeColor =
      conclusion === 'success'
        ? '#2e7d32'
        : conclusion === 'failure'
          ? '#c00'
          : status === 'in_progress'
            ? '#1565c0'
            : '#666';

    const jobList = Array.isArray(jobs) ? jobs : [];
    const jobHtml = jobList
      .map((j) => {
        const steps = Array.isArray(j.steps) ? j.steps : [];
        const stepLines = steps
          .map((s) => {
            const c = s.conclusion || s.status || '';
            const icon =
              c === 'success'
                ? '✅'
                : c === 'failure'
                  ? '❌'
                  : c === 'skipped'
                    ? '⏭'
                    : c === 'in_progress'
                      ? '⏳'
                      : '•';
            return `<div class="dpr-wf-step">${icon} ${escapeHtml(
              s.name || '',
            )}</div>`;
          })
          .join('');
        return `
          <div class="dpr-wf-job">
            <div class="dpr-wf-job-title">${escapeHtml(j.name || '')}</div>
            <div class="dpr-wf-steps">${stepLines || '<div style="color:#999;">暂无步骤信息</div>'}</div>
          </div>
        `;
      })
      .join('');

    runsEl.innerHTML = `
      <div style="display:flex; justify-content:space-between; gap:10px; align-items:center; margin-bottom:8px;">
        <div style="min-width:0;">
          <div style="font-weight:600;">Run #${run.run_number || run.id}</div>
          <div style="color:#666; margin-top:2px;">
            <span style="display:inline-block; padding:1px 6px; border-radius:999px; background:rgba(0,0,0,0.06); color:${badgeColor};">
              ${escapeHtml(status)}${conclusion ? ` / ${escapeHtml(conclusion)}` : ''}
            </span>
            <span style="margin-left:8px;">${escapeHtml(
              (run.created_at || '').replace('T', ' ').replace('Z', ''),
            )}</span>
          </div>
        </div>
        <div style="flex-shrink:0; display:flex; gap:8px;">
          <a class="arxiv-tool-btn" style="padding:6px 10px; text-decoration:none;" target="_blank" href="${runUrl}">打开 Actions</a>
        </div>
      </div>
      ${jobHtml || '<div style="color:#999;">暂无 Job 信息</div>'}
    `;
  };

  const refreshRun = async (owner, repo, runId) => {
    const token = activeRun && activeRun.token ? activeRun.token : loadGithubToken();
    if (!token) return;

    try {
      const runUrl = `https://api.github.com/repos/${owner}/${repo}/actions/runs/${runId}`;
      const res = await ghFetch(token, runUrl);
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`读取 run 失败：HTTP ${res.status} ${res.statusText} - ${txt}`);
      }
      const run = await res.json();

      const jobsUrl = `https://api.github.com/repos/${owner}/${repo}/actions/runs/${runId}/jobs?per_page=100`;
      const jobsRes = await ghFetch(token, jobsUrl);
      let jobs = [];
      if (jobsRes.ok) {
        const jobsData = await jobsRes.json();
        jobs = Array.isArray(jobsData.jobs) ? jobsData.jobs : [];
      }

      renderRun(owner, repo, run, jobs);

      if (run.status === 'completed') {
        stopPolling();
        setStatus(`运行已结束：${run.conclusion || 'completed'}`, run.conclusion === 'success' ? '#080' : '#c00');
      } else {
        setStatus('运行中：每 5 秒自动刷新...', '#1565c0');
      }
    } catch (e) {
      console.error(e);
      setStatus(`刷新失败：${e.message || e}`, '#c00');
    }
  };

  return {
    open,
  };
})();
