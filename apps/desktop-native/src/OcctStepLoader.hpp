#pragma once

#include <QList>
#include <QString>
#include <QStringList>

struct NativeStepTreeNode {
  QString id;
  QString parentId;
  QString label;
  QString persistentId;
  QString entityType;
};

struct NativeStepLoadResult {
  QString status;
  QString sourcePath;
  QString statusMessage;
  QStringList warnings;
  QStringList prerequisites;
  QList<NativeStepTreeNode> nodes;
  int freeShapeCount = 0;
  bool occtAvailable = false;
  bool xdeDocumentLoaded = false;
  bool viewerRuntimeReady = false;
};

class OcctStepLoader {
public:
  static NativeStepLoadResult describeAvailability();
  static NativeStepLoadResult loadStepDocument(const QString& filePath);
};
