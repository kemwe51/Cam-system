#include "CamWorkbenchMainWindow.hpp"

#include "ProjectFileService.hpp"
#include "ViewportFoundationWidget.hpp"

#include <QAction>
#include <QApplication>
#include <QDockWidget>
#include <QFileInfo>
#include <QHeaderView>
#include <QMenu>
#include <QMenuBar>
#include <QMessageBox>
#include <QAbstractItemView>
#include <QSettings>
#include <QStatusBar>
#include <QTabWidget>
#include <QTableWidget>
#include <QTableWidgetItem>
#include <QTextEdit>
#include <QToolBar>
#include <QTreeWidget>
#include <QVBoxLayout>
#include <exception>

namespace {
constexpr auto kRecentFilesKey = "desktopNative/recentFiles";
}

CamWorkbenchMainWindow::CamWorkbenchMainWindow(QWidget* parent)
  : QMainWindow(parent) {
  currentProject_ = ProjectFileService::createEmpty();
  setWindowTitle(QStringLiteral("CAM System Native Workbench Foundation"));
  resize(1600, 960);
  setDockOptions(QMainWindow::AllowNestedDocks | QMainWindow::AllowTabbedDocks | QMainWindow::AnimatedDocks);

  setupActions();
  setupMenuBar();
  setupToolBar();
  setupCentralWorkspace();
  setupDocks();
  loadRecentFiles();
  syncUiToDocument();
  statusBar()->showMessage(QStringLiteral("Desktop workbench foundation ready."), 4000);
}

void CamWorkbenchMainWindow::setupActions() {
  auto makeAction = [this](const QString& text, const QKeySequence& shortcut, CommandId commandId) {
    auto* action = new QAction(text, this);
    if (!shortcut.isEmpty()) {
      action->setShortcut(shortcut);
    }
    connect(action, &QAction::triggered, this, [this, commandId]() { dispatchCommand(commandId); });
    addAction(action);
    return action;
  };

  makeAction(QStringLiteral("&New project"), QKeySequence::New, CommandId::NewProject);
  makeAction(QStringLiteral("&Open project…"), QKeySequence::Open, CommandId::OpenProject);
  makeAction(QStringLiteral("&Save project"), QKeySequence::Save, CommandId::SaveProject);
  makeAction(QStringLiteral("Save project &as…"), QKeySequence::SaveAs, CommandId::SaveProjectAs);
  makeAction(QStringLiteral("Import &STEP…"), QKeySequence(QStringLiteral("Ctrl+Shift+S")), CommandId::ImportStep);
  makeAction(QStringLiteral("Import &DXF…"), QKeySequence(QStringLiteral("Ctrl+Shift+D")), CommandId::ImportDxf);
  makeAction(QStringLiteral("Fit view"), QKeySequence(QStringLiteral("F")), CommandId::FitView);
  makeAction(QStringLiteral("Top view"), QKeySequence(QStringLiteral("T")), CommandId::TopView);
  makeAction(QStringLiteral("Front view"), QKeySequence(QStringLiteral("Shift+F")), CommandId::FrontView);
  makeAction(QStringLiteral("Isometric view"), QKeySequence(QStringLiteral("I")), CommandId::IsometricView);
}

void CamWorkbenchMainWindow::setupMenuBar() {
  auto* fileMenu = menuBar()->addMenu(QStringLiteral("&File"));
  fileMenu->addActions(actions().mid(0, 6));
  recentFilesMenu_ = fileMenu->addMenu(QStringLiteral("Recent files"));
  fileMenu->addSeparator();
  fileMenu->addAction(QStringLiteral("E&xit"), qApp, &QApplication::quit, QKeySequence::Quit);

  auto* viewMenu = menuBar()->addMenu(QStringLiteral("&View"));
  viewMenu->addActions(actions().mid(6, 4));

  auto* helpMenu = menuBar()->addMenu(QStringLiteral("&Help"));
  helpMenu->addAction(QStringLiteral("Desktop foundation status"), this, [this]() {
    QMessageBox::information(this,
      QStringLiteral("Desktop foundation status"),
      QStringLiteral("This milestone provides a real Qt Widgets workbench shell, file workflow scaffolding, and an OCCT integration boundary. STEP loading itself remains a foundation until Open CASCADE model loading is wired."));
  });
}

void CamWorkbenchMainWindow::setupToolBar() {
  auto* toolbar = addToolBar(QStringLiteral("Main"));
  toolbar->setMovable(false);
  toolbar->setToolButtonStyle(Qt::ToolButtonTextBesideIcon);
  for (auto* action : actions().mid(0, 6)) {
    toolbar->addAction(action);
  }
  toolbar->addSeparator();
  for (auto* action : actions().mid(6, 4)) {
    toolbar->addAction(action);
  }
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
  modelTree_->setHeaderLabels({QStringLiteral("Model tree"), QStringLiteral("Stable id")});
  featuresTree_ = new QTreeWidget(leftTabs);
  featuresTree_->setHeaderLabels({QStringLiteral("Features"), QStringLiteral("Source refs")});
  operationsTree_ = new QTreeWidget(leftTabs);
  operationsTree_->setHeaderLabels({QStringLiteral("Operations"), QStringLiteral("Setup")});
  toolsTree_ = new QTreeWidget(leftTabs);
  toolsTree_->setHeaderLabels({QStringLiteral("Tools"), QStringLiteral("Diameter")});
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

  auto* bottomDock = new QDockWidget(QStringLiteral("Review and run status"), this);
  bottomDock->setAllowedAreas(Qt::BottomDockWidgetArea);
  bottomDock->setWidget(bottomTabs);
  addDockWidget(Qt::BottomDockWidgetArea, bottomDock);
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
  setWindowTitle(QStringLiteral("%1 — CAM System Native Workbench Foundation").arg(projectLabel));
  viewport_->setProjectContext(projectLabel, currentProject_.bridgeSnapshotPath);

  inspectorTable_->setRowCount(5);
  inspectorTable_->setItem(0, 0, new QTableWidgetItem(QStringLiteral("Project id")));
  inspectorTable_->setItem(0, 1, new QTableWidgetItem(currentProject_.projectId));
  inspectorTable_->setItem(1, 0, new QTableWidgetItem(QStringLiteral("Bridge snapshot")));
  inspectorTable_->setItem(1, 1, new QTableWidgetItem(currentProject_.bridgeSnapshotPath));
  inspectorTable_->setItem(2, 0, new QTableWidgetItem(QStringLiteral("STEP source")));
  inspectorTable_->setItem(2, 1, new QTableWidgetItem(currentProject_.lastImportedStepPath));
  inspectorTable_->setItem(3, 0, new QTableWidgetItem(QStringLiteral("DXF source")));
  inspectorTable_->setItem(3, 1, new QTableWidgetItem(currentProject_.lastImportedDxfPath));
  inspectorTable_->setItem(4, 0, new QTableWidgetItem(QStringLiteral("Dirty")));
  inspectorTable_->setItem(4, 1, new QTableWidgetItem(currentProject_.dirty ? QStringLiteral("Yes") : QStringLiteral("No")));

  modelTree_->clear();
  featuresTree_->clear();
  operationsTree_->clear();
  toolsTree_->clear();

  auto* projectRoot = new QTreeWidgetItem(modelTree_, {projectLabel, currentProject_.projectId});
  projectRoot->addChild(new QTreeWidgetItem({QStringLiteral("STEP asset"), QFileInfo(currentProject_.lastImportedStepPath).fileName()}));
  projectRoot->addChild(new QTreeWidgetItem({QStringLiteral("DXF asset"), QFileInfo(currentProject_.lastImportedDxfPath).fileName()}));
  projectRoot->addChild(new QTreeWidgetItem({QStringLiteral("Bridge snapshot"), QFileInfo(currentProject_.bridgeSnapshotPath).fileName()}));
  modelTree_->expandAll();

  new QTreeWidgetItem(featuresTree_, {QStringLiteral("Topology-aware feature sync boundary"), QStringLiteral("native-workbench-v1")});
  new QTreeWidgetItem(featuresTree_, {QStringLiteral("Future face / edge / solid ids"), QStringLiteral("OCCT XDE")});
  new QTreeWidgetItem(operationsTree_, {QStringLiteral("Deterministic operation authority"), QStringLiteral("@cam/engine")});
  new QTreeWidgetItem(operationsTree_, {QStringLiteral("Preview/path sync"), QStringLiteral("@cam/model")});
  new QTreeWidgetItem(toolsTree_, {QStringLiteral("Tool library bridge"), QStringLiteral("shared schemas")});

  warningsView_->setPlainText(
    QStringLiteral("1. This shell is real Qt Widgets code.\n"
                   "2. STEP viewing remains foundational until Open CASCADE loading and AIS selection wiring are connected.\n"
                   "3. Deterministic planning authority remains in the existing TypeScript engine."));
  checklistView_->setPlainText(
    QStringLiteral("- Open or save local project files\n"
                   "- Import STEP and DXF paths into the document shell\n"
                   "- Attach a native-workbench-v1 bridge snapshot\n"
                   "- Review warnings, AI review, and metadata in dock tabs"));
  aiReviewView_->setPlainText(
    QStringLiteral("AI review stays advisory only. The native shell is expected to display structured review output from the existing companion pipeline instead of creating manufacturing authority."));
  metadataView_->setPlainText(
    QStringLiteral("schemaVersion: %1\nprojectFile: %2\nbridgeSnapshotPath: %3\nstep: %4\ndxf: %5")
      .arg(currentProject_.schemaVersion)
      .arg(currentProject_.projectFilePath)
      .arg(currentProject_.bridgeSnapshotPath)
      .arg(currentProject_.lastImportedStepPath)
      .arg(currentProject_.lastImportedDxfPath));
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
        currentProject_.dirty = true;
        logMessage(QStringLiteral("Started a new desktop CAM project shell."));
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
          logMessage(QStringLiteral("Saved project shell: %1").arg(filePath));
        }
        break;
      }
      case CommandId::SaveProjectAs: {
        const auto filePath = ProjectFileService::promptSaveProject(this, currentProject_.projectFilePath);
        if (!filePath.isEmpty()) {
          ProjectFileService::save(currentProject_, filePath);
          pushRecentFile(filePath);
          logMessage(QStringLiteral("Saved project shell as: %1").arg(filePath));
        }
        break;
      }
      case CommandId::ImportStep: {
        const auto filePath = ProjectFileService::promptImportStep(this);
        if (!filePath.isEmpty()) {
          currentProject_.lastImportedStepPath = filePath;
          currentProject_.dirty = true;
          viewport_->setSelectionStatus(QStringLiteral("Selection sync ready for future STEP faces / solids once OCCT mapping is connected."));
          logMessage(QStringLiteral("Registered STEP source for future OCCT loading: %1").arg(filePath));
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
        break;
      case CommandId::TopView:
        viewport_->setViewerModeLabel(QStringLiteral("top / wireframe"));
        logMessage(QStringLiteral("Viewport command routed: top view."));
        break;
      case CommandId::FrontView:
        viewport_->setViewerModeLabel(QStringLiteral("front / shaded"));
        logMessage(QStringLiteral("Viewport command routed: front view."));
        break;
      case CommandId::IsometricView:
        viewport_->setViewerModeLabel(QStringLiteral("isometric / shaded"));
        logMessage(QStringLiteral("Viewport command routed: isometric view."));
        break;
    }
  } catch (const std::exception& error) {
    QMessageBox::critical(this, QStringLiteral("Desktop workbench command failed"), QString::fromUtf8(error.what()));
  }

  syncUiToDocument();
}

void CamWorkbenchMainWindow::openProjectFile(const QString& filePath) {
  currentProject_ = ProjectFileService::load(filePath);
  pushRecentFile(filePath);
  logMessage(QStringLiteral("Opened project shell: %1").arg(filePath));
  syncUiToDocument();
}
