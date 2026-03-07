import { useEffect, useMemo, useState } from 'react';
import type { CamReview, DraftCamPlan, PartInput } from '@cam/shared';
import './App.css';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001';

async function fetchJson<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
    ...options,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed with ${response.status}`);
  }

  return (await response.json()) as T;
}

function App() {
  const [sample, setSample] = useState<PartInput | null>(null);
  const [plan, setPlan] = useState<DraftCamPlan | null>(null);
  const [review, setReview] = useState<CamReview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'sample' | 'plan' | 'review' | 'approve' | null>(null);

  useEffect(() => {
    void loadSample();
  }, []);

  async function loadSample(): Promise<void> {
    try {
      setBusy('sample');
      setError(null);
      setSample(await fetchJson<PartInput>('/sample'));
      setPlan(null);
      setReview(null);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to load sample part.');
    } finally {
      setBusy(null);
    }
  }

  async function generatePlan(): Promise<void> {
    if (!sample) {
      return;
    }

    try {
      setBusy('plan');
      setError(null);
      setReview(null);
      setPlan(
        await fetchJson<DraftCamPlan>('/plan', {
          method: 'POST',
          body: JSON.stringify(sample),
        }),
      );
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to build plan.');
    } finally {
      setBusy(null);
    }
  }

  async function runReview(): Promise<void> {
    if (!plan) {
      return;
    }

    try {
      setBusy('review');
      setError(null);
      setReview(
        await fetchJson<CamReview>('/review', {
          method: 'POST',
          body: JSON.stringify({ plan }),
        }),
      );
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to run review.');
    } finally {
      setBusy(null);
    }
  }

  async function approve(): Promise<void> {
    if (!plan) {
      return;
    }

    try {
      setBusy('approve');
      setError(null);
      setPlan(
        await fetchJson<DraftCamPlan>('/approve', {
          method: 'POST',
          body: JSON.stringify({
            plan,
            approver: 'Demo Programmer',
            notes: 'Approved from the mobile-first review console demo.',
          }),
        }),
      );
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to approve plan.');
    } finally {
      setBusy(null);
    }
  }

  const partCounts = useMemo(() => {
    if (!sample) {
      return [];
    }

    return [
      ['Top surfaces', sample.topSurfaces.length],
      ['Contours', sample.contours.length],
      ['Pockets', sample.pockets.length],
      ['Slots', sample.slots.length],
      ['Hole groups', sample.holeGroups.length],
      ['Chamfers', sample.chamfers.length],
      ['Engraving', sample.engraving.length],
    ];
  }, [sample]);

  return (
    <main className="app-shell">
      <header className="hero-card">
        <div>
          <p className="eyebrow">Programmer-in-the-loop CAM</p>
          <h1>Draft review console for 2D and 2.5D milling</h1>
          <p className="hero-copy">
            Deterministic planning prepares the draft. AI review stays advisory. Human approval is
            required before release.
          </p>
        </div>
        <div className="action-row">
          <button onClick={() => void loadSample()} disabled={busy !== null}>
            {busy === 'sample' ? 'Loading sample…' : 'Reload sample'}
          </button>
          <button onClick={() => void generatePlan()} disabled={!sample || busy !== null}>
            {busy === 'plan' ? 'Planning…' : 'Generate draft plan'}
          </button>
          <button onClick={() => void runReview()} disabled={!plan || busy !== null}>
            {busy === 'review' ? 'Reviewing…' : 'Run AI review'}
          </button>
          <button onClick={() => void approve()} disabled={!plan || busy !== null}>
            {busy === 'approve' ? 'Approving…' : 'Approve draft'}
          </button>
        </div>
      </header>

      {error ? <section className="error-banner">{error}</section> : null}

      <section className="grid-layout">
        <article className="panel">
          <div className="panel-heading">
            <h2>Sample part input</h2>
            {sample ? <span className="chip">{sample.partId}</span> : null}
          </div>
          {sample ? (
            <>
              <p className="panel-copy">
                {sample.partName} rev {sample.revision} · {sample.stock.material}
              </p>
              <dl className="stats-grid">
                <div>
                  <dt>Stock</dt>
                  <dd>
                    {sample.stock.xMm} × {sample.stock.yMm} × {sample.stock.zMm} mm
                  </dd>
                </div>
                {partCounts.map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </>
          ) : (
            <p className="panel-copy">Load the sample part input to begin.</p>
          )}
        </article>

        <article className="panel">
          <div className="panel-heading">
            <h2>Approval state</h2>
            {plan ? <span className={`chip chip-${plan.approval.state}`}>{plan.approval.state}</span> : null}
          </div>
          {plan ? (
            <>
              <p className="panel-copy">
                {plan.summary.featureCount} normalized features · {plan.summary.operationCount} proposed operations ·
                {` `}{plan.estimatedCycleTimeMinutes} min estimated cycle time
              </p>
              <ul className="simple-list">
                <li>Highest risk: {plan.summary.highestRisk}</li>
                <li>Human approval required: {plan.approval.requiresHumanApproval ? 'Yes' : 'No'}</li>
                <li>Approved by: {plan.approval.approvedBy ?? 'Pending review'}</li>
              </ul>
            </>
          ) : (
            <p className="panel-copy">Generate a draft plan to review approval state.</p>
          )}
        </article>
      </section>

      <section className="grid-layout">
        <article className="panel">
          <div className="panel-heading">
            <h2>Normalized features</h2>
            {plan ? <span className="chip">{plan.features.length}</span> : null}
          </div>
          <div className="stacked-list">
            {plan?.features.map((feature) => (
              <div key={feature.id} className="list-card">
                <div className="list-card-header">
                  <strong>{feature.name}</strong>
                  <span>{feature.kind.replace('_', ' ')}</span>
                </div>
                <p>
                  Depth {feature.depthMm} mm · Size {feature.lengthMm} × {feature.widthMm} mm · Qty {feature.quantity}
                </p>
                <ul>
                  {feature.notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </div>
            )) ?? <p className="panel-copy">No deterministic features yet.</p>}
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <h2>Operations and tools</h2>
            {plan ? <span className="chip">{plan.operations.length}</span> : null}
          </div>
          <div className="stacked-list">
            {plan?.operations.map((operation) => (
              <div key={operation.id} className="list-card">
                <div className="list-card-header">
                  <strong>{operation.name}</strong>
                  <span>{operation.estimatedMinutes} min</span>
                </div>
                <p>{operation.strategy}</p>
                <p>
                  {operation.setup} · {operation.toolName}
                </p>
              </div>
            )) ?? <p className="panel-copy">No operations yet.</p>}
          </div>
        </article>
      </section>

      <section className="grid-layout">
        <article className="panel">
          <div className="panel-heading">
            <h2>Risks and checklist</h2>
            {plan ? <span className="chip">{plan.risks.length + plan.checklist.length}</span> : null}
          </div>
          {plan ? (
            <div className="stacked-list">
              {plan.risks.map((risk) => (
                <div key={risk.id} className="list-card">
                  <div className="list-card-header">
                    <strong>{risk.title}</strong>
                    <span className={`risk-pill risk-${risk.level}`}>{risk.level}</span>
                  </div>
                  <p>{risk.description}</p>
                </div>
              ))}
              {plan.checklist.map((item) => (
                <div key={item.id} className="list-card">
                  <div className="list-card-header">
                    <strong>{item.title}</strong>
                    <span>{item.status}</span>
                  </div>
                  <p>{item.rationale}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="panel-copy">Generate a plan to see deterministic risks and checklist items.</p>
          )}
        </article>

        <article className="panel">
          <div className="panel-heading">
            <h2>AI advisory review</h2>
            {review ? <span className="chip">{review.mode}</span> : null}
          </div>
          {review ? (
            <div className="stacked-list">
              <div className="list-card">
                <div className="list-card-header">
                  <strong>Overall assessment</strong>
                </div>
                <p>{review.overallAssessment}</p>
              </div>
              <div className="list-card">
                <div className="list-card-header">
                  <strong>Missing operations</strong>
                </div>
                <ul>
                  {(review.missingOperations.length > 0 ? review.missingOperations : ['No likely missing operations identified by the advisory review.']).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="list-card">
                <div className="list-card-header">
                  <strong>Risk flags</strong>
                </div>
                <ul>
                  {(review.riskFlags.length > 0 ? review.riskFlags : ['No additional advisory risk flags.']).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="list-card">
                <div className="list-card-header">
                  <strong>Suggested edits</strong>
                </div>
                <ul>
                  {(review.suggestedEdits.length > 0 ? review.suggestedEdits : ['No advisory edits suggested.']).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <p className="panel-copy">Run the AI review after generating a deterministic draft plan.</p>
          )}
        </article>
      </section>
    </main>
  );
}

export default App;
