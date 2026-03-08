#include "CamWorkbenchMainWindow.hpp"

#include <QApplication>
#include <QFile>
#include <QIcon>

int main(int argc, char* argv[]) {
  QApplication application(argc, argv);
  QApplication::setApplicationName(QStringLiteral("CAM System Native Workbench"));
  QApplication::setOrganizationName(QStringLiteral("CamSystem"));

  const auto iconPath = QStringLiteral(":/app-icon-placeholder.svg");
  if (QFile::exists(iconPath)) {
    application.setWindowIcon(QIcon(iconPath));
  }

  CamWorkbenchMainWindow window;
  window.show();
  return application.exec();
}
