#pragma once

#include <QString>
#include <QJsonObject>

struct WorkbenchProjectDocument {
  QString schemaVersion = QStringLiteral("cam-desktop-project-v1");
  QString projectId;
  QString displayName = QStringLiteral("Untitled CAM project");
  QString projectFilePath;
  QString bridgeSnapshotPath;
  QString lastImportedStepPath;
  QString lastImportedDxfPath;
  QString notes;
  QJsonObject metadata;
  bool dirty = false;

  [[nodiscard]] QString title() const;
};
