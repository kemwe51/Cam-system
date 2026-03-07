import { useEffect, useMemo, useReducer, useState } from 'react';
import type { JSX } from 'react';
import './App.css';
import {
  approveDraftPlan,
  generateDraftPlan,
  loadProjectDraft,
  loadSamplePart,
  reviewDraftPlan,
  saveProjectDraft,
} from './api';
import { Viewport3D } from './Viewport3D';
import {
  buildProjectDraft,
  createProjectId,
  getOrderedOperations,
  initialWorkbenchState,
  resolveSelectedFeatureId,
  workbenchReducer,
} from './workbenchReducer';
import type { ViewOrientation } from './viewportScene';

type BusyState = 'sample' | 'plan' | 'review' | 'approve' | 'save' | 'load' | null;
type BottomTab = 'review' | 'risks' | 'approval' | 'console';
type PanelKey = 'tree' | 'inspector' | 'bottom';

const bottomTabs: Array<{ id: BottomTab; label: string }> = [
  { id: 'review', label: 'AI review' },
  { id: 'risks', label: 'Risks + notes' },
  { id: 'approval', label: 'Approval' },
  { id: 'console', label: 'Console' },
];

function panelSelectionClass(active: boolean): string {
  return active ? 'tree-item tree-item-selected' : 'tree-item';
}

function formatTimestamp(value: string | null): string {
  if (!value) {
    return 'Not saved yet';
  }

  return new Date(value).toLocaleString();
}

function App() {
  const [state, dispatch] = useReducer(workbenchReducer, initialWorkbenchState);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<BusyState>(null);
  const [viewOrientation, setViewOrientation] = useState<ViewOrientation>('isometric');
  const [activeBottomTab, setActiveBottomTab] = useState<BottomTab>('review');
  const [panelVisibility, setPanelVisibility] = useState<Record<PanelKey, boolean>>({
    tree: true,
    inspector: true,
    bottom: true,
  });

  useEffect(() => {
    void handleLoadSample();
  }, []);

  const orderedOperations = useMemo(() => getOrderedOperations(state.draftPlan), [state.draftPlan]);
  const selectedFeatureId = useMemo(
    () => resolveSelectedFeatureId(state.draftPlan, state.selectedEntity),
    [state.draftPlan, state.selectedEntity],
  );
  const selectedFeature = useMemo(
    () => state.draftPlan?.features.find((feature) => feature.id === selectedFeatureId) ?? null,
    [selectedFeatureId, state.draftPlan],
  );
  const selectedOperation = useMemo(
    () =>
      state.selectedEntity?.type === 'operation'
        ? orderedOperations.find((operation) => operation.id === state.selectedEntity?.id) ?? null
        : null,
    [orderedOperations, state.selectedEntity],
  );
  const projectId = useMemo(
    () => (state.sample ? createProjectId(state.sample) : state.draftPlan ? createProjectId(state.draftPlan.part) : null),
    [state.draftPlan, state.sample],
  );

  async function withBusy(nextBusy: BusyState, action: () => Promise<void>): Promise<void> {
    try {
      setBusy(nextBusy);
      setError(null);
      await action();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unexpected workbench error.');
    } finally {
      setBusy(null);
    }
  }

  async function handleLoadSample(): Promise<void> {
    await withBusy('sample', async () => {
      const sample = await loadSamplePart();
      dispatch({
        type: 'sampleLoaded',
        sample,
        message: `Loaded structured sample part ${sample.partId}.`,
      });
    });
  }

  async function handlePlan(): Promise<void> {
    if (!state.sample) {
      return;
    }
    const sample = state.sample;

    await withBusy('plan', async () => {
      const plan = await generateDraftPlan(sample);
      dispatch({
        type: 'planLoaded',
        plan,
        message: `Generated deterministic plan with ${plan.operations.length} operations.`,
      });
      setViewOrientation('fit');
    });
  }

  async function handleReview(): Promise<void> {
    if (!state.draftPlan) {
      return;
    }
    const draftPlan = state.draftPlan;

    await withBusy('review', async () => {
      const review = await reviewDraftPlan(draftPlan);
      dispatch({
        type: 'reviewLoaded',
        review,
        message: `AI review returned in ${review.mode} mode.`,
      });
      setActiveBottomTab('review');
    });
  }

  async function handleApprove(): Promise<void> {
    if (!state.draftPlan) {
      return;
    }
    const draftPlan = state.draftPlan;

    await withBusy('approve', async () => {
      const plan = await approveDraftPlan(draftPlan);
      dispatch({
        type: 'approvalLoaded',
        plan,
        message: 'Approval state updated from the workbench.',
      });
      setActiveBottomTab('approval');
    });
  }

  async function handleSaveDraft(): Promise<void> {
    const projectDraft = buildProjectDraft(state);
    if (!projectDraft) {
      return;
    }

    await withBusy('save', async () => {
      const savedDraft = await saveProjectDraft(projectDraft);
      dispatch({
        type: 'projectSaved',
        savedAt: savedDraft.savedAt ?? new Date().toISOString(),
        message: `Saved draft foundation ${savedDraft.projectId} to the API store.`,
      });
      setActiveBottomTab('console');
    });
  }

  async function handleLoadDraft(): Promise<void> {
    if (!projectId) {
      return;
    }

    await withBusy('load', async () => {
      const project = await loadProjectDraft(projectId);
      dispatch({
        type: 'projectLoaded',
        project,
        message: `Loaded saved draft ${project.projectId} from the API store.`,
      });
      setActiveBottomTab('console');
      setViewOrientation('fit');
    });
  }

  function togglePanel(panelKey: PanelKey): void {
    setPanelVisibility((current) => ({
      ...current,
      [panelKey]: !current[panelKey],
    }));
  }

  function renderBottomPanel(): JSX.Element {
    if (activeBottomTab === 'review') {
      return state.review ? (
        <div className="bottom-grid">
          <article className="bottom-card">
            <header>
              <h3>Assessment</h3>
              <span className="chip">{state.review.mode}</span>
            </header>
            <p>{state.review.overallAssessment}</p>
          </article>
          <article className="bottom-card">
            <header>
              <h3>Missing operations</h3>
            </header>
            <ul>
              {(state.review.missingOperations.length > 0
                ? state.review.missingOperations
                : ['No additional missing operations flagged by the advisory review.']).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
          <article className="bottom-card">
            <header>
              <h3>Suggested edits</h3>
            </header>
            <ul>
              {(state.review.suggestedEdits.length > 0
                ? state.review.suggestedEdits
                : ['No additional advisory edits were suggested.']).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        </div>
      ) : (
        <p className="empty-state">Run the advisory review after planning or manual edits.</p>
      );
    }

    if (activeBottomTab === 'risks') {
      return state.draftPlan ? (
        <div className="bottom-grid">
          <article className="bottom-card">
            <header>
              <h3>Risks</h3>
            </header>
            <div className="stacked-list">
              {state.draftPlan.risks.length > 0 ? (
                state.draftPlan.risks.map((risk) => (
                  <button
                    type="button"
                    key={risk.id}
                    className={panelSelectionClass(
                      state.selectedEntity?.type === 'risk' && state.selectedEntity.id === risk.id,
                    )}
                    onClick={() => dispatch({ type: 'selectEntity', entity: { type: 'risk', id: risk.id } })}
                  >
                    <strong>{risk.title}</strong>
                    <span className={`risk-pill risk-${risk.level}`}>{risk.level}</span>
                    <small>{risk.description}</small>
                  </button>
                ))
              ) : (
                <p className="empty-state">No deterministic risks were triggered.</p>
              )}
            </div>
          </article>
          <article className="bottom-card">
            <header>
              <h3>Checklist</h3>
            </header>
            <ul className="detail-list">
              {state.draftPlan.checklist.map((item) => (
                <li key={item.id}>
                  <strong>{item.title}</strong>
                  <span>{item.rationale}</span>
                </li>
              ))}
            </ul>
          </article>
        </div>
      ) : (
        <p className="empty-state">Plan the part to inspect deterministic risks and review notes.</p>
      );
    }

    if (activeBottomTab === 'approval') {
      return state.draftPlan ? (
        <div className="bottom-grid">
          <article className="bottom-card">
            <header>
              <h3>Approval state</h3>
              <span className={`chip chip-${state.draftPlan.approval.state}`}>
                {state.draftPlan.approval.state.replace('_', ' ')}
              </span>
            </header>
            <dl className="detail-pairs">
              <div>
                <dt>Human approval</dt>
                <dd>{state.draftPlan.approval.requiresHumanApproval ? 'Required' : 'Not required'}</dd>
              </div>
              <div>
                <dt>Approved by</dt>
                <dd>{state.draftPlan.approval.approvedBy ?? 'Pending'}</dd>
              </div>
              <div>
                <dt>Saved draft</dt>
                <dd>{formatTimestamp(state.lastSavedAt)}</dd>
              </div>
              <div>
                <dt>Dirty state</dt>
                <dd>{state.dirty ? 'Unsaved manual changes' : 'In sync with last saved/generated state'}</dd>
              </div>
            </dl>
          </article>
          <article className="bottom-card">
            <header>
              <h3>Approval notes</h3>
            </header>
            <ul>
              {state.draftPlan.approval.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </article>
        </div>
      ) : (
        <p className="empty-state">Approval state appears once a deterministic plan exists.</p>
      );
    }

    return (
      <ul className="console-list">
        {state.consoleMessages.map((message) => (
          <li key={message}>{message}</li>
        ))}
      </ul>
    );
  }

  return (
    <main className="workbench-shell">
      <header className="toolbar-shell">
        <div className="toolbar-copy">
          <p className="eyebrow">Programmer-in-the-loop CAM workbench</p>
          <h1>Manual planning foundation for 2D / 2.5D milling</h1>
          <p>
            Deterministic planning remains authoritative. The viewport is a derived scene from structured
            JSON input, and AI review stays advisory only.
          </p>
        </div>
        <div className="toolbar-group">
          <button onClick={() => void handleLoadSample()} disabled={busy !== null}>
            {busy === 'sample' ? 'Loading…' : 'Reload sample'}
          </button>
          <button onClick={() => void handlePlan()} disabled={!state.sample || busy !== null}>
            {busy === 'plan' ? 'Planning…' : 'Plan'}
          </button>
          <button onClick={() => void handleReview()} disabled={!state.draftPlan || busy !== null}>
            {busy === 'review' ? 'Reviewing…' : 'Review'}
          </button>
          <button onClick={() => void handleApprove()} disabled={!state.draftPlan || busy !== null}>
            {busy === 'approve' ? 'Approving…' : 'Approve'}
          </button>
          <button onClick={() => void handleSaveDraft()} disabled={!state.draftPlan || busy !== null}>
            {busy === 'save' ? 'Saving…' : 'Save draft'}
          </button>
          <button onClick={() => void handleLoadDraft()} disabled={!projectId || busy !== null}>
            {busy === 'load' ? 'Loading…' : 'Load draft'}
          </button>
        </div>
        <div className="toolbar-group toolbar-group-secondary">
          {(['isometric', 'top', 'front', 'fit'] as ViewOrientation[]).map((orientation) => (
            <button
              key={orientation}
              type="button"
              className={viewOrientation === orientation ? 'secondary-button active-button' : 'secondary-button'}
              onClick={() => setViewOrientation(orientation)}
            >
              {orientation}
            </button>
          ))}
          {(['tree', 'inspector', 'bottom'] as PanelKey[]).map((panelKey) => (
            <button
              key={panelKey}
              type="button"
              className={panelVisibility[panelKey] ? 'secondary-button active-button' : 'secondary-button'}
              onClick={() => togglePanel(panelKey)}
            >
              {panelKey}
            </button>
          ))}
          <span className={state.dirty ? 'chip chip-dirty' : 'chip'}>
            {state.dirty ? 'Unsaved manual edits' : 'Draft synced'}
          </span>
        </div>
        {error ? <div className="error-banner">{error}</div> : null}
      </header>

      <section className="workbench-grid">
        {panelVisibility.tree ? (
          <aside className="workbench-panel tree-panel">
            <div className="panel-header">
              <div>
                <p className="panel-label">Project tree</p>
                <h2>{state.sample?.partName ?? 'No part loaded'}</h2>
              </div>
              {projectId ? <span className="chip">{projectId}</span> : null}
            </div>
            {state.sample ? (
              <dl className="summary-list">
                <div>
                  <dt>Stock</dt>
                  <dd>
                    {state.sample.stock.xMm} × {state.sample.stock.yMm} × {state.sample.stock.zMm} mm
                  </dd>
                </div>
                <div>
                  <dt>Material</dt>
                  <dd>{state.sample.stock.material}</dd>
                </div>
                <div>
                  <dt>Revision</dt>
                  <dd>{state.sample.revision}</dd>
                </div>
                <div>
                  <dt>Last save</dt>
                  <dd>{formatTimestamp(state.lastSavedAt)}</dd>
                </div>
              </dl>
            ) : (
              <p className="empty-state">Load the structured part input to initialize the workbench.</p>
            )}
            <div className="tree-section">
              <div className="tree-section-header">
                <h3>Features</h3>
                <span className="chip">{state.draftPlan?.features.length ?? 0}</span>
              </div>
              <div className="tree-stack">
                {state.draftPlan?.features.map((feature) => (
                  <button
                    type="button"
                    key={feature.id}
                    className={panelSelectionClass(
                      state.selectedEntity?.type === 'feature' && state.selectedEntity.id === feature.id,
                    )}
                    onClick={() => dispatch({ type: 'selectEntity', entity: { type: 'feature', id: feature.id } })}
                  >
                    <strong>{feature.name}</strong>
                    <span>{feature.kind.replace('_', ' ')}</span>
                    <small>
                      Qty {feature.quantity} · {feature.lengthMm.toFixed(1)} × {feature.widthMm.toFixed(1)} ×{' '}
                      {feature.depthMm.toFixed(1)} mm
                    </small>
                  </button>
                )) ?? <p className="empty-state">Generate a plan to populate the feature tree.</p>}
              </div>
            </div>
            <div className="tree-section">
              <div className="tree-section-header">
                <h3>Operations</h3>
                <span className="chip">{orderedOperations.length}</span>
              </div>
              <div className="tree-stack">
                {orderedOperations.length > 0 ? (
                  orderedOperations.map((operation, index) => (
                    <div key={operation.id} className="tree-operation-row">
                      <button
                        type="button"
                        className={panelSelectionClass(
                          state.selectedEntity?.type === 'operation' && state.selectedEntity.id === operation.id,
                        )}
                        onClick={() =>
                          dispatch({ type: 'selectEntity', entity: { type: 'operation', id: operation.id } })
                        }
                      >
                        <strong>
                          {index + 1}. {operation.name}
                        </strong>
                        <span>
                          {operation.origin} · {operation.enabled ? 'enabled' : 'disabled'}
                        </span>
                        <small>
                          {operation.setup} · {operation.toolName} · {operation.estimatedMinutes.toFixed(1)} min
                        </small>
                      </button>
                      <div className="tree-controls">
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() =>
                            dispatch({
                              type: 'moveOperation',
                              operationId: operation.id,
                              direction: 'up',
                              message: `Moved ${operation.name} earlier in the draft order.`,
                            })
                          }
                          disabled={index === 0}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() =>
                            dispatch({
                              type: 'moveOperation',
                              operationId: operation.id,
                              direction: 'down',
                              message: `Moved ${operation.name} later in the draft order.`,
                            })
                          }
                          disabled={index === orderedOperations.length - 1}
                        >
                          ↓
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="empty-state">Manual and automatic operations appear after planning.</p>
                )}
              </div>
            </div>
          </aside>
        ) : null}

        <section className="workbench-panel viewport-panel">
          <div className="panel-header">
            <div>
              <p className="panel-label">Viewport</p>
              <h2>Derived stock and feature view</h2>
            </div>
            {state.draftPlan ? <span className="chip">{state.draftPlan.summary.featureCount} features</span> : null}
          </div>
          {state.draftPlan ? (
            <>
              <Viewport3D
                part={state.draftPlan.part}
                features={state.draftPlan.features}
                selectedFeatureId={selectedFeatureId}
                onSelectFeature={(featureId) =>
                  dispatch({
                    type: 'selectEntity',
                    entity: featureId ? { type: 'feature', id: featureId } : null,
                  })
                }
                viewOrientation={viewOrientation}
              />
              <div className="viewport-status-bar">
                <span>
                  Highest risk: <strong>{state.draftPlan.summary.highestRisk}</strong>
                </span>
                <span>
                  Enabled cycle time: <strong>{state.draftPlan.estimatedCycleTimeMinutes.toFixed(1)} min</strong>
                </span>
                <span>
                  Approval: <strong>{state.draftPlan.approval.state.replace('_', ' ')}</strong>
                </span>
              </div>
            </>
          ) : (
            <div className="viewport-placeholder">
              <p>Generate a deterministic draft plan to populate the derived viewport scene and workbench trees.</p>
            </div>
          )}
        </section>

        {panelVisibility.inspector ? (
          <aside className="workbench-panel inspector-panel">
            <div className="panel-header">
              <div>
                <p className="panel-label">Inspector</p>
                <h2>
                  {selectedOperation
                    ? selectedOperation.name
                    : selectedFeature
                      ? selectedFeature.name
                      : 'Select a feature or operation'}
                </h2>
              </div>
              {selectedOperation ? (
                <span className="chip">{selectedOperation.origin}</span>
              ) : selectedFeature ? (
                <span className="chip">{selectedFeature.kind.replace('_', ' ')}</span>
              ) : null}
            </div>
            {selectedOperation && state.draftPlan ? (
              <div className="inspector-form">
                <label>
                  <span>Operation name</span>
                  <input
                    value={selectedOperation.name}
                    onChange={(event) =>
                      dispatch({
                        type: 'updateOperation',
                        operationId: selectedOperation.id,
                        changes: { name: event.target.value },
                        message: `Updated operation name for ${selectedOperation.name}.`,
                      })
                    }
                  />
                </label>
                <label>
                  <span>Strategy</span>
                  <textarea
                    rows={5}
                    value={selectedOperation.strategy}
                    onChange={(event) =>
                      dispatch({
                        type: 'updateOperation',
                        operationId: selectedOperation.id,
                        changes: { strategy: event.target.value },
                        message: `Updated strategy for ${selectedOperation.name}.`,
                      })
                    }
                  />
                </label>
                <label>
                  <span>Setup</span>
                  <input
                    value={selectedOperation.setup}
                    onChange={(event) =>
                      dispatch({
                        type: 'updateOperation',
                        operationId: selectedOperation.id,
                        changes: { setup: event.target.value },
                        message: `Updated setup for ${selectedOperation.name}.`,
                      })
                    }
                  />
                </label>
                <label>
                  <span>Estimated minutes</span>
                  <input
                    type="number"
                    min="0.5"
                    step="0.1"
                    value={selectedOperation.estimatedMinutes}
                    onChange={(event) => {
                      const nextMinutes = Number(event.target.value);
                      if (!Number.isFinite(nextMinutes) || nextMinutes < 0.5) {
                        return;
                      }
                      dispatch({
                        type: 'updateOperation',
                        operationId: selectedOperation.id,
                        changes: { estimatedMinutes: nextMinutes },
                        message: `Updated estimated time for ${selectedOperation.name}.`,
                      });
                    }}
                  />
                </label>
                <label>
                  <span>Selected tool</span>
                  <select
                    value={selectedOperation.toolId}
                    onChange={(event) =>
                      dispatch({
                        type: 'updateOperation',
                        operationId: selectedOperation.id,
                        changes: { toolId: event.target.value },
                        message: `Selected a different tool for ${selectedOperation.name}.`,
                      })
                    }
                  >
                    {state.draftPlan.tools.map((tool) => (
                      <option key={tool.id} value={tool.id}>
                        {tool.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={selectedOperation.enabled}
                    onChange={() =>
                      dispatch({
                        type: 'toggleOperation',
                        operationId: selectedOperation.id,
                        message: `${selectedOperation.enabled ? 'Disabled' : 'Enabled'} ${selectedOperation.name}.`,
                      })
                    }
                  />
                  <span>Enabled for the draft sequence</span>
                </label>
                <div className="inspector-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() =>
                      dispatch({
                        type: 'moveOperation',
                        operationId: selectedOperation.id,
                        direction: 'up',
                        message: `Moved ${selectedOperation.name} earlier in the draft order.`,
                      })
                    }
                  >
                    Move up
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() =>
                      dispatch({
                        type: 'moveOperation',
                        operationId: selectedOperation.id,
                        direction: 'down',
                        message: `Moved ${selectedOperation.name} later in the draft order.`,
                      })
                    }
                  >
                    Move down
                  </button>
                </div>
                <dl className="detail-pairs">
                  <div>
                    <dt>Order</dt>
                    <dd>{selectedOperation.order + 1}</dd>
                  </div>
                  <div>
                    <dt>Origin</dt>
                    <dd>{selectedOperation.origin}</dd>
                  </div>
                  <div>
                    <dt>Feature</dt>
                    <dd>{selectedFeature?.name ?? selectedOperation.featureId}</dd>
                  </div>
                  <div>
                    <dt>Status</dt>
                    <dd>{selectedOperation.enabled ? 'Enabled' : 'Disabled'}</dd>
                  </div>
                </dl>
              </div>
            ) : selectedFeature && state.draftPlan ? (
              <div className="inspector-form">
                <dl className="detail-pairs">
                  <div>
                    <dt>Kind</dt>
                    <dd>{selectedFeature.kind.replace('_', ' ')}</dd>
                  </div>
                  <div>
                    <dt>Quantity</dt>
                    <dd>{selectedFeature.quantity}</dd>
                  </div>
                  <div>
                    <dt>Depth</dt>
                    <dd>{selectedFeature.depthMm.toFixed(1)} mm</dd>
                  </div>
                  <div>
                    <dt>Envelope</dt>
                    <dd>
                      {selectedFeature.lengthMm.toFixed(1)} × {selectedFeature.widthMm.toFixed(1)} mm
                    </dd>
                  </div>
                </dl>
                <ul className="detail-list">
                  {selectedFeature.notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() =>
                    dispatch({
                      type: 'addManualOperation',
                      featureId: selectedFeature.id,
                      message: `Added a manual operation for ${selectedFeature.name}.`,
                    })
                  }
                >
                  Add manual operation
                </button>
                <div className="inspector-subsection">
                  <h3>Related operations</h3>
                  <div className="tree-stack">
                    {orderedOperations
                      .filter((operation) => operation.featureId === selectedFeature.id)
                      .map((operation) => (
                        <button
                          key={operation.id}
                          type="button"
                          className={panelSelectionClass(
                            state.selectedEntity?.type === 'operation' && state.selectedEntity.id === operation.id,
                          )}
                          onClick={() =>
                            dispatch({ type: 'selectEntity', entity: { type: 'operation', id: operation.id } })
                          }
                        >
                          <strong>{operation.name}</strong>
                          <span>{operation.origin}</span>
                          <small>{operation.toolName}</small>
                        </button>
                      ))}
                  </div>
                </div>
              </div>
            ) : (
              <p className="empty-state">
                Select a feature in the tree or viewport, or select an operation to edit manual planning fields.
              </p>
            )}
          </aside>
        ) : null}
      </section>

      {panelVisibility.bottom ? (
        <section className="workbench-panel bottom-panel">
          <div className="panel-header bottom-panel-header">
            <div>
              <p className="panel-label">Review + release</p>
              <h2>Risks, AI review, approval, and console</h2>
            </div>
            <nav className="tab-strip" aria-label="Workbench detail tabs">
              {bottomTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={activeBottomTab === tab.id ? 'secondary-button active-button' : 'secondary-button'}
                  onClick={() => setActiveBottomTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
          {renderBottomPanel()}
        </section>
      ) : null}
    </main>
  );
}

export default App;
