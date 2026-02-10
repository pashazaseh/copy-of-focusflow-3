const { exec } = require('child_process');
const os = require('os');

/**
 * Toggles the system "Do Not Disturb" mode.
 * @param {boolean} enable - Whether to enable DND.
 */
function setDoNotDisturb(enable) {
  const platform = os.platform();

  if (platform === 'darwin') {
    // macOS: Use Shortcuts CLI (macOS 12+)
    // "Turn Do Not Disturb On" and "Turn Do Not Disturb Off" are standard actions.
    const action = enable ? 'Turn Do Not Disturb On' : 'Turn Do Not Disturb Off';
    exec(`shortcuts run "${action}"`, (error) => {
      if (error) {
        try {
          console.error(`Failed to toggle DND (macOS): ${error.message}`);
        } catch (e) {
          // Ignore EPIPE errors if stdout/stderr is closed
        }
      }
    });
  } else if (platform === 'win32') {
    // Windows: Toggle global toast notifications via Registry
    // 0 = Notifications Disabled (DND On)
    // 1 = Notifications Enabled (DND Off)
    const val = enable ? 0 : 1;
    const psCommand = `Set-ItemProperty -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Notifications\\Settings" -Name "NOC_GLOBAL_SETTING_TOASTS_ENABLED" -Value ${val}`;
    
    exec(`powershell -NoProfile -Command "${psCommand}"`, (error) => {
      if (error) {
        try {
          console.error(`Failed to toggle DND (Windows): ${error.message}`);
        } catch (e) {
          // Ignore EPIPE
        }
      }
    });
  }
}

module.exports = { setDoNotDisturb };