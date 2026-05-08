Set objShell = CreateObject("WScript.Shell")

Dim baseDir
baseDir = "C:\Users\mihak\My Drive\Dokumenti\Antigravity\Racunovodstvo"

' Zaženi strežnik prek BAT skripte (cmd nastavi imenik + skrit zagon)
objShell.Run "cmd /c """ & baseDir & "\start_server.bat""", 0, False

' Počakaj 3 sekunde, da se strežnik naloži
WScript.Sleep 3000
objShell.Run "http://127.0.0.1:8000"

Set objShell = Nothing
