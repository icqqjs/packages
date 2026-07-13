import { execFile } from "node:child_process";
import os from "node:os";

const platform = os.platform();

export interface NotifyOptions {
  title: string;
  body: string;
  subtitle?: string;
  sound?: boolean;
}

/**
 * Send a native OS notification. Fails silently if the notification tool is unavailable.
 */
export function sendNotification(opts: NotifyOptions): void {
  switch (platform) {
    case "darwin":
      notifyMacOS(opts);
      break;
    case "linux":
      notifyLinux(opts);
      break;
    case "win32":
      notifyWindows(opts);
      break;
    default:
      // Unsupported platform — silently skip
      break;
  }
}

function notifyMacOS({ title, body, subtitle, sound }: NotifyOptions) {
  // Use osascript — available on all macOS without extra installs
  let script = `display notification ${escapeAppleScript(body)} with title ${escapeAppleScript(title)}`;
  if (subtitle) {
    script += ` subtitle ${escapeAppleScript(subtitle)}`;
  }
  if (sound !== false) {
    script += ` sound name "default"`;
  }
  execFile("osascript", ["-e", script], silentCallback);
}

function notifyLinux({ title, body, subtitle }: NotifyOptions) {
  // notify-send from libnotify — available on most Linux desktops
  const fullBody = subtitle ? `<b>${escapeXml(subtitle)}</b>\n${escapeXml(body)}` : escapeXml(body);
  execFile("notify-send", [title, fullBody, "--app-name=icqq"], silentCallback);
}

function notifyWindows({ title, body, subtitle }: NotifyOptions) {
  // PowerShell toast notification — works on Windows 10+
  const line2 = subtitle ? escapeXml(subtitle) : "";
  const line3 = escapeXml(body);
  const ps = `
    [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
    [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom, ContentType = WindowsRuntime] | Out-Null
    $xml = @"
    <toast>
      <visual>
        <binding template="ToastGeneric">
          <text>${escapeXml(title)}</text>
          <text>${line2}</text>
          <text>${line3}</text>
        </binding>
      </visual>
    </toast>
"@
    $doc = New-Object Windows.Data.Xml.Dom.XmlDocument
    $doc.LoadXml($xml)
    $toast = [Windows.UI.Notifications.ToastNotification]::new($doc)
    [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("icqq").Show($toast)
  `.trim();
  execFile("powershell", ["-NoProfile", "-NonInteractive", "-Command", ps], silentCallback);
}

function escapeAppleScript(str: string): string {
  return `"${str.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r")}"`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function silentCallback(err: Error | null) {
  if (err) {
    // Notification failed — not critical, just log to daemon output
    console.error(`[notify] ${err.message}`);
  }
}
