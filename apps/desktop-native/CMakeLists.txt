cmake_minimum_required(VERSION 3.24)
project(CamDesktopNative VERSION 0.1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_AUTOMOC ON)
set(CMAKE_AUTOUIC ON)
set(CMAKE_AUTORCC ON)

find_package(Qt6 6.5 REQUIRED COMPONENTS Widgets)
find_package(OpenCASCADE CONFIG QUIET)

qt_standard_project_setup()

qt_add_executable(cam_desktop_native
  src/main.cpp
  src/CamWorkbenchMainWindow.cpp
  src/NativeWorkbenchSnapshot.cpp
  src/OcctStepLoader.cpp
  src/ViewportFoundationWidget.cpp
  src/ProjectFileService.cpp
  src/resources.qrc
)

target_include_directories(cam_desktop_native PRIVATE src)
target_link_libraries(cam_desktop_native PRIVATE Qt6::Widgets)

if(OpenCASCADE_FOUND)
  target_compile_definitions(cam_desktop_native PRIVATE CAM_DESKTOP_HAS_OCCT=1)
  if(DEFINED OpenCASCADE_INCLUDE_DIR)
    target_include_directories(cam_desktop_native PRIVATE ${OpenCASCADE_INCLUDE_DIR})
  endif()
  if(DEFINED OpenCASCADE_LIBRARIES)
    target_link_libraries(cam_desktop_native PRIVATE ${OpenCASCADE_LIBRARIES})
  else()
    foreach(occt_target IN ITEMS TKernel TKMath TKG2d TKG3d TKBRep TKGeomBase TKGeomAlgo TKTopAlgo TKXSBase TKCAF TKXCAF TKCDF TKLCAF TKVCAF TKDESTEP TKService TKV3d TKOpenGl)
      if(TARGET OpenCASCADE::${occt_target})
        target_link_libraries(cam_desktop_native PRIVATE OpenCASCADE::${occt_target})
      endif()
    endforeach()
  endif()
endif()

if(WIN32)
  set_target_properties(cam_desktop_native PROPERTIES WIN32_EXECUTABLE TRUE)
endif()
