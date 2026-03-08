import { useEffect, useMemo, useReducer, useState } from 'react';
import type { JSX } from 'react';
import './App.css';
import {
  approveDraftPlan,
  generateDraftPlan,
  listProjects,
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
import type { ViewMode, ViewOrientation } from './viewportScene';

type BusyState = 'sample' | 'catalog' | 'plan' | 'review' | 'approve' | 'save' | 'load' | null;
type BottomTab = 'risks' | 'checklist' | 'review' | 'console' | 'metadata';
type LeftDockTab = 'model' | 'features' | 'operations' | 'tools';
type OperationFilter = 'all' | 'enabled' | 'disabled' | 'manual' | 'automatic';
type OperationGroupMode = 'setup' | 'feature';

type OperationGroupView = {
  id: string;
  label: string;
  operationIds: string[];
};

const leftDockTabs: Array<{ id: LeftDockTab; label: string }> = [
  { id: 'model', label: 'Model tree' },
  { id: 'features', label: 'Features' },
  { id: 'operations', label: 'Operations' },
  { id: 'tools', label: 'Tools' },
];

const bottomTabs: Array<{ id: BottomTab; label: string }> = [
  { id: 'risks', label: 'Risks' },
  { id: 'checklist', label: 'Checklist' },
  { id: 'review', label: 'AI review' },
  { id: 'console', label: 'Console' },
  { id: 'metadata', label: 'Project metadata' },
];

const viewOrientations: ViewOrientation[] = ['fit', 'top', 'front', 'right', 'isometric'];
const viewModes: ViewMode[] = ['shaded', 'wireframe', 'stock_only', 'features', 'operations'];
const operationFilters: OperationFilter[] = ['all', 'enabled', 'disabled', 'manual', 'automatic'];

function panelSelectionClass(active: boolean): string {
  return active ? 'tree-item tree-item-selected' : 'tree-item';
}

function formatTimestamp(value: string | null | undefined): string {
  if (!value) {
    return 'Not saved yet';
  }

  return new Date(value).toLocaleString();
}

function filterOperations<T extends { enabled: boolean; origin: 'automatic' | 'manual' }>(
  operations: T[],
  operationFilter: OperationFilter,
): T[] {
  switch (operationFilter) {
    case 'enabled':
      return operations.filter((operation) => operation.enabled);
    case 'disabled':
      return operations.filter((operation) => !operation.enabled);
    case 'manual':
      return operations.filter((operation) => operation.origin === 'manual');
    case 'automatic':
      return operations.filter((operation) => operation.origin === 'automatic');
    default:
      return operations;
  }
}

function operationGroups(
  operations: ReturnType<typeof getOrderedOperations>,
  mode: OperationGroupMode,
  featureNames: Map<string, string>,
): OperationGroupView[] {
  const groups = new Map<string, OperationGroupView>();

  operations.forEach((operation) => {
    const label = mode === 'setup' ? operation.setup : featureNames.get(operation.featureId) ?? operation.featureId;
    const id = mode === 'setup' ? operation.setupId : operation.featureId;
    const existing = groups.get(id);
    if (existing) {
      existing.operationIds.push(operation.id);
      return;
    }

    groups.set(id, {
      id,
      label,
      operationIds: [operation.id],
    });
  });

  return [...groups.values()];
}

function App() {
  const [state, dispatch] = useReducer(workbenchReducer, initialWorkbenchState);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<BusyState>(null);
  const [viewOrientation, setViewOrientation] = useState<ViewOrientation>('fit');
  const [viewMode, setViewMode] = useState<ViewMode>('shaded');
  const [activeBottomTab, setActiveBottomTab] = useState<BottomTab>('review');
  const [activeLeftTab, setActiveLeftTab] = useState<LeftDockTab>('operations');
  const [operationFilter, setOperationFilter] = useState<OperationFilter>('all');
  const [operationGroupMode, setOperationGroupMode] = useState<OperationGroupMode>('setup');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');

  useEffect(() => {
    void initializeWorkbench();
  }, []);

  const orderedOperations = useMemo(() => getOrderedOperations(state.draftPlan), [state.draftPlan]);
  const filteredOperations = useMemo(
    () => filterOperations(orderedOperations, operationFilter),
    [operationFilter, orderedOperations],
  );
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
  const selectedTool = useMemo(() => {
    const directToolId = state.selectedEntity?.type === 'tool'
      ? state.selectedEntity.id
      : selectedOperation?.toolId;
    return directToolId ? state.draftPlan?.toolLibrary.tools.find((tool) => tool.id === directToolId) ?? null : null;
  }, [selectedOperation?.toolId, state.draftPlan, state.selectedEntity]);
  const featureNames = useMemo(
    () => new Map((state.draftPlan?.features ?? []).map((feature) => [feature.id, feature.name])),
    [state.draftPlan?.features],
  );
  const visibleOperationGroups = useMemo(
    () => operationGroups(filteredOperations, operationGroupMode, featureNames),
    [featureNames, filteredOperations, operationGroupMode],
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

  async function initializeWorkbench(): Promise<void> {
    await withBusy('catalog', async () => {
      const [projectCatalog, sample] = await Promise.all([listProjects(), loadSamplePart()]);
      dispatch({
        type: 'projectCatalogLoaded',
        projects: projectCatalog.projects,
        message: `Loaded ${projectCatalog.projects.length} saved project sessions from the API repository.`,
      });
      dispatch({
        type: 'sampleLoaded',
        sample,
        message: `Loaded structured sample part ${sample.partId}.`,
      });
      setSelectedProjectId(projectCatalog.projects[0]?.projectId ?? '');
    });
  }

  async function refreshProjectCatalog(): Promise<void> {
    const projectCatalog = await listProjects();
    dispatch({
      type: 'projectCatalogLoaded',
      projects: projectCatalog.projects,
      message: `Refreshed project catalog (${projectCatalog.projects.length} saved sessions).`,
    });
    setSelectedProjectId((current) => current || projectCatalog.projects[0]?.projectId || '');
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
      setActiveLeftTab('operations');
      setActiveBottomTab('risks');
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
        message: `AI review returned in ${review.mode} mode (${review.approvalRecommendation}).`,
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
      setActiveBottomTab('metadata');
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
        project: savedDraft,
        message: `Saved project session ${savedDraft.projectId} to the API repository.`,
      });
      await refreshProjectCatalog();
      setSelectedProjectId(savedDraft.projectId);
      setActiveBottomTab('console');
    });
  }

  async function handleLoadDraft(nextProjectId = selectedProjectId || projectId || ''): Promise<void> {
    if (!nextProjectId) {
      return;
    }

    await withBusy('load', async () => {
      const project = await loadProjectDraft(nextProjectId);
      dispatch({
        type: 'projectLoaded',
        project,
        message: `Loaded saved project ${project.projectId} from the API repository.`,
      });
      setSelectedProjectId(project.projectId);
      setActiveBottomTab('metadata');
      setViewOrientation('fit');
    });
  }

  function renderModelTree(): JSX.Element {
    return state.sample ? (
      <div className="stacked-list">
        <button
          type="button"
          className={panelSelectionClass(state.selectedEntity?.type === 'project')}
          onClick={() => dispatch({ type: 'selectEntity', entity: { type: 'project', id: projectId ?? 'project' } })}
        >
          <strong>{state.sample.partName}</strong>
          <span>Revision {state.sample.revision}</span>
          <small>{state.sample.stock.material}</small>
        </button>
        {state.draftPlan?.setups.map((setup) => (
          <div key={setup.id} className="tree-folder">
            <div className="tree-folder-header">
              <strong>{setup.name}</strong>
              <span>{setup.workOffset}</span>
            </div>
            <small>{setup.notes.join(' ')}</small>
          </div>
        ))}
        {state.draftPlan?.assumptions.map((assumption) => (
          <div key={assumption} className="tree-note">
            {assumption}
          </div>
        ))}
      </div>
    ) : (
      <p className="empty-state">Load a structured part to initialize the project session tree.</p>
    );
  }

  function renderFeaturesTree(): JSX.Element {
    return state.draftPlan ? (
      <div className="tree-stack">
        {state.draftPlan.features.map((feature) => (
          <button
            type="button"
            key={feature.id}
            className={panelSelectionClass(state.selectedEntity?.type === 'feature' && state.selectedEntity.id === feature.id)}
            onClick={() => dispatch({ type: 'selectEntity', entity: { type: 'feature', id: feature.id } })}
          >
            <strong>{feature.name}</strong>
            <span>{feature.kind.replace('_', ' ')}</span>
            <small>
              Qty {feature.quantity} · {feature.lengthMm.toFixed(1)} × {feature.widthMm.toFixed(1)} × {feature.depthMm.toFixed(1)} mm
            </small>
          </button>
        ))}
      </div>
    ) : (
      <p className="empty-state">Generate a deterministic plan to populate the feature list.</p>
    );
  }

  function renderOperationsTree(): JSX.Element {
    const operationsById = new Map(filteredOperations.map((operation) => [operation.id, operation]));

    return (
      <div className="stacked-list">
        <div className="operation-toolbar">
          <div className="chip-row">
            {operationFilters.map((filter) => (
              <button
                key={filter}
                type="button"
                className={operationFilter === filter ? 'secondary-button active-button' : 'secondary-button'}
                onClick={() => setOperationFilter(filter)}
              >
                {filter}
              </button>
            ))}
          </div>
          <div className="chip-row">
            {(['setup', 'feature'] as OperationGroupMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                className={operationGroupMode === mode ? 'secondary-button active-button' : 'secondary-button'}
                onClick={() => setOperationGroupMode(mode)}
              >
                Group by {mode}
              </button>
            ))}
          </div>
        </div>
        {visibleOperationGroups.length > 0 ? visibleOperationGroups.map((group) => (
          <section key={group.id} className="tree-folder">
            <div className="tree-folder-header">
              <strong>{group.label}</strong>
              <span>{group.operationIds.length}</span>
            </div>
            <div className="tree-stack">
              {group.operationIds.map((operationId) => {
                const operation = operationsById.get(operationId);
                if (!operation) {
                  return null;
                }

                const index = filteredOperations.findIndex((candidate) => candidate.id === operation.id);
                const isSelected = state.selectedEntity?.type === 'operation' && state.selectedEntity.id === operation.id;

                return (
                  <div key={operation.id} className="operation-card">
                    <button
                      type="button"
                      className={panelSelectionClass(isSelected)}
                      onClick={() => dispatch({ type: 'selectEntity', entity: { type: 'operation', id: operation.id } })}
                    >
                      <strong>
                        {operation.order + 1}. {operation.name}
                      </strong>
                      <span>
                        {operation.origin} · {operation.enabled ? 'enabled' : 'disabled'} · {operation.setup}
                      </span>
                      <small>
                        {operation.toolName} · {operation.estimatedMinutes.toFixed(1)} min {operation.isDirty ? '· modified' : ''}
                      </small>
                    </button>
                    <div className="operation-inline-row">
                      <input
                        aria-label={`Rename ${operation.name}`}
                        value={operation.name}
                        onFocus={() => dispatch({ type: 'selectEntity', entity: { type: 'operation', id: operation.id } })}
                        onChange={(event) =>
                          dispatch({
                            type: 'updateOperation',
                            operationId: operation.id,
                            changes: { name: event.target.value || operation.name },
                            message: `Renamed operation ${operation.name}.`,
                          })
                        }
                      />
                      {operation.isDirty ? <span className="chip chip-dirty">Modified</span> : null}
                    </div>
                    <div className="tree-controls-inline">
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
                        disabled={index <= 0}
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
                        disabled={index === filteredOperations.length - 1}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="icon-button"
                        onClick={() =>
                          dispatch({
                            type: 'duplicateOperation',
                            operationId: operation.id,
                            message: `Duplicated ${operation.name} as a manual operation.`,
                          })
                        }
                      >
                        ⎘
                      </button>
                      <button
                        type="button"
                        className="icon-button"
                        onClick={() =>
                          dispatch({
                            type: 'toggleOperation',
                            operationId: operation.id,
                            message: `${operation.enabled ? 'Disabled' : 'Enabled'} ${operation.name}.`,
                          })
                        }
                      >
                        {operation.enabled ? 'On' : 'Off'}
                      </button>
                      <button
                        type="button"
                        className="icon-button"
                        disabled={operation.origin !== 'manual'}
                        onClick={() =>
                          dispatch({
                            type: 'deleteManualOperation',
                            operationId: operation.id,
                            message: `Deleted manual operation ${operation.name}.`,
                          })
                        }
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )) : <p className="empty-state">No operations match the current filter.</p>}
      </div>
    );
  }

  function renderToolsTree(): JSX.Element {
    return state.draftPlan ? (
      <div className="tree-stack">
        {state.draftPlan.toolLibrary.tools.map((tool) => (
          <button
            type="button"
            key={tool.id}
            className={panelSelectionClass(state.selectedEntity?.type === 'tool' && state.selectedEntity.id === tool.id)}
            onClick={() => dispatch({ type: 'selectEntity', entity: { type: 'tool', id: tool.id } })}
          >
            <strong>{tool.name}</strong>
            <span>{tool.type.replaceAll('_', ' ')}</span>
            <small>
              Ø {tool.diameterMm} mm · max depth {tool.maxDepthMm} mm · {tool.material}
            </small>
          </button>
        ))}
      </div>
    ) : (
      <p className="empty-state">Plan the part to inspect the foundational tool library.</p>
    );
  }

  function renderLeftDockBody(): JSX.Element {
    switch (activeLeftTab) {
      case 'model':
        return renderModelTree();
      case 'features':
        return renderFeaturesTree();
      case 'operations':
        return renderOperationsTree();
      case 'tools':
        return renderToolsTree();
    }
  }

  function renderInspector(): JSX.Element {
    if (selectedOperation && state.draftPlan) {
      return (
        <div className="inspector-form">
          <div className="inspector-header-row">
            <span className="chip">{selectedOperation.origin}</span>
            {selectedOperation.isDirty ? <span className="chip chip-dirty">Unsaved op change</span> : null}
          </div>
          <label>
            <span>Operation name</span>
            <input
              value={selectedOperation.name}
              onChange={(event) =>
                dispatch({
                  type: 'updateOperation',
                  operationId: selectedOperation.id,
                  changes: { name: event.target.value || selectedOperation.name },
                  message: `Updated operation name for ${selectedOperation.name}.`,
                })
              }
            />
          </label>
          <label>
            <span>Setup</span>
            <select
              value={selectedOperation.setupId}
              onChange={(event) =>
                dispatch({
                  type: 'updateOperation',
                  operationId: selectedOperation.id,
                  changes: { setupId: event.target.value },
                  message: `Updated setup for ${selectedOperation.name}.`,
                })
              }
            >
              {state.draftPlan.setups.map((setup) => (
                <option key={setup.id} value={setup.id}>
                  {setup.name}
                </option>
              ))}
            </select>
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
              {state.draftPlan.toolLibrary.tools.map((tool) => (
                <option key={tool.id} value={tool.id}>
                  {tool.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Strategy</span>
            <textarea
              rows={4}
              value={selectedOperation.strategy}
              onChange={(event) =>
                dispatch({
                  type: 'updateOperation',
                  operationId: selectedOperation.id,
                  changes: { strategy: event.target.value || selectedOperation.strategy },
                  message: `Updated strategy for ${selectedOperation.name}.`,
                })
              }
            />
          </label>
          <label>
            <span>Operation notes</span>
            <textarea
              rows={3}
              value={selectedOperation.notes}
              onChange={(event) =>
                dispatch({
                  type: 'updateOperation',
                  operationId: selectedOperation.id,
                  changes: { notes: event.target.value },
                  message: `Updated notes for ${selectedOperation.name}.`,
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
                  type: 'duplicateOperation',
                  operationId: selectedOperation.id,
                  message: `Duplicated ${selectedOperation.name} as a manual operation.`,
                })
              }
            >
              Duplicate
            </button>
            <button
              type="button"
              className="secondary-button"
              disabled={selectedOperation.origin !== 'manual'}
              onClick={() =>
                dispatch({
                  type: 'deleteManualOperation',
                  operationId: selectedOperation.id,
                  message: `Deleted manual operation ${selectedOperation.name}.`,
                })
              }
            >
              Delete manual op
            </button>
          </div>
          <dl className="detail-pairs">
            <div>
              <dt>Order</dt>
              <dd>{selectedOperation.order + 1}</dd>
            </div>
            <div>
              <dt>Feature</dt>
              <dd>{selectedFeature?.name ?? selectedOperation.featureId}</dd>
            </div>
            <div>
              <dt>Tool</dt>
              <dd>{selectedOperation.toolName}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{selectedOperation.enabled ? 'Enabled' : 'Disabled'}</dd>
            </div>
          </dl>
        </div>
      );
    }

    if (selectedFeature && state.draftPlan) {
      return (
        <div className="inspector-form">
          <span className="chip">{selectedFeature.kind.replace('_', ' ')}</span>
          <dl className="detail-pairs">
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
            <div>
              <dt>Related ops</dt>
              <dd>{orderedOperations.filter((operation) => operation.featureId === selectedFeature.id).length}</dd>
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
        </div>
      );
    }

    if (selectedTool) {
      return (
        <div className="inspector-form">
          <span className="chip">tool</span>
          <dl className="detail-pairs">
            <div>
              <dt>Name</dt>
              <dd>{selectedTool.name}</dd>
            </div>
            <div>
              <dt>Type</dt>
              <dd>{selectedTool.type.replaceAll('_', ' ')}</dd>
            </div>
            <div>
              <dt>Diameter</dt>
              <dd>{selectedTool.diameterMm} mm</dd>
            </div>
            <div>
              <dt>Max depth</dt>
              <dd>{selectedTool.maxDepthMm} mm</dd>
            </div>
          </dl>
          <p className="empty-state">Tool data remains foundational catalog data. Feeds, speeds, holders, and assemblies are not modeled yet.</p>
        </div>
      );
    }

    return (
      <p className="empty-state">
        Select a feature, operation, or tool from the docks. The inspector edits draft data only; deterministic planning remains authoritative.
      </p>
    );
  }

  function renderBottomPanel(): JSX.Element {
    if (activeBottomTab === 'risks') {
      return state.draftPlan ? (
        <div className="bottom-grid">
          <article className="bottom-card">
            <header>
              <h3>Deterministic risks</h3>
              <span className={`chip risk-${state.draftPlan.summary.highestRisk}`}>{state.draftPlan.summary.highestRisk}</span>
            </header>
            <div className="stacked-list">
              {state.draftPlan.risks.length > 0 ? state.draftPlan.risks.map((risk) => (
                <button
                  type="button"
                  key={risk.id}
                  className={panelSelectionClass(state.selectedEntity?.type === 'risk' && state.selectedEntity.id === risk.id)}
                  onClick={() => dispatch({ type: 'selectEntity', entity: { type: 'risk', id: risk.id } })}
                >
                  <strong>{risk.title}</strong>
                  <span className={`risk-pill risk-${risk.level}`}>{risk.level}</span>
                  <small>{risk.description}</small>
                </button>
              )) : <p className="empty-state">No deterministic risks were triggered.</p>}
            </div>
          </article>
          <article className="bottom-card">
            <header>
              <h3>Manual override status</h3>
            </header>
            <dl className="detail-pairs">
              <div>
                <dt>Manual ops</dt>
                <dd>{state.draftPlan.summary.manualOperationCount}</dd>
              </div>
              <div>
                <dt>Disabled ops</dt>
                <dd>{state.draftPlan.operations.filter((operation) => !operation.enabled).length}</dd>
              </div>
              <div>
                <dt>Modified ops</dt>
                <dd>{state.draftPlan.operations.filter((operation) => operation.isDirty).length}</dd>
              </div>
              <div>
                <dt>Cycle time</dt>
                <dd>{state.draftPlan.estimatedCycleTimeMinutes.toFixed(1)} min</dd>
              </div>
            </dl>
          </article>
        </div>
      ) : (
        <p className="empty-state">Plan the part to inspect deterministic risks and manual override status.</p>
      );
    }

    if (activeBottomTab === 'checklist') {
      return state.draftPlan ? (
        <div className="bottom-grid">
          <article className="bottom-card span-2">
            <header>
              <h3>Release checklist</h3>
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
        <p className="empty-state">Checklist items appear after deterministic planning.</p>
      );
    }

    if (activeBottomTab === 'review') {
      return state.review ? (
        <div className="bottom-grid">
          <article className="bottom-card">
            <header>
              <h3>Overall assessment</h3>
              <span className="chip">{state.review.mode}</span>
            </header>
            <p>{state.review.overallAssessment}</p>
            <p>
              <strong>Recommendation:</strong> {state.review.approvalRecommendation.replaceAll('_', ' ')}
            </p>
            <p>
              <strong>Fallback:</strong> {state.review.fallbackUsed ? 'heuristic fallback used' : 'structured OpenAI response'}
            </p>
          </article>
          <article className="bottom-card">
            <header>
              <h3>Missing operations</h3>
            </header>
            <ul>
              {(state.review.missingOperations.length > 0 ? state.review.missingOperations : ['No missing operations flagged.']).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
          <article className="bottom-card">
            <header>
              <h3>Risk flags</h3>
            </header>
            <ul>
              {(state.review.riskFlags.length > 0 ? state.review.riskFlags : ['No additional risk flags from the advisory review.']).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
          <article className="bottom-card">
            <header>
              <h3>Suggested edits</h3>
            </header>
            <ul>
              {(state.review.suggestedEdits.length > 0 ? state.review.suggestedEdits : ['No extra edits suggested.']).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        </div>
      ) : (
        <p className="empty-state">Run AI review after planning or manual edits. AI remains advisory only.</p>
      );
    }

    if (activeBottomTab === 'metadata') {
      return state.draftPlan ? (
        <div className="bottom-grid">
          <article className="bottom-card">
            <header>
              <h3>Project session metadata</h3>
            </header>
            <dl className="detail-pairs">
              <div>
                <dt>Project id</dt>
                <dd>{projectId}</dd>
              </div>
              <div>
                <dt>Part id</dt>
                <dd>{state.draftPlan.part.partId}</dd>
              </div>
              <div>
                <dt>Revision</dt>
                <dd>{state.draftPlan.part.revision}</dd>
              </div>
              <div>
                <dt>Updated at</dt>
                <dd>{formatTimestamp(state.lastSavedAt)}</dd>
              </div>
              <div>
                <dt>Approval state</dt>
                <dd>{state.draftPlan.approval.state.replace('_', ' ')}</dd>
              </div>
              <div>
                <dt>Dirty plan</dt>
                <dd>{state.dirty ? 'Unsaved draft changes' : 'Saved/generated state'}</dd>
              </div>
            </dl>
          </article>
          <article className="bottom-card">
            <header>
              <h3>Machine + setup foundation</h3>
            </header>
            <ul className="detail-list">
              <li>
                <strong>{state.draftPlan.machineProfile.name}</strong>
                <span>
                  Travels {state.draftPlan.machineProfile.travelsMm.x} × {state.draftPlan.machineProfile.travelsMm.y} × {state.draftPlan.machineProfile.travelsMm.z} mm
                </span>
              </li>
              {state.draftPlan.setups.map((setup) => (
                <li key={setup.id}>
                  <strong>{setup.name}</strong>
                  <span>
                    {setup.workOffset} · {setup.orientation}
                  </span>
                </li>
              ))}
            </ul>
          </article>
        </div>
      ) : (
        <p className="empty-state">Project metadata appears once a deterministic plan exists.</p>
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
    <main className="workbench-shell v2-shell">
      <header className="app-bar">
        <div className="app-bar-project">
          <p className="eyebrow">CAM Workbench v2</p>
          <h1>{state.sample?.partName ?? 'CAM project session'}</h1>
          <p>
            Rev {state.sample?.revision ?? '—'} · Deterministic planning authoritative · AI advisory only · Derived viewport only
          </p>
        </div>
        <div className="app-bar-actions">
          <button onClick={() => void handlePlan()} disabled={!state.sample || busy !== null}>
            {busy === 'plan' ? 'Planning…' : 'Plan'}
          </button>
          <button onClick={() => void handleReview()} disabled={!state.draftPlan || busy !== null}>
            {busy === 'review' ? 'Reviewing…' : 'Review'}
          </button>
          <button onClick={() => void handleSaveDraft()} disabled={!state.draftPlan || busy !== null}>
            {busy === 'save' ? 'Saving…' : 'Save'}
          </button>
          <button onClick={() => void handleApprove()} disabled={!state.draftPlan || busy !== null}>
            {busy === 'approve' ? 'Approving…' : 'Approve'}
          </button>
          <button className="secondary-button" onClick={() => void handleLoadSample()} disabled={busy !== null}>
            {busy === 'sample' ? 'Loading…' : 'Reload sample'}
          </button>
        </div>
        <div className="app-bar-controls">
          <div className="control-stack">
            <span className="panel-label">View presets</span>
            <div className="chip-row">
              {viewOrientations.map((orientation) => (
                <button
                  key={orientation}
                  type="button"
                  className={viewOrientation === orientation ? 'secondary-button active-button' : 'secondary-button'}
                  onClick={() => setViewOrientation(orientation)}
                >
                  {orientation}
                </button>
              ))}
            </div>
          </div>
          <div className="control-stack">
            <span className="panel-label">View modes</span>
            <div className="chip-row">
              {viewModes.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={viewMode === mode ? 'secondary-button active-button' : 'secondary-button'}
                  onClick={() => setViewMode(mode)}
                >
                  {mode.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="app-bar-status">
          <span className={state.dirty ? 'chip chip-dirty' : 'chip'}>{state.dirty ? 'Dirty draft' : 'Draft synced'}</span>
          {state.draftPlan ? <span className="chip">{state.draftPlan.approval.state.replace('_', ' ')}</span> : null}
          <span className="status-copy">Last save: {formatTimestamp(state.lastSavedAt)}</span>
        </div>
      </header>

      {error ? <div className="error-banner">{error}</div> : null}

      <section className="main-workbench-grid">
        <aside className="workbench-panel left-dock">
          <div className="panel-header">
            <div>
              <p className="panel-label">Project session</p>
              <h2>{projectId ?? 'Unsaved session'}</h2>
            </div>
            <span className="chip">{state.projects.length} saved</span>
          </div>
          <div className="project-picker-row">
            <select value={selectedProjectId} onChange={(event) => setSelectedProjectId(event.target.value)}>
              <option value="">Select saved project</option>
              {state.projects.map((project) => (
                <option key={project.projectId} value={project.projectId}>
                  {project.projectId} · {project.partName} · {project.revision}
                </option>
              ))}
            </select>
            <button className="secondary-button" onClick={() => void handleLoadDraft()} disabled={!selectedProjectId || busy !== null}>
              {busy === 'load' ? 'Loading…' : 'Load'}
            </button>
          </div>
          <nav className="dock-tabs" aria-label="Workbench left dock tabs">
            {leftDockTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={activeLeftTab === tab.id ? 'secondary-button active-button' : 'secondary-button'}
                onClick={() => setActiveLeftTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </nav>
          <div className="dock-body">{renderLeftDockBody()}</div>
        </aside>

        <section className="workbench-panel viewport-panel">
          <div className="panel-header">
            <div>
              <p className="panel-label">3D viewport</p>
              <h2>Stock, feature, and operation overlays</h2>
            </div>
            {state.draftPlan ? <span className="chip">{viewMode.replace('_', ' ')}</span> : null}
          </div>
          {state.draftPlan ? (
            <>
              <Viewport3D
                part={state.draftPlan.part}
                features={state.draftPlan.features}
                operations={state.draftPlan.operations}
                selectedFeatureId={selectedFeatureId}
                selectedOperationId={selectedOperation?.id ?? null}
                onSelectFeature={(featureId) =>
                  dispatch({
                    type: 'selectEntity',
                    entity: featureId ? { type: 'feature', id: featureId } : null,
                  })
                }
                viewOrientation={viewOrientation}
                viewMode={viewMode}
              />
              <div className="viewport-status-bar">
                <span>
                  Highest risk: <strong>{state.draftPlan.summary.highestRisk}</strong>
                </span>
                <span>
                  Cycle time: <strong>{state.draftPlan.estimatedCycleTimeMinutes.toFixed(1)} min</strong>
                </span>
                <span>
                  Section-ready: <strong>yes</strong>
                </span>
              </div>
            </>
          ) : (
            <div className="viewport-placeholder">
              <p>Generate a deterministic draft plan to populate the workpiece scene pipeline.</p>
            </div>
          )}
        </section>

        <aside className="workbench-panel inspector-panel">
          <div className="panel-header">
            <div>
              <p className="panel-label">Inspector</p>
              <h2>
                {selectedOperation
                  ? selectedOperation.name
                  : selectedFeature
                    ? selectedFeature.name
                    : selectedTool
                      ? selectedTool.name
                      : 'Select a workbench item'}
              </h2>
            </div>
          </div>
          {renderInspector()}
        </aside>
      </section>

      <section className="workbench-panel bottom-panel">
        <div className="panel-header bottom-panel-header">
          <div>
            <p className="panel-label">Bottom panel</p>
            <h2>Risks, checklist, AI review, console, and metadata</h2>
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
    </main>
  );
}

export default App;
