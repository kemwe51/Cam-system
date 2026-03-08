#pragma once

#include "WorkbenchProjectDocument.hpp"

#include <QMainWindow>
#include <QList>

class QAction;
class QMenu;
class QTabWidget;
class QTableWidget;
class QTextEdit;
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
    ImportStep,
    ImportDxf,
    FitView,
    TopView,
    FrontView,
    IsometricView,
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
  void logMessage(const QString& message);
  void dispatchCommand(CommandId commandId);
  void openProjectFile(const QString& filePath);

  WorkbenchProjectDocument currentProject_;
  ViewportFoundationWidget* viewport_ = nullptr;
  QTabWidget* centerTabs_ = nullptr;
  QTreeWidget* modelTree_ = nullptr;
  QTreeWidget* featuresTree_ = nullptr;
  QTreeWidget* operationsTree_ = nullptr;
  QTreeWidget* toolsTree_ = nullptr;
  QTableWidget* inspectorTable_ = nullptr;
  QTextEdit* warningsView_ = nullptr;
  QTextEdit* checklistView_ = nullptr;
  QTextEdit* aiReviewView_ = nullptr;
  QTextEdit* logsView_ = nullptr;
  QTextEdit* metadataView_ = nullptr;
  QMenu* recentFilesMenu_ = nullptr;
  QList<QString> recentFiles_;
};
