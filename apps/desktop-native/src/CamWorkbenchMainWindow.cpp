#include "CamWorkbenchMainWindow.hpp"

#include "ProjectFileService.hpp"
#include "ViewportFoundationWidget.hpp"

#include <QAbstractItemView>
#include <QAction>
#include <QApplication>
#include <QBrush>
#include <QColor>
#include <QDockWidget>
#include <QFileInfo>
#include <QHeaderView>
#include <QMenu>
#include <QMenuBar>
#include <QMessageBox>
#include <QSettings>
#include <QSignalBlocker>
#include <QStatusBar>
#include <QTableWidget>
#include <QTableWidgetItem>
#include <QTabWidget>
#include <QTextEdit>
#include <QToolBar>
#include <QTreeWidget>
#include <QTreeWidgetItem>
#include <exception>

namespace {
constexpr auto kRecentFilesKey = "desktopNative/recentFiles";
constexpr auto kNodeIdRole = Qt::UserRole + 1;
constexpr auto kNodeKindRole = Qt::UserRole + 2;

QString detailForNode(const NativeWorkbenchNode& node) {
  if (!node.operationId.isEmpty()) {
    return node.metadata.value(QStringLiteral("setupId"));
  }
  if (!node.toolId.isEmpty()) {
    return node.metadata.value(QStringLiteral("diameterMm"));
  }
  if (!node.sourceGeometryIds.isEmpty()) {
    return node.sourceGeometryIds.join(QStringLiteral(", "));
  }
  return node.stableId;
}

QTreeWidgetItem* findItemByNodeId(QTreeWidget* tree, const QString& nodeId) {
  if (tree == nullptr || nodeId.isEmpty()) {
    return nullptr;
  }

  QList<QTreeWidgetItem*> stack;
  for (int index = 0; index < tree->topLevelItemCount(); ++index) {
    stack.push_back(tree->topLevelItem(index));
  }

  while (!stack.isEmpty()) {
    auto* item = stack.takeLast();
    if (item->data(0, kNodeIdRole).toString() == nodeId) {
      return item;
    }
    for (int childIndex = 0; childIndex < item->childCount(); ++childIndex) {
      stack.push_back(item->child(childIndex));
    }
  }

  return nullptr;
}
}

CamWorkbenchMainWindow::CamWorkbenchMainWindow(QWidget* parent)
  : QMainWindow(parent)
  , currentStepLoad_(OcctStepLoader::describeAvailability()) {
  currentProject_ = ProjectFileService::createEmpty();
  setWindowTitle(QStringLiteral("CAM System Native Workbench"));
  resize(1680, 980);
  setDockOptions(QMainWindow::AllowNestedDocks | QMainWindow::AllowTabbedDocks | QMainWindow::AnimatedDocks);

  setupActions();
  setupMenuBar();
  setupToolBar();
  setupCentralWorkspace();
  setupDocks();
  loadRecentFiles();
  syncUiToDocument();
  statusBar()->showMessage(QStringLiteral("Native CAM workbench ready."), 4000);
}

QAction* CamWorkbenchMainWindow::createAction(CommandId commandId, const QString& text, const QKeySequence& shortcut) {
  auto* actionHandle = new QAction(text, this);
  if (!shortcut.isEmpty()) {
    actionHandle->setShortcut(shortcut);
  }
  connect(actionHandle, &QAction::triggered, this, [this, commandId]() { dispatchCommand(commandId); });
  addAction(actionHandle);
  actionsByCommand_.insert(static_cast<int>(commandId), actionHandle);
  return actionHandle;
}

QAction* CamWorkbenchMainWindow::action(CommandId commandId) const {
  return actionsByCommand_.value(static_cast<int>(commandId), nullptr);
}

void CamWorkbenchMainWindow::setupActions() {
  createAction(CommandId::NewProject, QStringLiteral("&New project"), QKeySequence::New);
  createAction(CommandId::OpenProject, QStringLiteral("&Open project…"), QKeySequence::Open);
  createAction(CommandId::SaveProject, QStringLiteral("&Save project"), QKeySequence::Save);
  createAction(CommandId::SaveProjectAs, QStringLiteral("Save project &as…"), QKeySequence::SaveAs);
  createAction(CommandId::AttachBridgeSnapshot, QStringLiteral("Attach &bridge snapshot…"), QKeySequence(QStringLiteral("Ctrl+Shift+J")));
  createAction(CommandId::ReloadBridgeSnapshot, QStringLiteral("&Reload bridge snapshot"), QKeySequence(QStringLiteral("Ctrl+R")));
  createAction(CommandId::ImportStep, QStringLiteral("Import &STEP…"), QKeySequence(QStringLiteral("Ctrl+Shift+S")));
  createAction(CommandId::ImportDxf, QStringLiteral("Import &DXF…"), QKeySequence(QStringLiteral("Ctrl+Shift+D")));
  createAction(CommandId::FitView, QStringLiteral("Fit view"), QKeySequence(QStringLiteral("F")));
  createAction(CommandId::TopView, QStringLiteral("Top view"), QKeySequence(QStringLiteral("T")));
  createAction(CommandId::FrontView, QStringLiteral("Front view"), QKeySequence(QStringLiteral("Shift+F")));
  createAction(CommandId::IsometricView, QStringLiteral("Isometric view"), QKeySequence(QStringLiteral("I")));
  createAction(CommandId::HideSelection, QStringLiteral("&Hide selection"), QKeySequence(QStringLiteral("H")));
  createAction(CommandId::ShowAll, QStringLiteral("Show &all"), QKeySequence(QStringLiteral("Shift+H")));
  createAction(CommandId::IsolateSelection, QStringLiteral("&Isolate selection"), QKeySequence(QStringLiteral("Ctrl+I")));
}

void CamWorkbenchMainWindow::setupMenuBar() {
  auto* fileMenu = menuBar()->addMenu(QStringLiteral("&File"));
  fileMenu->addAction(action(CommandId::NewProject));
  fileMenu->addAction(action(CommandId::OpenProject));
  fileMenu->addSeparator();
  fileMenu->addAction(action(CommandId::SaveProject));
  fileMenu->addAction(action(CommandId::SaveProjectAs));
  fileMenu->addSeparator();
  fileMenu->addAction(action(CommandId::AttachBridgeSnapshot));
  fileMenu->addAction(action(CommandId::ReloadBridgeSnapshot));
  fileMenu->addSeparator();
  fileMenu->addAction(action(CommandId::ImportStep));
  fileMenu->addAction(action(CommandId::ImportDxf));
  recentFilesMenu_ = fileMenu->addMenu(QStringLiteral("Recent projects"));
  fileMenu->addSeparator();
  fileMenu->addAction(QStringLiteral("E&xit"), qApp, &QApplication::quit, QKeySequence::Quit);

  auto* viewMenu = menuBar()->addMenu(QStringLiteral("&View"));
  viewMenu->addAction(action(CommandId::FitView));
  viewMenu->addAction(action(CommandId::TopView));
  viewMenu->addAction(action(CommandId::FrontView));
  viewMenu->addAction(action(CommandId::IsometricView));
  viewMenu->addSeparator();
  viewMenu->addAction(action(CommandId::HideSelection));
  viewMenu->addAction(action(CommandId::ShowAll));
  viewMenu->addAction(action(CommandId::IsolateSelection));

  auto* projectMenu = menuBar()->addMenu(QStringLiteral("&Project"));
  projectMenu->addAction(action(CommandId::AttachBridgeSnapshot));
  projectMenu->addAction(action(CommandId::ReloadBridgeSnapshot));
  projectMenu->addAction(action(CommandId::ImportStep));
  projectMenu->addAction(action(CommandId::ImportDxf));

  auto* helpMenu = menuBar()->addMenu(QStringLiteral("&Help"));
  helpMenu->addAction(QStringLiteral("Native workbench status"), this, [this]() {
    QMessageBox::information(this,
      QStringLiteral("Native workbench status"),
      QStringLiteral("This milestone strengthens the professional Qt workbench, loads native-workbench-v1 bridge snapshots, and wires a real OCCT/XDE STEP loading boundary. Full OCCT viewport rendering and topology-highlighted face/edge selection still require a local OCCT-enabled Windows build."));
  });
}

void CamWorkbenchMainWindow::setupToolBar() {
  auto* toolbar = addToolBar(QStringLiteral("Workbench"));
  toolbar->setMovable(false);
  toolbar->setToolButtonStyle(Qt::ToolButtonTextBesideIcon);
  toolbar->addAction(action(CommandId::NewProject));
  toolbar->addAction(action(CommandId::OpenProject));
  toolbar->addAction(action(CommandId::SaveProject));
  toolbar->addSeparator();
  toolbar->addAction(action(CommandId::AttachBridgeSnapshot));
  toolbar->addAction(action(CommandId::ImportStep));
  toolbar->addAction(action(CommandId::ImportDxf));
  toolbar->addSeparator();
  toolbar->addAction(action(CommandId::FitView));
  toolbar->addAction(action(CommandId::TopView));
  toolbar->addAction(action(CommandId::FrontView));
  toolbar->addAction(action(CommandId::IsometricView));
  toolbar->addSeparator();
  toolbar->addAction(action(CommandId::HideSelection));
  toolbar->addAction(action(CommandId::ShowAll));
  toolbar->addAction(action(CommandId::IsolateSelection));
}

void CamWorkbenchMainWindow::setupCentralWorkspace() {
  centerTabs_ = new QTabWidget(this);
  centerTabs_->setDocumentMode(true);
  viewport_ = new ViewportFoundationWidget(centerTabs_);
  centerTabs_->addTab(viewport_, QStringLiteral("Model viewport"));
  setCentralWidget(centerTabs_);
}

void CamWorkbenchMainWindow::setupDocks() {
  auto* leftTabs = new QTabWidget(this);
  modelTree_ = new QTreeWidget(leftTabs);
  modelTree_->setHeaderLabels({QStringLiteral("Model tree"), QStringLiteral("Detail")});
  modelTree_->setSelectionMode(QAbstractItemView::SingleSelection);
  featuresTree_ = new QTreeWidget(leftTabs);
  featuresTree_->setHeaderLabels({QStringLiteral("Features"), QStringLiteral("Source refs")});
  featuresTree_->setSelectionMode(QAbstractItemView::SingleSelection);
  operationsTree_ = new QTreeWidget(leftTabs);
  operationsTree_->setHeaderLabels({QStringLiteral("Operations"), QStringLiteral("Setup / source")});
  operationsTree_->setSelectionMode(QAbstractItemView::SingleSelection);
  toolsTree_ = new QTreeWidget(leftTabs);
  toolsTree_->setHeaderLabels({QStringLiteral("Tools"), QStringLiteral("Diameter / type")});
  toolsTree_->setSelectionMode(QAbstractItemView::SingleSelection);
  leftTabs->addTab(modelTree_, QStringLiteral("Model tree"));
  leftTabs->addTab(featuresTree_, QStringLiteral("Features"));
  leftTabs->addTab(operationsTree_, QStringLiteral("Operations"));
  leftTabs->addTab(toolsTree_, QStringLiteral("Tools"));

  auto* leftDock = new QDockWidget(QStringLiteral("Programming browser"), this);
  leftDock->setAllowedAreas(Qt::LeftDockWidgetArea | Qt::RightDockWidgetArea);
  leftDock->setWidget(leftTabs);
  addDockWidget(Qt::LeftDockWidgetArea, leftDock);

  inspectorTable_ = new QTableWidget(0, 2, this);
  inspectorTable_->setHorizontalHeaderLabels({QStringLiteral("Property"), QStringLiteral("Value")});
  inspectorTable_->horizontalHeader()->setSectionResizeMode(QHeaderView::Stretch);
  inspectorTable_->verticalHeader()->hide();
  inspectorTable_->setEditTriggers(QAbstractItemView::NoEditTriggers);

  auto* inspectorDock = new QDockWidget(QStringLiteral("Inspector"), this);
  inspectorDock->setAllowedAreas(Qt::LeftDockWidgetArea | Qt::RightDockWidgetArea);
  inspectorDock->setWidget(inspectorTable_);
  addDockWidget(Qt::RightDockWidgetArea, inspectorDock);

  auto* bottomTabs = new QTabWidget(this);
  warningsView_ = new QTextEdit(bottomTabs);
  warningsView_->setReadOnly(true);
  checklistView_ = new QTextEdit(bottomTabs);
  checklistView_->setReadOnly(true);
  aiReviewView_ = new QTextEdit(bottomTabs);
  aiReviewView_->setReadOnly(true);
  logsView_ = new QTextEdit(bottomTabs);
  logsView_->setReadOnly(true);
  metadataView_ = new QTextEdit(bottomTabs);
  metadataView_->setReadOnly(true);
  bottomTabs->addTab(warningsView_, QStringLiteral("Warnings"));
  bottomTabs->addTab(checklistView_, QStringLiteral("Checklist"));
  bottomTabs->addTab(aiReviewView_, QStringLiteral("AI review"));
  bottomTabs->addTab(logsView_, QStringLiteral("Logs / console"));
  bottomTabs->addTab(metadataView_, QStringLiteral("Project metadata"));

  auto* bottomDock = new QDockWidget(QStringLiteral("Review and session status"), this);
  bottomDock->setAllowedAreas(Qt::BottomDockWidgetArea);
  bottomDock->setWidget(bottomTabs);
  addDockWidget(Qt::BottomDockWidgetArea, bottomDock);

  connect(modelTree_, &QTreeWidget::itemSelectionChanged, this, [this]() { handleTreeSelectionChanged(modelTree_, QStringLiteral("Model tree")); });
  connect(featuresTree_, &QTreeWidget::itemSelectionChanged, this, [this]() { handleTreeSelectionChanged(featuresTree_, QStringLiteral("Features")); });
  connect(operationsTree_, &QTreeWidget::itemSelectionChanged, this, [this]() { handleTreeSelectionChanged(operationsTree_, QStringLiteral("Operations")); });
  connect(toolsTree_, &QTreeWidget::itemSelectionChanged, this, [this]() { handleTreeSelectionChanged(toolsTree_, QStringLiteral("Tools")); });
}

void CamWorkbenchMainWindow::loadRecentFiles() {
  QSettings settings(QStringLiteral("CamSystem"), QStringLiteral("DesktopNative"));
  recentFiles_ = settings.value(QStringLiteral(kRecentFilesKey)).toStringList();
  refreshRecentFilesMenu();
}

void CamWorkbenchMainWindow::pushRecentFile(const QString& filePath) {
  if (filePath.isEmpty()) {
    return;
  }
  recentFiles_.removeAll(filePath);
  recentFiles_.prepend(filePath);
  while (recentFiles_.size() > 10) {
    recentFiles_.removeLast();
  }
  QSettings settings(QStringLiteral("CamSystem"), QStringLiteral("DesktopNative"));
  settings.setValue(QStringLiteral(kRecentFilesKey), recentFiles_);
  refreshRecentFilesMenu();
}

void CamWorkbenchMainWindow::refreshRecentFilesMenu() {
  recentFilesMenu_->clear();
  if (recentFiles_.isEmpty()) {
    auto* placeholder = recentFilesMenu_->addAction(QStringLiteral("No recent projects"));
    placeholder->setEnabled(false);
    return;
  }

  for (const auto& filePath : recentFiles_) {
    recentFilesMenu_->addAction(filePath, this, [this, filePath]() { openProjectFile(filePath); });
  }
}

void CamWorkbenchMainWindow::syncUiToDocument() {
  const auto projectLabel = currentProject_.title();
  setWindowTitle(QStringLiteral("%1 — CAM System Native Workbench").arg(projectLabel));
  rebuildTreeViews();
  refreshInspectorForSelection({}, QStringLiteral("Project"));
  refreshReviewPanels();
  refreshMetadataPanel();
  refreshViewportSummary();
}

void CamWorkbenchMainWindow::rebuildTreeViews() {
  modelTree_->clear();
  featuresTree_->clear();
  operationsTree_->clear();
  toolsTree_->clear();

  if (currentSnapshot_.has_value()) {
    QList<NativeWorkbenchNode> modelNodes;
    QList<NativeWorkbenchNode> featureNodes;
    QList<NativeWorkbenchNode> operationNodes;
    QList<NativeWorkbenchNode> toolNodes;
    for (const auto& node : currentSnapshot_->nodes) {
      const auto isProjectRoot = node.kind == QStringLiteral("project");
      if (isProjectRoot
          || node.kind == QStringLiteral("source")
          || (node.kind == QStringLiteral("collection") && node.label == QStringLiteral("Model tree"))
          || node.kind == QStringLiteral("model_entity")) {
        modelNodes.push_back(node);
      }
      if (isProjectRoot
          || (node.kind == QStringLiteral("collection") && node.label == QStringLiteral("Features"))
          || node.kind == QStringLiteral("feature")) {
        featureNodes.push_back(node);
      }
      if (isProjectRoot
          || (node.kind == QStringLiteral("collection") && node.label == QStringLiteral("Operations"))
          || node.kind == QStringLiteral("operation")) {
        operationNodes.push_back(node);
      }
      if (isProjectRoot
          || (node.kind == QStringLiteral("collection") && node.label == QStringLiteral("Tools"))
          || node.kind == QStringLiteral("tool")) {
        toolNodes.push_back(node);
      }
    }

    addSnapshotNodesToTree(modelTree_, modelNodes, 0, 1);
    populateStepTree();
    addSnapshotNodesToTree(featuresTree_, featureNodes, 0, 1);
    addSnapshotNodesToTree(operationsTree_, operationNodes, 0, 1);
    addSnapshotNodesToTree(toolsTree_, toolNodes, 0, 1);
  } else {
    auto* projectRoot = new QTreeWidgetItem(modelTree_, {currentProject_.title(), currentProject_.projectId});
    projectRoot->addChild(new QTreeWidgetItem({QStringLiteral("Bridge snapshot"), QFileInfo(currentProject_.bridgeSnapshotPath).fileName()}));
    projectRoot->addChild(new QTreeWidgetItem({QStringLiteral("STEP source"), QFileInfo(currentProject_.lastImportedStepPath).fileName()}));
    projectRoot->addChild(new QTreeWidgetItem({QStringLiteral("DXF source"), QFileInfo(currentProject_.lastImportedDxfPath).fileName()}));
    populateStepTree();
  }

  modelTree_->expandAll();
  featuresTree_->expandAll();
  operationsTree_->expandAll();
  toolsTree_->expandAll();
}

void CamWorkbenchMainWindow::addSnapshotNodesToTree(QTreeWidget* tree, const QList<NativeWorkbenchNode>& nodes, int labelColumn, int detailColumn) {
  QHash<QString, QTreeWidgetItem*> treeItemsByNodeId;
  for (const auto& node : nodes) {
    const QStringList columns = {
      node.label,
      detailForNode(node),
    };

    QTreeWidgetItem* item = nullptr;
    if (!node.parentId.isEmpty() && treeItemsByNodeId.contains(node.parentId)) {
      item = new QTreeWidgetItem(treeItemsByNodeId.value(node.parentId), columns);
    } else {
      item = new QTreeWidgetItem(tree, columns);
    }

    item->setData(labelColumn, kNodeIdRole, node.id);
    item->setData(labelColumn, kNodeKindRole, node.kind);
    item->setToolTip(labelColumn, QStringLiteral("%1 (%2)").arg(node.label, node.stableId));
    item->setToolTip(detailColumn, node.sourceGeometryIds.join(QStringLiteral(", ")));
    if (node.status == QStringLiteral("warning")) {
      item->setForeground(labelColumn, QBrush(QColor(QStringLiteral("#f59e0b"))));
    } else if (node.status == QStringLiteral("placeholder")) {
      item->setForeground(labelColumn, QBrush(QColor(QStringLiteral("#94a3b8"))));
    }
    const auto hidden = hiddenNodeIds_.contains(node.id);
    item->setHidden(hidden);
    treeItemsByNodeId.insert(node.id, item);
  }
}

void CamWorkbenchMainWindow::populateStepTree() {
  const auto statusLabel = currentStepLoad_.status.isEmpty() ? QStringLiteral("not_requested") : currentStepLoad_.status;
  auto* stepRoot = new QTreeWidgetItem(modelTree_, {QStringLiteral("Native STEP session"), statusLabel});
  stepRoot->setExpanded(true);
  stepRoot->setToolTip(0, currentStepLoad_.statusMessage);

  if (currentProject_.lastImportedStepPath.isEmpty()) {
    stepRoot->addChild(new QTreeWidgetItem({QStringLiteral("No STEP file selected"), QStringLiteral("Use File → Import STEP…")}));
    return;
  }

  stepRoot->addChild(new QTreeWidgetItem({QStringLiteral("Source path"), currentProject_.lastImportedStepPath}));
  stepRoot->addChild(new QTreeWidgetItem({QStringLiteral("OCCT"), currentStepLoad_.occtAvailable ? QStringLiteral("available") : QStringLiteral("missing")}));
  stepRoot->addChild(new QTreeWidgetItem({QStringLiteral("XDE document"), currentStepLoad_.xdeDocumentLoaded ? QStringLiteral("loaded") : QStringLiteral("not loaded")}));

  if (!currentStepLoad_.nodes.isEmpty()) {
    auto* documentRoot = new QTreeWidgetItem(stepRoot, {QStringLiteral("STEP/XDE model tree"), QStringLiteral("%1 root shapes").arg(currentStepLoad_.freeShapeCount)});
    QHash<QString, QTreeWidgetItem*> stepItems;
    for (const auto& node : currentStepLoad_.nodes) {
      QTreeWidgetItem* parent = documentRoot;
      if (!node.parentId.isEmpty() && stepItems.contains(node.parentId)) {
        parent = stepItems.value(node.parentId);
      }
      auto* item = new QTreeWidgetItem(parent, {node.label, QStringLiteral("%1 · %2").arg(node.entityType, node.persistentId)});
      item->setToolTip(0, QStringLiteral("OCCT persistent id: %1").arg(node.persistentId));
      stepItems.insert(node.id, item);
    }
  } else {
    stepRoot->addChild(new QTreeWidgetItem({QStringLiteral("STEP tree"), currentStepLoad_.statusMessage}));
  }
}

void CamWorkbenchMainWindow::refreshInspectorForSelection(const QString& nodeId, const QString& sourcePanel) {
  inspectorTable_->clearContents();

  QList<QPair<QString, QString>> rows = {
    {QStringLiteral("Project"), currentProject_.title()},
    {QStringLiteral("Source panel"), sourcePanel},
    {QStringLiteral("Project id"), currentProject_.projectId},
    {QStringLiteral("Bridge snapshot"), currentProject_.bridgeSnapshotPath},
    {QStringLiteral("STEP source"), currentProject_.lastImportedStepPath},
    {QStringLiteral("DXF source"), currentProject_.lastImportedDxfPath},
  };

  if (!nodeId.isEmpty() && currentSnapshot_.has_value()) {
    if (const auto* node = currentSnapshot_->findNodeById(nodeId)) {
      rows.push_back({QStringLiteral("Selected node"), node->label});
      rows.push_back({QStringLiteral("Node kind"), node->kind});
      rows.push_back({QStringLiteral("Stable id"), node->stableId});
      rows.push_back({QStringLiteral("Status"), node->status});
      rows.push_back({QStringLiteral("Visibility"), hiddenNodeIds_.contains(node->id) ? QStringLiteral("hidden") : node->visibility});
      if (!node->entityId.isEmpty()) {
        rows.push_back({QStringLiteral("Entity id"), node->entityId});
      }
      if (!node->featureId.isEmpty()) {
        rows.push_back({QStringLiteral("Feature id"), node->featureId});
      }
      if (!node->operationId.isEmpty()) {
        rows.push_back({QStringLiteral("Operation id"), node->operationId});
      }
      if (!node->toolId.isEmpty()) {
        rows.push_back({QStringLiteral("Tool id"), node->toolId});
      }
      if (!node->previewId.isEmpty()) {
        rows.push_back({QStringLiteral("Preview id"), node->previewId});
      }
      if (!node->sourceGeometryIds.isEmpty()) {
        rows.push_back({QStringLiteral("Source geometry"), node->sourceGeometryIds.join(QStringLiteral(", "))});
      }
      if (const auto* link = currentSnapshot_->findSelectionLinkForNode(nodeId)) {
        rows.push_back({QStringLiteral("Link resolution"), link->resolution});
        rows.push_back({QStringLiteral("Link warnings"), link->warnings.join(QStringLiteral(" | "))});
      }
      for (auto iterator = node->metadata.begin(); iterator != node->metadata.end(); ++iterator) {
        rows.push_back({QStringLiteral("Meta · %1").arg(iterator.key()), iterator.value()});
      }
    }
  } else {
    rows.push_back({QStringLiteral("STEP session"), currentStepLoad_.status});
    rows.push_back({QStringLiteral("STEP status"), currentStepLoad_.statusMessage});
  }

  inspectorTable_->setRowCount(rows.size());
  for (int row = 0; row < rows.size(); ++row) {
    inspectorTable_->setItem(row, 0, new QTableWidgetItem(rows[row].first));
    inspectorTable_->setItem(row, 1, new QTableWidgetItem(rows[row].second));
  }
}

void CamWorkbenchMainWindow::refreshReviewPanels() {
  QStringList warnings;
  warnings << QStringLiteral("Deterministic planning remains authoritative. AI review remains advisory only.");
  warnings.append(currentSnapshot_.has_value() ? currentSnapshot_->warnings : QStringList{});
  warnings.append(currentStepLoad_.warnings);
  warningsView_->setPlainText(warnings.join(QStringLiteral("\n")));

  QStringList checklist = {
    QStringLiteral("- Open or save a `.camproj.json` desktop project"),
    QStringLiteral("- Attach a `native-workbench-v1` snapshot from the TypeScript/API companion flow"),
    QStringLiteral("- Import a STEP file to exercise the OCCT/XDE loading boundary"),
    QStringLiteral("- Review unresolved STEP-to-feature links before trusting topology-aware CAM edits"),
    QStringLiteral("- Use hide/show/isolate hooks to prepare future display-object lifecycle management"),
  };
  if (currentSnapshot_.has_value()) {
    checklist.push_back(QStringLiteral("- Snapshot summary: %1").arg(currentSnapshot_->summaryLine()));
  }
  checklistView_->setPlainText(checklist.join(QStringLiteral("\n")));

  aiReviewView_->setPlainText(
    QStringLiteral("AI review is displayed as companion metadata only.\n\n"
                   "Native shell responsibilities in this milestone:\n"
                   "- load the bridge snapshot\n"
                   "- keep model/features/operations/tools selection synchronized\n"
                   "- surface unresolved topology and STEP-link warnings\n\n"
                   "Manufacturing authority remains in the deterministic engine and approval flow."));
}

void CamWorkbenchMainWindow::refreshMetadataPanel() {
  QStringList lines = {
    QStringLiteral("schemaVersion: %1").arg(currentProject_.schemaVersion),
    QStringLiteral("projectFile: %1").arg(currentProject_.projectFilePath),
    QStringLiteral("bridgeSnapshotPath: %1").arg(currentProject_.bridgeSnapshotPath),
    QStringLiteral("stepSource: %1").arg(currentProject_.lastImportedStepPath),
    QStringLiteral("dxfSource: %1").arg(currentProject_.lastImportedDxfPath),
    QStringLiteral("dirty: %1").arg(currentProject_.dirty ? QStringLiteral("yes") : QStringLiteral("no")),
    QStringLiteral("stepSession: %1").arg(currentStepLoad_.status),
    QStringLiteral("stepStatus: %1").arg(currentStepLoad_.statusMessage),
  };
  if (currentSnapshot_.has_value()) {
    lines.push_back(QStringLiteral("nativeWorkbench: %1").arg(currentSnapshot_->summaryLine()));
    lines.push_back(QStringLiteral("displayLayers: %1").arg(currentSnapshot_->displayLayers.size()));
  }
  metadataView_->setPlainText(lines.join(QStringLiteral("\n")));
}

void CamWorkbenchMainWindow::refreshViewportSummary() {
  viewport_->setProjectContext(currentProject_.title(), currentProject_.bridgeSnapshotPath);
  viewport_->setIntegrationStatus(currentStepLoad_.statusMessage);
  viewport_->setDocumentStatus(currentSnapshot_.has_value()
      ? QStringLiteral("Bridge snapshot loaded · %1").arg(currentSnapshot_->summaryLine())
      : QStringLiteral("Awaiting bridge snapshot. STEP session status: %1").arg(currentStepLoad_.status));

  QStringList layerLabels;
  if (currentSnapshot_.has_value()) {
    for (const auto& layer : currentSnapshot_->displayLayers) {
      layerLabels.push_back(QStringLiteral("%1 (%2%3)")
        .arg(layer.label, layer.status, layer.visible ? QString() : QStringLiteral(", hidden")));
    }
  }
  if (layerLabels.isEmpty()) {
    layerLabels = {
      QStringLiteral("Model geometry"),
      QStringLiteral("Feature overlays"),
      QStringLiteral("Operation overlays"),
      QStringLiteral("Future path plans"),
    };
  }
  viewport_->setDisplayLegend(QStringLiteral("Display layers: %1 · hidden nodes %2").arg(layerLabels.join(QStringLiteral(" · "))).arg(hiddenNodeIds_.size()));
}

void CamWorkbenchMainWindow::handleTreeSelectionChanged(QTreeWidget* tree, const QString& sourcePanel) {
  const auto nodeId = selectedNodeId(tree);
  if (nodeId.isEmpty()) {
    return;
  }

  refreshInspectorForSelection(nodeId, sourcePanel);
  if (currentSnapshot_.has_value()) {
    if (const auto* link = currentSnapshot_->findSelectionLinkForNode(nodeId)) {
      applySelectionLink(*link, tree);
      viewport_->setSelectionStatus(QStringLiteral("%1 selection → %2 (%3)").arg(sourcePanel, link->id, link->resolution));
      return;
    }
  }

  clearTreeSelections(tree);
  viewport_->setSelectionStatus(QStringLiteral("%1 selection → %2").arg(sourcePanel, nodeId));
}

void CamWorkbenchMainWindow::applySelectionLink(const NativeWorkbenchSelectionLink& link, QTreeWidget* sourceTree) {
  const auto applyNode = [this](QTreeWidget* tree, const QString& nodeId) {
    if (!nodeId.isEmpty()) {
      setTreeSelection(tree, nodeId);
    }
  };

  applyNode(modelTree_, link.modelEntityNodeId);
  applyNode(featuresTree_, link.featureNodeId);
  applyNode(operationsTree_, link.operationNodeId);
  applyNode(toolsTree_, link.toolNodeId);

  if (!link.warnings.isEmpty()) {
    statusBar()->showMessage(link.warnings.join(QStringLiteral(" | ")), 7000);
  }

  if (sourceTree != nullptr && !selectedNodeId(sourceTree).isEmpty()) {
    refreshInspectorForSelection(selectedNodeId(sourceTree), sourceTree == modelTree_ ? QStringLiteral("Model tree")
      : sourceTree == featuresTree_ ? QStringLiteral("Features")
      : sourceTree == operationsTree_ ? QStringLiteral("Operations")
      : QStringLiteral("Tools"));
  }
}

void CamWorkbenchMainWindow::clearTreeSelections(QTreeWidget* sourceTree) {
  const auto clearIfNeeded = [sourceTree](QTreeWidget* tree) {
    if (tree != sourceTree) {
      const QSignalBlocker blocker(tree);
      tree->clearSelection();
    }
  };
  clearIfNeeded(modelTree_);
  clearIfNeeded(featuresTree_);
  clearIfNeeded(operationsTree_);
  clearIfNeeded(toolsTree_);
}

void CamWorkbenchMainWindow::applyVisibilityCommand(CommandId commandId) {
  const auto tree = activeTree();
  const auto nodeId = selectedNodeId(tree);
  if (commandId != CommandId::ShowAll && nodeId.isEmpty()) {
    logMessage(QStringLiteral("Select a model, feature, operation, or tool node before changing visibility."));
    return;
  }

  if (commandId == CommandId::ShowAll) {
    hiddenNodeIds_.clear();
    logMessage(QStringLiteral("Visibility reset: all workbench items are visible again."));
  } else if (commandId == CommandId::HideSelection) {
    if (!hiddenNodeIds_.contains(nodeId)) {
      hiddenNodeIds_.push_back(nodeId);
    }
    logMessage(QStringLiteral("Visibility hook: hidden %1").arg(nodeId));
  } else if (commandId == CommandId::IsolateSelection) {
    hiddenNodeIds_.clear();
    QStringList keepIds = {nodeId};
    if (currentSnapshot_.has_value()) {
      if (const auto* link = currentSnapshot_->findSelectionLinkForNode(nodeId)) {
        keepIds << link->modelEntityNodeId << link->featureNodeId << link->operationNodeId << link->toolNodeId << link->previewNodeId;
      }
      for (const auto& node : currentSnapshot_->nodes) {
        if (!keepIds.contains(node.id)) {
          hiddenNodeIds_.push_back(node.id);
        }
      }
    }
    logMessage(QStringLiteral("Visibility hook: isolated selection set around %1").arg(nodeId));
  }

  syncUiToDocument();
  if (!nodeId.isEmpty()) {
    setTreeSelection(tree, nodeId);
  }
}

void CamWorkbenchMainWindow::setTreeSelection(QTreeWidget* tree, const QString& nodeId) {
  if (tree == nullptr || nodeId.isEmpty()) {
    return;
  }
  auto* item = findItemByNodeId(tree, nodeId);
  if (item == nullptr) {
    return;
  }
  const QSignalBlocker blocker(tree);
  tree->setCurrentItem(item);
  item->setSelected(true);
}

void CamWorkbenchMainWindow::loadBridgeSnapshotFromFile(const QString& filePath) {
  QString errorMessage;
  const auto snapshot = NativeWorkbenchSnapshotReader::loadFromFile(filePath, &errorMessage);
  if (!snapshot.has_value()) {
    throw std::runtime_error(errorMessage.toUtf8().constData());
  }

  currentSnapshot_ = snapshot;
  currentProject_.bridgeSnapshotPath = filePath;
  currentProject_.projectId = snapshot->projectId;
  if (currentProject_.displayName.isEmpty() || currentProject_.displayName == QStringLiteral("Untitled CAM project")) {
    currentProject_.displayName = snapshot->projectId;
  }
  logMessage(QStringLiteral("Loaded native workbench snapshot: %1").arg(filePath));
}

void CamWorkbenchMainWindow::loadStepFile(const QString& filePath) {
  currentProject_.lastImportedStepPath = filePath;
  currentStepLoad_ = OcctStepLoader::loadStepDocument(filePath);
  currentProject_.dirty = true;
  logMessage(QStringLiteral("STEP session updated: %1").arg(currentStepLoad_.statusMessage));
}

QTreeWidget* CamWorkbenchMainWindow::activeTree() const {
  for (auto* tree : {modelTree_, featuresTree_, operationsTree_, toolsTree_}) {
    if (tree != nullptr && tree->hasFocus()) {
      return tree;
    }
  }
  for (auto* tree : {modelTree_, featuresTree_, operationsTree_, toolsTree_}) {
    if (tree != nullptr && !selectedNodeId(tree).isEmpty()) {
      return tree;
    }
  }
  return modelTree_;
}

QString CamWorkbenchMainWindow::selectedNodeId(QTreeWidget* tree) const {
  if (tree == nullptr || tree->currentItem() == nullptr) {
    return {};
  }
  return tree->currentItem()->data(0, kNodeIdRole).toString();
}

void CamWorkbenchMainWindow::logMessage(const QString& message) {
  logsView_->append(message);
  statusBar()->showMessage(message, 5000);
}

void CamWorkbenchMainWindow::dispatchCommand(CommandId commandId) {
  try {
    switch (commandId) {
      case CommandId::NewProject:
        currentProject_ = ProjectFileService::createEmpty();
        currentStepLoad_ = OcctStepLoader::describeAvailability();
        currentSnapshot_.reset();
        hiddenNodeIds_.clear();
        currentProject_.dirty = true;
        logMessage(QStringLiteral("Started a new native CAM project shell."));
        break;
      case CommandId::OpenProject: {
        const auto filePath = ProjectFileService::promptOpenProject(this);
        if (!filePath.isEmpty()) {
          openProjectFile(filePath);
        }
        return;
      }
      case CommandId::SaveProject: {
        auto filePath = currentProject_.projectFilePath;
        if (filePath.isEmpty()) {
          filePath = ProjectFileService::promptSaveProject(this);
        }
        if (!filePath.isEmpty()) {
          ProjectFileService::save(currentProject_, filePath);
          pushRecentFile(filePath);
          logMessage(QStringLiteral("Saved native CAM project: %1").arg(filePath));
        }
        break;
      }
      case CommandId::SaveProjectAs: {
        const auto filePath = ProjectFileService::promptSaveProject(this, currentProject_.projectFilePath);
        if (!filePath.isEmpty()) {
          ProjectFileService::save(currentProject_, filePath);
          pushRecentFile(filePath);
          logMessage(QStringLiteral("Saved native CAM project as: %1").arg(filePath));
        }
        break;
      }
      case CommandId::AttachBridgeSnapshot: {
        const auto filePath = ProjectFileService::promptOpenBridgeSnapshot(this, currentProject_.bridgeSnapshotPath);
        if (!filePath.isEmpty()) {
          loadBridgeSnapshotFromFile(filePath);
          currentProject_.dirty = true;
        }
        break;
      }
      case CommandId::ReloadBridgeSnapshot:
        if (currentProject_.bridgeSnapshotPath.isEmpty()) {
          logMessage(QStringLiteral("No bridge snapshot is attached yet."));
        } else {
          loadBridgeSnapshotFromFile(currentProject_.bridgeSnapshotPath);
        }
        break;
      case CommandId::ImportStep: {
        const auto filePath = ProjectFileService::promptImportStep(this);
        if (!filePath.isEmpty()) {
          loadStepFile(filePath);
        }
        break;
      }
      case CommandId::ImportDxf: {
        const auto filePath = ProjectFileService::promptImportDxf(this);
        if (!filePath.isEmpty()) {
          currentProject_.lastImportedDxfPath = filePath;
          currentProject_.dirty = true;
          logMessage(QStringLiteral("Registered DXF companion source: %1").arg(filePath));
        }
        break;
      }
      case CommandId::FitView:
        viewport_->setViewerModeLabel(QStringLiteral("fit / shaded"));
        logMessage(QStringLiteral("Viewport command routed: fit view."));
        return;
      case CommandId::TopView:
        viewport_->setViewerModeLabel(QStringLiteral("top / wireframe"));
        logMessage(QStringLiteral("Viewport command routed: top view."));
        return;
      case CommandId::FrontView:
        viewport_->setViewerModeLabel(QStringLiteral("front / shaded"));
        logMessage(QStringLiteral("Viewport command routed: front view."));
        return;
      case CommandId::IsometricView:
        viewport_->setViewerModeLabel(QStringLiteral("isometric / shaded"));
        logMessage(QStringLiteral("Viewport command routed: isometric view."));
        return;
      case CommandId::HideSelection:
      case CommandId::ShowAll:
      case CommandId::IsolateSelection:
        applyVisibilityCommand(commandId);
        return;
    }
  } catch (const std::exception& error) {
    QMessageBox::critical(this, QStringLiteral("Native workbench command failed"), QString::fromUtf8(error.what()));
  }

  syncUiToDocument();
}

void CamWorkbenchMainWindow::openProjectFile(const QString& filePath) {
  currentProject_ = ProjectFileService::load(filePath);
  currentSnapshot_.reset();
  currentStepLoad_ = OcctStepLoader::describeAvailability();
  hiddenNodeIds_.clear();

  if (!currentProject_.bridgeSnapshotPath.isEmpty()) {
    loadBridgeSnapshotFromFile(currentProject_.bridgeSnapshotPath);
  }
  if (!currentProject_.lastImportedStepPath.isEmpty()) {
    currentStepLoad_ = OcctStepLoader::loadStepDocument(currentProject_.lastImportedStepPath);
  }

  pushRecentFile(filePath);
  logMessage(QStringLiteral("Opened native CAM project: %1").arg(filePath));
  syncUiToDocument();
}
