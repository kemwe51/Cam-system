#pragma once

#include "NativeWorkbenchSnapshot.hpp"
#include "OcctStepLoader.hpp"
#include "WorkbenchProjectDocument.hpp"

#include <QHash>
#include <QKeySequence>
#include <QMainWindow>
#include <QList>
#include <QStringList>
#include <optional>

class QAction;
class QMenu;
class QTabWidget;
class QTableWidget;
class QTextEdit;
class QTreeWidgetItem;
class QTreeWidget;
class ViewportFoundationWidget;

class CamWorkbenchMainWindow final : public QMainWindow {
  Q_OBJECT

public:
  explicit CamWorkbenchMainWindow(QWidget* parent = nullptr);

private:
  enum class CommandId {
    NewProject,
    OpenProject,
    SaveProject,
    SaveProjectAs,
    AttachBridgeSnapshot,
    ReloadBridgeSnapshot,
    ImportStep,
    ImportDxf,
    FitView,
    TopView,
    FrontView,
    IsometricView,
    HideSelection,
    ShowAll,
    IsolateSelection,
  };

  void setupActions();
  void setupMenuBar();
  void setupToolBar();
  void setupCentralWorkspace();
  void setupDocks();
  void loadRecentFiles();
  void pushRecentFile(const QString& filePath);
  void refreshRecentFilesMenu();
  void syncUiToDocument();
  void rebuildTreeViews();
  void refreshInspectorForSelection(const QString& nodeId, const QString& sourcePanel);
  void refreshInspectorForStepSelection(QTreeWidgetItem* item, const QString& sourcePanel);
  void refreshReviewPanels();
  void refreshMetadataPanel();
  void refreshViewportSummary();
  void handleTreeSelectionChanged(QTreeWidget* tree, const QString& sourcePanel);
  void applySelectionLink(const NativeWorkbenchSelectionLink& link, QTreeWidget* sourceTree);
  void clearTreeSelections(QTreeWidget* sourceTree);
  void applyVisibilityCommand(CommandId commandId);
  void setTreeSelection(QTreeWidget* tree, const QString& nodeId);
  void addSnapshotNodesToTree(QTreeWidget* tree, const QList<NativeWorkbenchNode>& nodes, int labelColumn, int detailColumn);
  void populateStepTree();
  void loadBridgeSnapshotFromFile(const QString& filePath);
  void loadStepFile(const QString& filePath);
  [[nodiscard]] QTreeWidget* activeTree() const;
  [[nodiscard]] QString selectedNodeId(QTreeWidget* tree) const;
  void logMessage(const QString& message);
  void dispatchCommand(CommandId commandId);
  void openProjectFile(const QString& filePath);
  [[nodiscard]] QAction* createAction(CommandId commandId, const QString& text, const QKeySequence& shortcut = {});
  [[nodiscard]] QAction* action(CommandId commandId) const;

  WorkbenchProjectDocument currentProject_;
  std::optional<NativeWorkbenchSnapshot> currentSnapshot_;
  NativeStepLoadResult currentStepLoad_;
  ViewportFoundationWidget* viewport_ = nullptr;
  QTabWidget* centerTabs_ = nullptr;
  QTreeWidget* modelTree_ = nullptr;
  QTreeWidget* featuresTree_ = nullptr;
  QTreeWidget* operationsTree_ = nullptr;
  QTreeWidget* toolsTree_ = nullptr;
  QTreeWidget* toolpathsTree_ = nullptr;
  QTableWidget* inspectorTable_ = nullptr;
  QTextEdit* warningsView_ = nullptr;
  QTextEdit* checklistView_ = nullptr;
  QTextEdit* aiReviewView_ = nullptr;
  QTextEdit* logsView_ = nullptr;
  QTextEdit* metadataView_ = nullptr;
  QMenu* recentFilesMenu_ = nullptr;
  QList<QString> recentFiles_;
  QHash<int, QAction*> actionsByCommand_;
  QStringList hiddenNodeIds_;
};
