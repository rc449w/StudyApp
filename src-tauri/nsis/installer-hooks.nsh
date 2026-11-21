!macro NSIS_HOOK_POSTINSTALL
  ; Create Desktop shortcut for StudyWise AI on Windows
  CreateShortcut "$DESKTOP\StudyWise AI.lnk" "$INSTDIR\StudyWise AI.exe" "" "$INSTDIR\StudyWise AI.exe" 0
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  ; Clean up Desktop shortcut on uninstall
  Delete "$DESKTOP\StudyWise AI.lnk"
!macroend
