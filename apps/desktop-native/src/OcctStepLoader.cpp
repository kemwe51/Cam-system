#include "OcctStepLoader.hpp"

#include <QFileInfo>

#ifdef CAM_DESKTOP_HAS_OCCT
#include <IFSelect_ReturnStatus.hxx>
#include <STEPCAFControl_Reader.hxx>
#include <TCollection_AsciiString.hxx>
#include <TCollection_ExtendedString.hxx>
#include <TDataStd_Name.hxx>
#include <TDF_LabelSequence.hxx>
#include <TDF_Tool.hxx>
#include <TDocStd_Document.hxx>
#include <XCAFApp_Application.hxx>
#include <XCAFDoc_DocumentTool.hxx>
#include <XCAFDoc_ShapeTool.hxx>
#endif

namespace {

NativeStepLoadResult unavailableResult(const QString& sourcePath = {}) {
  NativeStepLoadResult result;
  result.status = QStringLiteral("prerequisites_missing");
  result.sourcePath = sourcePath;
  result.statusMessage = QStringLiteral("Open CASCADE was not available at configure time. STEP/XDE loading boundaries are compiled, but runtime loading requires a local OCCT-enabled Windows build.");
  result.prerequisites = {
    QStringLiteral("Qt 6.5+ Widgets build configured through CMake"),
    QStringLiteral("Open CASCADE CMake package available in CMAKE_PREFIX_PATH"),
    QStringLiteral("MSVC 2022 or another C++20-capable compiler"),
  };
  return result;
}

#ifdef CAM_DESKTOP_HAS_OCCT
QString labelName(const TDF_Label& label) {
  Handle(TDataStd_Name) nameAttribute;
  if (label.FindAttribute(TDataStd_Name::GetID(), nameAttribute)) {
    return QString::fromUtf16(reinterpret_cast<const char16_t*>(nameAttribute->Get().ToExtString()));
  }
  return {};
}

QString labelEntry(const TDF_Label& label) {
  TCollection_AsciiString entry;
  TDF_Tool::Entry(label, entry);
  return QString::fromLatin1(entry.ToCString());
}

QString shapeType(const Handle(XCAFDoc_ShapeTool)& shapeTool, const TDF_Label& label) {
  if (shapeTool->IsAssembly(label)) {
    return QStringLiteral("assembly");
  }
  if (shapeTool->IsComponent(label)) {
    return QStringLiteral("part");
  }
  if (shapeTool->IsSimpleShape(label)) {
    return QStringLiteral("solid");
  }
  return QStringLiteral("shape");
}

void collectShapeNodes(const Handle(XCAFDoc_ShapeTool)& shapeTool, const TDF_Label& label, const QString& parentId, QList<NativeStepTreeNode>& nodes) {
  const auto entry = labelEntry(label);
  const auto text = labelName(label);
  nodes.push_back({
    .id = QStringLiteral("step-node-%1").arg(entry),
    .parentId = parentId,
    .label = text.isEmpty() ? entry : text,
    .persistentId = entry,
    .entityType = shapeType(shapeTool, label),
  });

  TDF_LabelSequence children;
  shapeTool->GetComponents(label, children);
  const auto currentNodeId = nodes.back().id;
  for (Standard_Integer index = 1; index <= children.Length(); ++index) {
    collectShapeNodes(shapeTool, children.Value(index), currentNodeId, nodes);
  }
}
#endif

}  // namespace

NativeStepLoadResult OcctStepLoader::describeAvailability() {
#ifdef CAM_DESKTOP_HAS_OCCT
  NativeStepLoadResult result;
  result.status = QStringLiteral("ready_for_step_xde_loading");
  result.statusMessage = QStringLiteral("Open CASCADE was found. Native STEP/XDE loading is available, and viewport rendering still needs local AIS/V3d hookup for full geometry display.");
  result.occtAvailable = true;
  result.prerequisites = {
    QStringLiteral("Local OCCT runtime DLLs available next to the executable or on PATH"),
    QStringLiteral("Viewport host wiring to AIS_InteractiveContext and V3d_View"),
  };
  return result;
#else
  return unavailableResult();
#endif
}

NativeStepLoadResult OcctStepLoader::loadStepDocument(const QString& filePath) {
#ifndef CAM_DESKTOP_HAS_OCCT
  auto result = unavailableResult(filePath);
  result.warnings = {
    QStringLiteral("STEP file was selected, but this build cannot open it without OCCT."),
  };
  return result;
#else
  NativeStepLoadResult result = describeAvailability();
  result.sourcePath = filePath;
  if (!QFileInfo::exists(filePath)) {
    result.status = QStringLiteral("load_failed");
    result.statusMessage = QStringLiteral("STEP source path does not exist.");
    result.warnings = {QStringLiteral("Selected STEP file could not be found on disk.")};
    return result;
  }

  Handle(TDocStd_Document) document;
  Handle(XCAFApp_Application) application = XCAFApp_Application::GetApplication();
  application->NewDocument(TCollection_ExtendedString("MDTV-XCAF"), document);

  STEPCAFControl_Reader reader;
  reader.SetColorMode(Standard_True);
  reader.SetLayerMode(Standard_True);
  reader.SetNameMode(Standard_True);
  reader.SetPropsMode(Standard_True);

  const auto readStatus = reader.ReadFile(filePath.toUtf8().constData());
  if (readStatus != IFSelect_RetDone) {
    result.status = QStringLiteral("load_failed");
    result.statusMessage = QStringLiteral("Open CASCADE could not read the STEP file.");
    result.warnings = {
      QStringLiteral("STEPCAFControl_Reader::ReadFile did not return IFSelect_RetDone."),
    };
    return result;
  }

  if (!reader.Transfer(document)) {
    result.status = QStringLiteral("load_failed");
    result.statusMessage = QStringLiteral("STEP file parsed, but transfer into the XDE document failed.");
    result.warnings = {
      QStringLiteral("Open CASCADE did not transfer the STEP document into XDE."),
    };
    return result;
  }

  const auto shapeTool = XCAFDoc_DocumentTool::ShapeTool(document->Main());
  TDF_LabelSequence freeShapes;
  shapeTool->GetFreeShapes(freeShapes);
  result.occtAvailable = true;
  result.xdeDocumentLoaded = true;
  result.viewerRuntimeReady = false;
  result.freeShapeCount = freeShapes.Length();
  result.status = QStringLiteral("xde_loaded_metadata_only");
  result.statusMessage = QStringLiteral("STEP/XDE document loaded. Model-tree metadata is available now; viewport rendering still requires AIS/V3d display-object wiring in a local OCCT-enabled build.");
  result.warnings = {
    QStringLiteral("Topology-backed face/edge/solid selection is not wired into the viewport yet."),
    QStringLiteral("This milestone loads STEP/XDE structure and prepares selection ids without claiming finished model rendering."),
  };

  for (Standard_Integer index = 1; index <= freeShapes.Length(); ++index) {
    collectShapeNodes(shapeTool, freeShapes.Value(index), {}, result.nodes);
  }

  if (result.nodes.isEmpty()) {
    result.warnings.push_back(QStringLiteral("STEP document loaded without free shapes. Check the source model or OCCT transfer settings."));
  }

  return result;
#endif
}
