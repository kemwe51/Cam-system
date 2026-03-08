import { useEffect, useMemo, useReducer, useState } from 'react';
import type { JSX } from 'react';
import './App.css';
import {
  approveDraftPlan,
  generateDraftPlan,
  importDxfText,
  importJsonText,
  importPlaceholder,
  importSampleJson,
  listProjects,
  loadProjectRecord,
  reviewDraftPlan,
  saveProjectRecord,
} from './api';
import { Viewport3D } from './Viewport3D';
import {
  buildProjectRecord,
  createProjectId,
  getOrderedOperations,
  initialWorkbenchState,
  resolveSelectedFeatureId,
  unsavedOperationSummary,
  workbenchReducer,
} from './workbenchReducer';
import type { ViewMode } from '@cam/model';
import type { ViewOrientation } from './viewportScene';

type BusyState = 'catalog' | 'import' | 'plan' | 'review' | 'approve' | 'save' | 'load' | null;
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
const viewModes: ViewMode[] = ['shaded', 'wireframe', 'stock', 'features', 'operation_preview'];
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

function operationWarnings(operation: { origin: 'automatic' | 'manual'; enabled: boolean; isDirty: boolean; notes: string }): string[] {
  return [
    ...(operation.origin === 'manual' ? ['manual override'] : []),
    ...(!operation.enabled ? ['disabled'] : []),
    ...(operation.isDirty ? ['unsaved'] : []),
    ...(operation.notes.trim() ? ['notes'] : []),
  ];
}

function App() {
  const [state, dispatch] = useReducer(workbenchReducer, initialWorkbenchState);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<BusyState>(null);
  const [viewOrientation, setViewOrientation] = useState<ViewOrientation>('fit');
  const [viewMode, setViewMode] = useState<ViewMode>('shaded');
  const [activeBottomTab, setActiveBottomTab] = useState<BottomTab>('metadata');
  const [activeLeftTab, setActiveLeftTab] = useState<LeftDockTab>('model');
  const [operationFilter, setOperationFilter] = useState<OperationFilter>('all');
  const [operationGroupMode, setOperationGroupMode] = useState<OperationGroupMode>('setup');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [jsonImportText, setJsonImportText] = useState<string>('');
  const [jsonFileName, setJsonFileName] = useState<string>('structured-part.json');
  const [placeholderFileName, setPlaceholderFileName] = useState<string>('incoming-model.dxf');
  const [dxfImportText, setDxfImportText] = useState<string>('');

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
  const selectedGeometryId = useMemo(
    () => (state.selectedEntity?.type === 'geometry' ? state.selectedEntity.id : null),
    [state.selectedEntity],
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
  const selectedGeometryEntity = useMemo(
    () => (selectedGeometryId ? state.currentModel?.entities.find((entity) => entity.id === selectedGeometryId) ?? null : null),
    [selectedGeometryId, state.currentModel],
  );
  const selectedExtractedFeature = useMemo(
    () =>
      selectedFeatureId
        ? state.currentModel?.extractedFeatures.find((feature) => feature.mappedFeatureId === selectedFeatureId) ?? null
        : null,
    [selectedFeatureId, state.currentModel],
  );
  const geometryLinkedFeatures = useMemo(
    () =>
      selectedGeometryId
        ? state.currentModel?.extractedFeatures.filter((feature) => feature.sourceGeometryRefs.includes(selectedGeometryId)) ?? []
        : [],
    [selectedGeometryId, state.currentModel],
  );
  const visibleOperationGroups = useMemo(
    () => operationGroups(filteredOperations, operationGroupMode, featureNames),
    [featureNames, filteredOperations, operationGroupMode],
  );
  const projectId = useMemo(
    () => (state.sample ? createProjectId(state.sample) : state.draftPlan ? createProjectId(state.draftPlan.part) : null),
    [state.draftPlan, state.sample],
  );
  const unsavedSummary = useMemo(() => unsavedOperationSummary(state.draftPlan), [state.draftPlan]);
  const combinedWarnings = useMemo(
    () => [...new Set([...(state.currentImportSession?.warnings ?? []), ...(state.currentProject?.warnings ?? []), ...(state.currentModel?.warnings ?? [])])],
    [state.currentImportSession?.warnings, state.currentModel?.warnings, state.currentProject?.warnings],
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
      const projectCatalog = await listProjects();
      dispatch({
        type: 'projectCatalogLoaded',
        projects: projectCatalog.projects,
        message: `Loaded ${projectCatalog.projects.length} saved project sessions from the API repository.`,
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

  async function loadImportSessionFromSample(): Promise<void> {
    await withBusy('import', async () => {
      const importSession = await importSampleJson();
      dispatch({
        type: 'importSessionLoaded',
        importSession,
        message: `Started sample JSON import session ${importSession.id}.`,
      });
      setActiveLeftTab('model');
      setActiveBottomTab('metadata');
      setViewOrientation('fit');
    });
  }

  async function handleImportJsonText(): Promise<void> {
    if (!jsonImportText.trim()) {
      setError('Paste structured JSON before importing.');
      return;
    }

    await withBusy('import', async () => {
      const importSession = await importJsonText(jsonImportText, jsonFileName || 'structured-part.json');
      dispatch({
        type: 'importSessionLoaded',
        importSession,
        message: `Imported structured JSON source ${importSession.source.filename}.`,
      });
      setActiveBottomTab('metadata');
    });
  }

  async function handleImportDxfText(): Promise<void> {
    if (!dxfImportText.trim()) {
      setError('Paste DXF text before importing.');
      return;
    }

    await withBusy('import', async () => {
      const filename = placeholderFileName || 'incoming-model.dxf';
      const importSession = await importDxfText(dxfImportText, filename);
      dispatch({
        type: 'importSessionLoaded',
        importSession,
        message: `Imported DXF source ${importSession.source.filename} with ${importSession.importedModel?.geometryDocument?.entities.length ?? 0} geometry entities.`,
      });
      setActiveLeftTab('model');
      setActiveBottomTab('metadata');
      setViewOrientation('top');
      setViewMode('wireframe');
    });
  }

  async function handlePlaceholderImport(format: 'step'): Promise<void> {
    await withBusy('import', async () => {
      const filename = placeholderFileName || `incoming-model.${format}`;
      const importSession = await importPlaceholder(format, filename);
      dispatch({
        type: 'importSessionLoaded',
        importSession,
        message: `Registered ${format.toUpperCase()} source ${importSession.source.filename} as an honest placeholder import session.`,
      });
      setActiveBottomTab('metadata');
    });
  }

  async function handlePlan(): Promise<void> {
    const partInput = state.currentImportSession?.deterministicPartInput ?? state.sample;
    if (!partInput) {
      return;
    }

    await withBusy('plan', async () => {
      const plan = await generateDraftPlan(partInput);
      dispatch({
        type: 'planLoaded',
        plan,
        message: `Generated deterministic plan with ${plan.operations.length} operations.`,
      });
      setViewOrientation('fit');
      setViewMode('operation_preview');
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
      const review = await reviewDraftPlan(draftPlan, {
        importSession: state.currentImportSession,
        project: state.currentProject,
        model: state.currentModel,
      });
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

  async function handleSaveProject(): Promise<void> {
    const project = buildProjectRecord(state);
    if (!project) {
      return;
    }

    await withBusy('save', async () => {
      const savedProject = await saveProjectRecord(project);
      dispatch({
        type: 'projectSaved',
        project: savedProject,
        message: `Saved project session ${savedProject.projectId} revision ${savedProject.revision}.`,
      });
      await refreshProjectCatalog();
      setSelectedProjectId(savedProject.projectId);
      setActiveBottomTab('metadata');
    });
  }

  async function handleLoadProject(nextProjectId = selectedProjectId || projectId || ''): Promise<void> {
    if (!nextProjectId) {
      return;
    }

    await withBusy('load', async () => {
      const project = await loadProjectRecord(nextProjectId);
      dispatch({
        type: 'projectLoaded',
        project,
        message: `Loaded saved project ${project.projectId} revision ${project.revision}.`,
      });
      setSelectedProjectId(project.projectId);
      setActiveBottomTab('metadata');
      setViewOrientation('fit');
    });
  }

  function renderImportPanel(): JSX.Element {
    return (
      <div className="stacked-list">
        <div className="tree-folder">
          <div className="tree-folder-header">
            <strong>Start import session</strong>
            <span>{state.currentImportSession?.importStatus ?? 'idle'}</span>
          </div>
          <small>Import source → derive model → derive plan → manually edit → review → save/approve.</small>
          <div className="app-bar-actions">
            <button onClick={() => void loadImportSessionFromSample()} disabled={busy !== null}>
              {busy === 'import' ? 'Importing…' : 'Import sample JSON'}
            </button>
          </div>
        </div>
        <div className="tree-folder">
          <div className="tree-folder-header">
            <strong>Paste structured JSON</strong>
            <span>real</span>
          </div>
          <input value={jsonFileName} onChange={(event) => setJsonFileName(event.target.value)} placeholder="structured-part.json" />
          <textarea rows={8} value={jsonImportText} onChange={(event) => setJsonImportText(event.target.value)} placeholder="Paste PartInput JSON here" />
          <button onClick={() => void handleImportJsonText()} disabled={busy !== null || !jsonImportText.trim()}>
            {busy === 'import' ? 'Importing…' : 'Import JSON text'}
          </button>
        </div>
        <div className="tree-folder">
          <div className="tree-folder-header">
            <strong>Import DXF text</strong>
            <span>subset</span>
          </div>
          <input value={placeholderFileName} onChange={(event) => setPlaceholderFileName(event.target.value)} placeholder="incoming-model.dxf" />
          <textarea rows={8} value={dxfImportText} onChange={(event) => setDxfImportText(event.target.value)} placeholder="Paste ASCII DXF text here" />
          <div className="chip-row">
            <button className="secondary-button" onClick={() => void handleImportDxfText()} disabled={busy !== null || !dxfImportText.trim()}>Import DXF</button>
          </div>
          <small>Supported DXF subset: LINE, ARC, CIRCLE, POINT, TEXT/MTEXT metadata, LWPOLYLINE, and POLYLINE. Unsupported entities become warnings instead of silent failures.</small>
        </div>
        <div className="tree-folder">
          <div className="tree-folder-header">
            <strong>STEP placeholder</strong>
            <span>foundational</span>
          </div>
          <div className="chip-row">
            <button className="secondary-button" onClick={() => void handlePlaceholderImport('step')} disabled={busy !== null}>Register STEP</button>
          </div>
          <small>STEP remains a workflow placeholder only. No real STEP topology or machining support is claimed here.</small>
        </div>
        {state.currentImportSession ? (
          <div className="tree-note">
            <strong>{state.currentImportSession.source.filename}</strong> · {state.currentImportSession.source.type} · {state.currentImportSession.importStatus}
            <br />
            {state.currentImportSession.warnings.join(' ')}
          </div>
        ) : null}
      </div>
    );
  }

  function renderModelTree(): JSX.Element {
    return state.currentModel ? (
      <div className="stacked-list">
        <button
          type="button"
          className={panelSelectionClass(state.selectedEntity?.type === 'project')}
          onClick={() => dispatch({ type: 'selectEntity', entity: projectId ? { type: 'project', id: projectId } : null })}
        >
          <strong>{state.sample?.partName ?? state.currentImportSession?.source.filename}</strong>
          <span>{state.currentImportSession?.source.type ?? 'no source'} · {state.currentModel.status}</span>
          <small>{state.currentModel.sourceGeometryMetadata[0]}</small>
        </button>
        <div className="tree-folder">
          <div className="tree-folder-header">
            <strong>Source / model layers</strong>
            <span>{state.currentModel.layers.length}</span>
          </div>
          <ul className="detail-list">
            {state.currentModel.layers.map((layer) => (
              <li key={layer.id}>
                <strong>{layer.label}</strong>
                <span>{layer.kind}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="tree-folder">
          <div className="tree-folder-header">
            <strong>Model bounds</strong>
            <span>{state.currentModel.entities.length} entities</span>
          </div>
          <small>
            {state.currentModel.bounds.size[0].toFixed(1)} × {state.currentModel.bounds.size[1].toFixed(1)} × {state.currentModel.bounds.size[2].toFixed(1)} mm
          </small>
        </div>
        {state.currentModel.geometryDocument ? (
          <div className="tree-folder">
            <div className="tree-folder-header">
              <strong>Imported geometry</strong>
              <span>{state.currentModel.geometryDocument.entities.length}</span>
            </div>
            <small>
              Layers {state.currentModel.geometryDocument.layers.length} · open profiles {state.currentModel.geometryGraph?.openProfileIds.length ?? 0} · closed profiles {state.currentModel.geometryGraph?.closedProfileIds.length ?? 0}
            </small>
            <ul className="detail-list">
              {state.currentModel.geometryDocument.layers.map((layer) => (
                <li key={layer.id}>
                  <strong>{layer.name}</strong>
                  <span>{layer.entityIds.length} entities</span>
                </li>
              ))}
            </ul>
            <div className="tree-stack">
              {state.currentModel.entities.filter((entity) => entity.kind === 'source_geometry').slice(0, 12).map((entity) => (
                <button
                  key={entity.id}
                  type="button"
                  className={panelSelectionClass(state.selectedEntity?.type === 'geometry' && state.selectedEntity.id === entity.id)}
                  onClick={() => dispatch({ type: 'selectEntity', entity: { type: 'geometry', id: entity.id } })}
                >
                  <strong>{entity.label}</strong>
                  <span>{entity.metadata.layerName ?? entity.metadata.layerId ?? entity.metadata.type}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {state.currentModel.extractedFeatures.length > 0 ? (
          <div className="tree-folder">
            <div className="tree-folder-header">
              <strong>Extracted features</strong>
              <span>{state.currentModel.extractedFeatures.length}</span>
            </div>
            <small>
              Unclassified geometry {state.currentModel.geometryDocument?.entities.filter((entity) => !state.currentModel!.extractedFeatures.some((feature) => feature.sourceGeometryRefs.includes(entity.id))).length ?? 0}
            </small>
          </div>
        ) : null}
      </div>
    ) : renderImportPanel();
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
            <span>{feature.kind.replace('_', ' ')} · {feature.origin === 'geometry_inferred' ? 'inferred' : 'structured'}</span>
            <small>
              Qty {feature.quantity} · {feature.lengthMm.toFixed(1)} × {feature.widthMm.toFixed(1)} × {feature.depthMm.toFixed(1)} mm
            </small>
            <div className="chip-row">
              {feature.origin === 'geometry_inferred' ? <span className="chip">imported geometry</span> : null}
              {feature.classificationState !== 'automatic' ? <span className="chip chip-dirty">{feature.classificationState.replace('_', ' ')}</span> : null}
              {feature.warnings.length > 0 ? <span className="chip chip-dirty">{feature.warnings.length} warnings</span> : null}
            </div>
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
                const warnings = operationWarnings(operation);

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
                        {operation.toolName} · {operation.estimatedMinutes.toFixed(1)} min · feature {featureNames.get(operation.featureId) ?? operation.featureId}
                      </small>
                    </button>
                    <div className="chip-row">
                      {warnings.map((warning) => <span key={`${operation.id}-${warning}`} className="chip chip-dirty">{warning}</span>)}
                    </div>
                    <div className="tree-controls-inline">
                      <button type="button" className="icon-button" onClick={() => dispatch({ type: 'moveOperation', operationId: operation.id, direction: 'up', message: `Moved ${operation.name} earlier in the draft order.` })} disabled={index <= 0}>↑</button>
                      <button type="button" className="icon-button" onClick={() => dispatch({ type: 'moveOperation', operationId: operation.id, direction: 'down', message: `Moved ${operation.name} later in the draft order.` })} disabled={index === filteredOperations.length - 1}>↓</button>
                      <button type="button" className="icon-button" onClick={() => dispatch({ type: 'duplicateOperation', operationId: operation.id, message: `Duplicated ${operation.name} as a manual operation.` })}>⎘</button>
                      <button type="button" className="icon-button" onClick={() => dispatch({ type: 'toggleOperation', operationId: operation.id, message: `${operation.enabled ? 'Disabled' : 'Enabled'} ${operation.name}.` })}>{operation.enabled ? 'On' : 'Off'}</button>
                      <button type="button" className="icon-button" disabled={operation.origin !== 'manual'} onClick={() => dispatch({ type: 'deleteManualOperation', operationId: operation.id, message: `Deleted manual operation ${operation.name}.` })}>✕</button>
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
            <input value={selectedOperation.name} onChange={(event) => dispatch({ type: 'updateOperation', operationId: selectedOperation.id, changes: { name: event.target.value || selectedOperation.name }, message: `Updated operation name for ${selectedOperation.name}.` })} />
          </label>
          <label>
            <span>Linked feature</span>
            <select value={selectedOperation.featureId} onChange={(event) => dispatch({ type: 'updateOperation', operationId: selectedOperation.id, changes: { featureId: event.target.value }, message: `Relinked ${selectedOperation.name} to a different feature.` })}>
              {state.draftPlan.features.map((feature) => <option key={feature.id} value={feature.id}>{feature.name}</option>)}
            </select>
          </label>
          <label>
            <span>Setup</span>
            <select value={selectedOperation.setupId} onChange={(event) => dispatch({ type: 'updateOperation', operationId: selectedOperation.id, changes: { setupId: event.target.value }, message: `Updated setup for ${selectedOperation.name}.` })}>
              {state.draftPlan.setups.map((setup) => <option key={setup.id} value={setup.id}>{setup.name}</option>)}
            </select>
          </label>
          <label>
            <span>Selected tool</span>
            <select value={selectedOperation.toolId} onChange={(event) => dispatch({ type: 'updateOperation', operationId: selectedOperation.id, changes: { toolId: event.target.value }, message: `Selected a different tool for ${selectedOperation.name}.` })}>
              {state.draftPlan.toolLibrary.tools.map((tool) => <option key={tool.id} value={tool.id}>{tool.name}</option>)}
            </select>
          </label>
          <label>
            <span>Strategy</span>
            <textarea rows={4} value={selectedOperation.strategy} onChange={(event) => dispatch({ type: 'updateOperation', operationId: selectedOperation.id, changes: { strategy: event.target.value || selectedOperation.strategy }, message: `Updated strategy for ${selectedOperation.name}.` })} />
          </label>
          <label>
            <span>Operation notes</span>
            <textarea rows={3} value={selectedOperation.notes} onChange={(event) => dispatch({ type: 'updateOperation', operationId: selectedOperation.id, changes: { notes: event.target.value }, message: `Updated notes for ${selectedOperation.name}.` })} />
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
                dispatch({ type: 'updateOperation', operationId: selectedOperation.id, changes: { estimatedMinutes: nextMinutes }, message: `Updated estimated time for ${selectedOperation.name}.` });
              }}
            />
          </label>
          <label className="checkbox-row">
            <input type="checkbox" checked={selectedOperation.enabled} onChange={() => dispatch({ type: 'toggleOperation', operationId: selectedOperation.id, message: `${selectedOperation.enabled ? 'Disabled' : 'Enabled'} ${selectedOperation.name}.` })} />
            <span>Enabled for the draft sequence</span>
          </label>
          <div className="chip-row">
            {operationWarnings(selectedOperation).map((warning) => <span key={`${selectedOperation.id}-${warning}`} className="chip chip-dirty">{warning}</span>)}
          </div>
          <div className="inspector-actions">
            <button type="button" className="secondary-button" onClick={() => dispatch({ type: 'duplicateOperation', operationId: selectedOperation.id, message: `Duplicated ${selectedOperation.name} as a manual operation.` })}>Duplicate</button>
            <button type="button" className="secondary-button" disabled={selectedOperation.origin !== 'manual'} onClick={() => dispatch({ type: 'deleteManualOperation', operationId: selectedOperation.id, message: `Deleted manual operation ${selectedOperation.name}.` })}>Delete manual op</button>
          </div>
          <dl className="detail-pairs">
            <div><dt>Order</dt><dd>{selectedOperation.order + 1}</dd></div>
            <div><dt>Feature</dt><dd>{selectedFeature?.name ?? selectedOperation.featureId}</dd></div>
            <div><dt>Tool</dt><dd>{selectedOperation.toolName}</dd></div>
            <div><dt>Status</dt><dd>{selectedOperation.enabled ? 'Enabled' : 'Disabled'}</dd></div>
          </dl>
        </div>
      );
    }

    if (selectedFeature && state.draftPlan) {
      return (
        <div className="inspector-form">
          <div className="chip-row">
            <span className="chip">{selectedFeature.kind.replace('_', ' ')}</span>
            {selectedFeature.origin === 'geometry_inferred' ? <span className="chip">imported geometry</span> : null}
            {selectedFeature.classificationState !== 'automatic' ? <span className="chip chip-dirty">{selectedFeature.classificationState.replace('_', ' ')}</span> : null}
            {selectedFeature.warnings.length > 0 ? <span className="chip chip-dirty">{selectedFeature.warnings.length} warnings</span> : null}
          </div>
          <dl className="detail-pairs">
            <div><dt>Quantity</dt><dd>{selectedFeature.quantity}</dd></div>
            <div><dt>Depth</dt><dd>{selectedFeature.depthMm.toFixed(1)} mm</dd></div>
            <div><dt>Envelope</dt><dd>{selectedFeature.lengthMm.toFixed(1)} × {selectedFeature.widthMm.toFixed(1)} mm</dd></div>
            <div><dt>Related ops</dt><dd>{orderedOperations.filter((operation) => operation.featureId === selectedFeature.id).length}</dd></div>
            <div><dt>Confidence</dt><dd>{(selectedFeature.confidence * 100).toFixed(0)}%</dd></div>
            <div><dt>Inference</dt><dd>{selectedFeature.inferenceMethod ?? 'Structured input'}</dd></div>
            {selectedExtractedFeature ? <div><dt>Extracted kind</dt><dd>{selectedExtractedFeature.kind.replace('_', ' ')}</dd></div> : null}
          </dl>
          <ul className="detail-list">{selectedFeature.notes.map((note) => <li key={note}>{note}</li>)}</ul>
          {selectedFeature.sourceGeometryRefs.length > 0 ? (
            <ul className="detail-list">
              {selectedFeature.sourceGeometryRefs.map((ref) => <li key={ref}>Source geometry: {ref}</li>)}
            </ul>
          ) : null}
          {selectedFeature.warnings.length > 0 ? (
            <ul className="detail-list">
              {selectedFeature.warnings.map((warning) => <li key={warning}>{warning}</li>)}
            </ul>
          ) : null}
          {selectedFeature.origin === 'geometry_inferred' ? (
            <label>
              <span>Manual reclassification</span>
              <select
                value={selectedFeature.classificationState === 'ignored' ? 'ignore' : selectedFeature.kind}
                onChange={(event) =>
                  dispatch({
                    type: 'reclassifyFeature',
                    featureId: selectedFeature.id,
                    nextKind: event.target.value as 'contour' | 'pocket' | 'slot' | 'hole_group' | 'ignore' | 'unclassified',
                    message: `Updated feature classification for ${selectedFeature.name}.`,
                  })}
              >
                <option value="contour">Contour</option>
                <option value="pocket">Pocket</option>
                <option value="slot">Slot</option>
                <option value="hole_group">Hole group</option>
                <option value="unclassified">Unclassified</option>
                <option value="ignore">Ignore</option>
              </select>
            </label>
          ) : null}
          <button type="button" onClick={() => dispatch({ type: 'addManualOperation', featureId: selectedFeature.id, message: `Added a manual operation for ${selectedFeature.name}.` })}>Add manual operation</button>
        </div>
      );
    }

    if (selectedGeometryEntity) {
      return (
        <div className="inspector-form">
          <span className="chip">imported geometry</span>
          <dl className="detail-pairs">
            <div><dt>Entity</dt><dd>{selectedGeometryEntity.label}</dd></div>
            <div><dt>Layer</dt><dd>{selectedGeometryEntity.metadata.layerName ?? selectedGeometryEntity.metadata.layerId ?? 'unknown'}</dd></div>
            <div><dt>Bounds</dt><dd>{selectedGeometryEntity.bounds.size[0].toFixed(1)} × {selectedGeometryEntity.bounds.size[1].toFixed(1)} mm</dd></div>
            <div><dt>Linked features</dt><dd>{geometryLinkedFeatures.length}</dd></div>
          </dl>
          <ul className="detail-list">
            {geometryLinkedFeatures.length > 0
              ? geometryLinkedFeatures.map((feature) => (
                  <li key={feature.id}>
                    <strong>{feature.label}</strong>
                    <span>{feature.kind.replace('_', ' ')} · {(feature.confidence * 100).toFixed(0)}%</span>
                  </li>
                ))
              : <li>No extracted feature is linked to this geometry entity yet.</li>}
          </ul>
        </div>
      );
    }

    if (selectedTool) {
      return (
        <div className="inspector-form">
          <span className="chip">tool</span>
          <dl className="detail-pairs">
            <div><dt>Name</dt><dd>{selectedTool.name}</dd></div>
            <div><dt>Type</dt><dd>{selectedTool.type.replaceAll('_', ' ')}</dd></div>
            <div><dt>Diameter</dt><dd>{selectedTool.diameterMm} mm</dd></div>
            <div><dt>Max depth</dt><dd>{selectedTool.maxDepthMm} mm</dd></div>
          </dl>
          <p className="empty-state">Tool data remains foundational catalog data. Feeds, speeds, holders, and assemblies are not modeled yet.</p>
        </div>
      );
    }

    return <p className="empty-state">Select a feature, operation, or tool from the docks. Deterministic planning remains authoritative.</p>;
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
                <button type="button" key={risk.id} className={panelSelectionClass(state.selectedEntity?.type === 'risk' && state.selectedEntity.id === risk.id)} onClick={() => dispatch({ type: 'selectEntity', entity: { type: 'risk', id: risk.id } })}>
                  <strong>{risk.title}</strong>
                  <span className={`risk-pill risk-${risk.level}`}>{risk.level}</span>
                  <small>{risk.description}</small>
                </button>
              )) : <p className="empty-state">No deterministic risks were triggered.</p>}
            </div>
          </article>
          <article className="bottom-card">
            <header><h3>Unsaved work summary</h3></header>
            <dl className="detail-pairs">
              <div><dt>Modified ops</dt><dd>{unsavedSummary.modified}</dd></div>
              <div><dt>Manual ops</dt><dd>{unsavedSummary.manual}</dd></div>
              <div><dt>Disabled ops</dt><dd>{unsavedSummary.disabled}</dd></div>
              <div><dt>Dirty state</dt><dd>{state.dirty ? 'Unsaved changes' : 'Saved / generated state'}</dd></div>
            </dl>
          </article>
        </div>
      ) : <p className="empty-state">Plan the part to inspect deterministic risks and unsaved draft status.</p>;
    }

    if (activeBottomTab === 'checklist') {
      return state.draftPlan ? (
        <div className="bottom-grid">
          <article className="bottom-card span-2">
            <header><h3>Release checklist</h3></header>
            <ul className="detail-list">
              {state.draftPlan.checklist.map((item) => (
                <li key={item.id}><strong>{item.title}</strong><span>{item.rationale}</span></li>
              ))}
            </ul>
          </article>
        </div>
      ) : <p className="empty-state">Checklist items appear after deterministic planning.</p>;
    }

    if (activeBottomTab === 'review') {
      return state.review ? (
        <div className="bottom-grid">
          <article className="bottom-card">
            <header><h3>Overall assessment</h3><span className="chip">{state.review.mode}</span></header>
            <p>{state.review.overallAssessment}</p>
            <p><strong>Recommendation:</strong> {state.review.approvalRecommendation.replaceAll('_', ' ')}</p>
            <p><strong>Fallback:</strong> {state.review.fallbackUsed ? 'heuristic fallback used' : 'structured OpenAI response'}</p>
          </article>
          <article className="bottom-card"><header><h3>Missing operations</h3></header><ul>{(state.review.missingOperations.length > 0 ? state.review.missingOperations : ['No missing operations flagged.']).map((item) => <li key={item}>{item}</li>)}</ul></article>
          <article className="bottom-card"><header><h3>Risk flags</h3></header><ul>{(state.review.riskFlags.length > 0 ? state.review.riskFlags : ['No additional risk flags from the advisory review.']).map((item) => <li key={item}>{item}</li>)}</ul></article>
          <article className="bottom-card"><header><h3>Suggested edits</h3></header><ul>{(state.review.suggestedEdits.length > 0 ? state.review.suggestedEdits : ['No extra edits suggested.']).map((item) => <li key={item}>{item}</li>)}</ul></article>
        </div>
      ) : <p className="empty-state">Run AI review after planning or manual edits. AI remains advisory only.</p>;
    }

    if (activeBottomTab === 'metadata') {
      return (
        <div className="bottom-grid">
          <article className="bottom-card">
            <header><h3>Import + project metadata</h3></header>
            <dl className="detail-pairs">
              <div><dt>Project id</dt><dd>{projectId ?? 'Not planned yet'}</dd></div>
              <div><dt>Project revision</dt><dd>{state.currentProject?.revision ?? 0}</dd></div>
              <div><dt>Import id</dt><dd>{state.currentImportSession?.id ?? state.currentProject?.sourceImportId ?? 'None'}</dd></div>
              <div><dt>Source type</dt><dd>{state.currentImportSession?.source.type ?? state.currentProject?.sourceType ?? 'None'}</dd></div>
              <div><dt>Filename</dt><dd>{state.currentImportSession?.source.filename ?? state.currentProject?.sourceFilename ?? 'None'}</dd></div>
              <div><dt>Model status</dt><dd>{state.currentModel?.status ?? 'No model'}</dd></div>
              <div><dt>Updated at</dt><dd>{formatTimestamp(state.lastSavedAt ?? state.currentProject?.updatedAt)}</dd></div>
              <div><dt>Approval state</dt><dd>{state.draftPlan?.approval.state.replace('_', ' ') ?? state.currentProject?.approvalState ?? 'draft'}</dd></div>
            </dl>
          </article>
          <article className="bottom-card">
             <header><h3>Warnings + revision summary</h3></header>
             <ul className="detail-list">
              {combinedWarnings.map((warning, index) => (
                <li key={`${warning}-${index}`}>{warning}</li>
              ))}
              {combinedWarnings.length === 0 ? <li>No current source/model warnings.</li> : null}
            </ul>
            <ul className="detail-list">
              {(state.currentProject?.revisions ?? []).slice(-5).reverse().map((revision) => (
                <li key={revision.id}><strong>Rev {revision.revision}</strong><span>{formatTimestamp(revision.updatedAt)} · ops {revision.operationCount} · manual {revision.manualOperationCount} · warnings {revision.warningCount}</span></li>
              ))}
              {!(state.currentProject?.revisions.length) ? <li>No saved revisions yet.</li> : null}
            </ul>
            {state.currentModel?.geometryDocument ? (
              <dl className="detail-pairs">
                <div><dt>DXF units</dt><dd>{state.currentModel.geometryDocument.units}</dd></div>
                <div><dt>Entity count</dt><dd>{state.currentModel.geometryDocument.entities.length}</dd></div>
                <div><dt>Open profiles</dt><dd>{state.currentModel.geometryGraph?.openProfileIds.length ?? 0}</dd></div>
                <div><dt>Closed profiles</dt><dd>{state.currentModel.geometryGraph?.closedProfileIds.length ?? 0}</dd></div>
                <div><dt>Extracted features</dt><dd>{state.currentModel.extractedFeatures.length}</dd></div>
              </dl>
            ) : null}
          </article>
        </div>
      );
    }

    return (
      <ul className="console-list">
        {state.consoleMessages.map((message) => <li key={message}>{message}</li>)}
      </ul>
    );
  }

  return (
    <main className="workbench-shell v2-shell">
      <header className="app-bar">
        <div className="app-bar-project">
          <p className="eyebrow">DXF & 2D Geometry Pipeline v4</p>
          <h1>{state.sample?.partName ?? state.currentImportSession?.source.filename ?? 'CAM project session'}</h1>
          <p>
            Rev {state.sample?.revision ?? '—'} · Source {state.currentImportSession?.source.type ?? state.currentProject?.sourceType ?? 'none'} · Model {state.currentModel?.status ?? 'none'} · Deterministic planning authoritative · AI advisory only
          </p>
        </div>
        <div className="app-bar-actions">
          <button onClick={() => void handlePlan()} disabled={!state.currentImportSession?.deterministicPartInput || busy !== null}>{busy === 'plan' ? 'Planning…' : 'Derive plan'}</button>
          <button onClick={() => void handleReview()} disabled={!state.draftPlan || busy !== null}>{busy === 'review' ? 'Reviewing…' : 'Review'}</button>
          <button onClick={() => void handleSaveProject()} disabled={!state.draftPlan || busy !== null}>{busy === 'save' ? 'Saving…' : 'Save project'}</button>
          <button onClick={() => void handleApprove()} disabled={!state.draftPlan || busy !== null}>{busy === 'approve' ? 'Approving…' : 'Approve'}</button>
          <button className="secondary-button" onClick={() => dispatch({ type: 'undo', message: 'Undid the latest local draft edit.' })} disabled={state.history.length === 0 || busy !== null}>Undo</button>
          <button className="secondary-button" onClick={() => dispatch({ type: 'redo', message: 'Redid the latest local draft edit.' })} disabled={state.future.length === 0 || busy !== null}>Redo</button>
        </div>
        <div className="app-bar-controls">
          <div className="control-stack">
            <span className="panel-label">View presets</span>
            <div className="chip-row">
              {viewOrientations.map((orientation) => (
                <button key={orientation} type="button" className={viewOrientation === orientation ? 'secondary-button active-button' : 'secondary-button'} onClick={() => setViewOrientation(orientation)}>{orientation}</button>
              ))}
            </div>
          </div>
          <div className="control-stack">
            <span className="panel-label">View modes</span>
            <div className="chip-row">
              {viewModes.map((mode) => (
                <button key={mode} type="button" className={viewMode === mode ? 'secondary-button active-button' : 'secondary-button'} onClick={() => setViewMode(mode)}>{mode.replace('_', ' ')}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="app-bar-status">
          <span className={state.dirty ? 'chip chip-dirty' : 'chip'}>{state.dirty ? 'Dirty draft' : 'Draft synced'}</span>
          {state.draftPlan ? <span className="chip">{state.draftPlan.approval.state.replace('_', ' ')}</span> : null}
          <span className="chip">Warnings {combinedWarnings.length}</span>
          <span className="status-copy">Last save: {formatTimestamp(state.lastSavedAt ?? state.currentProject?.updatedAt)}</span>
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
                  {project.projectId} · rev {project.revision} · {project.sourceType ?? 'no source'}
                </option>
              ))}
            </select>
            <button className="secondary-button" onClick={() => void handleLoadProject()} disabled={!selectedProjectId || busy !== null}>{busy === 'load' ? 'Loading…' : 'Load'}</button>
          </div>
          <nav className="dock-tabs" aria-label="Workbench left dock tabs">
            {leftDockTabs.map((tab) => (
              <button key={tab.id} type="button" className={activeLeftTab === tab.id ? 'secondary-button active-button' : 'secondary-button'} onClick={() => setActiveLeftTab(tab.id)}>{tab.label}</button>
            ))}
          </nav>
          <div className="dock-body">{renderLeftDockBody()}</div>
        </aside>

        <section className="workbench-panel viewport-panel">
          <div className="panel-header">
            <div>
              <p className="panel-label">Viewport</p>
              <h2>Source/model/features/operation preview</h2>
            </div>
            {state.currentModel ? <span className="chip">{viewMode.replace('_', ' ')}</span> : null}
          </div>
          {state.currentModel && state.draftPlan ? (
            <>
              <Viewport3D
                model={state.currentModel}
                operations={state.draftPlan.operations}
                selectedFeatureId={selectedFeatureId}
                selectedOperationId={selectedOperation?.id ?? null}
                selectedGeometryId={selectedGeometryId}
                onSelectFeature={(featureId) => dispatch({ type: 'selectEntity', entity: featureId ? { type: 'feature', id: featureId } : null })}
                onSelectOperation={(operationId) => dispatch({ type: 'selectEntity', entity: operationId ? { type: 'operation', id: operationId } : null })}
                onSelectGeometry={(geometryId) => dispatch({ type: 'selectEntity', entity: { type: 'geometry', id: geometryId } })}
                viewOrientation={viewOrientation}
                viewMode={viewMode}
              />
              <div className="viewport-status-bar">
                <span>Highest risk: <strong>{state.draftPlan.summary.highestRisk}</strong></span>
                <span>Cycle time: <strong>{state.draftPlan.estimatedCycleTimeMinutes.toFixed(1)} min</strong></span>
                <span>Operation preview: <strong>derived only</strong></span>
              </div>
            </>
          ) : state.currentModel ? (
            <div className="viewport-placeholder"><p>Derive a deterministic plan to populate operation previews on top of the imported model.</p></div>
          ) : (
            <div className="viewport-placeholder"><p>Start an import session to populate model-aware viewport layers.</p></div>
          )}
        </section>

        <aside className="workbench-panel inspector-panel">
          <div className="panel-header">
            <div>
              <p className="panel-label">Inspector</p>
              <h2>{selectedOperation ? selectedOperation.name : selectedFeature ? selectedFeature.name : selectedTool ? selectedTool.name : 'Select a workbench item'}</h2>
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
              <button key={tab.id} type="button" className={activeBottomTab === tab.id ? 'secondary-button active-button' : 'secondary-button'} onClick={() => setActiveBottomTab(tab.id)}>{tab.label}</button>
            ))}
          </nav>
        </div>
        {renderBottomPanel()}
      </section>
    </main>
  );
}

export default App;
