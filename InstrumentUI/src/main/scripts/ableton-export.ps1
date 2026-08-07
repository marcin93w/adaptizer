# Renders the currently open Ableton Live set to a .wav file by driving the
# "Export Audio/Video" dialog, the same way the Python instrument does with pywinauto.
param (
  [Parameter(Mandatory = $true)][string]$OutputFile
)

$ErrorActionPreference = "Stop"

# The UI shows only the tagged message, so the PowerShell error trace stays out of it
trap {
  [Console]::Error.WriteLine("ADAPTIZER_ERROR: " + $_.Exception.Message)
  exit 1
}

Add-Type -AssemblyName System.Windows.Forms

Add-Type @"
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;

public static class NativeWindows {
  private delegate bool EnumProc(IntPtr handle, IntPtr param);

  [DllImport("user32.dll")] private static extern bool EnumWindows(EnumProc callback, IntPtr param);
  [DllImport("user32.dll")] private static extern bool EnumChildWindows(IntPtr parent, EnumProc callback, IntPtr param);
  [DllImport("user32.dll")] private static extern int GetWindowText(IntPtr handle, StringBuilder text, int maxLength);
  [DllImport("user32.dll")] private static extern int GetClassName(IntPtr handle, StringBuilder text, int maxLength);
  [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr handle, out uint processId);
  [DllImport("user32.dll")] private static extern bool IsWindowVisible(IntPtr handle);
  [DllImport("user32.dll")] private static extern bool IsIconic(IntPtr handle);
  [DllImport("user32.dll")] private static extern int GetDlgCtrlID(IntPtr handle);
  [DllImport("user32.dll")] private static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] private static extern bool SetForegroundWindow(IntPtr handle);
  [DllImport("user32.dll")] private static extern bool BringWindowToTop(IntPtr handle);
  [DllImport("user32.dll")] private static extern bool ShowWindow(IntPtr handle, int command);
  [DllImport("user32.dll")] private static extern bool AttachThreadInput(uint attach, uint attachTo, bool doAttach);
  [DllImport("kernel32.dll")] private static extern uint GetCurrentThreadId();
  [DllImport("user32.dll")] private static extern void keybd_event(byte key, byte scan, uint flags, UIntPtr extraInfo);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern IntPtr SendMessage(IntPtr handle, uint message, IntPtr wParam, string lParam);
  [DllImport("user32.dll")] private static extern IntPtr SendMessage(IntPtr handle, uint message, IntPtr wParam, IntPtr lParam);

  private const uint WM_SETTEXT = 0x000C;
  private const uint BM_CLICK = 0x00F5;
  private const byte VK_MENU = 0x12;
  private const uint KEYEVENTF_KEYUP = 0x0002;
  private const int SW_RESTORE = 9;

  public static string GetTitle(IntPtr handle) {
    var text = new StringBuilder(512);
    GetWindowText(handle, text, text.Capacity);
    return text.ToString();
  }

  public static string GetClass(IntPtr handle) {
    var text = new StringBuilder(512);
    GetClassName(handle, text, text.Capacity);
    return text.ToString();
  }

  public static uint GetProcessId(IntPtr handle) {
    uint processId;
    GetWindowThreadProcessId(handle, out processId);
    return processId;
  }

  public static List<IntPtr> GetTopLevelWindows(uint processId) {
    var windows = new List<IntPtr>();
    EnumWindows((handle, param) => {
      if (IsWindowVisible(handle) && (processId == 0 || GetProcessId(handle) == processId)) {
        windows.Add(handle);
      }
      return true;
    }, IntPtr.Zero);
    return windows;
  }

  public static IntPtr FindChild(IntPtr parent, string className, int controlId) {
    IntPtr found = IntPtr.Zero;
    EnumChildWindows(parent, (handle, param) => {
      if (found == IntPtr.Zero && IsWindowVisible(handle)
          && GetClass(handle) == className && GetDlgCtrlID(handle) == controlId) {
        found = handle;
      }
      return true;
    }, IntPtr.Zero);
    return found;
  }

  public static bool IsInForeground(IntPtr handle) {
    return GetForegroundWindow() == handle;
  }

  public static bool Focus(IntPtr handle) {
    if (GetForegroundWindow() == handle) {
      return true;
    }
    if (IsIconic(handle)) {
      ShowWindow(handle, SW_RESTORE);
    }
    uint foregroundProcessId;
    uint foregroundThread = GetWindowThreadProcessId(GetForegroundWindow(), out foregroundProcessId);
    uint currentThread = GetCurrentThreadId();
    // Pressing ALT lifts the foreground lock, so SetForegroundWindow is not ignored
    keybd_event(VK_MENU, 0, 0, UIntPtr.Zero);
    keybd_event(VK_MENU, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
    AttachThreadInput(currentThread, foregroundThread, true);
    BringWindowToTop(handle);
    bool result = SetForegroundWindow(handle);
    AttachThreadInput(currentThread, foregroundThread, false);
    return result;
  }

  public static void SetText(IntPtr handle, string text) {
    SendMessage(handle, WM_SETTEXT, IntPtr.Zero, text);
  }

  public static void Click(IntPtr handle) {
    SendMessage(handle, BM_CLICK, IntPtr.Zero, IntPtr.Zero);
  }
}
"@

function Get-AbletonProcessId {
  $process = Get-Process -Name "Ableton Live*" -ErrorAction SilentlyContinue |
    Where-Object { $_.MainWindowHandle -ne [IntPtr]::Zero } |
    Select-Object -First 1

  if (-not $process) {
    $process = Get-Process | Where-Object { $_.MainWindowTitle -match "Ableton Live" } | Select-Object -First 1
  }

  if (-not $process) {
    throw "Could not connect to Ableton Live. Please make sure that Ableton Live is running, a project is open and the Ableton window is not minimized."
  }
  return [uint32]$process.Id
}

function Set-ActiveWindow {
  param ([IntPtr]$Handle, [string]$Description)

  # Keys are sent to whatever window is active, so never send them blindly
  for ($attempt = 0; $attempt -lt 5; $attempt++) {
    [void][NativeWindows]::Focus($Handle)
    Start-Sleep -Milliseconds 500
    if ([NativeWindows]::IsInForeground($Handle)) {
      return
    }
  }

  throw "Could not bring the $Description to the front. Please make sure Ableton Live is not busy and no other window is blocking it."
}

function Wait-ForWindow {
  param ([uint32]$ProcessId, [string]$TitlePattern, [string]$ClassName, [int]$TimeoutSeconds = 15)

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  do {
    foreach ($window in [NativeWindows]::GetTopLevelWindows($ProcessId)) {
      if ([NativeWindows]::GetTitle($window) -match $TitlePattern -and
          (-not $ClassName -or [NativeWindows]::GetClass($window) -eq $ClassName)) {
        return $window
      }
    }
    Start-Sleep -Milliseconds 200
  } while ((Get-Date) -lt $deadline)

  return [IntPtr]::Zero
}

$abletonProcessId = Get-AbletonProcessId

$mainWindow = Wait-ForWindow -ProcessId $abletonProcessId -TitlePattern " - Ableton Live" -TimeoutSeconds 5
if ($mainWindow -eq [IntPtr]::Zero) {
  throw "Could not find the Ableton Live window. Please make sure a project is open and the window is not minimized."
}

Set-ActiveWindow -Handle $mainWindow -Description "Ableton Live window"

# Ctrl+Shift+R opens the Export Audio/Video dialog
[System.Windows.Forms.SendKeys]::SendWait("^+r")

$exportDialog = Wait-ForWindow -ProcessId $abletonProcessId -TitlePattern "^Export Audio/Video$" -TimeoutSeconds 15
if ($exportDialog -eq [IntPtr]::Zero) {
  throw "The Export Audio/Video dialog did not open. Please make sure Ableton Live is responsive and not busy."
}

Set-ActiveWindow -Handle $exportDialog -Description "Export Audio/Video dialog"
# Accept the export settings that are configured in Ableton
[System.Windows.Forms.SendKeys]::SendWait("{ENTER}")

$saveDialog = Wait-ForWindow -ProcessId $abletonProcessId -TitlePattern "^Save Audio File As" -ClassName "#32770" -TimeoutSeconds 20
if ($saveDialog -eq [IntPtr]::Zero) {
  throw "The Save Audio File As dialog did not open."
}

$fileNameField = [NativeWindows]::FindChild($saveDialog, "Edit", 1001)
if ($fileNameField -eq [IntPtr]::Zero) {
  throw "Could not find the file name field in the Save Audio File As dialog."
}
[NativeWindows]::SetText($fileNameField, $OutputFile)
Start-Sleep -Milliseconds 300

$saveButton = [NativeWindows]::FindChild($saveDialog, "Button", 1)
if ($saveButton -eq [IntPtr]::Zero) {
  throw "Could not find the Save button in the Save Audio File As dialog."
}
[NativeWindows]::Click($saveButton)

# Confirm overwriting when the file is already there from a previous export
$overwriteDialog = Wait-ForWindow -ProcessId $abletonProcessId -TitlePattern "^Confirm Save As$" -ClassName "#32770" -TimeoutSeconds 2
if ($overwriteDialog -ne [IntPtr]::Zero) {
  $yesButton = [NativeWindows]::FindChild($overwriteDialog, "Button", 6)
  if ($yesButton -ne [IntPtr]::Zero) {
    [NativeWindows]::Click($yesButton)
  }
}

Write-Output "Rendering $OutputFile"
