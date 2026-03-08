#pragma once

#include "WorkbenchProjectDocument.hpp"

class QWidget;
class QString;

class ProjectFileService {
public:
  static WorkbenchProjectDocument createEmpty();
  static WorkbenchProjectDocument load(const QString& filePath);
  static void save(WorkbenchProjectDocument& document, const QString& filePath);
  static QString promptOpenProject(QWidget* parent);
  static QString promptSaveProject(QWidget* parent, const QString& currentPath = {});
  static QString promptImportStep(QWidget* parent);
  static QString promptImportDxf(QWidget* parent);
};
