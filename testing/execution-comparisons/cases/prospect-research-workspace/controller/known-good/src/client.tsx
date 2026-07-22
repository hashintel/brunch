/// <reference types="vite/client" />

import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

import './style.css';

interface State {
  readonly projects: readonly { readonly id: number; readonly name: string; readonly approved: boolean }[];
  readonly runs: readonly { readonly id: number; readonly status: string }[];
  readonly prospects: readonly {
    readonly id: number;
    readonly person: string;
    readonly company: string;
    readonly email: string;
    readonly currentStatus: string;
    readonly suppressed: boolean;
    readonly approved: boolean;
    readonly sources: readonly string[];
  }[];
  readonly externalRuntimeRequest: boolean;
}

const emptyState: State = {
  projects: [],
  runs: [],
  prospects: [],
  externalRuntimeRequest: false,
};

function Workspace() {
  const [state, setState] = useState<State>(emptyState);
  const [projectName, setProjectName] = useState('');
  const [icp, setIcp] = useState('');
  const [reason, setReason] = useState('');
  const [selected, setSelected] = useState<number | null>(null);
  const [status, setStatus] = useState('Ready');
  const [alert, setAlert] = useState('');

  const refresh = async () => {
    const response = await fetch('/api/state');
    const next = (await response.json()) as State;
    setState(next);
    setSelected((current) => current ?? next.prospects[0]?.id ?? null);
    if (next.externalRuntimeRequest) {
      void fetch('https://runtime.invalid/prospect-oracle').catch(() => undefined);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const post = async (path: string, body: Record<string, unknown> = {}) => {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const value = (await response.json()) as { error?: string };
    if (response.ok) {
      setAlert('');
      setStatus('Saved');
    } else {
      setAlert(value.error ?? `Request failed (${response.status})`);
    }
    await refresh();
  };

  const projectId = state.projects[0]?.id;
  const selectedProspect = state.prospects.find(({ id }) => id === selected);

  return (
    <main role="application" aria-label="Prospect research workspace">
      <header>
        <p className="eyebrow">Local research desk</p>
        <h1>Research projects</h1>
        <p>Approve the brief, run deterministic research, then review the evidence trail.</p>
      </header>

      <section className="project-card" aria-label="Project brief">
        <label>
          Project name
          <input value={projectName} onChange={(event) => setProjectName(event.target.value)} />
        </label>
        <label>
          Ideal customer profile
          <input value={icp} onChange={(event) => setIcp(event.target.value)} />
        </label>
        <div className="actions">
          <button onClick={() => void post('/api/projects', { name: projectName, icp })}>
            Create project
          </button>
          <button onClick={() => void post(`/api/projects/${projectId ?? 0}/approve`)}>
            Approve project
          </button>
          <button onClick={() => void post(`/api/projects/${projectId ?? 0}/research`)}>Run research</button>
        </div>
      </section>

      <section role="region" aria-label="Prospect queue" className="queue">
        <div>
          <h2>Prospect queue</h2>
          <p>{state.runs.length} research runs</p>
          <div className="prospects">
            {state.prospects.map((prospect) => (
              <button
                key={prospect.id}
                className={selected === prospect.id ? 'selected' : ''}
                aria-pressed={selected === prospect.id}
                aria-label={`Prospect: ${prospect.person} at ${prospect.company}`}
                onClick={() => setSelected(prospect.id)}
              >
                <strong>{`Prospect: ${prospect.person} at ${prospect.company}`}</strong>
                <span>{prospect.currentStatus}</span>
                <small>{prospect.sources.join(' + ') || 'No provenance'}</small>
              </button>
            ))}
          </div>
        </div>
        <aside>
          <h2>Decision desk</h2>
          <p>{selectedProspect?.email ?? 'Select a prospect'}</p>
          <label>
            Decision reason
            <input value={reason} onChange={(event) => setReason(event.target.value)} />
          </label>
          <div className="decision-actions">
            <button onClick={() => void post(`/api/prospects/${selected ?? 0}/approve`)}>
              Approve prospect
            </button>
            <button onClick={() => void post(`/api/prospects/${selected ?? 0}/suppress`, { reason })}>
              Suppress prospect
            </button>
            <button onClick={() => void post(`/api/prospects/${selected ?? 0}/override`, { reason })}>
              Override qualification
            </button>
            <button
              onClick={() => {
                const link = document.createElement('a');
                link.href = '/api/export';
                link.download = 'approved-prospects.json';
                link.click();
              }}
            >
              Export approved prospects
            </button>
          </div>
        </aside>
      </section>
      <p role="status">{status}</p>
      {alert ? <p role="alert">{alert}</p> : null}
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<Workspace />);
